import { useState } from 'react'

/** مشاركة الرابط: قائمة المشاركة في الهاتف (واتساب، تلكرام…)، أو نسخ الرابط في الحاسوب. */
export default function ShareButton({ title = 'تعلّم التجويد برواية حفص', text, url, compact = false, className = '' }) {
  const [copied, setCopied] = useState(false)
  const link = url ?? window.location.href
  const share = async () => {
    const data = { title, text: text ?? title, url: link }
    try {
      if (navigator.share) {
        await navigator.share(data)
        return
      }
    } catch (e) {
      if (e.name === 'AbortError') return
    }
    try {
      await navigator.clipboard.writeText(`${data.text}\n${link}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt('انسخ الرابط:', link)
    }
  }
  return (
    <button
      type="button"
      onClick={share}
      className={
        className ||
        (compact
          ? 'rounded-lg border border-line bg-surface px-4 text-sm font-medium leading-10'
          : 'inline-flex items-center gap-2 rounded-xl border border-accent bg-surface px-4 py-2.5 font-medium text-accent hover:bg-accent-soft')
      }
      aria-live="polite"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <circle cx="18" cy="5" r="3" />
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="19" r="3" />
        <path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" />
      </svg>
      {copied ? 'نُسخ الرابط ✓' : 'مشاركة'}
    </button>
  )
}
