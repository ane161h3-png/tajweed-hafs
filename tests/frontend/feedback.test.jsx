import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { buildPayload, CONTACT_EMAIL, mailtoLink, sendFeedback, validate } from '../../frontend/src/features/feedback/feedback'
import FeedbackPage from '../../frontend/src/features/feedback/FeedbackPage'
import { findSubsection } from '../../frontend/src/data/sections'

const form = { kind: 'suggestion', message: '  أتمنى إضافة قسم للتسميع الجماعي  ', contact: '' }
const info = { platform: 'web', page: '/settings/feedback', version: 't1' }

describe('صندوق الشكاوى والاقتراحات', () => {
  it('موجود في الإعدادات', () => {
    expect(findSubsection('settings', 'feedback')?.title).toBe('الشكاوى والاقتراحات')
  })

  it('يتحقق من النوع وطول الرسالة', () => {
    expect(validate(form)).toBeNull()
    expect(validate({ ...form, kind: 'x' })).toMatch('نوع')
    expect(validate({ ...form, message: ' ' })).toMatch('اكتب')
    expect(validate({ ...form, message: 'ا'.repeat(2001) })).toMatch('أطول')
  })

  it('الحمولة تحمل النص المنظّف والنوع بالعربية، ووسيلة التواصل اختيارية', () => {
    const p = buildPayload(form, info)
    expect(p.message).toBe('أتمنى إضافة قسم للتسميع الجماعي')
    expect(p.type).toBe('اقتراح إضافة')
    expect(p.contact).toBe('لم يُذكر')
    expect(p.subject).toContain('اقتراح إضافة')
  })

  it('رابط البريد موجّه إلى صاحب البرنامج وحده', () => {
    const link = mailtoLink(form, info)
    expect(link.startsWith(`mailto:${CONTACT_EMAIL}?`)).toBe(true)
    expect(decodeURIComponent(link)).toContain('أتمنى إضافة قسم')
  })

  it('يرسل JSON إلى عنوان النموذج ويرمي خطأ عند الفشل', async () => {
    const ok = vi.fn().mockResolvedValue({ ok: true })
    await sendFeedback(form, { fetchImpl: ok, url: 'https://example.test/f' })
    const [url, opts] = ok.mock.calls[0]
    expect(url).toBe('https://example.test/f')
    expect(opts.method).toBe('POST')
    expect(JSON.parse(opts.body).message).toBe('أتمنى إضافة قسم للتسميع الجماعي')

    const bad = vi.fn().mockResolvedValue({ ok: false, status: 500 })
    await expect(sendFeedback(form, { fetchImpl: bad, url: 'https://example.test/f' })).rejects.toThrow()
    await expect(sendFeedback(form, { fetchImpl: ok, url: '' })).rejects.toThrow('no-endpoint')
  })

  it('الصفحة تمنع إرسال رسالة فارغة', () => {
    render(
      <MemoryRouter>
        <FeedbackPage />
      </MemoryRouter>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'أرسل' }))
    expect(screen.getByRole('alert').textContent).toMatch('اكتب رسالتك')
  })
})
