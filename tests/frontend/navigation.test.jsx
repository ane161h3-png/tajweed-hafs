import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { AppRoutes } from '../../frontend/src/App'
import { SettingsProvider } from '../../frontend/src/features/settings/SettingsContext'
import { PlayerProvider } from '../../frontend/src/features/player/PlayerContext'
import { SECTIONS, crumbsFor } from '../../frontend/src/data/sections'

function renderAt(path) {
  return render(
    <SettingsProvider>
      <PlayerProvider>
        <MemoryRouter initialEntries={[path]}>
          <AppRoutes />
        </MemoryRouter>
      </PlayerProvider>
    </SettingsProvider>,
  )
}

describe('شجرة الأقسام', () => {
  it('فيها الأقسام السبعة بعد الرئيسية ولكل قسم أقسام فرعية', () => {
    expect(SECTIONS.map((s) => s.id)).toEqual(['mushaf', 'ahkam', 'makharij', 'sifat', 'listen', 'quiz', 'settings'])
    for (const s of SECTIONS) expect(s.subsections.length).toBeGreaterThan(0)
  })

  it('أبواب الأحكام الأربعة عشر', () => {
    expect(SECTIONS.find((s) => s.id === 'ahkam').subsections).toHaveLength(14)
  })

  it('معرّفات الأقسام الفرعية فريدة داخل كل قسم', () => {
    for (const s of SECTIONS) expect(new Set(s.subsections.map((x) => x.id)).size).toBe(s.subsections.length)
  })
})

describe('مسار التنقل', () => {
  it('يبني القسم ثم الفرعي', () => {
    expect(crumbsFor('/ahkam/mudood').map((c) => c.title)).toEqual(['الرئيسية', 'أحكام التجويد', 'المدود'])
  })

  it('يتجاهل المسارات غير المعروفة', () => {
    expect(crumbsFor('/nope/x')).toHaveLength(1)
  })

  it('يظهر أعلى صفحة القسم الفرعي ويشير للصفحة الحالية', () => {
    renderAt('/makharij/teeth')
    const nav = screen.getByRole('navigation', { name: 'مسار التنقل' })
    expect(within(nav).getByRole('link', { name: 'الرئيسية' })).toHaveAttribute('href', '/')
    expect(within(nav).getByRole('link', { name: 'مخارج الحروف' })).toHaveAttribute('href', '/makharij')
    expect(within(nav).getByText('أسماء الأسنان')).toHaveAttribute('aria-current', 'page')
  })
})

describe('التنقل', () => {
  it('الرئيسية تعرض بطاقات كل الأقسام', () => {
    renderAt('/')
    for (const s of SECTIONS) expect(screen.getAllByRole('link', { name: new RegExp(s.title) }).length).toBeGreaterThan(0)
  })

  it('الوصول إلى قسم فرعي من الرئيسية بضغطتين (والدرس هو الثالثة)', async () => {
    const user = userEvent.setup()
    renderAt('/')
    const main = screen.getByRole('main')
    await user.click(within(main).getByRole('link', { name: /^أحكام التجويد/ }))
    await user.click(within(main).getByRole('link', { name: /القلقلة/ }))
    expect(screen.getByRole('heading', { level: 1, name: 'القلقلة' })).toBeInTheDocument()
  })

  it('شريط الموبايل فيه خمسة أزرار، و«المزيد» يفتح بقية الأقسام', async () => {
    const user = userEvent.setup()
    renderAt('/')
    const bottom = screen.getByRole('navigation', { name: 'التنقل السفلي' })
    expect(within(bottom).getAllByRole('listitem')).toHaveLength(5)
    await user.click(within(bottom).getByRole('button', { name: /المزيد/ }))
    const sheet = screen.getByRole('dialog', { name: 'بقية الأقسام' })
    // من «المزيد» إلى القسم الفرعي مباشرة
    await user.click(within(sheet).getByRole('link', { name: 'قوة الحروف' }))
    const crumbs = screen.getByRole('navigation', { name: 'مسار التنقل' })
    expect(within(crumbs).getByText('قوة الحروف')).toHaveAttribute('aria-current', 'page')
  })

  it('صفحة غير موجودة', () => {
    renderAt('/ahkam/does-not-exist')
    expect(screen.getByRole('heading', { name: 'الصفحة غير موجودة' })).toBeInTheDocument()
  })

  it('«أكمل من حيث توقفت» يرجع لآخر صفحة', () => {
    renderAt('/sifat/similar')
    cleanup()
    renderAt('/')
    expect(screen.getByRole('link', { name: /أكمل من حيث توقفت/ })).toHaveAttribute('href', '/sifat/similar')
  })
})

describe('الوضع الليلي', () => {
  it('الزر يبدّل صنف dark ويحفظه', async () => {
    const user = userEvent.setup()
    renderAt('/')
    const [toggle] = screen.getAllByRole('button', { name: 'الوضع الليلي' })
    await user.click(toggle)
    expect(document.documentElement).toHaveClass('dark')
    expect(JSON.parse(localStorage.getItem('tajweed.settings')).theme).toBe('dark')
  })
})

describe('صفحة السور', () => {
  it('تعرض رسالة واضحة إذا لم تُبنَ قاعدة البيانات', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ detail: 'قاعدة البيانات غير مبنية بعد' }), { status: 503 })))
    renderAt('/mushaf/surahs')
    expect(await screen.findByRole('alert')).toHaveTextContent('قاعدة البيانات غير مبنية بعد')
    vi.unstubAllGlobals()
  })

  it('تعرض السور من الخادم بالأرقام العربية', async () => {
    const surahs = [{ number: 2, name: 'البقرة', ayah_count: 286, revelation: 'مدنية', juz: 1 }]
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(surahs))))
    renderAt('/mushaf/surahs')
    const link = await screen.findByRole('link', { name: /سورة البقرة/ })
    expect(link).toHaveAttribute('href', '/mushaf/surah/2')
    expect(link).toHaveTextContent('٢٨٦ آية')
    vi.unstubAllGlobals()
  })
})
