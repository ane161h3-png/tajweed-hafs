import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { useApi } from '../../lib/api'
import { useSettings } from '../settings/SettingsContext'
import { buildAyahQueue, indexOf, initialState, itemUrl, reducer } from './queue'
import { resolveAudio } from './offline'

const PlayerContext = createContext(null)
export const DEFAULT_RECITER = 'husary-murattal'
export const RATES = [0.5, 0.75, 1, 1.25, 1.5]

/**
 * مشغّل التلاوة للتطبيق كله: يبقى يعمل عند التنقل بين الصفحات.
 * الوضع «آية»: من everyayah آية آية مع تظليل الآية الجارية والتكرار.
 * الوضع «سورة»: ملف السورة كاملاً من mp3quran.
 */
export function PlayerProvider({ children }) {
  const { settings, update } = useSettings()
  const { data: reciters } = useApi('/reciters')
  const [state, dispatch] = useReducer(reducer, initialState)
  const audio = useRef(null)
  const preload = useRef(null)
  const meta = useRef({ names: {} })
  const tokenRef = useRef(0)
  const logical = useRef(null) // الرابط الأصلي للملف الحالي (قد يكون src رابطاً محلياً)
  tokenRef.current = state.token

  const reciter = useMemo(() => {
    const list = reciters ?? []
    return list.find((r) => r.id === settings.reciter) ?? list.find((r) => r.id === DEFAULT_RECITER) ?? list[0] ?? null
  }, [reciters, settings.reciter])
  const rate = settings.playbackRate ?? 1
  const [override, setOverride] = useState(null) // تلاوة خاصة خارج قائمة القرّاء (مثل تسجيلات مكتبة المنشاوي)
  const effective = override ?? reciter
  const current = state.items[state.index] ?? null
  const active = state.status !== 'idle' || state.items.length > 0

  // عنصر صوت واحد طوال عمر التطبيق
  if (!audio.current && typeof Audio !== 'undefined') audio.current = new Audio()

  // تشغيل العنصر الحالي كلما تغيّر الفهرس أو تكرّرت الآية
  useEffect(() => {
    const el = audio.current
    if (!el || state.status !== 'playing' || !current) return
    const url = itemUrl(current, effective)
    if (!url) {
      dispatch({ type: 'status', status: 'error', error: 'لا توجد تلاوة بهذا الوضع للقارئ المختار' })
      return
    }
    const token = state.token
    // الملف المنزّل للاستماع دون إنترنت إن وُجد
    resolveAudio(url).then((src) => {
      if (tokenRef.current !== token) return // بدأ عنصر آخر أثناء الانتظار
      if (logical.current !== url || !el.src) {
        el.src = src
        logical.current = url
      } else el.currentTime = 0
      el.defaultPlaybackRate = rate
      el.playbackRate = rate
      el.play().catch((e) => {
        if (e.name !== 'AbortError') dispatch({ type: 'status', status: 'error', error: 'تعذّر تشغيل الصوت؛ تحقق من الاتصال بالإنترنت' })
      })
    })
    // تحميل التالي مسبقاً لتقليل الفجوة بين الآيات
    const next = state.items[state.index + 1]
    const nextUrl = next && itemUrl(next, effective)
    if (nextUrl) {
      preload.current = new Audio()
      preload.current.preload = 'auto'
      preload.current.src = nextUrl
    }
    if ('mediaSession' in navigator && typeof MediaMetadata !== 'undefined') {
      const name = meta.current.names[current.surah] ?? ''
      navigator.mediaSession.metadata = new MediaMetadata({
        title: current.kind === 'ayah' ? `${name} - الآية ${current.ayah}` : name,
        artist: effective?.name ?? '',
      })
    }
    // يُعاد التشغيل عند بدء عنصر جديد (token) أو تغيير القارئ، لا عند الاستئناف بعد الإيقاف المؤقت
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.token, effective])

  useEffect(() => {
    const el = audio.current
    if (!el) return
    const onEnded = () => dispatch({ type: 'ended' })
    const onError = () => el.src && dispatch({ type: 'status', status: 'error', error: 'تعذّر تحميل التلاوة؛ تحقق من الاتصال بالإنترنت' })
    el.addEventListener('ended', onEnded)
    el.addEventListener('error', onError)
    return () => {
      el.removeEventListener('ended', onEnded)
      el.removeEventListener('error', onError)
    }
  }, [])

  useEffect(() => {
    if (state.status === 'idle' || state.status === 'error') audio.current?.pause()
  }, [state.status])

  useEffect(() => {
    if (audio.current) {
      audio.current.defaultPlaybackRate = rate
      audio.current.playbackRate = rate
    }
  }, [rate])

  /** تشغيل كتل (سورة أو جزء) آية آية بدءاً من آية معيّنة. */
  const playAyahs = useCallback((blocks, { surah, ayah, from, to, names } = {}) => {
    setOverride(null)
    meta.current.names = { ...meta.current.names, ...names }
    const items = buildAyahQueue(blocks)
    const start = surah ? Math.max(0, indexOf(items, surah, ayah ?? 1)) : 0
    const f = from ? Math.max(0, indexOf(items, from.surah, from.ayah)) : start
    const t = to ? indexOf(items, to.surah, to.ayah, { withBismillah: false }) : items.length - 1
    dispatch({ type: 'load', items, start, from: f, to: t })
  }, [])

  const playSurah = useCallback((surah, name, special = null) => {
    setOverride(special)
    meta.current.names[surah] = name
    dispatch({ type: 'load', items: [{ kind: 'surah', surah, ayah: 0 }] })
  }, [])

  const pause = useCallback(() => {
    audio.current?.pause()
    dispatch({ type: 'status', status: 'paused' })
  }, [])
  const resume = useCallback(() => {
    // بعد انتهاء القائمة أو خطأ: ابدأ من أول المقطع
    if (state.status === 'idle' || state.status === 'error' || !audio.current?.src) {
      return dispatch({ type: 'jump', index: state.status === 'paused' ? state.index : state.from })
    }
    audio.current.play().then(
      () => dispatch({ type: 'status', status: 'playing' }),
      () => dispatch({ type: 'status', status: 'error', error: 'تعذّر تشغيل الصوت' }),
    )
  }, [state.index, state.status, state.from])
  const stop = useCallback(() => {
    audio.current?.pause()
    if (audio.current) audio.current.removeAttribute('src')
    logical.current = null
    dispatch({ type: 'stop' })
  }, [])

  const value = {
    state,
    current,
    surahName: current ? meta.current.names[current.surah] : null,
    active,
    reciter: effective,
    reciters: reciters ?? [],
    rate,
    audio,
    setReciter: (id) => {
      setOverride(null)
      update({ reciter: id })
    },
    setRate: (r) => update({ playbackRate: r }),
    setRepeat: (patch) => dispatch({ type: 'repeat', ...patch }),
    setRange: (from, to) => dispatch({ type: 'range', from, to }),
    next: () => dispatch({ type: 'next' }),
    prev: () => dispatch({ type: 'prev' }),
    playAyahs,
    playSurah,
    pause,
    resume,
    stop,
  }
  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>
}

export function usePlayer() {
  const ctx = useContext(PlayerContext)
  if (!ctx) throw new Error('usePlayer خارج PlayerProvider')
  return ctx
}

/** الآية الجارية الآن (لتظليلها في المصحف)، أو null */
export function usePlayingAyah() {
  const { current, state } = usePlayer()
  if (!current || current.kind !== 'ayah' || state.status === 'idle') return null
  return { surah: current.surah, ayah: current.ayah }
}
