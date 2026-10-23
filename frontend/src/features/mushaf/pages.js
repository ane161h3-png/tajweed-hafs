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

/**
 * الحزب وربعه لآية. hizb: [{quarter, surah, ayah}] مرتبة (٢٤٠ ربعاً، كل حزب أربعة أرباع).
 * يرجع { hizb: ١–٦٠، quarter: ١–٤، index: ١–٢٤٠ } أو null.
 */
export function hizbOf(hizb, surah, ayah) {
  if (!hizb?.length) return null
  const key = surah * 1000 + ayah
  if (key < hizb[0].surah * 1000 + hizb[0].ayah) return null
  let lo = 0
  let hi = hizb.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (hizb[mid].surah * 1000 + hizb[mid].ayah <= key) lo = mid
    else hi = mid - 1
  }
  return { hizb: Math.floor(lo / 4) + 1, quarter: (lo % 4) + 1, index: lo + 1 }
}

/** هل يبدأ ربع حزب جديد داخل هذه الآيات؟ يرجع رقم الربع (١–٢٤٠) أو null. */
export function quarterStartingIn(hizb, ayahs) {
  if (!hizb?.length) return null
  const keys = new Set(ayahs.map((a) => a.surah * 1000 + a.ayah))
  const q = hizb.find((h) => keys.has(h.surah * 1000 + h.ayah))
  return q?.quarter ?? null
}
