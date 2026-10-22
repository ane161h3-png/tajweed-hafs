import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { SECTIONS, sectionPath } from '../../data/sections'
import { api, arabicNumber } from '../../lib/api'
import { highlightParts } from '../../lib/filter'
import { readJSON, writeJSON } from '../../lib/storage'
import { JUZ_NAMES } from '../mushaf/MushafLists'
import { Snippet } from '../mushaf/SearchBar'
import { GROUP_LABEL, buildIndex, pageResult, searchIndex } from './globalIndex'

export const SEARCH_EVENT = 'tajweed:search'
/** يفتح البحث الشامل من أي مكان (زر في الرأس، أو اختصار لوحة المفاتيح). */
export const openGlobalSearch = () => window.dispatchEvent(new Event(SEARCH_EVENT))

const RECENT_KEY = 'tajweed.recentSearches'
const MAX_RECENT = 6

// فهرس المحتوى يُبنى مرة ويُعاد استعماله دقيقة (الدروس المعدّلة تظهر عند الفتح التالي)
let cache = { at: 0, promise: null }
function loadIndex() {
  if (cache.promise && Date.now() - cache.at < 60_000) return cache.promise
  cache = {
    at: Date.now(),
    promise: (async () => {
      const [lessonIndex, letters, surahs, juz] = await Promise.all([api('/lessons'), api('/letters'), api('/surahs'), api('/juz')])
      const lessons = await Promise.all(lessonIndex.lessons.map((l) => api(`/lessons/${l.id}`).catch(() => null)))
      return buildIndex({ lessons, letters, surahs, juz, juzNames: JUZ_NAMES })
    })().catch((e) => {
      cache = { at: 0, promise: null }
      throw e
    }),
  }
  return cache.promise
}

function Hl({ text, q }) {
  return highlightParts(text, q).map((p, i) =>
    p.hit ? (
      <mark key={i} className="rounded bg-gold/30 px-0.5 text-ink">
        {p.text}
      </mark>
    ) : (
      <span key={i}>{p.text}</span>
    ),
  )
}

export default function GlobalSearch() {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const [items, setItems] = useState(null)
  const [error, setError] = useState(null)
  const [ayahs, setAyahs] = useState([])
  const [ayahKind, setAyahKind] = useState('')
  const [recent, setRecent] = useState(() => readJSON(RECENT_KEY, []))
  const navigate = useNavigate()
  const listId = useId()
  const input = useRef(null)
  const from = useRef(null)
  const list = useRef(null)

  const show = useCallback(() => {
    from.current = document.activeElement
    setQ('')
    setActive(0)
    setOpen(true)
  }, [])
  const close = useCallback(() => {
    setOpen(false)
    from.current?.focus?.()
  }, [])

  // الاختصارات: Ctrl/⌘+K يفتح ويغلق، و«/» يفتح خارج حقول الكتابة
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((o) => {
          if (!o) from.current = document.activeElement
          return !o
        })
      } else if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const t = e.target
        const typing = t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))
        if (!typing) {
          e.preventDefault()
          show()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener(SEARCH_EVENT, show)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener(SEARCH_EVENT, show)
    }
  }, [show])

  // تحميل الفهرس عند أول فتح، ومنع تمرير الصفحة خلف النافذة
  useEffect(() => {
    if (!open) return
    document.body.style.overflow = 'hidden'
    input.current?.focus()
    let alive = true
    loadIndex().then(
      (it) => alive && (setItems(it), setError(null)),
      (e) => alive && setError(e),
    )
    return () => {
      alive = false
      document.body.style.overflow = ''
    }
  }, [open])

  // آيات من المصحف (البحث النصي والمراجع مثل «البقرة 255») من الخادم أو الملفات المحلية
  useEffect(() => {
    const query = q.trim()
    if (!open || query.length < 2 || pageResult(query)) {
      setAyahs([])
      return
    }
    const ctrl = new AbortController()
    const t = setTimeout(() => {
      api(`/search?q=${encodeURIComponent(query)}&limit=8`, { signal: ctrl.signal }).then(
        (d) => (setAyahs(d.results ?? []), setAyahKind(d.kind ?? '')),
        () => {},
      )
    }, 220)
    return () => {
      clearTimeout(t)
      ctrl.abort()
    }
  }, [q, open])

  const results = useMemo(() => {
    const query = q.trim()
    if (!query) return []
    const rows = []
    const page = pageResult(query)
    if (page) rows.push(page)
    const local = items ? searchIndex(items, query) : []
    // نتائج المصحف القادمة من البحث الذكي: آيات مطابقة أو سورة/جزء مذكور بمرجعه
    const seen = new Set(local.map((r) => r.to))
    const quran = []
    for (const a of ayahs) {
      if (a.type === 'ayah') quran.push({ id: `ay-${a.surah}-${a.ayah}`, group: 'ayahs', title: `${a.surah_name} ${a.ayah}`, ayah: a, to: `/mushaf/surah/${a.surah}?ayah=${a.ayah}`, score: 0 })
      else {
        const to = a.type === 'juz' ? `/mushaf/juz/${a.juz}` : `/mushaf/surah/${a.surah}`
        if (!seen.has(to)) quran.push({ id: `rf-${to}`, group: 'surahs', title: a.type === 'juz' ? `الجزء ${a.juz}` : `سورة ${a.name}`, sub: a.type === 'juz' ? '' : a.revelation, to, score: 2 })
      }
    }
    // المرجع المكتوب صراحةً (2:255، البقرة 255) يسبق كل شيء
    const direct = ['ref', 'name_ayah'].includes(ayahKind)
    rows.push(...(direct ? quran : []), ...local, ...(direct ? [] : quran))
    return rows
  }, [q, items, ayahs, ayahKind])

  useEffect(() => setActive(0), [q])
  useEffect(() => {
    list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const remember = (query) => {
    const next = [query, ...recent.filter((x) => x !== query)].slice(0, MAX_RECENT)
    setRecent(next)
    writeJSON(RECENT_KEY, next)
  }
  const go = (r) => {
    if (q.trim()) remember(q.trim())
    setOpen(false)
    navigate(r.to)
  }
  const onKey = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      close()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && results[active]) {
      e.preventDefault()
      go(results[active])
    }
  }

  if (!open) return null
  const query = q.trim()
  let lastGroup = null

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center bg-black/55 p-3 pt-[6vh] sm:pt-[10vh]" onPointerDown={(e) => e.target === e.currentTarget && close()}>
      <div role="dialog" aria-modal="true" aria-label="البحث في البرنامج" className="flex max-h-[82dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl">
        <div className="flex items-center gap-2 border-b border-line px-3">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-muted" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            ref={input}
            type="search"
            role="combobox"
            aria-expanded={results.length > 0}
            aria-controls={listId}
            aria-activedescendant={results[active] ? `${listId}-${active}` : undefined}
            aria-autocomplete="list"
            autoComplete="off"
            enterKeyHint="go"
            spellCheck="false"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
            placeholder="ابحث في كل البرنامج: حكم، حرف، سورة، آية، صفحة…"
            className="h-14 min-w-0 flex-1 bg-transparent text-base outline-none [&::-webkit-search-cancel-button]:hidden"
          />
          {q && (
            <button type="button" onClick={() => (setQ(''), input.current?.focus())} aria-label="مسح" className="grid size-8 place-items-center rounded-lg text-muted hover:bg-surface-2">
              ✕
            </button>
          )}
          <button type="button" onClick={close} className="rounded-lg px-2 py-1 text-sm text-muted hover:bg-surface-2">
            إغلاق
          </button>
        </div>

        <div ref={list} className="min-h-0 flex-1 overflow-y-auto" aria-live="polite">
          {error && (
            <p role="alert" className="p-4 text-sm text-[var(--pen-red)]">
              تعذّر تحميل فهرس البحث: {error.message}
            </p>
          )}

          {!query && (
            <div className="space-y-4 p-4">
              <div>
                <p className="mb-2 text-xs font-semibold text-muted">اذهب إلى</p>
                <div className="flex flex-wrap gap-2">
                  {SECTIONS.map((s) => (
                    <button key={s.id} type="button" onClick={() => (setOpen(false), navigate(sectionPath(s)))} className="rounded-full border border-line px-3 py-1.5 text-sm hover:border-accent hover:bg-accent-soft">
                      {s.short ?? s.title}
                    </button>
                  ))}
                </div>
              </div>
              {recent.length > 0 && (
                <div>
                  <div className="mb-2 flex items-center justify-between text-xs font-semibold text-muted">
                    <span>عمليات بحث سابقة</span>
                    <button type="button" className="font-normal hover:text-ink" onClick={() => (setRecent([]), writeJSON(RECENT_KEY, []))}>
                      مسح
                    </button>
                  </div>
                  <ul className="flex flex-wrap gap-2">
                    {recent.map((r) => (
                      <li key={r}>
                        <button type="button" onClick={() => (setQ(r), input.current?.focus())} className="rounded-lg bg-surface-2 px-3 py-1.5 text-sm hover:bg-accent-soft">
                          ↺ {r}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="rounded-xl bg-surface-2 p-3 text-sm text-muted">
                <p className="mb-1 font-semibold text-ink">أمثلة على ما يمكنك كتابته</p>
                <ul className="space-y-0.5">
                  <li>«الإخفاء» أو «مد لازم» ← دروس الأحكام</li>
                  <li>«ض» أو «الصاد» ← الحرف ومخرجه وصفاته</li>
                  <li>«الكهف» أو «٣٦» أو «جزء عم» ← سور وأجزاء</li>
                  <li>«صفحة ٢٥٥» ← صفحة من المصحف</li>
                  <li>«البقرة ٢٥٥» أو جزء من آية ← آيات</li>
                </ul>
                <p className="mt-2 text-xs">اختصارات: Ctrl+K أو «/» للفتح، ↑↓ للتنقل، Enter للفتح، Esc للإغلاق.</p>
              </div>
            </div>
          )}

          {query && !items && !error && <p className="p-6 text-center text-muted">جارٍ تجهيز البحث…</p>}
          {query && items && results.length === 0 && (
            <div className="p-6 text-center text-muted">
              <p className="font-medium text-ink">لا نتائج لـ «{query}»</p>
              <p className="mt-1 text-sm">جرّب كلمة أقصر أو بلا تشكيل، أو اسماً آخر للحكم أو الحرف.</p>
            </div>
          )}

          {results.length > 0 && (
            <ul id={listId} role="listbox" aria-label="نتائج البحث">
              {results.map((r, i) => {
                const head = r.group !== lastGroup
                lastGroup = r.group
                return (
                  <li key={r.id} role="presentation">
                    {head && <p className="sticky top-0 z-10 bg-surface-2 px-4 py-1 text-xs font-semibold text-muted">{GROUP_LABEL[r.group]}</p>}
                    <div
                      id={`${listId}-${i}`}
                      role="option"
                      aria-selected={i === active}
                      onPointerDown={(e) => e.preventDefault()}
                      onClick={() => go(r)}
                      onMouseMove={() => i !== active && setActive(i)}
                      className={`cursor-pointer border-b border-line/60 px-4 py-2.5 ${i === active ? 'bg-accent-soft' : ''}`}
                    >
                      {r.ayah ? (
                        <>
                          <span className="font-quran block !text-lg !leading-loose">
                            <Snippet text={r.ayah.text} match={r.ayah.match} />
                          </span>
                          <span className="text-xs text-muted">
                            {r.ayah.surah_name} {arabicNumber(r.ayah.ayah)} · الجزء {arabicNumber(r.ayah.juz)}
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="block font-medium">
                            <Hl text={r.title} q={query} />
                          </span>
                          {r.sub && (
                            <span className="block text-xs text-muted">
                              <Hl text={r.sub} q={query} />
                            </span>
                          )}
                          {r.snippet && (
                            <span className="mt-0.5 block text-sm text-muted">
                              <Hl text={r.snippet} q={query} />
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
