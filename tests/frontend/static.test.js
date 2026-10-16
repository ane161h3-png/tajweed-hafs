// وضع التطبيق دون خادم: البحث والمطابقة في JavaScript يجب أن تطابق الخادم تماماً.
// tests/fixtures/parity.json مسجّل من الخادم الحقيقي؛ والبيانات من frontend/public/data (scripts/export_static.py).
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { normalize } from '../../frontend/src/lib/arabic'
import { findWord } from '../../frontend/src/lib/matching'
import { resetStaticCache, staticApi, writeLesson } from '../../frontend/src/lib/staticApi'

const here = (p) => fileURLToPath(new URL(p, import.meta.url))
const DATA = here('../../frontend/public/data/')
const parity = JSON.parse(readFileSync(here('../fixtures/parity.json'), 'utf-8'))
const hasData = existsSync(DATA + 'search-index.json')

describe('تطبيع العربية مطابق للخادم', () => {
  for (const [w, [a, b]] of Object.entries(parity.normalize)) {
    it(w, () => {
      expect(normalize(w)).toBe(a)
      expect(normalize(w, { spellDagger: true })).toBe(b)
    })
  }
})

describe.skipIf(!hasData)('بيانات التطبيق', () => {
  beforeAll(() => {
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      const rel = String(url).replace(/^.*\/data\//, '')
      if (!existsSync(DATA + rel)) return new Response('', { status: 404 })
      return new Response(readFileSync(DATA + rel, 'utf-8'))
    }))
  })
  afterAll(() => vi.unstubAllGlobals())
  beforeEach(() => {
    resetStaticCache()
    localStorage.clear()
  })

  describe('البحث مطابق للخادم', () => {
    for (const [q, expected] of Object.entries(parity.search)) {
      it(q, async () => {
        const r = await staticApi(`/search?q=${encodeURIComponent(q)}&limit=20`)
        expect(r.kind).toBe(expected.kind)
        const got = r.results.map((x) => [x.type, x.surah, x.ayah ?? null, x.type === 'juz' ? x.juz : null, x.match ?? null])
        const want = expected.results.map(([t, s, a, j, m]) => [t, s, a ?? null, j, m])
        // إن زادت المطابقات على الحد فقد يختلف أيّ عشرين تُعرض (ترتيب FTS5 بـ bm25)؛ وإلا فالمجموعة نفسها
        if (expected.total <= 20) expect(new Set(got.map((x) => JSON.stringify(x)))).toEqual(new Set(want.map((x) => JSON.stringify(x))))
        else expect(got).toHaveLength(want.length)
        if (want.length) expect(got[0][0]).toBe(want[0][0])
        expect(r.total_text).toBe(expected.total)
      }, 20000)
    }
  })

  it('مطابقة كلمة المثال مطابقة للخادم', async () => {
    for (const [key, want] of Object.entries(parity.find_word)) {
      const [s, a, w] = key.split(':')
      const ayah = await staticApi(`/ayah/${s}/${a}`)
      expect([key, findWord(ayah.text, w)]).toEqual([key, want])
    }
  })

  it('المسارات الأساسية', async () => {
    expect((await staticApi('/surahs')).length).toBe(114)
    const s = await staticApi('/surah/112')
    expect(s.surah.name).toBe('الإخلاص')
    expect(s.bismillah_text).toBeTruthy()
    expect((await staticApi('/quiz?level=2')).questions.every((q) => q.level === 2)).toBe(true)
    expect((await staticApi('/ayah/112/1')).words.length).toBeGreaterThan(2)
    await expect(staticApi('/surah/115')).rejects.toThrow('لا توجد سورة')
  })

  it('تعديل الدروس يُحفظ على الجهاز ويُدمج مع الأصل', async () => {
    const before = await staticApi('/lessons')
    const lesson = await staticApi('/lessons/noon-sakinah-2')
    const { id, updated_at, ...body } = lesson
    body.examples = lesson.examples.map(({ surah, ayah, word, note }) => ({ surah, ayah, word, note }))
    const saved = await writeLesson('PUT', `/lessons/${id}`, { ...body, lugha: 'تجربة' })
    expect(saved.lugha).toBe('تجربة')
    expect(saved.examples[0].ayah_text).toBeTruthy()
    expect((await staticApi('/lessons/noon-sakinah-2')).lugha).toBe('تجربة')

    const created = await writeLesson('POST', '/lessons', { ...body, title: 'درس جديد', order: 0 })
    expect(created.id).toBe('noon-sakinah-8')
    expect((await staticApi('/lessons')).lessons).toHaveLength(before.lessons.length + 1)

    await writeLesson('DELETE', `/lessons/${created.id}`)
    await writeLesson('DELETE', '/lessons/noon-sakinah-7')
    const after = await staticApi('/lessons')
    expect(after.lessons).toHaveLength(before.lessons.length - 1)
    await expect(staticApi('/lessons/noon-sakinah-7')).rejects.toThrow('الدرس غير موجود')
  })
})
