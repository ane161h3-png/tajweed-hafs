import { describe, expect, it } from 'vitest'
import { PAGE_COUNT, pageOf, pageRange, parsePageQuery } from '../../frontend/src/features/mushaf/pages'
import { highlightParts, makeMatcher } from '../../frontend/src/lib/filter'

const PAGES = [
  { page: 1, surah: 1, ayah: 1 },
  { page: 2, surah: 2, ayah: 1 },
  { page: 3, surah: 2, ayah: 6 },
  { page: 4, surah: 2, ayah: 17 },
  { page: 5, surah: 3, ayah: 1 },
]

describe('صفحة الآية', () => {
  it('أول آية في الصفحة وآخرها وما بينهما', () => {
    expect(pageOf(PAGES, 1, 1)).toBe(1)
    expect(pageOf(PAGES, 1, 7)).toBe(1)
    expect(pageOf(PAGES, 2, 1)).toBe(2)
    expect(pageOf(PAGES, 2, 5)).toBe(2)
    expect(pageOf(PAGES, 2, 6)).toBe(3)
    expect(pageOf(PAGES, 2, 286)).toBe(4)
    expect(pageOf(PAGES, 114, 6)).toBe(5)
  })
  it('بلا بيانات: null', () => {
    expect(pageOf(null, 1, 1)).toBeNull()
    expect(pageOf([], 1, 1)).toBeNull()
  })
  it('نطاق صفحات سورة', () => {
    expect(pageRange(PAGES, { surah: 2, ayah: 1 }, { surah: 2, ayah: 286 })).toEqual([2, 4])
  })
})

describe('فهم «صفحة ٢٥٥» في مربع البحث', () => {
  it.each([
    ['صفحة 255', 255],
    ['صفحة ٢٥٥', 255],
    ['الصفحة ١٢', 12],
    ['ص 604', 604],
    ['ص٣٠٠', 300],
    ['page 7', 7],
    ['255 صفحة', 255],
    ['  صفحة   1 ', 1],
  ])('%s', (q, n) => expect(parsePageQuery(q)).toBe(n))

  it.each(['255', 'صفحة 0', 'صفحة 605', 'صفحة', 'البقرة 255', '2:255', 'ص', 'صفحة ١٢٣٤'])('لا يُعدّ صفحة: %s', (q) => expect(parsePageQuery(q)).toBeNull())

  it('عدد الصفحات ٦٠٤', () => expect(PAGE_COUNT).toBe(604))
})

describe('تصفية القوائم', () => {
  const m = (q, ...f) => makeMatcher(q)(...f)
  it('بلا تشكيل وبالأرقام العربية', () => {
    expect(m('البقره', 'سورة البَقَرَة')).toBe(true)
    expect(m('٣٦', 'سورة يس', '36')).toBe(true)
    expect(m('', 'أي شيء')).toBe(true)
  })
  it('كل كلمة على حدة، ولا بد من وجودها كلها', () => {
    expect(m('سورة مكية', 'سورة الفاتحة', 'مكية')).toBe(true)
    expect(m('سورة مدنية', 'سورة الفاتحة', 'مكية')).toBe(false)
  })
  it('تظليل المطابق مع بقاء التشكيل داخله', () => {
    const parts = highlightParts('ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَـٰلَمِينَ', 'الحمد')
    expect(parts.filter((p) => p.hit).map((p) => p.text).join('')).toBe('ٱلْحَمْدُ')
    expect(parts.map((p) => p.text).join('')).toBe('ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَـٰلَمِينَ')
  })
  it('بلا استعلام: النص كما هو', () => {
    expect(highlightParts('نص', '')).toEqual([{ text: 'نص', hit: false }])
  })
})
