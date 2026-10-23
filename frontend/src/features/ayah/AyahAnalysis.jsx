import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { usePageCrumb } from '../../components/Breadcrumb'
import { arabicNumber, useApi } from '../../lib/api'
import HeadDiagram from '../makharij/HeadDiagram'
import { articulation } from '../makharij/articulation'
import { useLetters } from '../makharij/letters'
import { DataState } from '../mushaf/MushafLists'
import { buildSegments } from '../mushaf/tajweed'
import { useRules } from '../mushaf/useRules'
import { usePlayer } from '../player/PlayerContext'
import { useSettings } from '../settings/SettingsContext'
import { analyzeAyah, summarize } from './analyze'

const card = 'rounded-2xl border border-line bg-surface p-4'
const KIND_NOTE = { mad: 'حرف مد', tanween: 'تنوين (نون ساكنة)', wasl: 'همزة وصل', marbuta: 'تاء مربوطة' }

/** كلمة قابلة للضغط، ملوّنة بأحكامها كما في المصحف. */
function WordButton({ word, text, tajweed, active, onPick, ruleColor }) {
  const segs = useMemo(
    () =>
      buildSegments(
        text.slice(word.start, word.end),
        tajweed.filter((m) => m.start < word.end && m.end > word.start).map((m) => ({ ...m, start: Math.max(m.start, word.start) - word.start, end: Math.min(m.end, word.end) - word.start })),
      ),
    [word, text, tajweed],
  )
  return (
    <button
      type="button"
      onClick={() => onPick(word.index)}
      aria-pressed={active}
      className={`font-quran mx-0.5 rounded-lg px-1.5 transition ${active ? 'bg-accent text-accent-ink shadow' : 'hover:bg-accent-soft'}`}
    >
      {segs.map((s) =>
        s.rules.length && !active ? (
          <span key={s.start} style={{ color: ruleColor(s.rules[0]) }}>
            {s.text}
          </span>
        ) : (
          <span key={s.start}>{s.text}</span>
        ),
      )}
    </button>
  )
}

function Chip({ children, tone = 'plain' }) {
  const tones = { plain: 'border-line bg-surface-2', accent: 'border-accent/40 bg-accent-soft text-accent', warn: 'border-[var(--pen-red)]/40 bg-[var(--pen-red)]/10 text-[var(--pen-red)]' }
  return <span className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-sm ${tones[tone]}`}>{children}</span>
}

const LetterChip = ({ l, count }) => (
  <Chip>
    <span className="font-quran text-lg leading-none">{l.char}</span>
    {count > 1 && <span className="text-xs text-muted">×{arabicNumber(count)}</span>}
  </Chip>
)

function Section({ id, title, hint, children }) {
  return (
    <section id={id} className="scroll-mt-28">
      <h2 className="mb-1 text-lg font-bold">{title}</h2>
      {hint && <p className="mb-2 text-sm text-muted">{hint}</p>}
      <div className="space-y-3">{children}</div>
    </section>
  )
}

/* ———— الأحكام ———— */
function RulesPart({ summary, onPickWord }) {
  const { rules } = summary
  return (
    <Section id="part-rules" title="١. الأحكام" hint="أحكام التجويد التي وقعت في هذا النطاق، وأين وقعت.">
      {rules.length === 0 && <p className={`${card} text-muted`}>لا حكم ملوّن هنا (مدّ طبيعي أو حروف عادية).</p>}
      {rules.map((r) => (
        <article key={r.id} className={card}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="size-3.5 rounded-full" style={{ background: r.color }} aria-hidden="true" />
            <h3 className="font-semibold">{r.name}</h3>
            <Chip tone="accent">{arabicNumber(r.count)} {r.count === 1 ? 'موضع' : 'مواضع'}</Chip>
            {r.lesson && (
              <Link to={`/ahkam/${r.lesson.section}/${r.lesson.id}`} className="ms-auto text-sm text-accent underline-offset-4 hover:underline">
                درس الحكم ←
              </Link>
            )}
          </div>
          {r.description && <p className="mt-1 text-sm text-muted">{r.description}</p>}
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {r.occurrences.map((o) => (
              <li key={`${o.start}-${o.end}`}>
                <button type="button" onClick={() => onPickWord(o.word)} className="font-quran rounded-lg border border-line bg-surface-2 px-2 text-lg hover:border-accent" title="اضغط لتحليل هذه الكلمة">
                  {o.wordText}
                </button>
              </li>
            ))}
          </ul>
        </article>
      ))}
      {summary.silent.length > 0 && (
        <div className={`${card} text-sm`}>
          <h3 className="mb-1 font-semibold">حروف مكتوبة لا تُنطق ({arabicNumber(summary.silent.length)})</h3>
          <ul className="flex flex-wrap gap-1.5">
            {summary.silent.map((l, i) => (
              <li key={i}>
                <Chip tone="warn">
                  <span className="font-quran text-lg leading-none">{l.char}</span>
                  <span className="text-xs">{l.why}</span>
                </Chip>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Section>
  )
}

/* ———— المخارج ———— */
function MakharijPart({ summary, letters, allLetters }) {
  const [open, setOpen] = useState({})
  return (
    <Section id="part-makharij" title="٢. المخارج" hint="مخرج كل حرف منطوق، مجموعة بحسب المخرج. اضغط «الرسم» لترى موضعه في أعضاء النطق.">
      {summary.makharij.map((m) => {
        const first = letters.letterById[m.letters[0].id]
        const shown = open[m.id]
        return (
          <article key={m.id} className={card}>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold">{m.name}</h3>
              <Chip>{letters.generalById[m.general]?.name}</Chip>
              <Chip tone="accent">{arabicNumber(m.count)} {m.count === 1 ? 'حرف' : 'حروف'}</Chip>
              <button type="button" onClick={() => setOpen({ ...open, [m.id]: !shown })} aria-expanded={!!shown} className="ms-auto rounded-lg border border-line px-3 py-1 text-sm hover:border-accent">
                {shown ? 'أخفِ الرسم' : '👁 الرسم'}
              </button>
            </div>
            <p className="mt-1 text-sm text-muted">{m.desc}</p>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {m.letters.map((l) => (
                <li key={l.id}>
                  <LetterChip l={l} count={l.count} />
                </li>
              ))}
            </ul>
            {shown && (
              <div className="mx-auto mt-3 max-w-sm">
                <HeadDiagram makhraj={m} art={articulation(first)} phase="contact" labels={false} />
              </div>
            )}
          </article>
        )
      })}
      {summary.makharij.length === 0 && <p className={`${card} text-muted`}>لا حروف منطوقة في هذا النطاق.</p>}
    </Section>
  )
}

/* ———— الصفات ———— */
function SifatPart({ summary }) {
  return (
    <Section id="part-sifat" title="٣. الصفات" hint="الصفات المتضادة (لكل حرف واحدة من كل زوج)، وغير المتضادة (لبعض الحروف).">
      <h3 className="font-semibold text-[var(--pen-red)]">الصفات المتضادة</h3>
      {summary.opposite.map((g) => (
        <article key={g.id} className={card}>
          <h4 className="mb-2 font-semibold">{g.name}</h4>
          <div className={`grid gap-2 ${g.sides.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
            {g.sides.map((s) => (
              <div key={s.id} className={`rounded-xl border p-2.5 ${s.count ? 'border-accent/50 bg-accent-soft/50' : 'border-line opacity-60'}`}>
                <div className="flex items-center justify-between">
                  <span className="font-medium">{s.name}</span>
                  <span className="text-sm tabular-nums text-muted">{arabicNumber(s.count)}</span>
                </div>
                {s.istilah && <p className="mt-0.5 text-xs text-muted">{s.istilah}</p>}
                {s.letters.length > 0 && (
                  <ul className="mt-1.5 flex flex-wrap gap-1">
                    {s.letters.map((l) => (
                      <li key={l.id}>
                        <LetterChip l={l} count={l.count} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </article>
      ))}

      <h3 className="mt-2 font-semibold text-[var(--pen-red)]">الصفات غير المتضادة</h3>
      {summary.nonOpposite.length === 0 && <p className={`${card} text-muted`}>لا حروف بصفات غير متضادة (قلقلة، صفير، لين…) في هذا النطاق.</p>}
      {summary.nonOpposite.map((s) => (
        <article key={s.id} className={card}>
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-semibold">{s.name}</h4>
            <Chip tone="accent">{arabicNumber(s.count)}</Chip>
          </div>
          {s.istilah && <p className="mt-0.5 text-sm text-muted">{s.istilah}</p>}
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {s.letters.map((l) => (
              <li key={l.id}>
                <LetterChip l={l} count={l.count} />
              </li>
            ))}
          </ul>
        </article>
      ))}
    </Section>
  )
}

/** حروف الكلمة المختارة بالترتيب مع ما يخص كل حرف (مد، شدّة، تنوين…). */
function WordLetters({ word }) {
  return (
    <div className={card}>
      <h3 className="mb-2 font-semibold">حروف الكلمة</h3>
      <ul className="flex flex-wrap gap-1.5">
        {word.letters.map((l, i) => (
          <li key={i}>
            <Chip tone={l.silent ? 'warn' : 'plain'}>
              <span className="font-quran text-xl leading-none">{l.char}</span>
              {l.doubled && <span className="text-xs">مشددة</span>}
              {KIND_NOTE[l.kind] && !l.silent && <span className="text-xs text-muted">{KIND_NOTE[l.kind]}</span>}
              {l.silent && <span className="text-xs">لا يُنطق</span>}
            </Chip>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function AyahAnalysis() {
  const { surah, ayah } = useParams()
  const s = Number(surah)
  const a = Number(ayah)
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { data, loading, error } = useApi(`/ayah/${s}/${a}`)
  const { data: surahs } = useApi('/surahs')
  const { data: letters, loading: lLoading, error: lError } = useLetters()
  const { data: lessonData } = useApi('/lessons')
  const { byId } = useRules()
  const { dark } = useSettings()
  const player = usePlayer()

  const wordIndex = params.has('w') ? Number(params.get('w')) : null
  usePageCrumb(data ? `تحليل ${data.surah_name} ${arabicNumber(a)}` : null)
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [s, a])

  const analysis = useMemo(() => (data && letters ? analyzeAyah(data.text, data.tajweed, letters) : null), [data, letters])
  const ruleInfo = useMemo(() => Object.fromEntries(Object.entries(byId).map(([id, r]) => [id, { ...r, color: dark ? r.color_dark ?? r.color : r.color }])), [byId, dark])
  const words = analysis?.words ?? []
  const word = wordIndex != null ? words[wordIndex] : null
  const summary = useMemo(
    () => (analysis && letters ? summarize(word ? [word] : words, letters, { ruleInfo, lessons: lessonData?.lessons ?? [] }) : null),
    [analysis, letters, word, words, ruleInfo, lessonData],
  )

  const pick = (i) => {
    const next = new URLSearchParams(params)
    if (i == null || i === wordIndex) next.delete('w')
    else next.set('w', String(i))
    setParams(next, { replace: true })
  }

  if (!data || !letters) return <DataState loading={loading || lLoading} error={error ?? lError} />
  const ruleColor = (id) => ruleInfo[id]?.color
  const count = surahs?.find((x) => x.number === s)?.ayah_count
  const go = (to) => navigate(to)
  const listen = () => player.playAyahs([{ surah: s, ayahs: [{ ayah: a }] }], { surah: s, ayah: a, from: { surah: s, ayah: a }, to: { surah: s, ayah: a }, names: { [s]: data.surah_name } })

  return (
    <div className="max-w-3xl space-y-5">
      <header className="space-y-2">
        <p className="text-sm text-muted">تحليل الآية: الأحكام والمخارج والصفات</p>
        <h1 className="text-2xl font-bold">
          سورة {data.surah_name} · الآية {arabicNumber(a)}
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={listen} className="flex h-10 items-center gap-1.5 rounded-xl bg-accent px-4 text-sm font-medium text-accent-ink hover:brightness-110">
            ▶ استمع
          </button>
          {player.reciters?.length > 0 && (
            <select aria-label="القارئ" value={player.reciter?.id ?? ''} onChange={(e) => player.setReciter(e.target.value)} className="h-10 max-w-48 rounded-xl border border-line bg-surface px-2 text-sm">
              {player.reciters.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}{r.style ? ` — ${r.style}` : ''}
                </option>
              ))}
            </select>
          )}
          <Link to={`/mushaf/surah/${s}?ayah=${a}`} className="flex h-10 items-center rounded-xl border border-line px-3 text-sm hover:border-accent">
            افتحها في المصحف
          </Link>
          <span className="ms-auto flex gap-1.5">
            <button type="button" disabled={a <= 1} onClick={() => go(`/ayah/${s}/${a - 1}`)} aria-label="الآية السابقة" className="h-10 min-w-10 rounded-xl border border-line px-2 hover:border-accent disabled:opacity-40">
              →
            </button>
            <button type="button" disabled={count != null && a >= count} onClick={() => go(`/ayah/${s}/${a + 1}`)} aria-label="الآية التالية" className="h-10 min-w-10 rounded-xl border border-line px-2 hover:border-accent disabled:opacity-40">
              ←
            </button>
          </span>
        </div>
      </header>

      <section aria-label="نص الآية" className={`${card} text-center`}>
        <p className="font-quran !text-[1.9rem] !leading-[2.4]" dir="rtl">
          {words.map((w) => (
            <WordButton key={w.index} word={w} text={data.text} tajweed={data.tajweed} active={w.index === wordIndex} onPick={pick} ruleColor={ruleColor} />
          ))}
          <span className="mx-1 text-gold">﴿{arabicNumber(a)}﴾</span>
        </p>
        <p className="mt-1 text-sm text-muted">اضغط على أي كلمة لتحليلها وحدها، واضغطها ثانية للعودة إلى الآية كلها.</p>
      </section>

      <div className="sticky top-0 z-10 -mx-4 flex flex-wrap items-center gap-2 border-b border-line bg-bg/95 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6">
        <span className="text-sm text-muted">التحليل لـ:</span>
        {word ? (
          <>
            <button type="button" onClick={() => pick(null)} className="rounded-full border border-line px-3 py-1 text-sm hover:border-accent">
              الآية كاملة
            </button>
            <span className="font-quran rounded-full bg-accent px-3 text-lg text-accent-ink">{word.text}</span>
          </>
        ) : (
          <span className="rounded-full bg-accent px-3 py-1 text-sm text-accent-ink">الآية كاملة ({arabicNumber(words.length)} كلمة)</span>
        )}
        <nav aria-label="أجزاء التحليل" className="ms-auto flex gap-1.5 text-sm">
          {[['part-rules', 'الأحكام'], ['part-makharij', 'المخارج'], ['part-sifat', 'الصفات']].map(([id, t]) => (
            <a key={id} href={`#${id}`} onClick={(e) => (e.preventDefault(), document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }))} className="rounded-lg px-2 py-1 text-accent hover:bg-accent-soft">
              {t}
            </a>
          ))}
        </nav>
      </div>

      {word && <WordLetters word={word} />}
      {summary && (
        <>
          <RulesPart summary={summary} onPickWord={pick} />
          <MakharijPart summary={summary} letters={letters} />
          <SifatPart summary={summary} />
        </>
      )}
      <p className="text-xs text-muted">التحليل آلي مبني على الرسم العثماني وعلامات الأحكام في البرنامج؛ راجع المواضع الدقيقة مع معلّمك.</p>
    </div>
  )
}
