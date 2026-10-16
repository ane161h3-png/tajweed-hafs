import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { usePageCrumb } from '../../components/Breadcrumb'
import { arabicNumber } from '../../lib/api'
import { DataState } from '../mushaf/MushafLists'
import HeadDiagram from './HeadDiagram'
import LetterPlayer from './LetterPlayer'
import TeethChart from './TeethChart'
import { articulation } from './articulation'
import { LEVEL_COLORS, letterSifat, useLetters } from './letters'

// ---------- عناصر مشتركة ----------

export function LetterChip({ letter, to, active, size = 'md' }) {
  const cls = `inline-grid place-items-center rounded-lg border font-quran leading-none transition ${
    size === 'lg' ? 'size-14 text-3xl' : 'size-10 text-2xl'
  } ${active ? 'border-accent bg-accent-soft text-accent' : 'border-line bg-surface hover:border-accent'}`
  const label = `${letter.name}`
  return to ? (
    <Link to={to} className={cls} aria-label={label} title={label}>
      {letter.char}
    </Link>
  ) : (
    <span className={cls} aria-label={label} title={label}>
      {letter.char}
    </span>
  )
}

export function Verses({ verses }) {
  if (!verses?.length) return null
  return (
    <div className="mt-6 rounded-2xl border border-line bg-surface p-4">
      <p className="mb-2 text-sm text-muted">من {verses[0].source}:</p>
      {verses.map((v, i) => (
        <p key={i} className="grid grid-cols-1 text-center font-medium leading-loose text-[var(--pen-blue)] sm:grid-cols-2 sm:gap-6">
          <span>{v.first}</span>
          <span>{v.second}</span>
        </p>
      ))}
    </div>
  )
}

export function DraftNote({ text }) {
  return (
    <p className="mb-4 rounded-lg border border-[var(--pen-red)]/30 bg-[var(--pen-red)]/5 px-3 py-2 text-xs text-[var(--pen-red)]">
      {text ?? 'مسودة على ما في المقدمة الجزرية؛ يراجعها مقرئ متخصص قبل الاعتماد.'}
    </p>
  )
}

/** صفحة تعتمد على محتوى الحروف: تعرض حالة التحميل ثم المحتوى. */
function WithLetters({ children }) {
  const { data, loading, error } = useLetters()
  if (!data) return <DataState loading={loading} error={error} />
  return children(data)
}

const card = 'rounded-2xl border border-line bg-surface p-4'

// ---------- المخارج العامة ----------

export function GeneralMakharij() {
  const [active, setActive] = useState('lisan')
  return (
    <WithLetters>
      {(d) => {
        const specific = d.makharij.filter((m) => m.general === active)
        const organs = specific.flatMap((m) => m.organs)
        return (
          <div>
            <h1 className="mb-1 text-2xl font-bold">المخارج العامة الخمسة</h1>
            <DraftNote />
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
              <ul className="space-y-2">
                {d.general.map((g) => (
                  <li key={g.id}>
                    <button
                      type="button"
                      onClick={() => setActive(g.id)}
                      aria-pressed={active === g.id}
                      className={`${card} w-full text-start ${active === g.id ? 'border-accent ring-1 ring-accent' : 'hover:border-accent/50'}`}
                    >
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="text-lg font-semibold">{g.name}</span>
                        <span className="text-xs text-muted">
                          {g.count === 1 ? 'مخرج واحد' : g.count === 2 ? 'مخرجان' : `${arabicNumber(g.count)} مخارج`}
                        </span>
                      </span>
                      <span className="mt-1 block text-sm text-muted">{g.desc}</span>
                      <span className="mt-2 flex flex-wrap gap-1.5">
                        {d.makharij
                          .filter((m) => m.general === g.id)
                          .flatMap((m) => m.letter_ids)
                          .filter((id, i, a) => a.indexOf(id) === i)
                          .map((id) => (
                            <LetterChip key={id} letter={d.letterById[id]} />
                          ))}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              <div className="lg:sticky lg:top-4 lg:self-start">
                <HeadDiagram highlight={organs} art={null} />
              </div>
            </div>
            <Verses verses={d.makharij_verses.slice(0, 2)} />
          </div>
        )
      }}
    </WithLetters>
  )
}

// ---------- المخارج الخاصة ----------

export function SpecificMakharij() {
  const [active, setActive] = useState('qaf')
  return (
    <WithLetters>
      {(d) => {
        const m = d.makhrajById[active]
        const first = d.letterById[m.letter_ids[0]]
        return (
          <div>
            <h1 className="mb-1 text-2xl font-bold">المخارج الخاصة السبعة عشر</h1>
            <DraftNote />
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
              <div className="lg:sticky lg:top-4 lg:self-start">
                <HeadDiagram makhraj={m} art={articulation(first)} phase="contact" />
                <div className={`${card} mt-3`}>
                  <p className="font-semibold">
                    {arabicNumber(m.order)}. {m.name}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-muted">{m.desc}</p>
                  <p className="mt-2 flex flex-wrap gap-1.5">
                    {m.letter_ids.map((id) => (
                      <LetterChip key={id} letter={d.letterById[id]} to={`/makharij/letters/${id}`} />
                    ))}
                  </p>
                </div>
              </div>
              <ol className="space-y-1.5">
                {d.makharij.map((x) => (
                  <li key={x.id}>
                    <button
                      type="button"
                      onClick={() => setActive(x.id)}
                      aria-pressed={active === x.id}
                      className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-start ${
                        active === x.id ? 'border-accent bg-accent-soft' : 'border-line bg-surface hover:border-accent/50'
                      }`}
                    >
                      <span className="w-7 shrink-0 text-center text-sm font-semibold text-muted">{arabicNumber(x.order)}</span>
                      <span className="min-w-0 flex-1 text-sm font-medium">{x.name}</span>
                      <span className="font-quran text-xl tracking-widest">{x.letters.split('').join(' ')}</span>
                    </button>
                  </li>
                ))}
              </ol>
            </div>
            <Verses verses={d.makharij_verses} />
          </div>
        )
      }}
    </WithLetters>
  )
}

// ---------- الحروف ----------

export function LettersGrid({ base = '/makharij/letters', title = 'الحروف واحداً واحداً' }) {
  return (
    <WithLetters>
      {(d) => (
        <div>
          <h1 className="mb-1 text-2xl font-bold">{title}</h1>
          <p className="mb-4 text-sm text-muted">اضغط حرفاً لترى مخرجه متحركاً وصفاته.</p>
          <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8">
            {d.letters.map((l) => (
              <li key={l.id}>
                <Link
                  to={`${base}/${l.id}`}
                  className="flex flex-col items-center rounded-xl border border-line bg-surface py-2 hover:border-accent hover:bg-accent-soft"
                >
                  <span className="font-quran text-3xl leading-tight">{l.char}</span>
                  <span className="text-[11px] text-muted">{l.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </WithLetters>
  )
}

export function SifaBadges({ letter, sifat }) {
  return (
    <ul className="flex flex-wrap gap-1.5">
      {letterSifat(letter, sifat).map((s) => (
        <li key={s.id}>
          <Link
            to={s.group ? `/sifat/opposite#${s.id}` : `/sifat/non-opposite#${s.id}`}
            className={`inline-block rounded-full px-2.5 py-0.5 text-sm ${
              s.strength === 'strong' ? 'bg-accent-soft text-accent' : s.strength === 'weak' ? 'bg-surface-2 text-muted' : 'bg-gold/15 text-ink'
            }`}
          >
            {s.name}
          </Link>
        </li>
      ))}
    </ul>
  )
}

export function LetterPage() {
  const { id } = useParams()
  const { data, loading, error } = useLetters()
  const letter = data?.letterById[id]
  usePageCrumb(letter ? `حرف ${letter.name}` : null)
  if (!data) return <DataState loading={loading} error={error} />
  if (!letter) return <p>الحرف غير موجود</p>
  const m = data.makhrajById[letter.makhraj]
  const mm = letter.madd_makhraj && data.makhrajById[letter.madd_makhraj]
  const i = data.letters.indexOf(letter)
  const prev = data.letters[i - 1]
  const next = data.letters[i + 1]
  const conditional = ['waw', 'ya'].includes(letter.id)
  return (
    <article>
      <header className="mb-4 flex items-center gap-4">
        <span className="grid size-16 place-items-center rounded-2xl bg-accent-soft font-quran text-5xl text-accent">{letter.char}</span>
        <div>
          <h1 className="text-2xl font-bold">{letter.name}</h1>
          <p className="text-muted">
            من {data.generalById[m.general].name} · {m.name}
          </p>
        </div>
      </header>
      <DraftNote />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <LetterPlayer letter={letter} makhraj={m} />
        <div className="space-y-3">
          <section className={card}>
            <h2 className="mb-1 font-semibold">المخرج</h2>
            <p className="text-sm leading-relaxed text-muted">{m.desc}</p>
            {mm && <p className="mt-2 text-sm">وإذا كانت مدّية فمخرجها {mm.name}.</p>}
            <p className="mt-2 text-sm">
              لقبها: <strong>{letter.laqab}</strong>
            </p>
          </section>
          <section className={card}>
            <h2 className="mb-2 flex items-center justify-between font-semibold">
              صفاتها
              <span className={`rounded-full px-2.5 py-0.5 text-xs ${LEVEL_COLORS[letter.level]}`}>قوتها: {letter.level}</span>
            </h2>
            <SifaBadges letter={letter} sifat={data.sifat} />
            {conditional && <p className="mt-2 text-xs text-muted">اللين والخفاء في الواو والياء بحسب حالهما: اللين إذا سكنتا بعد فتح، والخفاء إذا كانتا مدّيتين.</p>}
          </section>
          {letter.mistakes && (
            <section className={card}>
              <h2 className="mb-1 font-semibold">أخطاء شائعة</h2>
              <p className="text-sm leading-relaxed text-muted">{letter.mistakes}</p>
            </section>
          )}
          <section className={card}>
            <h2 className="mb-1 font-semibold">طريقة معرفة المخرج</h2>
            <p className="text-sm text-muted">
              سكّن الحرف وأدخل عليه همزة متحركة: <span className="font-quran text-xl text-ink">{letter.pronounce}</span>، فحيث ينقطع
              الصوت فهو مخرجه.
            </p>
          </section>
        </div>
      </div>
      <nav aria-label="الحرف السابق والتالي" className="mt-6 flex justify-between text-sm">
        {prev ? (
          <Link to={`/makharij/letters/${prev.id}`} className="rounded-lg border border-line bg-surface px-4 py-2 hover:border-accent">
            → {prev.name}
          </Link>
        ) : (
          <span />
        )}
        {next && (
          <Link to={`/makharij/letters/${next.id}`} className="rounded-lg border border-line bg-surface px-4 py-2 hover:border-accent">
            {next.name} ←
          </Link>
        )}
      </nav>
    </article>
  )
}

// ---------- الألقاب ----------

export function Titles() {
  return (
    <WithLetters>
      {(d) => (
        <div>
          <h1 className="mb-1 text-2xl font-bold">ألقاب الحروف</h1>
          <p className="mb-4 text-sm text-muted">لقّب الخليل بن أحمد الحروف بحسب مواضع خروجها.</p>
          <DraftNote />
          <ul className="grid gap-3 sm:grid-cols-2">
            {d.alqab.map((a) => (
              <li key={a.name} className={card}>
                <p className="text-lg font-semibold">{a.name}</p>
                <p className="mt-1 text-sm text-muted">{a.why}</p>
                <p className="mt-2 flex flex-wrap gap-1.5">
                  {[...a.letters].map((c) => {
                    const l = d.letterByChar[c]
                    return <LetterChip key={c} letter={l} to={`/makharij/letters/${l.id}`} />
                  })}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </WithLetters>
  )
}

// ---------- الأسنان ----------

export function Teeth() {
  const [kind, setKind] = useState(null)
  return (
    <WithLetters>
      {(d) => (
        <div>
          <h1 className="mb-1 text-2xl font-bold">أسماء الأسنان</h1>
          <p className="mb-4 text-sm text-muted">عدد الأسنان غالباً اثنان وثلاثون: ستة عشر في كل فك. اضغط اسماً لتظليله.</p>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <TeethChart active={kind} onPick={setKind} />
            <ul className="space-y-2">
              {d.teeth.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => setKind(kind === t.id ? null : t.id)}
                    aria-pressed={kind === t.id}
                    className={`${card} w-full text-start ${kind === t.id ? 'border-accent ring-1 ring-accent' : ''}`}
                  >
                    <span className="flex justify-between">
                      <span className="font-semibold">{t.name}</span>
                      <span className="text-sm text-muted">{arabicNumber(t.count)}</span>
                    </span>
                    <span className="mt-1 block text-sm text-muted">{t.desc}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </WithLetters>
  )
}

// ---------- طريقة معرفة المخرج ----------

export function FindingMakhraj() {
  const [id, setId] = useState('ba')
  return (
    <WithLetters>
      {(d) => {
        const letter = d.letterById[id]
        return (
          <div>
            <h1 className="mb-1 text-2xl font-bold">طريقة معرفة المخرج</h1>
            <div className={`${card} mb-4 leading-loose`}>
              <p>
                لمعرفة مخرج أي حرف: <strong>سكّنه أو شدّده، وأدخل عليه همزة متحركة</strong>، ثم انطق به وأصغِ إليه؛ فحيث ينقطع
                الصوت فهو مخرجه المحقق، وحيث يمكن انقطاعه في الجملة فهو مخرجه المقدّر.
              </p>
              <p className="text-sm text-muted">مثال: أَبْ ، أَتْ ، أَثْ … اختر حرفاً وجرّب:</p>
            </div>
            <div className="mb-4 flex flex-wrap gap-1.5">
              {d.letters
                .filter((l) => l.id !== 'alif')
                .map((l) => (
                  <button key={l.id} type="button" onClick={() => setId(l.id)} aria-pressed={id === l.id} className="contents">
                    <LetterChip letter={l} active={id === l.id} />
                  </button>
                ))}
            </div>
            <div className="max-w-3xl">
              <LetterPlayer key={id} letter={letter} makhraj={d.makhrajById[letter.makhraj]} />
            </div>
          </div>
        )
      }}
    </WithLetters>
  )
}

// ---------- الأخطاء الشائعة ----------

export function CommonMistakes() {
  const [q, setQ] = useState('')
  const { data, loading, error } = useLetters()
  const list = useMemo(() => (data?.letters ?? []).filter((l) => l.mistakes && (!q || l.name.includes(q) || l.char === q)), [data, q])
  if (!data) return <DataState loading={loading} error={error} />
  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">الأخطاء الشائعة في نطق الحروف</h1>
      <DraftNote />
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="ابحث بحرف أو اسمه…"
        aria-label="ابحث في الأخطاء"
        className="mb-4 w-full max-w-sm rounded-xl border border-line bg-surface px-3 py-2"
      />
      <ul className="grid gap-2 sm:grid-cols-2">
        {list.map((l) => (
          <li key={l.id}>
            <Link to={`/makharij/letters/${l.id}`} className={`${card} flex gap-3 hover:border-accent/50`}>
              <span className="font-quran text-3xl leading-none text-accent">{l.char}</span>
              <span className="text-sm leading-relaxed text-muted">{l.mistakes}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
