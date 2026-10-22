import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { buildIndex, pageResult, searchIndex, snippetAround } from '../../frontend/src/features/search/globalIndex'

const here = (p) => fileURLToPath(new URL(p, import.meta.url))
const DATA = here('../../frontend/public/data/')
const json = (rel) => JSON.parse(readFileSync(DATA + rel, 'utf-8'))

const lessons = json('lessons.json').lessons.map((l) => json(`lessons/${l.id}.json`))
const items = buildIndex({ lessons, letters: json('letters.json'), surahs: json('surahs.json'), juz: json('juz.json'), juzNames: { 30: 'عم', 29: 'تبارك' } })
const top = (q, n = 3) => searchIndex(items, q).slice(0, n).map((r) => `${r.group}:${r.title}`)

describe('فهرس البحث الشامل', () => {
  it('فيه كل أنواع المحتوى', () => {
    const groups = new Set(items.map((i) => i.group))
    for (const g of ['sections', 'guide', 'lessons', 'letters', 'makharij', 'sifat', 'surahs']) expect(groups.has(g)).toBe(true)
    expect(items.filter((i) => i.group === 'lessons').length).toBe(42)
    expect(items.filter((i) => i.group === 'letters').length).toBe(29)
    expect(items.filter((i) => i.id.startsWith('surah-')).length).toBe(114)
    expect(items.filter((i) => i.id.startsWith('juz-')).length).toBe(30)
  })

  it('معرّفات العناصر فريدة', () => {
    const ids = items.map((i) => i.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('الإظهار الحلقي: يجد الدرس في المقدمة', () => {
    expect(top('الإظهار الحلقي')[0]).toBe('lessons:الإظهار الحلقي')
  })

  it('بلا تشكيل وبهمزة مختلفة', () => {
    expect(top('الاظهار الحلقي')[0]).toBe('lessons:الإظهار الحلقي')
  })

  it('يبحث في نص الدرس لا في عنوانه فقط', () => {
    const r = searchIndex(items, 'تحفة الأطفال')
    expect(r.some((x) => x.group === 'lessons')).toBe(true)
    const withSnippet = searchIndex(items, 'الغنة').find((x) => x.group === 'lessons' && x.score === 1)
    expect(withSnippet?.snippet.length).toBeGreaterThan(5)
  })

  it('الحرف باسمه أو بشكله', () => {
    const dad = searchIndex(items, 'ضاد')
    expect(dad.findIndex((r) => r.id === 'letter-dad')).toBeLessThan(dad.findIndex((r) => r.id === 'sec-sifat'))
    expect(searchIndex(items, 'ض').some((r) => r.id === 'letter-dad')).toBe(true)
  })

  it('السورة برقمها أو اسمها، والجزء بلقبه', () => {
    expect(searchIndex(items, '36')[0].id).toBe('surah-36')
    expect(top('يس')[0]).toBe('surahs:سورة يس')
    expect(searchIndex(items, 'عم')[0].id).toBe('juz-30')
    expect(searchIndex(items, 'تبارك')[0].id).toBe('juz-29')
  })

  it('الصفة والمخرج', () => {
    expect(searchIndex(items, 'الجهر').some((r) => r.group === 'sifat')).toBe(true)
    expect(searchIndex(items, 'أقصى الحلق').some((r) => r.group === 'makharij')).toBe(true)
  })

  it('الدليل: سؤال بكلمة من جوابه', () => {
    const r = searchIndex(items, 'الميكروفون').filter((x) => x.group === 'guide')
    expect(r.length).toBeGreaterThan(0)
    expect(r[0].to.startsWith('/settings/guide?q=')).toBe(true)
  })

  it('كل كلمات الاستعلام مطلوبة', () => {
    expect(searchIndex(items, 'الإظهار شفوي حلقي').length).toBeLessThan(searchIndex(items, 'الإظهار').length)
    expect(searchIndex(items, 'كلمةغيرموجودةإطلاقا')).toEqual([])
  })

  it('حدّ لكل مجموعة، والاستعلام الفارغ بلا نتائج', () => {
    const r = searchIndex(items, 'ال', { perGroup: 3 })
    const counts = {}
    for (const x of r) counts[x.group] = (counts[x.group] ?? 0) + 1
    expect(Math.max(...Object.values(counts))).toBeLessThanOrEqual(3)
    expect(searchIndex(items, '   ')).toEqual([])
  })

  it('مسارات النتائج صحيحة الشكل', () => {
    for (const r of searchIndex(items, 'ا', { perGroup: 50 })) expect(r.to).toMatch(/^\//)
    const l = searchIndex(items, 'الإظهار الحلقي')[0]
    expect(l.to).toMatch(/^\/ahkam\/noon-sakinah\/noon-sakinah-\d+$/)
  })
})

describe('صفحة المصحف ومقتطف النص', () => {
  it('«صفحة ٢٥٥» تعطي نتيجة صفحة', () => {
    expect(pageResult('صفحة ٢٥٥')).toMatchObject({ group: 'pages', to: '/mushaf/page/255' })
    expect(pageResult('255')).toBeNull()
  })

  it('المقتطف حول الكلمة، وطوله معقول', () => {
    const body = 'كلام طويل '.repeat(20) + 'الغنة صفة ثابتة للنون والميم ' + 'وكلام بعدها '.repeat(20)
    const s = snippetAround(body, 'الغنه')
    expect(s).toContain('الغنة')
    expect(s.length).toBeLessThan(160)
    expect(snippetAround('', 'ا')).toBe('')
  })
})
