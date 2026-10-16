import { useEffect, useMemo, useRef, useState } from 'react'
import { arabicNumber, useApi } from '../../lib/api'
import { usePlayer } from '../player/PlayerContext'
import { itemUrl } from '../player/queue'
import HeadDiagram from '../makharij/HeadDiagram'
import { useLetters } from '../makharij/letters'
import { tokens } from './text'

// كل سؤال يستدعي onAnswer(correct, details) مرة واحدة، ثم يعرض الإجابة الصحيحة (done = true).

const choice = (state) =>
  `w-full rounded-xl border px-4 py-2.5 text-start transition ${
    state === 'right'
      ? 'border-accent bg-accent-soft font-semibold text-accent'
      : state === 'wrong'
        ? 'border-[var(--pen-red)] bg-[var(--pen-red)]/10 text-[var(--pen-red)]'
        : 'border-line bg-surface hover:border-accent'
  }`

export function Mcq({ q, done, onAnswer }) {
  const [picked, setPicked] = useState(null)
  return (
    <div>
      {q.ayah_text && (
        <blockquote className="font-quran mb-3 rounded-xl border border-line bg-surface px-4 py-2 !text-xl">
          {q.ayah_text} <span className="text-sm text-muted">[{q.surah_name}: {arabicNumber(q.ayah)}]</span>
        </blockquote>
      )}
      <ul className={q.big_options ? 'grid grid-cols-4 gap-2' : 'space-y-2'} role="radiogroup" aria-label="الخيارات">
        {q.options.map((o, i) => {
          const state = done ? (i === q.answer ? 'right' : i === picked ? 'wrong' : null) : null
          return (
            <li key={i}>
              <button
                type="button"
                role="radio"
                aria-checked={picked === i}
                disabled={done}
                onClick={() => {
                  setPicked(i)
                  onAnswer(i === q.answer)
                }}
                className={`${choice(state)} ${q.big_options ? 'text-center font-quran !text-3xl' : ''}`}
              >
                {o}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function TrueFalse({ q, done, onAnswer }) {
  const [picked, setPicked] = useState(null)
  return (
    <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="صح أو خطأ">
      {[
        [true, 'صح ✓'],
        [false, 'خطأ ✗'],
      ].map(([v, label]) => {
        const state = done ? (v === q.answer ? 'right' : v === picked ? 'wrong' : null) : null
        return (
          <button
            key={label}
            type="button"
            role="radio"
            aria-checked={picked === v}
            disabled={done}
            onClick={() => {
              setPicked(v)
              onAnswer(v === q.answer)
            }}
            className={`${choice(state)} text-center text-lg`}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}

export function Spot({ q, done, onAnswer }) {
  const { data } = useLetters()
  const [picked, setPicked] = useState(null)
  return (
    <div className="max-w-xl">
      <HeadDiagram
        quiz
        labels={false}
        picked={picked}
        correct={done ? q.answer : null}
        makhraj={done && data ? data.makhrajById[q.answer] : null}
        onSpot={(id) => {
          if (done) return
          setPicked(id)
          onAnswer(id === q.answer)
        }}
      />
      <p className="mt-1 text-xs text-muted">النقاط الباهتة مواضع المخارج السبعة عشر؛ اضغط واحدة.</p>
    </div>
  )
}

/** سحب وإفلات، ومعه بديل باللمس ولوحة المفاتيح: اختر حرفاً ثم اضغط الصفة. */
export function Classify({ q, done, onAnswer }) {
  const [placed, setPlaced] = useState({})
  const [selected, setSelected] = useState(null)
  const remaining = q.letters.filter((l) => !placed[l.id])
  const place = (letterId, binId) => {
    if (done) return
    const next = { ...placed, [letterId]: binId }
    setPlaced(next)
    setSelected(null)
    if (Object.keys(next).length === q.letters.length) {
      const allRight = q.letters.every((l) => next[l.id] === q.answer[l.id])
      onAnswer(allRight, { placed: next })
    }
  }
  const tile = (l, inBin) => {
    const wrong = done && placed[l.id] !== q.answer[l.id]
    return (
      <button
        key={l.id}
        type="button"
        draggable={!done}
        onDragStart={(e) => e.dataTransfer.setData('text/plain', l.id)}
        onClick={() => !done && (inBin ? setPlaced(({ [l.id]: _, ...rest }) => rest) : setSelected(selected === l.id ? null : l.id))}
        aria-pressed={selected === l.id}
        className={`glyph size-12 rounded-xl border text-3xl ${
          wrong ? 'border-[var(--pen-red)] text-[var(--pen-red)]' : done ? 'border-accent text-accent' : selected === l.id ? 'border-accent bg-accent-soft' : 'border-line bg-surface'
        }`}
      >
        {l.char}
      </button>
    )
  }
  return (
    <div>
      <div className="mb-3 flex min-h-14 flex-wrap gap-2 rounded-xl border border-dashed border-line p-2" aria-label="الحروف">
        {remaining.map((l) => tile(l, false))}
        {remaining.length === 0 && <span className="text-sm text-muted">صنّفتَ كل الحروف.</span>}
      </div>
      <div className={`grid gap-3 ${q.bins.length === 3 ? 'sm:grid-cols-3' : 'grid-cols-2'}`}>
        {q.bins.map((b) => (
          <div
            key={b.id}
            role="button"
            tabIndex={0}
            onClick={() => selected && place(selected, b.id)}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && selected && place(selected, b.id)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => place(e.dataTransfer.getData('text/plain'), b.id)}
            aria-label={`ضع في ${b.name}`}
            className={`min-h-28 rounded-xl border-2 p-2 ${selected ? 'border-accent/60 bg-accent-soft/40' : 'border-line bg-surface'}`}
          >
            <p className="mb-2 text-center font-semibold">{b.name}</p>
            <div className="flex flex-wrap justify-center gap-2">{q.letters.filter((l) => placed[l.id] === b.id).map((l) => tile(l, true))}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

/** اضغط كلمة فيها الحكم؛ التصحيح من مواضع الأحكام في نص الآية. */
export function Extract({ q, done, onAnswer }) {
  const { data } = useApi(`/ayah/${q.surah}/${q.ayah}`)
  const [picked, setPicked] = useState(null)
  const words = useMemo(() => (data ? tokens(data.text) : []), [data])
  const hits = useMemo(() => {
    if (!data) return new Set()
    const marks = data.tajweed.filter((m) => m.rule === q.rule)
    return new Set(words.filter((w) => marks.some((m) => m.start < w.end && m.end > w.start)).map((w) => w.start))
  }, [data, words, q.rule])
  if (!data) return <p className="text-muted">جارٍ تحميل الآية…</p>
  return (
    <div>
      <p className="font-quran flex flex-wrap gap-x-1.5 rounded-xl border border-line bg-surface px-4 py-3 !text-2xl">
        {words.map((w) => {
          const right = done && hits.has(w.start)
          const wrong = done && picked === w.start && !hits.has(w.start)
          return (
            <button
              key={w.start}
              type="button"
              disabled={done}
              onClick={() => {
                setPicked(w.start)
                onAnswer(hits.has(w.start))
              }}
              className={`rounded px-1 ${right ? 'bg-accent-soft text-accent ring-1 ring-accent' : wrong ? 'bg-[var(--pen-red)]/10 text-[var(--pen-red)] line-through' : 'hover:bg-surface-2'}`}
            >
              {w.text}
            </button>
          )
        })}
        <span className="text-gold">﴿{arabicNumber(q.ayah)}﴾</span>
      </p>
      <p className="mt-1 text-xs text-muted">{data.surah_name}</p>
    </div>
  )
}

export function Listen({ q, done, onAnswer }) {
  const { reciter } = usePlayer()
  const audio = useRef(null)
  const [playing, setPlaying] = useState(false)
  const url = reciter?.ayah_url ? itemUrl({ kind: 'ayah', surah: q.surah, ayah: q.ayah }, reciter) : null
  useEffect(() => () => audio.current?.pause(), [])
  const play = () => {
    audio.current?.pause()
    audio.current = new Audio(url)
    audio.current.onended = () => setPlaying(false)
    audio.current.play().then(() => setPlaying(true), () => setPlaying(false))
  }
  return (
    <div>
      <button type="button" onClick={play} disabled={!url} className="mb-3 flex items-center gap-2 rounded-xl bg-accent px-5 py-3 font-medium text-accent-ink disabled:opacity-50">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d={playing ? 'M7 5h4v14H7zM13 5h4v14h-4z' : 'M8 5v14l11-7z'} />
        </svg>
        {playing ? 'يُتلى الآن…' : 'استمع إلى الآية'}
      </button>
      {!url && <p className="mb-2 text-sm text-muted">اختر قارئاً له تلاوة آية آية من الإعدادات.</p>}
      <Mcq q={q} done={done} onAnswer={onAnswer} />
      {done && (
        <p className="font-quran mt-3 text-lg text-muted">
          الشاهد: {q.word} — {q.surah_name} {arabicNumber(q.ayah)}
        </p>
      )}
    </div>
  )
}

export const QUESTION_TYPES = { mcq: Mcq, tf: TrueFalse, spot: Spot, classify: Classify, extract: Extract, listen: Listen }
export const TYPE_NAMES = {
  mcq: 'اختيار من متعدد',
  tf: 'صح أو خطأ',
  spot: 'حدّد المخرج على الرسم',
  classify: 'صنّف الحروف',
  extract: 'استخرج الحكم من الآية',
  listen: 'استمع وحدّد الحكم',
}
