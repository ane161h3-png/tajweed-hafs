// صفحات مصحف المدينة (١–٦٠٤): البحث عن صفحة آية، وفهم كتابة رقم الصفحة في مربعات البحث.
import { toAsciiDigits } from '../../lib/arabic'

export const PAGE_COUNT = 604

/** رقم صفحة آية. pages: [{page, surah, ayah}] مرتبة؛ يرجع null إن لم تتوفر البيانات. */
export function pageOf(pages, surah, ayah) {
  if (!pages?.length) return null
  const key = surah * 1000 + ayah
  let lo = 0
  let hi = pages.length - 1
  if (key < pages[0].surah * 1000 + pages[0].ayah) return null
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (pages[mid].surah * 1000 + pages[mid].ayah <= key) lo = mid
    else hi = mid - 1
  }
  return pages[lo].page
}

/** أول صفحة وآخرها لمجموعة آيات متصلة [{surah, ayah}]. */
export function pageRange(pages, first, last) {
  const a = pageOf(pages, first.surah, first.ayah)
  const b = pageOf(pages, last.surah, last.ayah)
  return a && b ? [a, b] : null
}

/**
 * يفهم «صفحة ٢٥٥» و«ص 255» و«page 12» و«٢٥٥ صفحة» ويرجع رقم الصفحة (١–٦٠٤) أو null.
 * الرقم المجرّد لا يُعدّ صفحة هنا (قد يكون سورة أو آية).
 */
export function parsePageQuery(q) {
  const s = toAsciiDigits(String(q ?? '').trim()).replace(/\s+/g, ' ')
  const m = /^(?:(?:صفحة|الصفحة|صفحه|ص|page|p)\.?\s*(\d{1,3})|(\d{1,3})\s*(?:صفحة|صفحه))$/i.exec(s)
  const n = m ? Number(m[1] ?? m[2]) : NaN
  return n >= 1 && n <= PAGE_COUNT ? n : null
}
