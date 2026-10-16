import { describe, expect, it } from 'vitest'
import { buildSegments, countRules, rulesCss } from '../../frontend/src/features/mushaf/tajweed'
import { buildAyahQueue, indexOf, initialState, itemUrl, reducer } from '../../frontend/src/features/player/queue'
import { dueForReview, INTERVALS, record, shuffle } from '../../frontend/src/features/quiz/srs'
import { pickSession } from '../../frontend/src/features/quiz/QuizPages'
import { articulation, lerpPath, tongueParts } from '../../frontend/src/features/makharij/articulation'
import { tokens } from '../../frontend/src/features/quiz/text'

describe('تقسيم الآية إلى مقاطع ملوّنة', () => {
  const text = 'قُلْ هُوَ ٱللَّهُ أَحَدٌ'
  it('ضمّ المقاطع يعيد النص كما هو حرفاً بحرف', () => {
    const w = text.indexOf('ٱ')
    const q = text.indexOf('دٌ')
    const segs = buildSegments(text, [{ rule: 'hamzat_wasl', start: w, end: w + 1 }, { rule: 'qalqalah', start: q, end: q + 2 }])
    expect(segs.map((s) => s.text).join('')).toBe(text)
    expect(segs.find((s) => s.rules[0] === 'hamzat_wasl').text).toBe('ٱ')
    expect(segs.find((s) => s.rules[0] === 'qalqalah').text).toBe('دٌ')
  })
  it('في التداخل يُلوَّن الأخص (الأقصر) ويُحفظ الآخر', () => {
    const segs = buildSegments('abcdef', [{ rule: 'long', start: 0, end: 6 }, { rule: 'short', start: 2, end: 3 }])
    expect(segs.map((s) => [s.text, s.rules])).toEqual([['ab', ['long']], ['c', ['short', 'long']], ['def', ['long']]])
  })
  it('بلا أحكام: مقطع واحد', () => {
    expect(buildSegments('abc', [])).toEqual([{ text: 'abc', start: 0, rules: [] }])
  })
  it('عدّ المواضع', () => {
    expect(countRules([{ tajweed: [{ rule: 'a' }, { rule: 'a' }, { rule: 'b' }] }])).toEqual({ a: 2, b: 1 })
  })
  it('تعديل لون الحكم من المستخدم يُقدَّم على الأصلي', () => {
    const css = rulesCss([{ id: 'ikhfa', color: '#111111', color_dark: '#222222' }], { overrides: { ikhfa: '#abcdef' } })
    expect(css).toContain('--tj-ikhfa:#abcdef')
    expect(rulesCss([{ id: 'ikhfa', color: '#111111', color_dark: '#222222' }], { dark: true })).toContain('--tj-ikhfa:#222222')
  })
})

describe('قائمة التشغيل والتكرار', () => {
  const blocks = [{ surah: 112, ayahs: [{ ayah: 1 }, { ayah: 2 }, { ayah: 3 }] }]
  const items = buildAyahQueue(blocks)
  it('البسملة قبل الآية الأولى (وليست في الفاتحة والتوبة)', () => {
    expect(items.map((x) => x.kind)).toEqual(['bismillah', 'ayah', 'ayah', 'ayah'])
    expect(buildAyahQueue([{ surah: 9, ayahs: [{ ayah: 1 }] }]).map((x) => x.kind)).toEqual(['ayah'])
    expect(itemUrl(items[0], { ayah_url: 'u/{sss}{aaa}' })).toBe('u/001001')
    expect(itemUrl(items[1], { ayah_url: 'u/{sss}{aaa}' })).toBe('u/112001')
  })
  it('تكرار كل آية مرتين ثم الانتقال، وإيقاف في آخر المقطع', () => {
    let s = reducer({ ...initialState, repeatAyah: 2 }, { type: 'load', items, start: 1, from: 1, to: 2 })
    const seen = []
    for (let k = 0; k < 6 && s.status === 'playing'; k++) {
      seen.push(`${items[s.index].ayah}.${s.ayahPass}`)
      s = reducer(s, { type: 'ended' })
    }
    expect(seen).toEqual(['1.0', '1.1', '2.0', '2.1'])
    expect(s.status).toBe('idle')
  })
  it('تكرار المقطع ٣ مرات', () => {
    let s = reducer({ ...initialState, repeatRange: 3 }, { type: 'load', items, start: 2, from: 2, to: 3 })
    const seen = []
    while (s.status === 'playing' && seen.length < 10) {
      seen.push(items[s.index].ayah)
      s = reducer(s, { type: 'ended' })
    }
    expect(seen).toEqual([2, 3, 2, 3, 2, 3])
  })
  it('كل عنصر جديد يغيّر الرمز (token)، والإيقاف المؤقت لا يغيّره', () => {
    let s = reducer(initialState, { type: 'load', items })
    const t = s.token
    s = reducer(s, { type: 'status', status: 'paused' })
    expect(s.token).toBe(t)
    s = reducer(s, { type: 'next' })
    expect(s.token).toBe(t + 1)
  })
  it('الفهرس يبدأ من البسملة للآية الأولى', () => {
    expect(indexOf(items, 112, 1)).toBe(0)
    expect(indexOf(items, 112, 1, { withBismillah: false })).toBe(1)
  })
})

describe('مراجعة الأخطاء بالتكرار المتباعد', () => {
  it('الخطأ يعيد السؤال فوراً، والصواب يؤجله', () => {
    const now = 1_000_000
    let store = {}
    const wrong = record('q1', false, now, store)
    store = { q1: wrong }
    expect(wrong.box).toBe(1)
    expect(dueForReview(store, now)).toEqual(['q1'])
    const right = record('q1', true, now, store)
    expect(right.box).toBe(2)
    expect(right.due).toBe(now + INTERVALS[2])
    expect(dueForReview({ q1: right }, now)).toEqual([])
  })
  it('جلسة منوّعة الأنواع بلا تكرار', () => {
    const qs = Array.from({ length: 30 }, (_, i) => ({ id: `q${i}`, type: ['mcq', 'tf', 'spot'][i % 3] }))
    const s = pickSession(qs, {}, 9)
    expect(new Set(s.map((q) => q.id)).size).toBe(9)
    expect(new Set(s.map((q) => q.type))).toEqual(new Set(['mcq', 'tf', 'spot']))
    expect(shuffle([1, 2, 3], () => 0)).toHaveLength(3)
  })
})

describe('حركة الرسم', () => {
  it('المسار الوسيط بين وضعين', () => {
    expect(lerpPath('M 0 0 L 10 10', 'M 10 10 L 20 20', 0.5)).toBe('M 5 5 L 15 15')
    expect(lerpPath('M 0 0', 'M 1 1 L 2 2', 0.5)).toBe('M 1 1 L 2 2') // بنية مختلفة: قفز مباشر
  })
  it('أجزاء اللسان من مساره', () => {
    const d = 'M 318 264 C 310 258 310 251 300 250 C 286 246 286 242 270 242 C 252 242 250 242 238 248 C 0 0 0 0 210 278'
    expect(tongueParts(d)).toEqual({ tip: [318, 264], blade: [300, 250], middle: [270, 242], back: [238, 248] })
  })
  it('وضع الحرف: القاف شديدة ولسانها في أقصاه، والميم بالغنة وانطباق الشفتين', () => {
    const qaf = articulation({ id: 'qaf', makhraj: 'qaf', sifat: ['jahr', 'shidda'], extra: ['qalqalah'] })
    expect(qaf).toMatchObject({ tongue: 'qaf', air: 'blocked', nasal: false })
    const meem = articulation({ id: 'meem', makhraj: 'shafatan', sifat: ['jahr', 'tawassut'], extra: ['ghunnah'] })
    expect(meem).toMatchObject({ lips: ['closed', 'closed'], air: 'weak', nasal: true })
    expect(articulation({ id: 'taa', makhraj: 'nit', sifat: ['shidda'], extra: [] }).tongue).toBe('nit-itbaq')
  })
  it('كلمات الآية دون علامات الوقف المنفصلة', () => {
    expect(tokens('ٱلْقَيُّومُ ۚ لَا').map((t) => t.text)).toEqual(['ٱلْقَيُّومُ', 'لَا'])
  })
})
