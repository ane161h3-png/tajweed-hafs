import { useCallback, useEffect, useRef, useState } from 'react'
import HeadDiagram from './HeadDiagram'
import LipsFront from './LipsFront'
import { LIP_LETTERS, articulation } from './articulation'

// تسجيلات نطق الحروف (اختيارية): ضع ملفاتها في frontend/public/audio/letters/{id}.mp3
const audioUrl = (id) => `${import.meta.env.BASE_URL}audio/letters/${id}.mp3`
const availability = new Map()

async function hasRecording(id) {
  if (!availability.has(id)) {
    availability.set(
      id,
      fetch(audioUrl(id), { method: 'HEAD' })
        .then((r) => r.ok && (r.headers.get('content-type') ?? '').startsWith('audio'))
        .catch(() => false),
    )
  }
  return availability.get(id)
}

const PHASE_TEXT = { rest: 'وضع البداية', contact: 'لحظة الاعتماد على المخرج', release: 'الانفصال' }

/**
 * رسم الحرف مع زر «انطق»: البداية ← الاعتماد على المخرج ← الانفصال، مرتين.
 * إن وُجد تسجيل للحرف شُغّل مع لحظة الاعتماد.
 */
export default function LetterPlayer({ letter, makhraj, labels = true }) {
  const [phase, setPhase] = useState('contact')
  const [playing, setPlaying] = useState(false)
  const [recording, setRecording] = useState(false)
  const timers = useRef([])
  const audio = useRef(null)
  const art = articulation(letter)

  useEffect(() => {
    setPhase('contact')
    let alive = true
    hasRecording(letter.id).then((ok) => alive && setRecording(ok))
    return () => {
      alive = false
      timers.current.forEach(clearTimeout)
      audio.current?.pause()
    }
  }, [letter.id])

  const play = useCallback(() => {
    timers.current.forEach(clearTimeout)
    timers.current = []
    setPlaying(true)
    const seq = [
      ['rest', 0],
      ['contact', 450],
      ['release', 1500],
      ['rest', 2200],
      ['contact', 2650],
      ['release', 3700],
      ['contact', 4400],
    ]
    for (const [p, at] of seq) {
      timers.current.push(
        setTimeout(() => {
          setPhase(p)
          if (p === 'contact' && recording && at < 4000) {
            audio.current ??= new Audio(audioUrl(letter.id))
            audio.current.currentTime = 0
            audio.current.play().catch(() => {})
          }
        }, at),
      )
    }
    timers.current.push(setTimeout(() => setPlaying(false), 4500))
  }, [letter.id, recording])

  return (
    <div>
      <div className="relative">
        <HeadDiagram makhraj={makhraj} art={art} phase={phase} labels={labels} />
        {LIP_LETTERS.has(letter.id) && (
          <div className="absolute bottom-1 end-1 w-28 rounded-xl border border-line bg-surface/90 p-1 sm:w-36">
            <LipsFront pose={phase === 'contact' ? art.lips[1] : 'rest'} />
            <p className="text-center text-[10px] text-muted">منظر أمامي</p>
          </div>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={play}
          disabled={playing}
          className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 font-medium text-accent-ink hover:brightness-110 disabled:opacity-60"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M8 5v14l11-7z" />
          </svg>
          انطق <span className="font-quran text-lg leading-none">{letter.pronounce}</span>
        </button>
        <span className="text-sm text-muted" aria-live="polite">
          {PHASE_TEXT[phase]}
        </span>
        <span className="ms-auto flex flex-wrap gap-3 text-xs text-muted">
          <span>
            <span className="inline-block h-0.5 w-5 bg-[var(--mk-air,#2b7de9)] align-middle" /> مسار الهواء والصوت
          </span>
          {art.air === 'blocked' && <span>الحرف شديد: ينحبس الصوت عند المخرج</span>}
          {art.air === 'weak' && <span>الحرف متوسط: يجري الصوت جرياناً ناقصاً</span>}
          {art.nasal && <span>يمر الصوت من الأنف (الغنة)</span>}
        </span>
      </div>
      {!recording && (
        <p className="mt-2 text-xs text-muted">
          لا يوجد تسجيل صوتي لهذا الحرف بعد؛ الحركة تعمل بلا صوت. يمكن إضافة تسجيل المقرئ في
          <code className="mx-1" dir="ltr">public/audio/letters/{letter.id}.mp3</code>
        </p>
      )}
    </div>
  )
}
