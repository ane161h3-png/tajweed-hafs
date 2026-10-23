import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import AyahAnalysis from '../../frontend/src/features/ayah/AyahAnalysis'
import AyahSheet from '../../frontend/src/features/mushaf/AyahSheet'
import { PlayerProvider } from '../../frontend/src/features/player/PlayerContext'
import { SettingsProvider } from '../../frontend/src/features/settings/SettingsContext'
import { resetRulesCache } from '../../frontend/src/features/mushaf/useRules'
import { resetStaticCache, staticApi } from '../../frontend/src/lib/staticApi'

const here = (p) => fileURLToPath(new URL(p, import.meta.url))
const DATA = here('../../frontend/public/data/')
const hasData = existsSync(DATA + 'letters.json')

const shell = (ui, at) => (
  <SettingsProvider>
    <PlayerProvider>
      <MemoryRouter initialEntries={[at]}>{ui}</MemoryRouter>
    </PlayerProvider>
  </SettingsProvider>
)

afterEach(cleanup)

describe.skipIf(!hasData)('صفحة تحليل الآية', () => {
  beforeAll(() => {
    resetStaticCache()
    resetRulesCache()
    // واجهة /api تُجاب من ملفات البيانات نفسها عبر الوضع الثابت
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
      if (!existsSync(DATA + rel)) return new Response('', { status: 404 })
      return new Response(readFileSync(DATA + rel, 'utf-8'))
    }))
    vi.stubGlobal('scrollTo', vi.fn())
  })
  afterAll(() => vi.unstubAllGlobals())

  const page = (at) =>
    render(
      shell(
        <Routes>
          <Route path="/ayah/:surah/:ayah" element={<AyahAnalysis />} />
        </Routes>,
        at,
      ),
    )

  it('تعرض الآية كلها بأجزائها الثلاثة: الأحكام والمخارج والصفات', async () => {
    page('/ayah/1/2')
    expect(await screen.findByText(/الآية ٢/, {}, { timeout: 8000 })).toBeTruthy()
    for (const t of ['١. الأحكام', '٢. المخارج', '٣. الصفات']) expect(await screen.findByRole('heading', { name: t })).toBeTruthy()
    expect(screen.getByText(/الآية كاملة/)).toBeTruthy()
    // كلمات الآية أزرار قابلة للضغط
    expect(screen.getAllByRole('button', { pressed: false }).length).toBeGreaterThanOrEqual(4)
  }, 15000)

  it('الضغط على كلمة يحصر التحليل فيها ويعرض حروفها، وثانية تعيد الآية كلها', async () => {
    const user = userEvent.setup()
    page('/ayah/1/2')
    await screen.findByRole('heading', { name: '٢. المخارج' }, { timeout: 8000 })
    const words = screen.getAllByRole('button', { pressed: false }).filter((b) => b.classList.contains('font-quran'))
    expect(words.length).toBe(4) // ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَـٰلَمِينَ
    expect(screen.queryByText('حروف الكلمة')).toBeNull()
    await user.click(words[2])
    expect(await screen.findByText('حروف الكلمة')).toBeTruthy()
    expect(screen.getAllByRole('button', { pressed: true }).length).toBe(1)
    await user.click(screen.getAllByRole('button', { pressed: true })[0])
    await waitFor(() => expect(screen.queryByText('حروف الكلمة')).toBeNull())
  }, 20000)

  it('الكلمة المحدّدة من الرابط (?w=) تُحلَّل وحدها', async () => {
    page('/ayah/1/2?w=2')
    expect(await screen.findByText('حروف الكلمة', {}, { timeout: 8000 })).toBeTruthy()
    // «رَبِّ»: راء مشددة وباء مشددة: مخرجان (اللسان، الشفتان)
    const mk = await screen.findByRole('heading', { name: '٢. المخارج' })
    const part = mk.closest('section')
    expect(within(part).getAllByRole('article').length).toBe(2)
  }, 15000)

  it('آية غير موجودة: رسالة خطأ لا شاشة بيضاء', async () => {
    page('/ayah/1/99')
    expect(await screen.findByRole('alert', {}, { timeout: 8000 })).toBeTruthy()
  }, 15000)
})

describe('لوحة الآية في المصحف', () => {
  const byId = {
    madd_6: { id: 'madd_6', name: 'المد اللازم', description: 'يُمد ست حركات لزوماً.' },
    ghunnah: { id: 'ghunnah', name: 'الغنة', description: 'صوت في الخيشوم.' },
  }
  const target = { surah: 2, ayah: 1, text: 'الٓمٓ', surahName: 'البقرة', juz: 1, tajweed: [{ rule: 'madd_6', start: 0, end: 2 }, { rule: 'madd_6', start: 2, end: 4 }, { rule: 'ghunnah', start: 4, end: 5 }] }
  const base = () => ({
    target,
    rule: null,
    onClose: vi.fn(),
    hasPrev: false,
    hasNext: true,
    onNeighbor: vi.fn(),
    onPlay: vi.fn(),
    onRepeat: vi.fn(),
    bookmarked: false,
    onBookmark: vi.fn(),
    pageNo: 2,
    byId,
    lessonFor: (id) => (id === 'madd_6' ? { id: 'mudood-8', section: 'mudood' } : null),
    colorOf: () => '#b00',
    onFocusRule: vi.fn(),
  })
  const open = (over = {}) => {
    const props = { ...base(), ...over }
    render(shell(<AyahSheet {...props} />, '/'))
    return props
  }

  it('تعرض الآية ورقم صفحتها وأحكامها بأعدادها', () => {
    open()
    expect(screen.getByRole('dialog', { name: /الآية 2 .*|الآية 1 من سورة البقرة/ })).toBeTruthy()
    expect(screen.getByText(/سورة البقرة · الآية ١/)).toBeTruthy()
    expect(screen.getByText(/الصفحة ٢/, { selector: 'p' })).toBeTruthy()
    expect(screen.getByRole('button', { name: /المد اللازم/ }).textContent).toContain('×٢')
  })

  it('الاستماع والتكرار والإغلاق والعلامة المرجعية تستدعي أفعالها', async () => {
    const user = userEvent.setup()
    const p = open()
    await user.click(screen.getByRole('button', { name: /استمع/ }))
    expect(p.onPlay).toHaveBeenCalledWith(2, 1)
    await user.click(screen.getByRole('button', { name: /كرّر/ }))
    expect(p.onRepeat).toHaveBeenCalledWith(2, 1)
    await user.click(screen.getByRole('button', { name: /علامة مرجعية/ }))
    expect(p.onBookmark).toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'إغلاق' }))
    expect(p.onClose).toHaveBeenCalled()
  })

  it('الضغط على حكم يعرض وصفه ورابط درسه، وثانية تخفيه', async () => {
    const user = userEvent.setup()
    open()
    expect(screen.queryByText('يُمد ست حركات لزوماً.')).toBeNull()
    await user.click(screen.getByRole('button', { name: /المد اللازم/ }))
    expect(screen.getByText('يُمد ست حركات لزوماً.')).toBeTruthy()
    expect(screen.getByRole('link', { name: /درس هذا الحكم/ }).getAttribute('href')).toBe('/ahkam/mudood/mudood-8')
    await user.click(screen.getByRole('button', { name: /المد اللازم/ }))
    expect(screen.queryByText('يُمد ست حركات لزوماً.')).toBeNull()
  })

  it('الحكم المضغوط من الصفحة يظهر مفتوحاً، وزر التحليل يفتح صفحة الآية', () => {
    open({ rule: 'ghunnah' })
    expect(screen.getByText('صوت في الخيشوم.')).toBeTruthy()
    expect(screen.getByRole('link', { name: /تحليل الآية/ }).getAttribute('href')).toBe('/ayah/2/1')
  })

  it('التنقل بين الآيات: السابق معطّل في الأولى والتالي يعمل', async () => {
    const user = userEvent.setup()
    const p = open()
    expect(screen.getByRole('button', { name: 'الآية السابقة' }).disabled).toBe(true)
    await user.click(screen.getByRole('button', { name: 'الآية التالية' }))
    expect(p.onNeighbor).toHaveBeenCalledWith(1)
  })

  it('Esc يغلق اللوحة', async () => {
    const user = userEvent.setup()
    const p = open()
    await user.keyboard('{Escape}')
    expect(p.onClose).toHaveBeenCalled()
  })
})
