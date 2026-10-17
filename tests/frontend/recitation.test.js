import { describe, expect, it } from 'vitest'
import { assessRecitation } from '../../frontend/src/lib/recitation'

const TEXT = 'قُلْ هُوَ ٱللَّهُ أَحَدٌ'
const match = (word) => [TEXT.indexOf(word), TEXT.indexOf(word) + word.length]

describe('تقييم القراءة بالميكروفون', () => {
  it('قراءة صحيحة بالإملاء العادي (كما يكتبها التعرّف الآلي)', () => {
    const r = assessRecitation(TEXT, match('أَحَدٌ'), ['قل هو الله أحد'])
    expect(r.correct).toBe(true)
    expect(r.score).toBe(1)
    expect(r.words.every((w) => w.ok)).toBe(true)
  })

  it('يختار أفضل البدائل المسموعة', () => {
    const r = assessRecitation(TEXT, match('أَحَدٌ'), ['كل هو الله', 'قل هو الله احد'])
    expect(r.correct).toBe(true)
    expect(r.heard).toBe('قل هو الله احد')
  })

  it('كلمة الشاهد ناقصة: خطأ، وتُعلَّم الكلمة', () => {
    const r = assessRecitation(TEXT, match('أَحَدٌ'), ['قل هو الله'])
    expect(r.correct).toBe(false)
    const target = r.words.find((w) => w.target)
    expect(target.text).toBe('أَحَدٌ')
    expect(target.ok).toBe(false)
  })

  it('كلمة مختلفة (لا حرف واحد) تُعدّ خطأ', () => {
    const r = assessRecitation(TEXT, match('أَحَدٌ'), ['قل هو الله واحد'])
    expect(r.words.find((w) => w.target).ok).toBe(false)
  })

  it('يتسامح مع فروق الرسم: الألف الخنجرية وصور الهمز', () => {
    const text = 'ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَٰلَمِينَ'
    const word = 'ٱلْعَٰلَمِينَ'
    const r = assessRecitation(text, [text.indexOf(word), text.indexOf(word) + word.length], ['الحمد لله رب العالمين'])
    expect(r.correct).toBe(true)
  })

  it('لا شيء مسموع', () => {
    const r = assessRecitation(TEXT, match('أَحَدٌ'), [])
    expect(r.correct).toBe(false)
    expect(r.score).toBe(0)
  })
})
