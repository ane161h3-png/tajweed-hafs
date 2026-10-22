import { useEffect, useId, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { api, arabicNumber } from '../../lib/api'
import { parsePageQuery } from './pages'

/** وجهة كل نتيجة. */
export function resultPath(r) {
  if (r.type === 'surah') return `/mushaf/surah/${r.surah}`
  if (r.type === 'juz') return `/mushaf/juz/${r.juz}`
  if (r.type === 'page') return `/mushaf/page/${r.page}`
  return `/mushaf/surah/${r.surah}?ayah=${r.ayah}`
}

/** مقتطف من الآية حول الكلمة المطابقة مع تظليلها. */
export function Snippet({ text, match, radius = 70 }) {
  if (!match) return text.length > radius * 2 ? text.slice(0, radius * 2).replace(/\s+\S*$/, '') + ' …' : text
  let a = Math.max(0, match[0] - radius)
  let b = Math.min(text.length, match[1] + radius)
  if (a > 0) a = text.indexOf(' ', a) + 1 || a
  if (b < text.length) b = text.lastIndexOf(' ', b) > match[1] ? text.lastIndexOf(' ', b) : b
  return (
    <>
      {a > 0 && '… '}
      {text.slice(a, match[0])}
      <mark className="rounded bg-gold/30 px-0.5 text-ink">{text.slice(match[0], match[1])}</mark>
      {text.slice(match[1], b)}
      {b < text.length && ' …'}
    </>
  )
}

function ResultLine({ r }) {
  if (r.type === 'surah')
    return (
      <>
        <span className="font-medium">سورة {r.name}</span>
        <span className="text-xs text-muted">
          {r.revelation} · {arabicNumber(r.ayah_count)} آية
        </span>
      </>
    )
  if (r.type === 'page')
    return (
      <>
        <span className="font-medium">الصفحة {arabicNumber(r.page)}</span>
        <span className="text-xs text-muted">من {arabicNumber(604)} صفحة في مصحف المدينة</span>
      </>
    )
  if (r.type === 'juz')
    return (
      <>
        <span className="font-medium">الجزء {arabicNumber(r.juz)}</span>
        <span className="text-xs text-muted">
          يبدأ من {r.surah_name ? `سورة ${r.surah_name}` : `السورة ${arabicNumber(r.surah)}`} {arabicNumber(r.ayah)}
        </span>
      </>
    )
  return (
    <>
      <span className="font-quran block !text-lg !leading-loose">
        <Snippet text={r.text} match={r.match} />
      </span>
      <span className="text-xs text-muted">
        {r.surah_name} {arabicNumber(r.ayah)} · الجزء {arabicNumber(r.juz)}
      </span>
    </>
  )
}

/** يحمّل النتائج أثناء الكتابة (مع تأخير بسيط وإلغاء الطلب السابق). */
export function useSearch(q, delay = 180) {
  const [state, setState] = useState({ results: [], total: 0, loading: false, error: null, query: '' })
  useEffect(() => {
    const query = q.trim()
    if (!query) {
      setState({ results: [], total: 0, loading: false, error: null, query: '' })
      return
    }
    // «صفحة ٢٥٥» تُفهم محلياً ولا تحتاج الخادم
    const page = parsePageQuery(query)
    if (page) {
      setState({ results: [{ type: 'page', page, surah: 0 }], total: 0, loading: false, error: null, query })
      return
    }
    const ctrl = new AbortController()
    setState((s) => ({ ...s, loading: true }))
    const t = setTimeout(() => {
      api(`/search?q=${encodeURIComponent(query)}&limit=30`, { signal: ctrl.signal }).then(
        (d) => setState({ results: d.results, total: d.total_text, loading: false, error: null, query }),
        (e) => e.name !== 'AbortError' && setState({ results: [], total: 0, loading: false, error: e, query }),
      )
    }, delay)
    return () => {
      clearTimeout(t)
      ctrl.abort()
    }
  }, [q, delay])
  return state
}

export const SEARCH_HINT = 'اسم السورة، أو 2:255، أو «البقرة 255»، أو «جزء 30»، أو «صفحة 255»، أو نص من الآية'

/**
 * شريط البحث الذكي بقائمة نتائج منسدلة (combobox): الأسهم للتنقل، Enter للفتح، Escape للإغلاق.
 */
export default function SearchBar({ autoFocus = false, onNavigate, compact = false }) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const { results, loading, error, total, query } = useSearch(q)
  const navigate = useNavigate()
  const listId = useId()
  const box = useRef(null)

  useEffect(() => setActive(0), [results])
  useEffect(() => {
    const onDown = (e) => box.current && !box.current.contains(e.target) && setOpen(false)
    window.addEventListener('pointerdown', onDown)
    return () => window.removeEventListener('pointerdown', onDown)
  }, [])

  const go = (r) => {
    setOpen(false)
    setQ('')
    navigate(resultPath(r))
    onNavigate?.(r)
  }
  const onKey = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setActive((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && results[active]) {
      e.preventDefault()
      go(results[active])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }
  const showList = open && q.trim()

  return (
    <div ref={box} className="relative">
      <label className="sr-only" htmlFor={`${listId}-input`}>
        ابحث في المصحف
      </label>
      <div className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 focus-within:border-accent">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-muted" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          id={`${listId}-input`}
          type="search"
          role="combobox"
          aria-expanded={!!showList}
          aria-controls={listId}
          aria-activedescendant={showList && results[active] ? `${listId}-${active}` : undefined}
          aria-autocomplete="list"
          autoComplete="off"
          autoFocus={autoFocus}
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKey}
          placeholder={compact ? 'ابحث: سورة، آية، جزء…' : SEARCH_HINT}
          className={`min-w-0 flex-1 bg-transparent outline-none ${compact ? 'py-2 text-sm' : 'py-3'}`}
        />
        {loading && <span className="size-4 animate-spin rounded-full border-2 border-accent border-t-transparent" aria-hidden="true" />}
      </div>

      {showList && (
        <div className="absolute inset-x-0 top-full z-40 mt-1 max-h-[65vh] overflow-y-auto rounded-xl border border-line bg-surface shadow-xl">
          {error ? (
            <p role="alert" className="p-3 text-sm text-[var(--pen-red)]">{error.message}</p>
          ) : results.length === 0 && !loading && query ? (
            <p className="p-3 text-sm text-muted">لا نتائج لـ «{query}»</p>
          ) : (
            <ul id={listId} role="listbox" aria-label="نتائج البحث">
              {results.map((r, i) => (
                <li
                  key={`${r.type}-${r.surah}-${r.ayah ?? ''}-${r.juz ?? ''}-${r.page ?? ''}`}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => go(r)}
                  onMouseEnter={() => setActive(i)}
                  className={`flex cursor-pointer flex-col gap-0.5 border-b border-line/60 px-3 py-2 last:border-0 ${i === active ? 'bg-accent-soft' : ''}`}
                >
                  <ResultLine r={r} />
                </li>
              ))}
            </ul>
          )}
          {total > results.filter((r) => r.type === 'ayah').length && (
            <p className="border-t border-line p-2 text-center text-xs text-muted">
              تُعرض أول النتائج من {arabicNumber(total)} آية. أضف كلمة لتضييق البحث.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
