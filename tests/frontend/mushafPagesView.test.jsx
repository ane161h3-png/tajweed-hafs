import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import MushafReader from '../../frontend/src/features/mushaf/MushafReader'
import PageSheet from '../../frontend/src/features/mushaf/PageSheet'
import { PlayerProvider } from '../../frontend/src/features/player/PlayerContext'
import { SettingsProvider } from '../../frontend/src/features/settings/SettingsContext'
import { resetRulesCache } from '../../frontend/src/features/mushaf/useRules'
import { resetStaticCache, staticApi } from '../../frontend/src/lib/staticApi'

const here = (p) => fileURLToPath(new URL(p, import.meta.url))
const DATA = here('../../frontend/public/data/')
const hasData = existsSync(DATA + 'hizb.json')

afterEach(cleanup)

describe('صفحة المصحف بهيئتها', () => {
  const groups = [
    { surah: { number: 2, name: 'البقرة', revelation: 'مدنية', ayah_count: 286 }, ayahs: [{ ayah: 17 }, { ayah: 25 }] },
    { surah: { number: 3, name: 'آل عمران', revelation: 'مدنية', ayah_count: 200 }, ayahs: [{ ayah: 1 }, { ayah: 9 }] },
  ]
  it('رأس الصفحة: السورة وتفاصيلها يميناً، والجزء والحزب يساراً، وتذييلها رقم الصفحة', () => {
    render(
      <PageSheet page={50} groups={groups} juz={3} hizb={{ hizb: 5, quarter: 4 }} quarterStart>
        <p>نص</p>
      </PageSheet>,
    )
    const sheet = screen.getByRole('region', { name: 'الصفحة 50' })
    const header = sheet.querySelector('header')
    expect(header.children[0].textContent).toContain('سورة البقرة · سورة آل عمران')
    expect(header.children[0].textContent).toContain('الآيات ١٧–٢٥')
    expect(header.children[1].textContent).toContain('الجزء ٣')
    expect(header.children[1].textContent).toContain('الحزب ٥ · الربع ٤')
    expect(header.children[1].textContent).toContain('۞')
    expect(sheet.querySelector('footer').textContent).toBe('٥٠')
    expect(within(sheet).getByText('نص')).toBeTruthy()
  })

  it('سورة واحدة: عدد آياتها ونوعها في الرأس', () => {
    render(
      <PageSheet page={1} groups={[{ surah: { number: 1, name: 'الفاتحة', revelation: 'مكية', ayah_count: 7 }, ayahs: [{ ayah: 1 }, { ayah: 7 }] }]} juz={1} hizb={{ hizb: 1, quarter: 1 }}>
        <p />
      </PageSheet>,
    )
    expect(screen.getByText(/مكية/).textContent).toContain('٧ آية')
  })
})

describe.skipIf(!hasData)('القارئ: المصحف صفحات', () => {
  beforeAll(() => {
    resetStaticCache()
    resetRulesCache()
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      const u = String(url)
      if (u.includes('/api/')) {
        try {
          return new Response(JSON.stringify(await staticApi(u.replace(/^.*\/api/, ''))))
        } catch (e) {
          return new Response(JSON.stringify({ detail: e.message }), { status: e.status ?? 500 })
        }
      }
      const rel = u.replace(/^.*\/data\//, '')
      return existsSync(DATA + rel) ? new Response(readFileSync(DATA + rel, 'utf-8')) : new Response('', { status: 404 })
    }))
    vi.stubGlobal('scrollTo', vi.fn())
    // jsdom بلا IntersectionObserver: نتحقق من العرض نفسه لا من التحميل أثناء التمرير
    vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect() {} unobserve() {} })
  })
  afterAll(() => vi.unstubAllGlobals())

  const open = (at, kind) =>
    render(
      <SettingsProvider>
        <PlayerProvider>
          <MemoryRouter initialEntries={[at]}>
            <Routes>
              <Route path="/mushaf/:kind/:n" element={<MushafReader kind={kind} />} />
            </Routes>
          </MemoryRouter>
        </PlayerProvider>
      </SettingsProvider>,
    )

  it('صفحة ٢٥٥: صفحة واحدة بآياتها ورأسها وتذييلها', async () => {
    open('/mushaf/page/255', 'page')
    const sheet = await screen.findByRole('region', { name: 'الصفحة 255' }, { timeout: 10000 })
    expect(sheet.querySelectorAll('.ayah').length).toBeGreaterThan(3)
    expect(sheet.querySelector('header').textContent).toMatch(/سورة .*الجزء/)
    expect(sheet.querySelector('footer').textContent).toBe('٢٥٥')
  }, 20000)

  it('سورة الفاتحة: صفحة واحدة، ولافتة السورة في أولها', async () => {
    open('/mushaf/surah/1', 'surah')
    const sheet = await screen.findByRole('region', { name: 'الصفحة 1' }, { timeout: 10000 })
    expect(document.querySelectorAll('.mushaf-page').length).toBe(1)
    expect(within(sheet).getAllByText(/سورة الفاتحة/).length).toBeGreaterThanOrEqual(2) // الرأس واللافتة
    expect(sheet.querySelectorAll('.ayah').length).toBe(7)
  }, 20000)

  it('سورة البقرة: صفحاتها متتالية، ولافتة «تابع» لا تتكرر داخل الصفحات', async () => {
    open('/mushaf/surah/2', 'surah')
    await screen.findByRole('region', { name: 'الصفحة 2' }, { timeout: 10000 })
    await waitFor(() => expect(document.querySelectorAll('.mushaf-page').length).toBe(48))
    const pages = [...document.querySelectorAll('.mushaf-page')].map((e) => Number(e.dataset.page))
    expect(pages).toEqual(Array.from({ length: 48 }, (_, i) => i + 2))
    expect(screen.queryAllByText(/^تابع سورة/).length).toBe(0)
    expect(document.querySelectorAll('.ayah').length).toBe(286)
  }, 30000)

  it('الجزء ٣٠: الصفحات ٥٨٢–٦٠٤', async () => {
    open('/mushaf/juz/30', 'juz')
    await screen.findByRole('region', { name: 'الصفحة 582' }, { timeout: 10000 })
    await waitFor(() => expect(document.querySelectorAll('.mushaf-page').length).toBe(23))
    expect(document.querySelector('.mushaf-page:last-of-type, .mushaf-page:last-child')?.dataset.page ?? '604').toBe('604')
  }, 30000)
})
