import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { arabicNumber, useApi } from '../../lib/api'
import { DataState } from '../mushaf/MushafLists'
import { QUESTION_TYPES, TYPE_NAMES } from './Questions'
import { dueForReview, loadSrs, record, shuffle, stats } from './srs'

const SESSION = 10
const LEVEL_NAMES = { 1: 'المستوى الأول: أساسيات الحروف والصفات', 2: 'المستوى الثاني: الأحكام والمخارج', 3: 'المستوى الثالث: الاستخراج والاستماع' }

/** يختار أسئلة الجلسة متنوعة الأنواع، مقدِّماً ما لم يُرَ بعد. */
export function pickSession(questions, srs, n = SESSION, rand = Math.random) {
  const byType = {}
  for (const q of shuffle(questions, rand)) (byType[q.type] ??= []).push(q)
  for (const t in byType) byType[t].sort((a, b) => (srs[a.id] ? 1 : 0) - (srs[b.id] ? 1 : 0))
  const out = []
  const types = Object.keys(byType)
  while (out.length < n && types.some((t) => byType[t].length)) {
    for (const t of types) if (byType[t].length && out.length < n) out.push(byType[t].shift())
  }
  return shuffle(out, rand)
}

function Session({ questions, title, onRestart }) {
  const [i, setI] = useState(0)
  const [results, setResults] = useState([])
  const q = questions[i]
  const done = results.length > i
  const Comp = q && QUESTION_TYPES[q.type]

  if (!questions.length)
    return <p className="rounded-xl border border-dashed border-line bg-surface p-6 text-center text-muted">لا أسئلة هنا الآن.</p>

  if (i >= questions.length) {
    const right = results.filter(Boolean).length
    const wrong = questions.filter((_, k) => !results[k])
    return (
      <div className="rounded-2xl border border-line bg-surface p-6 text-center">
        <p className="text-4xl font-bold text-accent">
          {arabicNumber(right)} / {arabicNumber(questions.length)}
        </p>
        <p className="mt-1 text-muted">{right === questions.length ? 'أحسنت! كل الإجابات صحيحة.' : 'الأسئلة الخاطئة أُضيفت إلى «مراجعة الأخطاء».'}</p>
        {wrong.length > 0 && (
          <ul className="mx-auto mt-4 max-w-xl space-y-1 text-start text-sm">
            {wrong.map((w) => (
              <li key={w.id} className="rounded-lg bg-surface-2 px-3 py-2">
                {w.question}
                {w.link && (
                  <Link to={w.link} className="ms-2 text-accent underline-offset-4 hover:underline">
                    الدرس
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-5 flex justify-center gap-3">
          <button type="button" onClick={onRestart} className="rounded-lg bg-accent px-5 py-2 font-medium text-accent-ink">
            جلسة جديدة
          </button>
          <Link to="/quiz/review" className="rounded-lg border border-line px-5 py-2">
            مراجعة الأخطاء
          </Link>
        </div>
      </div>
    )
  }

  const answer = (correct) => {
    if (done) return
    record(q.id, correct)
    setResults((r) => [...r, correct])
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-3 text-sm text-muted">
        <span>{title}</span>
        <span className="ms-auto tabular-nums">
          {arabicNumber(i + 1)} / {arabicNumber(questions.length)}
        </span>
      </div>
      <div className="mb-4 h-1.5 rounded-full bg-surface-2">
        <div className="h-1.5 rounded-full bg-accent transition-all" style={{ width: `${(i / questions.length) * 100}%` }} />
      </div>
      <article className="rounded-2xl border border-line bg-surface p-5" aria-live="polite">
        <p className="mb-1 text-xs text-muted">
          {TYPE_NAMES[q.type]} · {q.topic}
        </p>
        <h2 className="mb-4 text-lg font-semibold leading-relaxed">{q.question}</h2>
        <Comp key={q.id} q={q} done={done} onAnswer={answer} />
        {done && (
          <div className={`mt-4 rounded-xl p-3 text-sm leading-relaxed ${results[i] ? 'bg-accent-soft text-accent' : 'bg-[var(--pen-red)]/10 text-[var(--pen-red)]'}`} role="status">
            <p className="font-semibold">{results[i] ? 'إجابة صحيحة ✓' : 'إجابة غير صحيحة'}</p>
            <p className="mt-1 text-ink">{q.explain}</p>
            {q.link && (
              <Link to={q.link} className="mt-1 inline-block text-accent underline-offset-4 hover:underline">
                افتح الدرس
              </Link>
            )}
          </div>
        )}
        {done && (
          <button type="button" onClick={() => setI(i + 1)} className="mt-4 rounded-lg bg-accent px-5 py-2 font-medium text-accent-ink" autoFocus>
            {i + 1 < questions.length ? 'السؤال التالي ←' : 'النتيجة'}
          </button>
        )}
      </article>
    </div>
  )
}

export function QuizLevel() {
  const { subId } = useParams()
  const level = Number(subId.replace('level-', ''))
  const { data, loading, error } = useApi(`/quiz?level=${level}`)
  const [round, setRound] = useState(0)
  const questions = useMemo(() => (data ? pickSession(data.questions, loadSrs()) : []), [data, round]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!data) return <DataState loading={loading} error={error} />
  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">{LEVEL_NAMES[level]}</h1>
      <p className="mb-4 text-sm text-muted">
        {arabicNumber(data.questions.length)} سؤالاً في هذا المستوى؛ كل جلسة {arabicNumber(SESSION)} أسئلة منوّعة.
      </p>
      <Session key={round} questions={questions} title={`جلسة ${arabicNumber(round + 1)}`} onRestart={() => setRound((r) => r + 1)} />
    </div>
  )
}

export function QuizReview() {
  const { data, loading, error } = useApi('/quiz')
  const [round, setRound] = useState(0)
  const srs = loadSrs()
  const s = stats(srs)
  const questions = useMemo(() => {
    if (!data) return []
    const byId = Object.fromEntries(data.questions.map((q) => [q.id, q]))
    return dueForReview(srs).map((id) => byId[id]).filter(Boolean).slice(0, SESSION)
  }, [data, round]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!data) return <DataState loading={loading} error={error} />
  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">مراجعة الأخطاء</h1>
      <p className="mb-4 text-sm text-muted">
        الأسئلة التي أخطأت فيها تعود إليك بفواصل متباعدة: فوراً، ثم بعد يوم، ثم ثلاثة، ثم أسبوع، ثم أسبوعين، حتى تُتقنها.
      </p>
      <div className="mb-4 grid grid-cols-3 gap-3 text-center">
        {[
          ['أسئلة جرّبتها', s.seen],
          ['أتقنتها', s.mastered],
          ['تنتظر المراجعة', s.due],
        ].map(([label, n]) => (
          <div key={label} className="rounded-xl border border-line bg-surface p-3">
            <p className="text-2xl font-bold text-accent">{arabicNumber(n)}</p>
            <p className="text-xs text-muted">{label}</p>
          </div>
        ))}
      </div>
      {questions.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line bg-surface p-6 text-center text-muted">
          لا شيء للمراجعة الآن. <Link to="/quiz/level-1" className="text-accent">ابدأ اختباراً</Link>
        </p>
      ) : (
        <Session key={round} questions={questions} title="مراجعة" onRestart={() => setRound((r) => r + 1)} />
      )}
    </div>
  )
}
