import { useState } from 'react'
import { arabicNumber } from '../../lib/api'
import { FEEDBACK_URL, KINDS, MAX_LEN, mailtoLink, sendFeedback, validate } from './feedback'

const card = 'rounded-2xl border border-line bg-surface p-4'
const field = 'w-full rounded-xl border border-line bg-bg px-3 py-2 outline-none focus:border-accent'
const EMPTY = { kind: 'suggestion', message: '', contact: '' }

export default function FeedbackPage() {
  const [form, setForm] = useState(EMPTY)
  const [trap, setTrap] = useState('') // حقل مخفي: يملؤه الروبوت وحده
  const [state, setState] = useState({ status: 'idle' }) // idle | sending | sent | failed
  const set = (patch) => setForm((f) => ({ ...f, ...patch }))
  const error = state.error

  async function onSubmit(e) {
    e.preventDefault()
    const err = validate(form)
    if (err) return setState({ status: 'idle', error: err })
    if (trap) return setState({ status: 'sent' })
    if (!FEEDBACK_URL) {
      window.location.href = mailtoLink(form)
      return setState({ status: 'mailed' })
    }
    setState({ status: 'sending' })
    try {
      await sendFeedback(form)
      setState({ status: 'sent' })
      setForm(EMPTY)
    } catch {
      setState({ status: 'failed' })
    }
  }

  if (state.status === 'sent') {
    return (
      <div className="max-w-2xl">
        <div className={`${card} text-center`} role="status">
          <p className="text-3xl" aria-hidden="true">✓</p>
          <h1 className="mt-2 text-xl font-bold">وصلت رسالتك، جزاك الله خيراً</h1>
          <p className="mt-1 text-sm text-muted">يقرؤها صاحب البرنامج وحده، ولا تظهر لأي مستخدم آخر.</p>
          <button type="button" onClick={() => setState({ status: 'idle' })} className="mt-4 rounded-lg border border-line px-4 py-2 text-sm">
            رسالة أخرى
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold">الشكاوى والاقتراحات</h1>
        <p className="mt-1 text-sm text-muted">
          اكتب شكواك أو اقتراحك لإضافة جديدة. تصل الرسالة إلى صاحب البرنامج وحده، ولا يراها أي مستخدم آخر.
        </p>
      </div>

      <form onSubmit={onSubmit} className={`${card} space-y-4`} noValidate>
        <fieldset>
          <legend className="mb-2 font-semibold">نوع الرسالة</legend>
          <div className="grid gap-2 sm:grid-cols-3" role="radiogroup">
            {KINDS.map((k) => (
              <label
                key={k.id}
                className={`cursor-pointer rounded-xl border px-3 py-2 ${form.kind === k.id ? 'border-accent bg-accent-soft' : 'border-line'}`}
              >
                <input type="radio" name="kind" value={k.id} checked={form.kind === k.id} onChange={() => set({ kind: k.id })} className="sr-only" />
                <span className={`block text-sm font-semibold ${form.kind === k.id ? 'text-accent' : ''}`}>{k.label}</span>
                <span className="block text-xs text-muted">{k.hint}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div>
          <label htmlFor="fb-message" className="mb-1 block font-semibold">
            رسالتك
          </label>
          <textarea
            id="fb-message"
            rows={6}
            maxLength={MAX_LEN}
            value={form.message}
            onChange={(e) => set({ message: e.target.value })}
            className={field}
            placeholder={form.kind === 'suggestion' ? 'مثلاً: أتمنى إضافة…' : 'صف ما حدث، وفي أي صفحة…'}
          />
          <p className="mt-1 text-start text-xs text-muted">
            {arabicNumber(form.message.length)} / {arabicNumber(MAX_LEN)}
          </p>
        </div>

        <div>
          <label htmlFor="fb-contact" className="mb-1 block font-semibold">
            وسيلة للتواصل معك <span className="text-sm font-normal text-muted">(اختياري)</span>
          </label>
          <input
            id="fb-contact"
            type="text"
            dir="auto"
            maxLength={200}
            value={form.contact}
            onChange={(e) => set({ contact: e.target.value })}
            className={field}
            placeholder="بريد أو رقم واتساب إن أردت الرد"
          />
        </div>

        <input
          type="text"
          name="_gotcha"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          value={trap}
          onChange={(e) => setTrap(e.target.value)}
          className="hidden"
        />

        {error && (
          <p className="text-sm text-[#c0392b]" role="alert">
            {error}
          </p>
        )}
        {state.status === 'failed' && (
          <div className="rounded-xl border border-line bg-surface-2 p-3 text-sm" role="alert">
            تعذّر الإرسال (ربما لا يوجد اتصال بالإنترنت). رسالتك لم تُحذف، فأعد المحاولة، أو{' '}
            <a href={mailtoLink(form)} className="text-accent underline-offset-4 hover:underline">
              أرسلها بالبريد
            </a>
            .
          </div>
        )}
        {state.status === 'mailed' && (
          <p className="rounded-xl border border-line bg-surface-2 p-3 text-sm" role="status">
            فُتح تطبيق البريد برسالتك جاهزة، اضغط «إرسال» فيه لتصل.
          </p>
        )}

        <button
          type="submit"
          disabled={state.status === 'sending'}
          className="rounded-lg bg-accent px-5 py-2 font-medium text-accent-ink disabled:opacity-60"
        >
          {state.status === 'sending' ? 'جارٍ الإرسال…' : 'أرسل'}
        </button>
      </form>
    </div>
  )
}
