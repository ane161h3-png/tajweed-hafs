import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { analyzeAyah, summarize } from '../../frontend/src/features/ayah/analyze'

const here = (p) => fileURLToPath(new URL(p, import.meta.url))
const DATA = here('../../frontend/public/data/')
const json = (rel) => JSON.parse(readFileSync(DATA + rel, 'utf-8'))
const letters = json('letters.json')
const rules = Object.fromEntries(json('rules.json').map((r) => [r.id, r]))
const ayah = (s, a) => json(`surah/${s}.json`).ayahs.find((x) => x.ayah === a)
const analyze = (s, a) => {
  const x = ayah(s, a)
  return analyzeAyah(x.text, x.tajweed, letters)
}
const spoken = (w) => w.letters.filter((l) => !l.silent)
const ids = (w) => spoken(w).map((l) => l.id)

describe('تحليل الحروف في الكلمة', () => {
  it('بسم الله الرحمن الرحيم: أربع كلمات', () => {
    const { words } = analyze(1, 1)
    expect(words.map((w) => w.text)).toEqual(ayah(1, 1).text.split(' '))
    expect(words.length).toBe(4)
    expect(ids(words[0])).toEqual(['ba', 'seen', 'meem'])
  })

  it('«ٱلرَّحِيمِ»: راء مشددة، وياء مد، وهمزة الوصل ولام التعريف لا تُنطقان', () => {
    const w = analyze(1, 1).words[3]
    expect(ids(w)).toEqual(['ra', 'haa', 'ya', 'meem'])
    expect(spoken(w)[0].doubled).toBe(true)
    expect(spoken(w)[2].kind).toBe('mad')
    expect(w.letters.filter((l) => l.silent).length).toBe(2)
  })

  it('«ٱلرَّحْمَٰنِ»: الألف الصغيرة ألف مد، وتنتهي بالنون', () => {
    const w = analyze(1, 1).words[2]
    const l = spoken(w)
    expect(l.map((x) => x.id)).toEqual(['ra', 'haa', 'meem', 'alif', 'noon'])
    expect(l[3].kind).toBe('mad')
  })

  it('التنوين يُحسب نوناً، وياء المد بعد الكسرة', () => {
    const { words } = analyzeAyah('عَلِيمٌ', [], letters)
    expect(words[0].letters.map((l) => [l.id, l.kind])).toEqual([
      ['ain', 'letter'],
      ['lam', 'letter'],
      ['ya', 'mad'],
      ['meem', 'letter'],
      ['noon', 'tanween'],
    ])
  })

  it('واو الجماعة: الواو مد والألف بعدها (علامة الصفر) لا تُنطق', () => {
    const { words } = analyzeAyah('ءَامَنُوا۟', [], letters)
    expect(words[0].letters.map((x) => [x.id, x.kind, x.silent])).toEqual([
      ['hamza', 'letter', false],
      ['alif', 'mad', false],
      ['meem', 'letter', false],
      ['noon', 'letter', false],
      ['waw', 'mad', false],
      ['alif', 'letter', true],
    ])
  })

  it('واو وياء متحركتان ليستا مدّاً', () => {
    const { words } = analyzeAyah('وَيَوْمَ', [], letters)
    expect(words[0].letters.map((l) => [l.id, l.kind])).toEqual([
      ['waw', 'letter'],
      ['ya', 'letter'],
      ['waw', 'letter'],
      ['meem', 'letter'],
    ])
  })

  it('الهمزات على أشكالها تُحسب همزة', () => {
    for (const w of ['أَنتُمْ', 'إِنَّ', 'مُؤْمِنِينَ', 'سُئِلَ', 'ءَالِهَةً']) {
      expect(analyzeAyah(w, [], letters).words[0].letters.some((l) => l.id === 'hamza'), w).toBe(true)
    }
  })

  it('علامات الأحكام تقع داخل حدود كلمتها', () => {
    const x = ayah(2, 2)
    const { words } = analyzeAyah(x.text, x.tajweed, letters)
    expect(words.filter((w) => w.rules.length).length).toBeGreaterThan(0)
    for (const w of words)
      for (const r of w.rules) {
        expect(r.start).toBeGreaterThanOrEqual(w.start)
        expect(r.end).toBeLessThanOrEqual(w.end)
      }
  })
})

describe('ملخّص الأحكام والمخارج والصفات', () => {
  it('مخرج كل حرف في «قَالَ»: اللسان والجوف', () => {
    const { words } = analyzeAyah('قَالَ', [], letters)
    const s = summarize(words, letters)
    const byMk = Object.fromEntries(s.makharij.map((m) => [m.id, m.letters.map((l) => l.id)]))
    expect(byMk).toEqual({ jawf: ['alif'], qaf: ['qaf'], lam: ['lam'] })
  })

  it('المدّ بالواو مخرجه الجوف لا الشفتان', () => {
    const { words } = analyzeAyah('نُورٌ', [], letters)
    const s = summarize(words, letters)
    expect(s.makharij.map((m) => m.id)).toEqual(expect.arrayContaining(['jawf', 'noon', 'ra']))
    expect(s.makharij.some((m) => m.id === 'shafatan')).toBe(false)
  })

  it('الغنة تُضيف الخيشوم للنون المشددة والميم المشددة', () => {
    const { words } = analyzeAyah('إِنَّ ثُمَّ', [], letters)
    const s = summarize(words, letters)
    expect(s.makharij.find((m) => m.id === 'khayshum')?.count).toBeGreaterThanOrEqual(2)
  })

  it('الصفات: القلقلة والجهر والهمس بحسب الحروف', () => {
    const { words } = analyzeAyah('قَدْ', [], letters)
    const s = summarize(words, letters)
    expect(s.nonOpposite.map((x) => x.id)).toContain('qalqalah')
    const jahr = s.opposite.find((g) => g.id === 'hams-jahr')
    expect(jahr.sides.find((x) => x.id === 'jahr').count).toBe(2)
    expect(jahr.sides.find((x) => x.id === 'hams').count).toBe(0)
  })

  it('كل حرف منطوق يقع في كل مجموعة من الصفات المتضادة مرة واحدة', () => {
    const x = ayah(2, 255)
    const { words } = analyzeAyah(x.text, x.tajweed, letters)
    const s = summarize(words, letters)
    for (const g of s.opposite) expect(g.sides.reduce((n, side) => n + side.count, 0), g.id).toBe(s.letterCount)
  })

  it('الأحكام: الأعداد وربطها بالدرس والوصف', () => {
    const x = ayah(2, 5)
    const { words } = analyzeAyah(x.text, x.tajweed, letters)
    const lessons = json('lessons.json').lessons
    const s = summarize(words, letters, { ruleInfo: rules, lessons })
    expect(s.rules.length).toBeGreaterThan(0)
    expect(s.rules.reduce((n, r) => n + r.count, 0)).toBe(x.tajweed.filter((m) => m.start < m.end).length)
    const withLesson = s.rules.find((r) => r.lesson)
    expect(withLesson.lesson.rules).toContain(withLesson.id)
  })

  it('كلمة واحدة: ملخّصها من حروفها فقط', () => {
    const { words } = analyze(1, 2)
    const one = summarize([words[0]], letters)
    const all = summarize(words, letters)
    expect(one.letterCount).toBeLessThan(all.letterCount)
    expect(one.letterCount).toBe(spoken(words[0]).length)
  })
})

describe('القرآن كله', () => {
  it('يُحلَّل كل آية دون أخطاء، وكل حرف معروف ومخرجه موجود', () => {
    const known = new Set(letters.letters.map((l) => l.id))
    const makharij = new Set(letters.makharij.map((m) => m.id))
    let nAyahs = 0
    let nLetters = 0
    for (let s = 1; s <= 114; s++) {
      for (const a of json(`surah/${s}.json`).ayahs) {
        const { words } = analyzeAyah(a.text, a.tajweed, letters)
        expect(words.length).toBeGreaterThan(0)
        for (const w of words) {
          if (!spoken(w).length) throw new Error(`كلمة بلا حروف منطوقة ${s}:${a.ayah} ${w.text}`)
          for (const l of w.letters) {
            if (!known.has(l.id) || l.at < w.start || l.at >= w.end) throw new Error(`حرف خارج كلمته ${s}:${a.ayah} ${w.text}`)
            nLetters++
          }
        }
        for (const m of summarize(words, letters).makharij) if (!makharij.has(m.id)) throw new Error(`مخرج مجهول ${m.id}`)
        nAyahs++
      }
    }
    expect(nAyahs).toBe(6236)
    expect(nLetters).toBeGreaterThan(300000)
  }, 180000)
})
