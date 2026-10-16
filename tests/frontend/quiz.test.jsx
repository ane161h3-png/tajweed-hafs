import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Classify, Mcq, TrueFalse } from '../../frontend/src/features/quiz/Questions'

const CLASSIFY = {
  bins: [
    { id: 'hams', name: 'الهمس' },
    { id: 'jahr', name: 'الجهر' },
  ],
  letters: [
    { id: 'ta', char: 'ت' },
    { id: 'dal', char: 'د' },
  ],
  answer: { ta: 'hams', dal: 'jahr' },
}

describe('أسئلة الاختبار', () => {
  it('اختيار من متعدد: الإجابة الصحيحة تُعلن', async () => {
    const onAnswer = vi.fn()
    render(<Mcq q={{ options: ['أ', 'ب'], answer: 1 }} done={false} onAnswer={onAnswer} />)
    await userEvent.click(screen.getByRole('radio', { name: 'ب' }))
    expect(onAnswer).toHaveBeenCalledWith(true)
  })

  it('صح وخطأ', async () => {
    const onAnswer = vi.fn()
    render(<TrueFalse q={{ answer: false }} done={false} onAnswer={onAnswer} />)
    await userEvent.click(screen.getByRole('radio', { name: /صح/ }))
    expect(onAnswer).toHaveBeenCalledWith(false)
  })

  it('التصنيف باللمس: اختر الحرف ثم الصفة', async () => {
    const user = userEvent.setup()
    const onAnswer = vi.fn()
    render(<Classify q={CLASSIFY} done={false} onAnswer={onAnswer} />)
    await user.click(screen.getByRole('button', { name: 'ت' }))
    await user.click(screen.getByRole('button', { name: 'ضع في الهمس' }))
    await user.click(screen.getByRole('button', { name: 'د' }))
    await user.click(screen.getByRole('button', { name: 'ضع في الجهر' }))
    expect(onAnswer).toHaveBeenCalledWith(true, { placed: { ta: 'hams', dal: 'jahr' } })
  })

  it('التصنيف الخاطئ', async () => {
    const user = userEvent.setup()
    const onAnswer = vi.fn()
    render(<Classify q={CLASSIFY} done={false} onAnswer={onAnswer} />)
    await user.click(screen.getByRole('button', { name: 'ت' }))
    await user.click(screen.getByRole('button', { name: 'ضع في الجهر' }))
    await user.click(screen.getByRole('button', { name: 'د' }))
    await user.click(screen.getByRole('button', { name: 'ضع في الجهر' }))
    expect(onAnswer.mock.calls[0][0]).toBe(false)
  })
})
