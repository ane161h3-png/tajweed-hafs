import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import { arabicNumber } from '../../lib/api'
import { usePlayer } from '../player/PlayerContext'
import { buildSegments } from './tajweed'

/**
 * لوحة الآية: تظهر عند الضغط على أي آية في المصحف، فتعرض نصها ملوّناً، وتتيح سماعها بقارئ تختاره،
 * ومعرفة أحكامها، وفتح تحليلها الكامل (الأحكام والمخارج والصفات).
 * target: { surah, ayah, text, tajweed, surahName, juz }
 */
export default function AyahSheet({ target, rule: initialRule, onClose, hasPrev, hasNext, onNeighbor, onPlay, onRepeat, bookmarked, onBookmark, pageNo, byId, lessonFor, colorOf, onFocusRule }) {
  const player = usePlayer()
  const [rule, setRule] = useState(initialRule)
  const [copied, setCopied] = useState(false)
  const closeRef = useRef(null)
  const { surah, ayah, text, tajweed, surahName } = target

  useEffect(() => setRule(initialRule), [initialRule, surah, ayah])
  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft' && hasNext) onNeighbor(1)
      if (e.key === 'ArrowRight' && hasPrev) onNeighbor(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, onNeighbor, hasPrev, hasNext])

  const segments = useMemo(() => buildSegments(text, tajweed), [text, tajweed])
  const rules = useMemo(() => {
    const m = new Map()
    for (const t of tajweed ?? []) m.set(t.rule, (m.get(t.rule) ?? 0) + 1)
    return [...m.entries()].map(([id, n]) => ({ id, n, info: byId[id] })).filter((r) => r.info)
  }, [tajweed, byId])
  const chosen = rule ? byId[rule] : null
  const lesson = chosen ? lessonFor(chosen.id) : null

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`﴿${text}﴾ [${surahName}: ${ayah}]`)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }
  const btn = 'flex h-10 items-center justify-center gap-1.5 rounded-xl border border-line bg-surface px-3 text-sm hover:border-accent'

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-black/30" aria-hidden="true" />
      <div role="dialog" aria-label={`الآية ${ayah} من سورة ${surahName}`} className="relative max-h-[78dvh] w-full max-w-xl overflow-y-auto rounded-t-3xl border border-line bg-bg p-4 shadow-2xl sm:rounded-3xl">
        <div className="mb-2 flex items-center gap-2">
          <button type="button" aria-label="الآية السابقة" disabled={!hasPrev} onClick={() => onNeighbor(-1)} className="grid size-9 place-items-center rounded-lg border border-line disabled:opacity-30">
            →
          </button>
          <div className="min-w-0 flex-1 text-center">
            <p className="font-semibold">
              سورة {surahName} · الآية {arabicNumber(ayah)}
            </p>
            <p className="text-xs text-muted">
              {target.juz ? `الجزء ${arabicNumber(target.juz)}` : ''}
              {pageNo ? ` · الصفحة ${arabicNumber(pageNo)}` : ''}
            </p>
          </div>
          <button type="button" aria-label="الآية التالية" disabled={!hasNext} onClick={() => onNeighbor(1)} className="grid size-9 place-items-center rounded-lg border border-line disabled:opacity-30">
            ←
          </button>
          <button ref={closeRef} type="button" aria-label="إغلاق" onClick={onClose} className="grid size-9 place-items-center rounded-lg border border-line hover:bg-surface-2">
            ✕
          </button>
        </div>

        <p className="font-quran my-3 rounded-2xl bg-surface px-3 py-2 text-center !text-[1.55rem] !leading-[2.3]" dir="rtl" lang="ar">
          {segments.map((s) =>
            s.rules.length ? (
              <span key={s.start} style={{ color: colorOf(s.rules[0]) }}>
                {s.text}
              </span>
            ) : (
              <span key={s.start}>{s.text}</span>
            ),
          )}
          <span className="mx-1 text-gold">﴿{arabicNumber(ayah)}﴾</span>
        </p>

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => onPlay(surah, ayah)} className="flex h-10 items-center gap-1.5 rounded-xl bg-accent px-4 text-sm font-medium text-accent-ink hover:brightness-110">
            ▶ استمع
          </button>
          <button type="button" onClick={() => onRepeat(surah, ayah)} className={btn} title="كرّر هذه الآية حتى الإيقاف">
            ⟲ كرّر
          </button>
          {player.reciters?.length > 0 && (
            <select aria-label="اختر القارئ" value={player.reciter?.id ?? ''} onChange={(e) => player.setReciter(e.target.value)} className="h-10 min-w-0 max-w-48 flex-1 rounded-xl border border-line bg-surface px-2 text-sm">
              {player.reciters.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}{r.style ? ` — ${r.style}` : ''}
                </option>
              ))}
            </select>
          )}
        </div>

        <h3 className="mb-1 text-sm font-semibold text-muted">أحكام هذه الآية {rules.length ? `(${arabicNumber(rules.length)})` : ''}</h3>
        {rules.length === 0 ? (
          <p className="mb-3 text-sm text-muted">لا أحكام ملوّنة في هذه الآية.</p>
        ) : (
          <ul className="mb-2 flex flex-wrap gap-1.5">
            {rules.map(({ id, n, info }) => (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => setRule(rule === id ? null : id)}
                  aria-pressed={rule === id}
                  className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-sm ${rule === id ? 'border-accent bg-accent-soft' : 'border-line bg-surface hover:border-accent'}`}
                >
                  <span className="size-3 rounded-full" style={{ background: colorOf(id) }} aria-hidden="true" />
                  {info.name}
                  {n > 1 && <span className="text-xs text-muted">×{arabicNumber(n)}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
        {chosen && (
          <div className="mb-3 rounded-xl border border-line bg-surface p-3 text-sm">
            <p className="font-semibold">{chosen.name}</p>
            {chosen.description && <p className="mt-0.5 text-muted">{chosen.description}</p>}
            <div className="mt-2 flex flex-wrap gap-3">
              {lesson && (
                <Link to={`/ahkam/${lesson.section}/${lesson.id}`} className="font-medium text-accent underline-offset-4 hover:underline">
                  درس هذا الحكم ←
                </Link>
              )}
              <button type="button" onClick={() => (onFocusRule(chosen.id), onClose())} className="font-medium text-accent underline-offset-4 hover:underline">
                أبرِز هذا الحكم في الصفحة
              </button>
            </div>
          </div>
        )}

        <Link
          to={`/ayah/${surah}/${ayah}`}
          className="mb-2 flex h-12 items-center justify-center gap-2 rounded-xl bg-[var(--gold)]/90 px-4 font-semibold text-black hover:brightness-105"
        >
          🔍 تحليل الآية: الأحكام والمخارج والصفات
        </Link>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onBookmark} className={btn} aria-pressed={bookmarked}>
            {bookmarked ? '✕ إزالة العلامة' : '🔖 علامة مرجعية'}
          </button>
          <button type="button" onClick={copy} className={btn}>
            {copied ? '✓ نُسخت' : '⧉ نسخ الآية'}
          </button>
          {pageNo && (
            <Link to={`/mushaf/page/${pageNo}?s=${surah}&at=${ayah}`} className={btn}>
              📄 الصفحة {arabicNumber(pageNo)}
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
