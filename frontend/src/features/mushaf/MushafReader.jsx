import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { AnimatePresence, motion } from 'framer-motion'
import { usePageCrumb } from '../../components/Breadcrumb'
import Popover from '../../components/Popover'
import { arabicNumber, useApi } from '../../lib/api'
import { useSettings } from '../settings/SettingsContext'
import { usePlayer, usePlayingAyah } from '../player/PlayerContext'
import { DataState } from './MushafLists'
import { SurahBlock } from './MushafView'
import ColorKey from './ColorKey'
import SearchBar from './SearchBar'
import { setLastRead, toggleBookmark, useBookmarks } from './reading'
import { countRules, rulesCss } from './tajweed'
import { useRules } from './useRules'

const SCALE_MIN = 0.8
const SCALE_MAX = 2.2

function RuleStyles({ rules }) {
  const { settings, dark } = useSettings()
  const css = useMemo(() => rulesCss(rules ?? [], { dark, overrides: settings.ruleColors }), [rules, dark, settings.ruleColors])
  return <style>{css}</style>
}

const tbBtn = 'grid h-9 min-w-9 place-items-center rounded-lg border border-line bg-surface px-2 text-sm hover:border-accent disabled:opacity-40'

function Toolbar({ kind, n, surahs, onListen, onListenSurah, canSurah, onOpenKey }) {
  const { settings, update } = useSettings()
  const navigate = useNavigate()
  const [searching, setSearching] = useState(false)
  const max = kind === 'surah' ? 114 : 30
  const base = kind === 'surah' ? '/mushaf/surah' : '/mushaf/juz'
  const scale = settings.quranScale
  const setScale = (v) => update({ quranScale: Math.round(Math.min(SCALE_MAX, Math.max(SCALE_MIN, v)) * 10) / 10 })
  return (
    <div className="sticky top-0 z-20 -mx-4 mb-4 border-b border-line bg-bg/95 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
      <div className="flex flex-wrap items-center gap-1.5">
        <Link to={`${base}/${n - 1}`} aria-disabled={n <= 1} className={`${tbBtn} ${n <= 1 ? 'pointer-events-none opacity-40' : ''}`} aria-label={kind === 'surah' ? 'السورة السابقة' : 'الجزء السابق'}>
          →
        </Link>
        {kind === 'surah' ? (
          <select
            aria-label="انتقل إلى سورة"
            className="h-9 max-w-44 rounded-lg border border-line bg-surface px-2 text-sm"
            value={n}
            onChange={(e) => navigate(`/mushaf/surah/${e.target.value}`)}
          >
            {(surahs ?? []).map((s) => (
              <option key={s.number} value={s.number}>
                {arabicNumber(s.number)}. {s.name}
              </option>
            ))}
          </select>
        ) : (
          <select aria-label="انتقل إلى جزء" className="h-9 rounded-lg border border-line bg-surface px-2 text-sm" value={n} onChange={(e) => navigate(`/mushaf/juz/${e.target.value}`)}>
            {Array.from({ length: 30 }, (_, i) => i + 1).map((j) => (
              <option key={j} value={j}>
                الجزء {arabicNumber(j)}
              </option>
            ))}
          </select>
        )}
        <Link to={`${base}/${n + 1}`} aria-disabled={n >= max} className={`${tbBtn} ${n >= max ? 'pointer-events-none opacity-40' : ''}`} aria-label={kind === 'surah' ? 'السورة التالية' : 'الجزء التالي'}>
          ←
        </Link>

        <span className="mx-1 hidden h-6 w-px bg-line sm:block" />
        <button type="button" className={tbBtn} onClick={() => setScale(scale - 0.1)} disabled={scale <= SCALE_MIN} aria-label="تصغير خط المصحف">
          أ−
        </button>
        <button type="button" className={tbBtn} onClick={() => setScale(scale + 0.1)} disabled={scale >= SCALE_MAX} aria-label="تكبير خط المصحف">
          أ+
        </button>
        <button
          type="button"
          className={`${tbBtn} ${settings.tajweedColors ? '' : 'opacity-60'}`}
          aria-pressed={settings.tajweedColors}
          onClick={() => update({ tajweedColors: !settings.tajweedColors })}
          title="تشغيل التلوين وإيقافه"
        >
          <span className="bg-[linear-gradient(90deg,#e67e22,#27ae60,#2471e8,#d64545)] bg-clip-text font-bold text-transparent">ألوان</span>
        </button>
        <button type="button" className={`${tbBtn} lg:hidden`} onClick={onOpenKey}>
          الفهرس
        </button>
        <button type="button" className={tbBtn} onClick={() => setSearching((s) => !s)} aria-expanded={searching} aria-label="بحث">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
        </button>

        <span className="ms-auto flex gap-1.5">
          {canSurah && (
            <button type="button" className={`${tbBtn} hidden sm:grid`} onClick={onListenSurah} title="ملف السورة كاملاً من mp3quran">
              السورة كاملة
            </button>
          )}
          <button type="button" onClick={onListen} className="flex h-9 items-center gap-1.5 rounded-lg bg-accent px-3 text-sm font-medium text-accent-ink hover:brightness-110">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M8 5v14l11-7z" />
            </svg>
            استمع
          </button>
        </span>
      </div>
      {searching && (
        <div className="mt-2">
          <SearchBar compact autoFocus onNavigate={() => setSearching(false)} />
        </div>
      )}
    </div>
  )
}

/** خيارات الآية: التشغيل والتكرار والعلامة المرجعية والنسخ. */
function AyahMenu({ target, onClose, onPlay, onRepeat, surahName, bookmarked }) {
  const [copied, setCopied] = useState(false)
  if (!target) return null
  const { surah, ayah, text } = target
  const item = 'flex w-full items-center gap-2 rounded-lg px-2 py-2 text-start hover:bg-surface-2'
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`﴿${text}﴾ [${surahName}: ${ayah}]`)
      setCopied(true)
      setTimeout(onClose, 700)
    } catch {
      setCopied(false)
    }
  }
  return (
    <Popover anchor={target.rect} onClose={onClose} label={`خيارات الآية ${ayah}`} width={250}>
      <p className="mb-1 px-2 font-semibold">
        {surahName} · الآية {arabicNumber(ayah)}
      </p>
      <button type="button" className={item} onClick={() => (onPlay(surah, ayah), onClose())}>
        ▶ تشغيل من هذه الآية
      </button>
      <button type="button" className={item} onClick={() => (onRepeat(surah, ayah), onClose())}>
        ⟲ كرّر هذه الآية حتى الإيقاف
      </button>
      <button type="button" className={item} onClick={() => (toggleBookmark({ surah, ayah, surahName }), onClose())}>
        {bookmarked ? '✕ إزالة العلامة المرجعية' : '🔖 إضافة علامة مرجعية'}
      </button>
      <button type="button" className={item} onClick={copy}>
        {copied ? '✓ نُسخت' : '⧉ نسخ الآية'}
      </button>
    </Popover>
  )
}

/** بطاقة الحكم عند الضغط على حرف ملوّن. */
function RuleCard({ target, onClose, byId, lessonFor, onFocus }) {
  const { settings, dark } = useSettings()
  if (!target) return null
  return (
    <Popover anchor={target.rect} onClose={onClose} label="حكم التجويد" width={300}>
      <ul className="space-y-3">
        {target.rules.map((id) => {
          const r = byId[id]
          if (!r) return null
          const lesson = lessonFor(id)
          const color = settings.ruleColors?.[id] ?? (dark ? r.color_dark : r.color)
          return (
            <li key={id}>
              <p className="flex items-center gap-2 font-semibold">
                <span className="size-3 rounded-full" style={{ background: color }} aria-hidden="true" />
                {r.name}
              </p>
              <p className="mt-0.5 leading-relaxed text-muted">{r.description}</p>
              <p className="mt-1.5 flex flex-wrap gap-3">
                {lesson && (
                  <Link to={`/ahkam/${lesson.section}/${lesson.id}`} className="text-accent underline-offset-4 hover:underline" onClick={onClose}>
                    درس: {lesson.title}
                  </Link>
                )}
                <button type="button" className="text-accent underline-offset-4 hover:underline" onClick={() => (onFocus(id), onClose())}>
                  أبرز مواضعه
                </button>
              </p>
            </li>
          )
        })}
      </ul>
    </Popover>
  )
}

/** مجموعات مواضع الحكم في الصفحة (المقاطع المتجاورة لموضع واحد تُعد موضعاً واحداً). */
function occurrenceGroups(root, rule) {
  if (!root || !rule) return []
  const groups = []
  let last = null
  for (const el of root.querySelectorAll(`.tj-${CSS.escape(rule)}`)) {
    if (last && last.nextSibling === el) groups.at(-1).push(el)
    else groups.push([el])
    last = el
  }
  return groups
}

function useNextSurahWithRule(rule, after) {
  const { data } = useApi(rule ? `/rules/${rule}/surahs` : null)
  if (!rule || !data) return null
  return data.find((s) => s.surah > after) ?? null
}

export default function MushafReader({ kind }) {
  const n = Number(useParams().n)
  const [params, setParams] = useSearchParams()
  const { data, loading, error } = useApi(kind === 'surah' ? `/surah/${n}` : `/juz/${n}`)
  const { data: surahs } = useApi('/surahs')
  const { data: lessonIndex } = useApi('/lessons')
  const { rules, byId, groups } = useRules()
  const { settings } = useSettings()
  const player = usePlayer()
  const playing = usePlayingAyah()
  const bookmarks = useBookmarks()
  const root = useRef(null)
  const [ruleCard, setRuleCard] = useState(null)
  const [ayahMenu, setAyahMenu] = useState(null)
  const [keyOpen, setKeyOpen] = useState(false)
  const [occurrence, setOccurrence] = useState(0)

  const focus = params.get('rule')
  const highlightAyah = Number(params.get('ayah')) || null

  const blocks = useMemo(() => {
    if (!data) return []
    if (kind === 'surah') return [{ surah: data.surah, ayahs: data.ayahs }]
    return data.surahs.map((s) => ({ surah: s, ayahs: data.ayahs.filter((a) => a.surah === s.number) }))
  }, [data, kind])
  const allAyahs = useMemo(() => blocks.flatMap((b) => b.ayahs), [blocks])
  const counts = useMemo(() => countRules(allAyahs), [allAyahs])
  const names = useMemo(() => Object.fromEntries(blocks.map((b) => [b.surah.number, b.surah.name])), [blocks])
  const bookmarkSet = useMemo(() => new Set(bookmarks.map((b) => `${b.surah}:${b.ayah}`)), [bookmarks])
  const lastSurah = blocks.at(-1)?.surah.number ?? n
  const nextWithRule = useNextSurahWithRule(focus, lastSurah)

  usePageCrumb(data ? (kind === 'surah' ? `سورة ${data.surah.name}` : `الجزء ${arabicNumber(n)}`) : null)

  const setFocus = useCallback(
    (id) => {
      const next = new URLSearchParams(params)
      if (id) next.set('rule', id)
      else next.delete('rule')
      setParams(next, { replace: true })
      setOccurrence(0)
      setKeyOpen(false)
    },
    [params, setParams],
  )

  // الانتقال إلى آية من البحث (?ayah=) أو من «أكمل القراءة» (?at=)
  useEffect(() => {
    if (!data) return
    const target = Number(params.get('ayah') || params.get('at'))
    const surah = kind === 'surah' ? n : Number(params.get('s')) || blocks[0]?.surah.number
    if (!target) {
      window.scrollTo(0, 0)
      return
    }
    requestAnimationFrame(() => {
      document.getElementById(`ayah-${surah}-${target}`)?.scrollIntoView({ block: 'center' })
    })
    // يُعاد عند تغيّر الآية المطلوبة ولو بقيت السورة نفسها (نتيجة بحث في السورة المفتوحة)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, params.get('ayah'), params.get('at')])

  // تمرير الآية الجارية في التلاوة إلى الشاشة
  useEffect(() => {
    if (!playing) return
    const el = document.getElementById(`ayah-${playing.surah}-${playing.ayah}`)
    if (!el) return
    const r = el.getBoundingClientRect()
    if (r.top < 90 || r.bottom > window.innerHeight - 140) el.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [playing?.surah, playing?.ayah]) // eslint-disable-line react-hooks/exhaustive-deps

  // حفظ آخر موضع قراءة: أول آية ظاهرة أسفل شريط الأدوات
  useEffect(() => {
    if (!data) return
    let t = null
    const save = () => {
      t = null
      const els = root.current?.querySelectorAll('.ayah') ?? []
      for (const el of els) {
        if (el.getBoundingClientRect().bottom > 110) {
          const s = Number(el.dataset.surah)
          setLastRead({ surah: s, ayah: Number(el.dataset.ayah), surahName: names[s] })
          break
        }
      }
    }
    const onScroll = () => (t ??= setTimeout(save, 500))
    window.addEventListener('scroll', onScroll, { passive: true })
    save()
    return () => {
      window.removeEventListener('scroll', onScroll)
      clearTimeout(t)
    }
  }, [data, names])

  const groupsInPage = useMemo(() => (focus ? occurrenceGroups(root.current, focus) : []), [focus, data, settings.tajweedColors]) // eslint-disable-line react-hooks/exhaustive-deps
  const step = (d) => {
    if (!groupsInPage.length) return
    const i = (occurrence + d + groupsInPage.length) % groupsInPage.length
    setOccurrence(i)
    const el = groupsInPage[i][0]
    el.scrollIntoView({ block: 'center', behavior: 'smooth' })
    el.animate?.([{ outline: '3px solid var(--gold)' }, { outline: '3px solid transparent' }], { duration: 1400 })
  }

  const lessonFor = useCallback(
    (ruleId) => (lessonIndex?.lessons ?? []).find((l) => l.rules?.includes(ruleId)) ?? null,
    [lessonIndex],
  )

  const onClick = (e) => {
    const menu = e.target.closest('[data-ayah-menu]')
    if (menu) {
      const ayahEl = menu.closest('.ayah')
      const surah = Number(ayahEl.dataset.surah)
      const ayah = Number(ayahEl.dataset.ayah)
      const a = blocks.find((b) => b.surah.number === surah)?.ayahs.find((x) => x.ayah === ayah)
      setAyahMenu({ rect: menu.getBoundingClientRect(), surah, ayah, text: a?.text ?? '' })
      return
    }
    const tj = e.target.closest('.tj')
    if (tj && settings.tajweedColors) setRuleCard({ rect: tj.getBoundingClientRect(), rules: tj.dataset.rules.split(' ') })
  }

  const queueBlocks = () => blocks.map((b) => ({ surah: b.surah.number, ayahs: b.ayahs }))
  const playFrom = (surah, ayah) => {
    // «كرّر حتى الإيقاف» مؤقت؛ التشغيل العادي يرجع إلى مرة واحدة للمقطع
    if (player.state.repeatRange === Infinity) player.setRepeat({ repeatRange: 1 })
    player.playAyahs(queueBlocks(), { surah, ayah, names })
  }
  const repeatAyah = (surah, ayah) => {
    player.setRepeat({ repeatRange: Infinity })
    player.playAyahs(queueBlocks(), { surah, ayah, from: { surah, ayah }, to: { surah, ayah }, names })
  }
  const listen = () => {
    if (!player.reciter?.ayah_url && player.reciter?.surah_url && kind === 'surah') return player.playSurah(n, names[n])
    const els = root.current?.querySelectorAll('.ayah') ?? []
    const first = [...els].find((el) => el.getBoundingClientRect().bottom > 110)
    if (first) playFrom(Number(first.dataset.surah), Number(first.dataset.ayah))
    else playFrom(blocks[0].surah.number, blocks[0].ayahs[0].ayah)
  }

  if (!data) return <DataState loading={loading} error={error} />
  const focusRule = focus ? byId[focus] : null

  const key = (
    <ColorKey
      groups={groups}
      counts={counts}
      focus={focus}
      onFocus={setFocus}
      occurrence={occurrence}
      onStep={step}
      nextSurah={
        nextWithRule && (
          <Link to={`/mushaf/surah/${nextWithRule.surah}?rule=${focus}&at=${nextWithRule.first_ayah}`} className="mt-1 block underline underline-offset-4">
            السورة التالية التي فيها الحكم: {nextWithRule.name} ({arabicNumber(nextWithRule.marks)}) ←
          </Link>
        )
      }
    />
  )

  return (
    <div>
      <RuleStyles rules={rules} />
      <Toolbar
        kind={kind}
        n={n}
        surahs={surahs}
        onListen={listen}
        onListenSurah={() => player.playSurah(n, names[n])}
        canSurah={kind === 'surah' && !!player.reciter?.surah_url}
        onOpenKey={() => setKeyOpen(true)}
      />
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_15rem] lg:gap-8">
        <div
          ref={root}
          onClick={onClick}
          data-focus={focus ?? undefined}
          className={`mushaf ${settings.tajweedColors || focus ? 'colors-on' : ''} ${settings.colorBlind ? 'cb' : ''}`}
        >
          {blocks.map((b) => (
            <SurahBlock
              key={b.surah.number}
              surah={b.surah}
              ayahs={b.ayahs}
              bismillah={data.bismillah_text}
              playing={playing}
              highlight={
                highlightAyah && (kind === 'surah' || b.surah.number === Number(params.get('s')))
                  ? { surah: b.surah.number, ayah: highlightAyah }
                  : null
              }
              bookmarks={bookmarkSet}
            />
          ))}
          <nav aria-label="السابق والتالي" className="mt-4 flex justify-between text-sm">
            {n > 1 ? (
              <Link to={`/mushaf/${kind}/${n - 1}`} className="rounded-lg border border-line bg-surface px-4 py-2 hover:border-accent">
                → {kind === 'surah' ? `سورة ${surahs?.[n - 2]?.name ?? ''}` : `الجزء ${arabicNumber(n - 1)}`}
              </Link>
            ) : (
              <span />
            )}
            {n < (kind === 'surah' ? 114 : 30) && (
              <Link to={`/mushaf/${kind}/${n + 1}`} className="rounded-lg border border-line bg-surface px-4 py-2 hover:border-accent">
                {kind === 'surah' ? `سورة ${surahs?.[n]?.name ?? ''}` : `الجزء ${arabicNumber(n + 1)}`} ←
              </Link>
            )}
          </nav>
        </div>
        <aside aria-label="فهرس الألوان" className="hidden lg:block">
          <div className="sticky top-16 max-h-[calc(100dvh-5rem)] overflow-y-auto rounded-2xl border border-line bg-surface p-4">{key}</div>
        </aside>
      </div>

      {/* الموبايل: الفهرس نافذة سفلية، وشارة الحكم المُبرز */}
      <AnimatePresence>
        {keyOpen && (
          <>
            <motion.div className="fixed inset-0 z-40 bg-black/30 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setKeyOpen(false)} />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="فهرس الألوان"
              className="fixed inset-x-0 bottom-0 z-50 max-h-[75dvh] overflow-y-auto rounded-t-3xl border-t border-line bg-surface px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-3 lg:hidden"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'tween', duration: 0.25 }}
            >
              <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-line" />
              <button type="button" onClick={() => setKeyOpen(false)} className="absolute end-4 top-3 text-muted" aria-label="إغلاق">
                ✕
              </button>
              {key}
            </motion.div>
          </>
        )}
      </AnimatePresence>
      {focusRule && (
        <button
          type="button"
          onClick={() => setKeyOpen(true)}
          className={`fixed start-3 z-30 flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-sm shadow-lg lg:hidden ${
            player.active ? 'bottom-[calc(8.4rem+env(safe-area-inset-bottom))]' : 'bottom-[calc(4.6rem+env(safe-area-inset-bottom))]'
          }`}
        >
          <span className="size-2.5 rounded-full" style={{ background: `var(--tj-${focusRule.id})` }} />
          إبراز: {focusRule.name}
        </button>
      )}

      <RuleCard target={ruleCard} onClose={() => setRuleCard(null)} byId={byId} lessonFor={lessonFor} onFocus={setFocus} />
      <AyahMenu
        target={ayahMenu}
        onClose={() => setAyahMenu(null)}
        onPlay={playFrom}
        onRepeat={repeatAyah}
        surahName={ayahMenu ? names[ayahMenu.surah] : ''}
        bookmarked={ayahMenu ? bookmarkSet.has(`${ayahMenu.surah}:${ayahMenu.ayah}`) : false}
      />
    </div>
  )
}
