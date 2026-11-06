import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { SECTIONS } from '../../frontend/src/data/sections'
import { qaUrl, searchQa } from '../../frontend/src/features/masail/masail'

const data = JSON.parse(readFileSync(join(import.meta.dirname, '../../frontend/src/features/masail/data/qa.json'), 'utf-8'))
const all = data.topics.flatMap((t) => t.qa)

describe('المسائل الشرعية: استفتاءات السيد السيستاني', () => {
  it('كل المواضيع منقولة، ولكل استفتاء رقم فريد وسؤال وجواب', () => {
    expect(data.topics.length).toBeGreaterThanOrEqual(650)
    expect(all.length).toBeGreaterThanOrEqual(5900)
    expect(new Set(all.map((x) => x.ref)).size).toBe(all.length)
    for (const x of all) {
      expect(x.q.length).toBeGreaterThan(3)
      expect(x.a.length).toBeGreaterThan(0)
      expect(x.q + x.a).not.toMatch(/<\/?[a-z][^>]*>/i)
    }
  })

  it('كل موضوع في باب من أبواب القسم، ولا باب فارغ', () => {
    const babs = SECTIONS.find((s) => s.id === 'masail').subsections.map((s) => s.id)
    expect(data.babs.map((b) => b.id).sort()).toEqual([...babs].sort())
    for (const t of data.topics) expect(babs).toContain(t.bab)
    for (const b of babs) expect(data.topics.some((t) => t.bab === b)).toBe(true)
  })

  it('الأبواب في مواضعها', () => {
    const bab = (title) => data.topics.find((t) => t.title === title)?.bab
    expect(bab('الوضوء')).toBe('tahara')
    expect(bab('أحكام المسافر')).toBe('salat')
    expect(bab('صوم المسافر')).toBe('sawm')
    expect(bab('الخمس في الحج')).toBe('khums')
    expect(bab('المرأة - الحجاب')).not.toBe('hajj')
    expect(bab('الحجامة')).not.toBe('hajj')
    expect(bab('إطلاق العيارات النارية')).not.toBe('nikah')
  })

  it('البحث يجد الاستفتاء بلا تشكيل، ويقصر على الباب', () => {
    const hits = searchQa(data, 'النوافل في السفر')
    expect(hits.some((h) => h.item.ref === 9016)).toBe(true)
    expect(searchQa(data, 'الوضوء', { bab: 'sawm' }).every((h) => h.topic.bab === 'sawm')).toBe(true)
    expect(searchQa(data, '')).toEqual([])
  })

  it('رابط الاستفتاء في الموقع الرسمي', () => {
    expect(qaUrl(9016)).toBe('https://www.sistani.org/arabic/qa/9016/')
    expect(data.source.url).toBe('https://www.sistani.org/arabic/qa/')
  })
})
