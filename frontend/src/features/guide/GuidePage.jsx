import { useState } from 'react'
import { GUIDE } from './guideContent'
import { openTour } from './Onboarding'

const card = 'rounded-2xl border border-line bg-surface'

/** دليل الاستخدام (الإعدادات ← دليل الاستخدام): أقسام قابلة للطيّ، وزر لإعادة الجولة. */
export default function GuidePage() {
  const [q, setQ] = useState('')
  const needle = q.trim()
  const sections = GUIDE.map((s) => ({
    ...s,
    items: needle ? s.items.filter(([a, b]) => a.includes(needle) || b.includes(needle)) : s.items,
  })).filter((s) => s.items.length)

  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-2xl font-bold">دليل الاستخدام</h1>
      <p className="text-muted">شرح مبسّط لكل أقسام البرنامج. اضغط على أي سؤال ليظهر جوابه، أو ابحث بكلمة.</p>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={openTour} className="rounded-xl bg-accent px-4 py-2.5 font-semibold text-accent-ink hover:brightness-110">
          ▶ أعد الجولة التعريفية
        </button>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ابحث في الدليل…"
          aria-label="ابحث في الدليل"
          className="min-w-0 flex-1 rounded-xl border border-line bg-bg px-3 py-2 focus:border-accent focus:outline-none"
        />
      </div>

      {!needle && (
        <nav aria-label="أقسام الدليل" className="flex flex-wrap gap-2">
          {GUIDE.map((s) => (
            <a key={s.id} href={`#guide-${s.id}`} className="rounded-full border border-line bg-surface px-3 py-1 text-sm hover:border-accent">
              {s.icon} {s.title}
            </a>
          ))}
        </nav>
      )}

      {sections.length === 0 && <p className="rounded-xl border border-dashed border-line p-6 text-center text-muted">لا نتيجة. جرّب كلمة أخرى.</p>}

      {sections.map((s) => (
        <section key={s.id} id={`guide-${s.id}`} className="scroll-mt-20">
          <h2 className="mb-2 flex items-center gap-2 text-lg font-bold">
            <span aria-hidden="true">{s.icon}</span>
            {s.title}
          </h2>
          <div className={`${card} divide-y divide-line`}>
            {s.items.map(([question, answer]) => (
              <details key={question} className="group px-4 py-3" open={!!needle}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-medium marker:hidden">
                  {question}
                  <span className="text-muted transition group-open:rotate-90" aria-hidden="true">
                    ‹
                  </span>
                </summary>
                <p className="mt-2 leading-relaxed text-muted">{answer}</p>
              </details>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
