import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { buildBlocks } from '../../frontend/src/features/notebook/blocks'

const here = (p) => fileURLToPath(new URL(p, import.meta.url))
const DATA = here('../../frontend/public/data/')
const json = (rel) => JSON.parse(readFileSync(DATA + rel, 'utf-8'))

const letters = json('letters.json')
const lessons = json('lessons.json').lessons.map((l) => json(`lessons/${l.id}.json`))
const build = (over = {}) => buildBlocks({ lessons, letters, edited: new Set(), notes: {}, drawings: true, ...over })

describe('كتل الدفتر', () => {
  it('معرّفات الكتل فريدة', () => {
    const ids = build().map((b) => b.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('فيه أغلفة الأبواب الثلاثة وصفحة ملاحظات لكل باب', () => {
    const b = build()
    expect(b.filter((x) => x.id.startsWith('part-')).length).toBe(3)
    expect(b.filter((x) => /^notes-\d$/.test(x.id)).length).toBe(3)
  })

  it('كل درس له عنوان في الفهرس برقم هرمي', () => {
    const toc = build().filter((b) => b.toc?.level === 2 && b.id.startsWith('lesson-'))
    expect(toc.length).toBe(lessons.length)
    expect(toc[0].toc.no).toBe('١-١')
  })

  it('درس المستخدم المعدَّل أو المضاف يُعلَّم، وعنوانه الجديد يظهر', () => {
    const mine = { ...lessons[0], title: 'عنواني أنا' }
    const added = { ...lessons[0], id: 'noon-sakinah-99', title: 'درس أضفته', order: 99, examples: [] }
    const b = build({ lessons: [mine, ...lessons.slice(1), added], edited: new Set([mine.id, added.id]) })
    const marked = b.filter((x) => x.toc?.mine)
    expect(marked.map((x) => x.toc.title)).toEqual(['عنواني أنا', 'درس أضفته'])
  })

  it('درس محذوف لا يظهر', () => {
    const b = build({ lessons: lessons.filter((l) => l.id !== lessons[0].id) })
    expect(b.some((x) => x.id === `lesson-${lessons[0].id}`)).toBe(false)
  })

  it('رسوم المخارج: ٥ للمجاميع و١٧ للمخارج و٢٩ للحروف، وتُحذف إن أُلغيت', () => {
    const withDraw = build().filter((b) => b.measureNode)
    expect(withDraw.filter((b) => b.id.startsWith('mkg-')).length).toBe(5)
    expect(withDraw.filter((b) => b.id.startsWith('mks-')).length).toBe(17)
    expect(withDraw.filter((b) => b.id.startsWith('mkl-')).length).toBe(29)
    expect(build({ drawings: false }).filter((b) => b.measureNode && /^mk[gsl]-/.test(b.id)).length).toBe(0)
  })

  it('ملاحظات المستخدم تصبح كتلة لكل فقرة داخل بابها', () => {
    const b = build({ notes: { ahkam: 'سطر أول\nسطر ثانٍ', makharij: '', sifat: 'للصفات' } })
    expect(b.filter((x) => /^notes-0-\d$/.test(x.id)).length).toBe(2)
    expect(b.filter((x) => /^notes-1-\d$/.test(x.id)).length).toBe(0)
    expect(b.filter((x) => /^notes-2-\d$/.test(x.id)).length).toBe(1)
  })

  it('أمثلة القرآن تُنقل كما هي (الكلمة المظلّلة داخل نصها)', () => {
    const l = lessons.find((x) => x.examples.length)
    const b = build().filter((x) => x.id.startsWith(`${l.id}-ex`) && /-ex\d+$/.test(x.id))
    expect(b.length).toBe(l.examples.length)
  })
})
