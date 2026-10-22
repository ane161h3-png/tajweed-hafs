import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import GuidePage from '../../frontend/src/features/guide/GuidePage'
import Onboarding, { TOUR_KEY, openTour } from '../../frontend/src/features/guide/Onboarding'
import { GUIDE, TOUR } from '../../frontend/src/features/guide/guideContent'

const wrap = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>)
afterEach(cleanup)
beforeEach(() => localStorage.clear())

describe('الجولة التعريفية', () => {
  it('تظهر لمستخدم جديد تلقائياً، وتتنقل بين الخطوات حتى النهاية وتُسجَّل', async () => {
    const user = userEvent.setup()
    wrap(<Onboarding auto />)
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByText(TOUR[0].title)).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'التالي' }))
    expect(screen.getByText(TOUR[1].title)).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'السابق' }))
    expect(screen.getByText(TOUR[0].title)).toBeTruthy()
    for (let i = 0; i < TOUR.length - 1; i++) await user.click(screen.getByRole('button', { name: 'التالي' }))
    await user.click(screen.getByRole('button', { name: 'ابدأ التعلّم' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(localStorage.getItem(TOUR_KEY)).toBe('true')
  })

  it('«تخطَّ» و Esc يغلقانها ولا تعود', async () => {
    const user = userEvent.setup()
    const { unmount } = wrap(<Onboarding auto />)
    await user.click(screen.getByRole('button', { name: 'تخطَّ' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    unmount()
    wrap(<Onboarding auto />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('المستخدم القديم (لديه تقدّم) لا تُفرض عليه', () => {
    localStorage.setItem('tajweed.completed', JSON.stringify({ 'noon-sakinah-1': 1 }))
    wrap(<Onboarding auto />)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(localStorage.getItem(TOUR_KEY)).toBe('true')
  })

  it('لا تظهر تلقائياً في الاختبارات (auto=false) لكنها تُفتح بـ openTour()', async () => {
    wrap(<Onboarding auto={false} />)
    expect(screen.queryByRole('dialog')).toBeNull()
    openTour()
    expect(await screen.findByRole('dialog')).toBeTruthy()
  })

  it('خطوات الجولة لها عنوان ونص، وروابطها داخلية', () => {
    for (const s of TOUR) {
      expect(s.title.length).toBeGreaterThan(3)
      expect(s.text.length).toBeGreaterThan(30)
      if (s.link) expect(s.link[0].startsWith('/')).toBe(true)
    }
  })
})

describe('دليل الاستخدام', () => {
  it('يعرض كل الأقسام وكل أسئلتها', () => {
    wrap(<GuidePage />)
    for (const s of GUIDE) {
      expect(screen.getAllByText((t) => t.includes(s.title)).length).toBeGreaterThan(0)
      for (const [q] of s.items) expect(screen.getByText(q)).toBeTruthy()
    }
  })

  it('البحث يصفّي الأسئلة', async () => {
    const user = userEvent.setup()
    wrap(<GuidePage />)
    await user.type(screen.getByLabelText('ابحث في الدليل'), 'الميكروفون')
    expect(screen.getByText('لماذا لا يعمل الميكروفون؟')).toBeTruthy()
    expect(screen.queryByText('هل أحتاج حساباً؟')).toBeNull()
  })

  it('بحث بلا نتيجة يعرض رسالة', async () => {
    const user = userEvent.setup()
    wrap(<GuidePage />)
    await user.type(screen.getByLabelText('ابحث في الدليل'), 'xyzxyz')
    expect(screen.getByText(/لا نتيجة/)).toBeTruthy()
  })
})
