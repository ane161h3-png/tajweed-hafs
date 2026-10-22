import { useId } from 'react'

/** مربع تصفية موحّد لكل القوائم: زر مسح، وعدّاد النتائج تقرؤه قارئات الشاشة، وEsc يمسح. */
export default function FilterBox({ value, onChange, placeholder = 'ابحث…', label, count, total, autoFocus = false, className = '' }) {
  const id = useId()
  return (
    <div className={className} role="search">
      <div className="relative">
        <label htmlFor={id} className="sr-only">
          {label ?? placeholder}
        </label>
        <svg className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          id={id}
          type="search"
          enterKeyHint="search"
          autoComplete="off"
          spellCheck="false"
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && value) {
              e.preventDefault()
              onChange('')
            }
          }}
          placeholder={placeholder}
          className="h-11 w-full rounded-xl border border-line bg-surface ps-10 pe-10 text-base focus:border-accent focus:outline-none [&::-webkit-search-cancel-button]:hidden"
        />
        {value && (
          <button type="button" onClick={() => onChange('')} aria-label="مسح البحث" className="absolute end-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink">
            ✕
          </button>
        )}
      </div>
      {count != null && total != null && value && (
        <p className="mt-1 text-xs text-muted" aria-live="polite">
          {count === 0 ? 'لا نتائج' : `${count} من ${total}`}
        </p>
      )}
    </div>
  )
}
