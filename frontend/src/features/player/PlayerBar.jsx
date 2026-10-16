import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { arabicNumber } from '../../lib/api'
import { indexOf } from './queue'
import { RATES, usePlayer } from './PlayerContext'

const REPEATS = [1, 2, 3, 5, 10, Infinity]
const repeatLabel = (n) =>
  n === Infinity ? 'بلا توقف' : n === 1 ? 'مرة واحدة' : n === 2 ? 'مرتان' : `${arabicNumber(n)} مرات`

function IconButton({ label, onClick, children, disabled, primary }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`grid size-10 shrink-0 place-items-center rounded-full disabled:opacity-40 ${
        primary ? 'bg-accent text-accent-ink hover:brightness-110' : 'text-ink hover:bg-surface-2'
      }`}
    >
      {children}
    </button>
  )
}

const svg = (d) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d={d} />
  </svg>
)
const ICONS = {
  play: svg('M8 5v14l11-7z'),
  pause: svg('M7 5h4v14H7zM13 5h4v14h-4z'),
  // في الواجهة العربية «التالي» إلى اليسار
  next: svg('M18 6h-2v12h2zM14 12 4.5 6v12z'),
  prev: svg('M6 6h2v12H6zM10 12l9.5 6V6z'),
  close: svg('M6.4 5 5 6.4 10.6 12 5 17.6 6.4 19l5.6-5.6 5.6 5.6 1.4-1.4-5.6-5.6L19 6.4 17.6 5 12 10.6z'),
  tune: svg('M3 17v2h6v-2zm0-12v2h10V5zm10 16v-2h8v-2h-8v-2h-2v6zM7 9v2H3v2h4v2h2V9zm14 4v-2H11v2zm-6-4h2V7h4V5h-4V3h-2z'),
}

function Progress({ audio }) {
  const [t, setT] = useState({ cur: 0, dur: 0 })
  useEffect(() => {
    const el = audio.current
    if (!el) return
    const tick = () => setT({ cur: el.currentTime, dur: el.duration || 0 })
    el.addEventListener('timeupdate', tick)
    el.addEventListener('loadedmetadata', tick)
    return () => {
      el.removeEventListener('timeupdate', tick)
      el.removeEventListener('loadedmetadata', tick)
    }
  }, [audio])
  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
  return (
    <div className="flex items-center gap-2 text-xs tabular-nums text-muted" dir="ltr">
      <span>{fmt(t.cur)}</span>
      <input
        type="range"
        min={0}
        max={t.dur || 1}
        step={1}
        value={t.cur}
        onChange={(e) => (audio.current.currentTime = Number(e.target.value))}
        className="flex-1 accent-[var(--accent)]"
        aria-label="موضع التشغيل"
      />
      <span>{fmt(t.dur)}</span>
    </div>
  )
}

function Options({ player }) {
  const { state, current, reciters, reciter, rate, setReciter, setRate, setRepeat, setRange } = player
  const surahItems = state.items.filter((x) => x.kind === 'ayah' && x.surah === current?.surah)
  const fromItem = state.items[state.from]
  const toItem = state.items[state.to]
  const [from, setFrom] = useState(fromItem?.ayah || surahItems[0]?.ayah || 1)
  const [to, setTo] = useState(toItem?.ayah || surahItems.at(-1)?.ayah || 1)
  const isAyahMode = current?.kind !== 'surah'
  const sel = 'rounded-md border border-line bg-surface px-2 py-1.5 text-sm'
  const applyRange = (f, t) => {
    const a = Math.min(f, t)
    const b = Math.max(f, t)
    setRange(indexOf(state.items, current.surah, a), indexOf(state.items, current.surah, b, { withBismillah: false }))
  }
  return (
    <div className="grid gap-3 border-b border-line px-4 py-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
      <label className="block">
        <span className="mb-1 block text-muted">القارئ</span>
        <select className={`${sel} w-full`} value={reciter?.id ?? ''} onChange={(e) => setReciter(e.target.value)}>
          {reciters.map((r) => (
            <option key={r.id} value={r.id} disabled={isAyahMode ? !r.ayah_url : !r.surah_url}>
              {r.name} · {r.style}
              {isAyahMode && !r.ayah_url ? ' (سور كاملة فقط)' : ''}
            </option>
          ))}
        </select>
      </label>
      <div>
        <span className="mb-1 block text-muted">السرعة</span>
        <div className="flex gap-1" role="group" aria-label="سرعة التلاوة">
          {RATES.map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={rate === r}
              onClick={() => setRate(r)}
              className={`rounded-md border px-2 py-1 tabular-nums ${rate === r ? 'border-accent bg-accent-soft text-accent' : 'border-line'}`}
              dir="ltr"
            >
              {r}×
            </button>
          ))}
        </div>
      </div>
      {isAyahMode && (
        <label className="block">
          <span className="mb-1 block text-muted">تكرار كل آية</span>
          <select className={`${sel} w-full`} value={String(state.repeatAyah)} onChange={(e) => setRepeat({ repeatAyah: Number(e.target.value) })}>
            {REPEATS.map((n) => (
              <option key={n} value={String(n)}>
                {repeatLabel(n)}
              </option>
            ))}
          </select>
        </label>
      )}
      <div>
        <span className="mb-1 block text-muted">{isAyahMode ? 'تكرار مقطع' : 'تكرار السورة'}</span>
        <div className="flex flex-wrap items-center gap-1.5">
          {isAyahMode && surahItems.length > 0 && (
            <>
              <span>من</span>
              <input type="number" className={`${sel} w-16`} min={surahItems[0].ayah} max={surahItems.at(-1).ayah} value={from}
                onChange={(e) => setFrom(Number(e.target.value))} onBlur={() => applyRange(from, to)} aria-label="من الآية" />
              <span>إلى</span>
              <input type="number" className={`${sel} w-16`} min={surahItems[0].ayah} max={surahItems.at(-1).ayah} value={to}
                onChange={(e) => setTo(Number(e.target.value))} onBlur={() => applyRange(from, to)} aria-label="إلى الآية" />
            </>
          )}
          <select className={sel} value={String(state.repeatRange)} onChange={(e) => setRepeat({ repeatRange: Number(e.target.value) })} aria-label="عدد مرات تكرار المقطع">
            {REPEATS.map((n) => (
              <option key={n} value={String(n)}>
                {repeatLabel(n)}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  )
}

export default function PlayerBar() {
  const player = usePlayer()
  const { state, current, active, reciter, audio, pause, resume, stop, next, prev } = player
  const [open, setOpen] = useState(false)
  if (!active) return null
  const playing = state.status === 'playing'
  const label = !current
    ? ''
    : current.kind === 'bismillah'
      ? 'البسملة'
      : current.kind === 'surah'
        ? 'السورة كاملة'
        : `الآية ${arabicNumber(current.ayah)}`
  const repeatNote = [
    state.repeatAyah > 1 && current?.kind === 'ayah' ? `تكرار ${arabicNumber(state.ayahPass + 1)}/${state.repeatAyah === Infinity ? '∞' : arabicNumber(state.repeatAyah)}` : null,
    state.repeatRange > 1 ? `المقطع ${arabicNumber(state.rangePass + 1)}/${state.repeatRange === Infinity ? '∞' : arabicNumber(state.repeatRange)}` : null,
  ].filter(Boolean)

  return (
    <section
      aria-label="مشغّل التلاوة"
      className="fixed inset-x-0 bottom-[calc(3.9rem+env(safe-area-inset-bottom))] z-30 border-t border-line bg-surface/95 shadow-[0_-8px_24px_-16px_rgb(0_0_0/0.4)] backdrop-blur lg:bottom-0 lg:start-72"
    >
      {open && <Options key={`${current?.surah}-${state.items.length}`} player={player} />}
      <div className="mx-auto flex max-w-5xl items-center gap-1 px-3 py-2">
        <IconButton label="السابق" onClick={prev} disabled={state.index <= 0}>
          {ICONS.prev}
        </IconButton>
        <IconButton label={playing ? 'إيقاف مؤقت' : 'تشغيل'} onClick={playing ? pause : resume} primary>
          {playing ? ICONS.pause : ICONS.play}
        </IconButton>
        <IconButton label="التالي" onClick={next} disabled={state.index >= state.items.length - 1}>
          {ICONS.next}
        </IconButton>
        <div className="mx-2 min-w-0 flex-1">
          {current && (
            <Link to={`/mushaf/surah/${current.surah}${current.kind === 'ayah' ? `?at=${current.ayah}` : ''}`} className="block truncate text-sm font-medium hover:text-accent">
              {player.surahName ? `سورة ${player.surahName}` : `السورة ${arabicNumber(current.surah)}`} · {label}
            </Link>
          )}
          {state.status === 'error' ? (
            <p role="alert" className="truncate text-xs text-[var(--pen-red)]">{state.error}</p>
          ) : current?.kind === 'surah' ? (
            <Progress audio={audio} />
          ) : (
            <p className="truncate text-xs text-muted">
              {reciter?.name} · {reciter?.style}
              {repeatNote.length > 0 && ` · ${repeatNote.join(' · ')}`}
            </p>
          )}
        </div>
        <IconButton label="إعدادات التلاوة: القارئ والسرعة والتكرار" onClick={() => setOpen((o) => !o)}>
          {ICONS.tune}
        </IconButton>
        <IconButton label="إغلاق المشغّل" onClick={stop}>
          {ICONS.close}
        </IconButton>
      </div>
    </section>
  )
}
