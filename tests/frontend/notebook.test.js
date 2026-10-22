import { describe, expect, it } from 'vitest'
import { linesFor, paginate } from '../../frontend/src/features/notebook/model'

const b = (h, extra = {}) => ({ h, ...extra })

describe('محرّك صفحات الدفتر', () => {
  it('عدد السطور من الطول مع تقريب لأعلى، وسطر على الأقل', () => {
    expect(linesFor(0, 22.7)).toBe(1)
    expect(linesFor(22.7, 22.7)).toBe(1)
    expect(linesFor(22.9, 22.7)).toBe(1) // ضمن هامش القياس (٠٫٥px)
    expect(linesFor(23.5, 22.7)).toBe(2)
    expect(linesFor(68, 22.7)).toBe(3)
  })

  it('يملأ الصفحة بالترتيب ثم ينتقل لغيرها', () => {
    const pages = paginate([b(20), b(20), b(10), b(5)], 43)
    expect(pages).toEqual([[0, 1], [2, 3]])
  })

  it('العنوان (keepNext) لا يُترك وحده في آخر الصفحة', () => {
    const pages = paginate([b(40), b(2, { keepNext: true }), b(10)], 43)
    expect(pages).toEqual([[0], [1, 2]])
  })

  it('سلسلة عناوين متتالية تنتقل معاً', () => {
    const pages = paginate([b(38), b(2, { keepNext: true }), b(2, { keepNext: true }), b(6)], 43)
    expect(pages).toEqual([[0], [1, 2, 3]])
  })

  it('breakBefore يبدأ صفحة جديدة، ولا يترك صفحة فارغة في البداية', () => {
    expect(paginate([b(3, { breakBefore: true }), b(3), b(3, { breakBefore: true })], 43)).toEqual([[0, 1], [2]])
  })

  it('كتلة أطول من الصفحة تُقصّ ولا تتسبب بحلقة لا نهائية', () => {
    const pages = paginate([b(99), b(5)], 43)
    expect(pages).toEqual([[0], [1]])
  })

  it('لا كتل = لا صفحات', () => {
    expect(paginate([], 43)).toEqual([])
  })

  it('كل كتلة تظهر مرة واحدة فقط وبترتيبها', () => {
    const blocks = Array.from({ length: 300 }, (_, i) => b((i % 7) + 1, { keepNext: i % 11 === 0 }))
    const flat = paginate(blocks).flat()
    expect(flat).toEqual(blocks.map((_, i) => i))
  })
})
