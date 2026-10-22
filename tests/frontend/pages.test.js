// صفحات المصحف في وضع التطبيق دون خادم: كل صفحة من الـ ٦٠٤ مطابقة للخادم (آيات ونصوص وأحكام).
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { resetStaticCache, staticApi } from '../../frontend/src/lib/staticApi'

const here = (p) => fileURLToPath(new URL(p, import.meta.url))
const DATA = here('../../frontend/public/data/')
const want = JSON.parse(readFileSync(here('../fixtures/pages_parity.json'), 'utf-8'))
const hasData = existsSync(DATA + 'pages.json')

// بصمة JSON بترتيب مفاتيح ثابت، كما فعل النص البرمجي المسجِّل (sort_keys)
const stable = (v) => (Array.isArray(v) ? `[${v.map(stable).join(', ')}]` : v && typeof v === 'object' ? `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}: ${stable(v[k])}`).join(', ')}}` : JSON.stringify(v))
const pyDump = (v) => stable(v).replace(/[\u0080-￿]/g, (c) => c) // ensure_ascii=False

describe.skipIf(!hasData)('صفحات المصحف دون خادم', () => {
  beforeAll(() => {
    resetStaticCache()
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      const rel = String(url).replace(/^.*\/data\//, '')
      if (!existsSync(DATA + rel)) return new Response('', { status: 404 })
      return new Response(readFileSync(DATA + rel, 'utf-8'))
    }))
  })
  afterAll(() => vi.unstubAllGlobals())

  it('الصفحات الستمئة وأربع: الحدود وعدد الآيات والسور مطابقة للخادم', async () => {
    const bad = []
    for (let n = 1; n <= 604; n++) {
      const d = await staticApi(`/page/${n}`)
      const got = [d.start.surah, d.start.ayah, d.end.surah, d.end.ayah, d.ayahs.length, d.surahs.map((s) => s.number)]
      if (JSON.stringify(got) !== JSON.stringify(want[n].slice(0, 6))) bad.push(n)
    }
    expect(bad).toEqual([])
  }, 120000)

  it('نصوص الآيات وأحكام التجويد متطابقة (بصمة كل صفحة)', async () => {
    const bad = []
    for (const n of [1, 2, 50, 77, 255, 300, 411, 582, 604]) {
      const d = await staticApi(`/page/${n}`)
      const h = createHash('sha1').update(pyDump(d.ayahs.map((a) => [a.surah, a.ayah, a.text, a.tajweed]))).digest('hex').slice(0, 12)
      if (h !== want[n][6]) bad.push(n)
    }
    expect(bad).toEqual([])
  }, 60000)

  it('رقم خارج النطاق يرجع خطأ مفهوماً، وقائمة الصفحات كاملة', async () => {
    await expect(staticApi('/page/0')).rejects.toThrow(/604/)
    await expect(staticApi('/page/605')).rejects.toThrow(/604/)
    expect(await staticApi('/pages')).toHaveLength(604)
  })
})
