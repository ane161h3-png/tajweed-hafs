import { useEffect, useMemo, useRef, useState } from 'react'
import { arabicNumber, useApi } from '../../lib/api'
import { listenContinuous, speechSupported } from '../../lib/speech'
import { readJSON, writeJSON } from '../../lib/storage'
import { Tracker, heardWords, surahWords } from '../../lib/tasmee'
import { DataState } from '../mushaf/MushafLists'
import { usePlayer } from '../player/PlayerContext'
import { itemUrl } from '../player/queue'
import { MicIcon } from './Recite'

const HISTORY_KEY = 'tajweed.tasmee'
const card = 'rounded-2xl border border-line bg-surface p-4'
const field = 'rounded-lg border border-line bg-bg px-3 py-2'

/** نغمة تنبيه قصيرة (نازلة) واهتزاز. */
function alertSound() {
  navigator.vibrate?.([120, 60, 120])
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const tone = (freq, at, dur) => {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.frequency.value = freq
      g.gain.setValueAtTime(0.0001, ctx.currentTime + at)
      g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + at + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + dur)
      o.connect(g).connect(ctx.destination)
      o.start(ctx.currentTime + at)
      o.stop(ctx.currentTime + at + dur + 0.05)
    }
    tone(880, 0, 0.18)
    tone(523, 0.2, 0.3)
    setTimeout(() => ctx.close(), 1000)
  } catch {
    /* لا صوت في هذا المتصفح */
  }
}

export function TasmeePage() {
  const { data: surahs, loading, error } = useApi('/surahs')
  const [surah, setSurah] = useState(1)
  const [from, setFrom] = useState(1)
  const [hide, setHide] = useState(false)
  const [session, setSession] = useState(null)
  const [supported, setSupported] = useState(null)
  useEffect(() => {
    speechSupported().then(setSupported)
  }, [])

  if (!surahs) return <DataState loading={loading} error={error} />
  const info = surahs.find((s) => s.number === surah)
  const history = readJSON(HISTORY_KEY, [])

  if (session) return <Session key={session.key} {...session} info={surahs.find((s) => s.number === session.surah)} onExit={() => setSession(null)} onRestart={() => setSession({ ...session, key: Date.now() })} />

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold">التسميع: اقرأ سورة</h1>
      <p className="text-muted">
        اختر سورة، ثم اضغط «ابدأ» واقرأ من حفظك أو من المصحف. يتابعك البرنامج كلمةً كلمة، فإذا أخطأت في كلمة أو نسيتها ينبّهك بصوت ويعرض لك الصواب، ثم
        تكمل القراءة من موضع الخطأ.
      </p>

      <section className={`${card} space-y-3`}>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">السورة</span>
          <select
            className={`${field} w-full`}
            value={surah}
            onChange={(e) => {
              setSurah(Number(e.target.value))
              setFrom(1)
            }}
          >
            {surahs.map((s) => (
              <option key={s.number} value={s.number}>
                {arabicNumber(s.number)}. {s.name} ({arabicNumber(s.ayah_count)} آية)
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">ابدأ من الآية</span>
          <select className={`${field} w-32`} value={from} onChange={(e) => setFrom(Number(e.target.value))}>
            {Array.from({ length: info.ayah_count }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {arabicNumber(i + 1)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={hide} onChange={(e) => setHide(e.target.checked)} className="h-5 w-5 accent-[var(--accent)]" />
          <span>إخفاء النص (للتسميع من الحفظ)</span>
        </label>
      </section>

      {supported === false ? (
        <p role="alert" className="rounded-xl bg-[var(--pen-red)]/10 p-3 text-sm text-[var(--pen-red)]">
          هذا المتصفح لا يدعم التعرّف على الكلام. استعمل Chrome على أندرويد أو الحاسوب، أو Safari على آيفون، أو تطبيق أندرويد.
        </p>
      ) : (
        <button
          type="button"
          disabled={supported === null}
          onClick={() => setSession({ surah, from, hide, key: Date.now() })}
          className="flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-lg font-semibold text-accent-ink shadow-sm hover:brightness-110 disabled:opacity-50"
        >
          <MicIcon /> ابدأ التسميع
        </button>
      )}

      <p className="text-xs text-muted">
        يحتاج إنترنت والسماح بالميكروفون. يكتشف البرنامج الكلمات الخاطئة والمنسية، ولا يقيس أحكام الأداء (المدود والغنة ونحوها)؛ لها «اقرأ بصوتك» والمعلّم.
      </p>

      {history.length > 0 && (
        <section className={card}>
          <h2 className="mb-2 font-semibold">آخر جلساتك</h2>
          <ul className="space-y-1 text-sm">
            {history.slice(0, 8).map((h) => (
              <li key={h.at} className="flex justify-between gap-2 border-t border-line pt-1 first:border-0 first:pt-0">
                <span>
                  {surahs.find((s) => s.number === h.surah)?.name} {h.from > 1 && `من الآية ${arabicNumber(h.from)}`}
                </span>
                <span className="text-muted">
                  {arabicNumber(h.read)} كلمة · {h.mistakes ? `${arabicNumber(h.mistakes)} خطأ` : 'بلا أخطاء ✓'}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function Session({ surah, from, hide, info, onExit, onRestart }) {
  const { data, loading, error } = useApi(`/surah/${surah}`)
  const { reciter } = usePlayer()
  const words = useMemo(() => {
    if (!data) return null
    const ayahs = data.ayahs.filter((a) => a.ayah >= from)
    return surahWords(ayahs, from === 1 ? data.bismillah_text : null)
  }, [data, from])
  const tracker = useRef(null)
  const listener = useRef(null)
  const [state, setState] = useState('ready') // ready | listening | mistake | done
  const [mistake, setMistake] = useState(null)
  const [problem, setProblem] = useState(null)
  const [, render] = useState(0)
  const audio = useRef(null)
  const current = useRef(null)

  if (words && !tracker.current) tracker.current = new Tracker(words)
  const t = tracker.current

  const stopListening = () => {
    listener.current?.stop()
    listener.current = null
  }
  useEffect(() => () => (stopListening(), audio.current?.pause()), [])

  const finish = () => {
    stopListening()
    setState('done')
    const read = t.status.filter((s) => s && s !== 'before').length
    if (read) writeJSON(HISTORY_KEY, [{ surah, from, at: Date.now(), read, mistakes: t.mistakes.length }, ...readJSON(HISTORY_KEY, [])].slice(0, 30))
  }

  const listen = () => {
    setProblem(null)
    setMistake(null)
    setState('listening')
    let halted = false
    listener.current = listenContinuous({
      toWords: heardWords,
      onWords: (ws) => {
        for (const w of ws) {
          if (halted) return
          const e = t.feed(w)
          if (e?.type === 'mistake') {
            halted = true
            stopListening()
            alertSound()
            setMistake(e)
            setState('mistake')
          } else if (e?.type === 'end') {
            halted = true
            finish()
          }
        }
        render((n) => n + 1)
      },
      onError: (err) => {
        setProblem(err.message)
        setState('ready')
      },
    })
  }

  const resume = () => {
    t.resume()
    listen()
  }
  const acceptWord = () => {
    // التعرّف الآلي أخطأ لا القارئ: تُقبل الكلمة ويُتابع بعدها
    t.status[t.pos] = 'tolerated'
    t.pos += 1
    if (t.done) return finish()
    resume()
  }

  // إبقاء الكلمة الحالية ظاهرة أثناء القراءة
  useEffect(() => {
    current.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [t?.pos, state])

  if (!words) return <DataState loading={loading} error={error} />

  const pos = t.pos
  const ayahOf = (i) => words[i]?.ayah
  const playAyah = (ayah) => {
    const url = itemUrl(ayah === 0 ? { kind: 'bismillah' } : { kind: 'ayah', surah, ayah }, reciter)
    if (!url) return
    audio.current?.pause()
    audio.current = new Audio(url)
    audio.current.play().catch(() => {})
  }
  const read = t.status.filter((s) => s === 'ok' || s === 'corrected' || s === 'tolerated').length

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-bold">
          تسميع سورة {info?.name}
          {from > 1 && <span className="text-base font-normal text-muted"> من الآية {arabicNumber(from)}</span>}
        </h1>
        <p className="text-sm text-muted">
          {arabicNumber(read)} من {arabicNumber(words.length)} كلمة · الأخطاء: {arabicNumber(t.mistakes.length)}
        </p>
      </div>

      <div className="sticky top-0 z-10 -mx-1 flex flex-wrap items-center gap-2 bg-bg/90 px-1 py-2 backdrop-blur">
        {state === 'ready' && (
          <button type="button" onClick={listen} className="flex items-center gap-2 rounded-full bg-accent px-6 py-3 font-semibold text-accent-ink">
            <MicIcon /> {read ? 'أكمل القراءة' : 'ابدأ القراءة'}
          </button>
        )}
        {state === 'listening' && (
          <button type="button" onClick={finish} className="flex animate-pulse items-center gap-2 rounded-full bg-[var(--pen-red)] px-6 py-3 font-semibold text-white" aria-live="polite">
            <MicIcon active /> يستمع… اضغط للإنهاء
          </button>
        )}
        {state !== 'done' && (
          <button type="button" onClick={() => (stopListening(), onExit())} className="rounded-full border border-line px-4 py-2 text-sm">
            اختر سورة أخرى
          </button>
        )}
      </div>

      {problem && (
        <p role="alert" className="rounded-xl bg-[var(--pen-red)]/10 p-3 text-sm text-[var(--pen-red)]">
          {problem}
        </p>
      )}

      {state === 'mistake' && mistake && (
        <MistakePanel
          mistake={mistake}
          words={words}
          surahName={info?.name}
          onResume={resume}
          onAccept={acceptWord}
          onListen={reciter?.ayah_url ? () => playAyah(mistake.word.ayah) : null}
        />
      )}

      {state === 'done' && <Summary t={t} words={words} read={read} onRestart={onRestart} onExit={onExit} />}

      <div className={`${card} font-quran text-2xl leading-[2.4]`} dir="rtl">
        {words.map((w, i) => {
          const s = t.status[i]
          const newAyah = i + 1 === words.length || ayahOf(i + 1) !== w.ayah
          const hidden = hide && i >= pos && state !== 'done'
          const cls =
            s === 'mistake'
              ? 'rounded bg-[var(--pen-red)]/15 text-[var(--pen-red)] underline decoration-wavy'
              : s === 'corrected'
                ? 'text-amber-600 dark:text-amber-400'
                : s === 'ok' || s === 'tolerated'
                  ? 'text-accent'
                  : i === pos
                    ? 'rounded bg-accent-soft'
                    : ''
          return (
            <span key={i}>
              <span ref={i === pos ? current : null} className={`${cls} ${hidden ? 'select-none blur-[6px]' : ''}`}>
                {w.text}
              </span>
              {newAyah && w.ayah > 0 && <span className="mx-1 text-xl text-muted">﴿{arabicNumber(w.ayah)}﴾</span>}{' '}
              {newAyah && w.ayah === 0 && <br />}
            </span>
          )
        })}
      </div>
    </div>
  )
}

function MistakePanel({ mistake, words, surahName, onResume, onAccept, onListen }) {
  const { word, kind, heard, index } = mistake
  const ayahWords = words.map((w, i) => ({ ...w, i })).filter((w) => w.ayah === word.ayah)
  return (
    <section role="alert" className="space-y-3 rounded-2xl border-2 border-[var(--pen-red)] bg-[var(--pen-red)]/5 p-4">
      <p className="text-lg font-bold text-[var(--pen-red)]">⚠️ تنبيه: {word.ayah ? `خطأ في الآية ${arabicNumber(word.ayah)} من سورة ${surahName}` : 'خطأ في البسملة'}</p>
      {kind === 'wrong' ? (
        <p>
          سُمعت: <span className="rounded bg-[var(--pen-red)]/10 px-1">«{heard}»</span>، والصواب: <span className="font-quran text-2xl text-accent">{word.text}</span>
        </p>
      ) : (
        <p>
          نسيتَ كلمة: <span className="font-quran text-2xl text-accent">{word.text}</span>
        </p>
      )}
      <p className="rounded-xl bg-surface p-3 font-quran text-xl leading-loose">
        {ayahWords.map((w) => (
          <span key={w.i} className={w.i === index ? 'rounded bg-accent-soft px-1 text-accent underline' : ''}>
            {w.text}{' '}
          </span>
        ))}
      </p>
      <p className="text-sm text-muted">أعد القراءة من الكلمة المظللة، ثم أكمل.</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={onResume} className="flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 font-semibold text-accent-ink">
          <MicIcon /> أكمل القراءة
        </button>
        {onListen && (
          <button type="button" onClick={onListen} className="rounded-full border border-accent px-4 py-2.5 text-accent">
            ▶ استمع للآية
          </button>
        )}
        <button type="button" onClick={onAccept} className="rounded-full border border-line px-4 py-2.5 text-sm text-muted" title="إن كنت قرأتها صحيحة وأخطأ التعرّف الآلي">
          قرأتها صحيحة، تابع
        </button>
      </div>
    </section>
  )
}

function Summary({ t, words, read, onRestart, onExit }) {
  const unique = [...new Map(t.mistakes.map((m) => [m.index, m])).values()]
  return (
    <section className="space-y-3 rounded-2xl border-2 border-accent bg-accent-soft/40 p-4">
      <p className="text-lg font-bold text-accent">{t.done ? 'أتممت القراءة' : 'انتهت الجلسة'} {unique.length === 0 && read ? '— بلا أخطاء، بارك الله فيك ✓' : ''}</p>
      <p className="text-sm">
        قرأت {arabicNumber(read)} من {arabicNumber(words.length)} كلمة، والأخطاء: {arabicNumber(unique.length)}.
      </p>
      {unique.length > 0 && (
        <ul className="space-y-1 text-sm">
          {unique.map((m) => (
            <li key={m.index}>
              {m.word.ayah ? `الآية ${arabicNumber(m.word.ayah)}` : 'البسملة'}: <span className="font-quran text-lg">{m.word.text}</span>{' '}
              <span className="text-muted">({m.kind === 'skip' ? 'نسيتها' : `قرأتها «${m.heard}»`})</span>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={onRestart} className="rounded-full bg-accent px-5 py-2.5 font-semibold text-accent-ink">
          أعد السورة
        </button>
        <button type="button" onClick={onExit} className="rounded-full border border-line px-4 py-2.5">
          اختر سورة أخرى
        </button>
      </div>
    </section>
  )
}
