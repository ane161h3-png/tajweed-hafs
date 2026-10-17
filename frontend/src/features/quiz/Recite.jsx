import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import { arabicNumber, useApi } from '../../lib/api'
import { assessRecitation } from '../../lib/recitation'
import { listen, speechSupported } from '../../lib/speech'
import { usePlayer } from '../player/PlayerContext'
import { itemUrl } from '../player/queue'
import { DataState } from '../mushaf/MushafLists'
import { record, shuffle } from './srs'

function MicIcon({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      {active ? <rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor" /> : <path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3" />}
    </svg>
  )
}

/** نص المقطع: كلمة الشاهد مظللة، وبعد التقييم كل كلمة بلون صحتها. */
function Passage({ q, result }) {
  const parts = []
  let pos = 0
  const words = result?.words
  if (words) {
    for (const w of words) {
      if (w.start > pos) parts.push(<span key={`g${pos}`}>{q.text.slice(pos, w.start)}</span>)
      parts.push(
        <span
          key={w.start}
          className={`rounded px-0.5 ${w.ok ? 'text-accent' : 'bg-[var(--pen-red)]/15 text-[var(--pen-red)] underline decoration-wavy underline-offset-8'} ${w.target ? 'ring-1 ring-gold' : ''}`}
        >
          {w.text}
        </span>,
      )
      pos = w.end
    }
    parts.push(<span key="end">{q.text.slice(pos)}</span>)
  } else {
    parts.push(<span key="a">{q.text.slice(0, q.match[0])}</span>)
    parts.push(
      <mark key="m" className="rounded bg-gold/25 px-0.5 text-ink ring-1 ring-gold/60">
        {q.text.slice(q.match[0], q.match[1])}
      </mark>,
    )
    parts.push(<span key="b">{q.text.slice(q.match[1])}</span>)
  }
  return (
    <p className="font-quran rounded-xl border border-line bg-surface px-4 py-3 text-center !text-[1.7rem]" lang="ar">
      {!q.whole && '… '}
      {parts}
      {!q.whole && ' …'}
      <span className="mx-1 text-gold">﴿{arabicNumber(q.ayah)}﴾</span>
    </p>
  )
}

/** سؤال «اقرأ بصوتك»: يفتح الميكروفون، ويقارن القراءة بالنص، ويشرح النطق الصحيح عند الخطأ. */
export function Recite({ q, onAnswer }) {
  const { reciter } = usePlayer()
  const [supported, setSupported] = useState(null)
  const [state, setState] = useState('idle') // idle | listening | checking
  const [interim, setInterim] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const session = useRef(null)
  const audio = useRef(null)
  const answered = useRef(false)

  useEffect(() => {
    speechSupported().then(setSupported)
    return () => {
      session.current?.stop()
      audio.current?.pause()
    }
  }, [])

  const start = async () => {
    setError(null)
    setResult(null)
    setInterim('')
    setState('listening')
    session.current = listen({ onInterim: setInterim })
    try {
      const alternatives = await session.current.promise
      setState('checking')
      const r = assessRecitation(q.text, q.match, alternatives)
      setResult(r)
      if (!answered.current) {
        answered.current = true
        onAnswer?.(r.correct)
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setState('idle')
    }
  }
  const stop = () => session.current?.stop()

  const url = reciter?.ayah_url ? itemUrl({ kind: 'ayah', surah: q.surah, ayah: q.ayah }, reciter) : null
  const playCorrect = () => {
    audio.current?.pause()
    audio.current = new Audio(url)
    audio.current.play().catch(() => {})
  }

  return (
    <div className="space-y-3">
      <Passage q={q} result={result} />
      <p className="text-center text-sm text-muted">
        {q.surah_name} {arabicNumber(q.ayah)} · انتبه لحكم «{q.rule_title}» في <span className="font-quran text-base text-ink">{q.word}</span>
      </p>

      {supported === false ? (
        <p role="alert" className="rounded-xl bg-[var(--pen-red)]/10 p-3 text-sm text-[var(--pen-red)]">
          هذا المتصفح لا يدعم التعرّف على الكلام. استعمل Chrome على أندرويد أو الحاسوب، أو Safari على آيفون، أو تطبيق أندرويد.
        </p>
      ) : (
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={state === 'listening' ? stop : start}
            disabled={state === 'checking' || supported === null}
            className={`flex items-center gap-2 rounded-full px-6 py-3 text-lg font-semibold shadow-sm transition disabled:opacity-50 ${
              state === 'listening' ? 'animate-pulse bg-[var(--pen-red)] text-white' : 'bg-accent text-accent-ink hover:brightness-110'
            }`}
            aria-live="polite"
          >
            <MicIcon active={state === 'listening'} />
            {state === 'listening' ? 'أنهِ القراءة' : result ? 'أعد القراءة' : 'اضغط واقرأ'}
          </button>
          {url && (
            <button type="button" onClick={playCorrect} className="rounded-full border border-line bg-surface px-4 py-2.5 text-sm hover:border-accent">
              🔊 استمع للقارئ
            </button>
          )}
        </div>
      )}

      {state === 'listening' && (
        <p className="text-center text-sm text-muted" aria-live="polite">
          جارٍ الاستماع… {interim && <span className="text-ink">«{interim}»</span>}
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-xl bg-[var(--pen-red)]/10 p-3 text-sm text-[var(--pen-red)]">
          {error}
        </p>
      )}

      {result && (
        <div role="status" className={`rounded-xl p-4 ${result.correct ? 'bg-accent-soft' : 'bg-[var(--pen-red)]/10'}`}>
          {result.correct ? (
            <p className="flex items-center gap-2 text-lg font-bold text-accent">
              <span className="grid size-9 place-items-center rounded-full bg-accent text-accent-ink">✓</span>
              قراءة صحيحة، أحسنت!
            </p>
          ) : (
            <div className="space-y-2 text-sm leading-relaxed">
              <p className="flex items-center gap-2 text-lg font-bold text-[var(--pen-red)]">
                <span className="grid size-9 place-items-center rounded-full bg-[var(--pen-red)] text-white">✗</span>
                تحتاج القراءة إلى تصحيح
              </p>
              <p>
                الكلمات المظللة بالأحمر في النص لم تُسمع صحيحة.
                {result.words.some((w) => w.target && !w.ok) && ' ومنها كلمة الشاهد.'}
              </p>
              <div className="rounded-lg bg-surface p-3">
                <p className="font-semibold">النطق الصحيح:</p>
                <p className="font-quran !text-2xl">{q.text}</p>
                <p className="mt-1">
                  <strong>حكم «{q.rule_title}»</strong>
                  {q.explain && `: ${q.explain}`}.
                </p>
                {q.method && <p className="mt-1 whitespace-pre-line text-muted">{q.method}</p>}
                <div className="mt-2 flex flex-wrap gap-3">
                  {url && (
                    <button type="button" onClick={playCorrect} className="rounded-lg bg-accent px-3 py-1.5 font-medium text-accent-ink">
                      🔊 استمع للنطق الصحيح
                    </button>
                  )}
                  <Link to={q.link} className="rounded-lg border border-line px-3 py-1.5">
                    راجع الدرس
                  </Link>
                </div>
              </div>
            </div>
          )}
          {result.heard && <p className="mt-2 text-xs text-muted">سُمع: «{result.heard}» · نسبة المطابقة {arabicNumber(Math.round(result.score * 100))}٪</p>}
        </div>
      )}
    </div>
  )
}

/** صفحة «اقرأ بصوتك»: تدريب متتابع على قراءة أمثلة الأحكام. */
export function RecitePractice() {
  const { data, loading, error } = useApi('/quiz?level=3')
  const [index, setIndex] = useState(0)
  const [seed, setSeed] = useState(0)
  const [stats, setStats] = useState({ right: 0, total: 0 })
  const items = useMemo(() => shuffle((data?.questions ?? []).filter((q) => q.type === 'recite')), [data, seed])
  if (!data) return <DataState loading={loading} error={error} />
  const q = items[index % Math.max(items.length, 1)]
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-1 text-2xl font-bold">اقرأ بصوتك</h1>
      <p className="mb-2 text-sm text-muted">
        اضغط زر الميكروفون واقرأ المقطع، فيتحقق البرنامج من قراءتك كلمةً كلمة، ويشرح لك النطق الصحيح إن أخطأت.
      </p>
      <p className="mb-4 rounded-lg border border-line bg-surface px-3 py-2 text-xs text-muted">
        التحقق آلي: يتأكد من صحة الكلمات ونطقها العام، ولا يقيس بدقة مقدار المد والغنة وصفات الحروف؛ استمع للقارئ وقارن، وراجع
        شيخك في الدقائق. يحتاج اتصالاً بالإنترنت.
      </p>
      {q ? (
        <>
          <div className="mb-3 flex items-center justify-between text-sm text-muted">
            <span>
              {arabicNumber(stats.right)} صحيحة من {arabicNumber(stats.total)}
            </span>
            <button type="button" onClick={() => setSeed((s) => s + 1)} className="underline-offset-4 hover:underline">
              خلط الأمثلة
            </button>
          </div>
          <Recite
            key={`${seed}-${index}`}
            q={q}
            onAnswer={(ok) => {
              record(q.id, ok)
              setStats((s) => ({ right: s.right + (ok ? 1 : 0), total: s.total + 1 }))
            }}
          />
          <div className="mt-4 flex justify-between">
            <button type="button" disabled={index === 0} onClick={() => setIndex((i) => i - 1)} className="rounded-lg border border-line bg-surface px-4 py-2 text-sm disabled:opacity-40">
              → السابق
            </button>
            <button type="button" onClick={() => setIndex((i) => i + 1)} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-ink">
              المثال التالي ←
            </button>
          </div>
        </>
      ) : (
        <p className="text-muted">لا أمثلة للقراءة بعد.</p>
      )}
    </div>
  )
}
