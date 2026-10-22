import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { arabicNumber } from '../../lib/api'
import { readJSON, writeJSON } from '../../lib/storage'
import { TOUR } from './guideContent'

export const TOUR_KEY = 'tajweed.onboarded'
export const TOUR_EVENT = 'tajweed:tour'

/** يفتح الجولة من أي مكان (زر «أعد الجولة» في الدليل). */
export const openTour = () => window.dispatchEvent(new Event(TOUR_EVENT))

/** مستخدم قديم: لديه تقدّم محفوظ، فلا تُفرض عليه الجولة. */
function hasProgress() {
  return !!(readJSON('tajweed.lastVisited', null) || Object.keys(readJSON('tajweed.completed', {})).length || Object.keys(readJSON('tajweed.quiz', {})).length)
}

/**
 * جولة المستخدم الجديد: تظهر مرة واحدة عند أول فتح، وتُعاد من الإعدادات.
 * auto=false (الاختبارات): لا تظهر تلقائياً لكنها تستجيب لـ openTour().
 */
export default function Onboarding({ auto = import.meta.env.MODE !== 'test' }) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)
  const navigate = useNavigate()
  const next = useRef(null)

  const finish = useCallback(() => {
    writeJSON(TOUR_KEY, true)
    setOpen(false)
  }, [])

  useEffect(() => {
    if (auto && !readJSON(TOUR_KEY, false)) {
      if (hasProgress()) writeJSON(TOUR_KEY, true)
      else setOpen(true)
    }
    const show = () => {
      setStep(0)
      setOpen(true)
    }
    window.addEventListener(TOUR_EVENT, show)
    return () => window.removeEventListener(TOUR_EVENT, show)
  }, [auto])

  useEffect(() => {
    if (!open) return
    next.current?.focus()
    const onKey = (e) => e.key === 'Escape' && finish()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, step, finish])

  if (!open) return null
  const s = TOUR[step]
  const last = step === TOUR.length - 1
  const go = (path) => {
    finish()
    navigate(path)
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/55 p-3 sm:items-center" role="presentation">
      <div role="dialog" aria-modal="true" aria-labelledby="tour-title" className="w-full max-w-md rounded-3xl border border-line bg-surface p-5 shadow-2xl">
        <div className="mb-3 flex items-center justify-between text-xs text-muted">
          <span aria-live="polite">
            الخطوة {arabicNumber(step + 1)} من {arabicNumber(TOUR.length)}
          </span>
          <button type="button" onClick={finish} className="rounded-md px-2 py-1 hover:text-ink">
            تخطَّ
          </button>
        </div>

        <div className="mb-3 grid size-14 place-items-center rounded-2xl bg-accent-soft text-3xl" aria-hidden="true">
          {s.icon}
        </div>
        <h2 id="tour-title" className="mb-2 text-xl font-bold">
          {s.title}
        </h2>
        <p className="min-h-[7.5rem] leading-relaxed text-muted">{s.text}</p>
        {s.link && (
          <button type="button" onClick={() => go(s.link[0])} className="mt-2 text-sm font-medium text-accent underline-offset-4 hover:underline">
            {s.link[1]} ←
          </button>
        )}

        <div className="mt-4 flex justify-center gap-1.5" aria-hidden="true">
          {TOUR.map((_, i) => (
            <span key={i} className={`h-1.5 rounded-full transition-all ${i === step ? 'w-5 bg-accent' : 'w-1.5 bg-line'}`} />
          ))}
        </div>

        <div className="mt-4 flex gap-2">
          {step > 0 && (
            <button type="button" onClick={() => setStep(step - 1)} className="rounded-xl border border-line px-4 py-2.5 font-medium">
              السابق
            </button>
          )}
          <button
            ref={next}
            type="button"
            onClick={() => (last ? finish() : setStep(step + 1))}
            className="flex-1 rounded-xl bg-accent px-4 py-2.5 font-semibold text-accent-ink hover:brightness-110"
          >
            {last ? 'ابدأ التعلّم' : 'التالي'}
          </button>
        </div>
      </div>
    </div>
  )
}
