import { useMemo, useState } from 'react'
import { arabicNumber, useApi } from '../../lib/api'
import { tokens } from '../../lib/matching'
import { Mcq } from '../quiz/Questions'
import { record, shuffle } from '../quiz/srs'

/** «أين الشاهد؟»: اضغط في الآية الكلمة التي فيها الحكم (التصحيح من موضع الشاهد). */
function FindWord({ ex, done, onAnswer }) {
  const [picked, setPicked] = useState(null)
  const words = useMemo(() => tokens(ex.ayah_text), [ex.ayah_text])
  const hit = (w) => ex.match && w.start < ex.match[1] && w.end > ex.match[0]
  return (
    <p className="font-quran flex flex-wrap gap-x-1.5 rounded-xl border border-line bg-surface px-3 py-2 !text-xl leading-loose">
      {words.map((w) => (
        <button
          key={w.start}
          type="button"
          disabled={done}
          onClick={() => {
            setPicked(w.start)
            onAnswer(hit(w))
          }}
          className={`rounded px-1 ${
            done && hit(w) ? 'bg-accent-soft text-accent ring-1 ring-accent' : done && picked === w.start ? 'bg-[var(--pen-red)]/10 text-[var(--pen-red)] line-through' : 'hover:bg-surface-2'
          }`}
        >
          {w.text}
        </button>
      ))}
      <span className="text-sm text-muted">[{ex.surah_name}: {arabicNumber(ex.ayah)}]</span>
    </p>
  )
}

/** تمرين قصير في آخر الدرس: أسئلة الدرس من بنك الأسئلة، وأسئلة «أين الشاهد؟» من أمثلته. */
export default function LessonExercise({ lesson }) {
  const { data } = useApi('/quiz?level=2')
  const [round, setRound] = useState(0)
  const [answers, setAnswers] = useState({})

  const items = useMemo(() => {
    const path = `/ahkam/${lesson.section}/${lesson.id}`
    const bank = shuffle((data?.questions ?? []).filter((q) => q.link === path && q.type === 'mcq')).slice(0, 2)
    const finds = shuffle((lesson.examples ?? []).filter((e) => e.match && e.ayah_text))
      .slice(0, bank.length ? 2 : 3)
      .map((ex, i) => ({ id: `find-${lesson.id}-${ex.surah}-${ex.ayah}-${i}`, kind: 'find', ex }))
    return [...bank.map((q) => ({ id: q.id, kind: 'mcq', q })), ...finds]
  }, [data, lesson, round]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!items.length) return null
  const right = items.filter((it) => answers[it.id] === true).length
  const finished = items.every((it) => it.id in answers)

  return (
    <section className="mt-[var(--rule)]" aria-labelledby="exercise-title">
      <h2 id="exercise-title" className="notebook-label text-lg">
        تمرين
      </h2>
      <ol className="space-y-4 leading-normal">
        {items.map((it, i) => {
          const done = it.id in answers
          const answer = (ok) => {
            if (done) return
            if (it.kind === 'mcq') record(it.id, ok)
            setAnswers((a) => ({ ...a, [it.id]: ok }))
          }
          return (
            <li key={`${round}-${it.id}`} className="rounded-xl border border-dashed border-line bg-surface/80 p-3">
              <p className="mb-2 font-medium">
                {arabicNumber(i + 1)}. {it.kind === 'mcq' ? it.q.question : 'اضغط في الآية الكلمة التي فيها الحكم:'}
              </p>
              {it.kind === 'mcq' ? (
                <Mcq q={it.q} done={done} onAnswer={answer} />
              ) : (
                <FindWord ex={it.ex} done={done} onAnswer={answer} />
              )}
              {done && (
                <p className={`mt-2 text-sm ${answers[it.id] ? 'text-accent' : 'text-[var(--pen-red)]'}`} role="status">
                  {answers[it.id] ? '✓ صحيح' : '✗ غير صحيح'}
                  {it.kind === 'find' && ` · الشاهد: ${it.ex.word}${it.ex.note ? ` (${it.ex.note})` : ''}`}
                  {it.kind === 'mcq' && !answers[it.id] && ` · ${it.q.explain}`}
                </p>
              )}
            </li>
          )
        })}
      </ol>
      {finished && (
        <div className="mt-3 flex flex-wrap items-center gap-3 leading-normal">
          <span className="font-semibold">
            النتيجة: {arabicNumber(right)} من {arabicNumber(items.length)}
          </span>
          <button
            type="button"
            onClick={() => {
              setAnswers({})
              setRound((r) => r + 1)
            }}
            className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm hover:border-accent"
          >
            تمرين آخر
          </button>
        </div>
      )}
    </section>
  )
}
