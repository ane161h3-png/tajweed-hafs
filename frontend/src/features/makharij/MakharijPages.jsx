import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { usePageCrumb } from '../../components/Breadcrumb'
import FilterBox from '../../components/FilterBox'
import { arabicNumber } from '../../lib/api'
import { makeMatcher } from '../../lib/filter'
import { DataState } from '../mushaf/MushafLists'
import HeadDiagram from './HeadDiagram'
import LetterPlayer from './LetterPlayer'
import TeethChart from './TeethChart'
import { articulation } from './articulation'
import { LEVEL_COLORS, letterSifat, useLetters } from './letters'

// ---------- عناصر مشتركة ----------

export function LetterChip({ letter, to, active, size = 'md', onClick }) {
  const cls = `glyph rounded-lg border transition ${
    size === 'lg' ? 'size-14 text-3xl' : 'size-11 text-2xl'
  } ${active ? 'border-accent bg-accent-soft text-accent ring-2 ring-accent/40' : 'border-line bg-surface hover:border-accent'}`
  const label = `${letter.name}`
  if (onClick)
    return (
      <button type="button" onClick={onClick} className={cls} aria-label={label} aria-pressed={!!active} title={label}>
        {letter.char}
      </button>
    )
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

/** شاشة واسعة (حاسوب): الرسم ثابت بجانب القائمة؛ وفي الموبايل يظهر تحت العنصر المختار مباشرة. */
export function useIsDesktop() {
  const query = '(min-width: 1024px)'
  const [desktop, setDesktop] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.(query).matches)
  useEffect(() => {
    const mq = window.matchMedia?.(query)
    if (!mq?.addEventListener) return
    const on = () => setDesktop(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return desktop
}

/** بعد الاختيار في الموبايل: يُظهر العنصر المختار ورسمه تحته في الشاشة. */
function revealOnMobile(id, desktop) {
  if (desktop) return
  requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView?.({ block: 'start', behavior: 'smooth' }))
}

/** الرسم مع بطاقة الحرف المختار. */
function DiagramPanel({ d, makhraj, letter, organs }) {
  return (
    <div className="space-y-2">
      <HeadDiagram makhraj={makhraj} art={letter ? articulation(letter) : null} phase="contact" highlight={organs ?? []} />
      {letter && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-accent/40 bg-accent-soft px-3 py-2 text-sm">
          <span className="glyph size-10 rounded-lg bg-surface text-2xl text-accent">{letter.char}</span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">{letter.name}</span>
            <span className="block text-muted">{d.makhrajById[letter.makhraj].name}</span>
          </span>
          <Link to={`/makharij/letters/${letter.id}`} className="rounded-lg bg-accent px-3 py-1.5 font-medium text-accent-ink">
            انطقه متحركاً ←
          </Link>
        </div>
      )}
    </div>
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
  const [letterId, setLetterId] = useState(null)
  const desktop = useIsDesktop()
  return (
    <WithLetters>
      {(d) => {
        const letter = letterId ? d.letterById[letterId] : null
        const organs = letter ? [] : d.makharij.filter((m) => m.general === active).flatMap((m) => m.organs)
        const panel = <DiagramPanel d={d} letter={letter} makhraj={letter ? d.makhrajById[letter.makhraj] : null} organs={organs} />
        return (
          <div>
            <h1 className="mb-1 text-2xl font-bold">المخارج العامة الخمسة</h1>
            <p className="mb-2 text-sm text-muted">اضغط اسم المخرج لتظليله على الرسم، أو اضغط حرفاً لترى مخرجه.</p>
            <DraftNote />
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
              <ul className="space-y-2">
                {d.general.map((g) => {
                  const on = active === g.id
                  const ids = d.makharij
                    .filter((m) => m.general === g.id)
                    .flatMap((m) => m.letter_ids)
                    .filter((id, i, a) => a.indexOf(id) === i)
                  return (
                    <li key={g.id} id={`general-${g.id}`} className={`${card} scroll-mt-20 ${on ? 'border-accent ring-1 ring-accent' : ''}`}>
                      <button
                        type="button"
                        onClick={() => {
                          setActive(g.id)
                          setLetterId(null)
                          revealOnMobile(`general-${g.id}`, desktop)
                        }}
                        aria-pressed={on && !letter}
                        className="block w-full text-start"
                      >
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="text-lg font-semibold">{g.name}</span>
                          <span className="text-xs text-muted">
                            {g.count === 1 ? 'مخرج واحد' : g.count === 2 ? 'مخرجان' : `${arabicNumber(g.count)} مخارج`}
                          </span>
                        </span>
                        <span className="mt-1 block text-sm text-muted">{g.desc}</span>
                      </button>
                      <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label={`حروف ${g.name}`}>
                        {ids.map((id) => (
                          <LetterChip
                            key={id}
                            letter={d.letterById[id]}
                            active={letterId === id}
                            onClick={() => {
                              setActive(g.id)
                              setLetterId(letterId === id ? null : id)
                              revealOnMobile(`general-${g.id}`, desktop)
                            }}
                          />
                        ))}
                      </div>
                      {/* الموبايل: الرسم تحت المخرج المختار مباشرة */}
                      {!desktop && on && <div className="mt-3 border-t border-line pt-3">{panel}</div>}
                    </li>
                  )
                })}
              </ul>
              {desktop && <div className="sticky top-4 self-start">{panel}</div>}
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
  const [letterId, setLetterId] = useState(null)
  const desktop = useIsDesktop()
  return (
    <WithLetters>
      {(d) => {
        const m = d.makhrajById[active]
        const letter = d.letterById[letterId && m.letter_ids.includes(letterId) ? letterId : m.letter_ids[0]]
        const details = (
          <div className="space-y-3">
            <DiagramPanel d={d} makhraj={m} letter={letter} />
            <div className={card}>
              <p className="font-semibold">
                {arabicNumber(m.order)}. {m.name}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-muted">{m.desc}</p>
              {m.letter_ids.length > 1 && (
                <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="حروف هذا المخرج">
                  {m.letter_ids.map((id) => (
                    <LetterChip key={id} letter={d.letterById[id]} active={letter.id === id} onClick={() => setLetterId(id)} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )
        return (
          <div>
            <h1 className="mb-1 text-2xl font-bold">المخارج الخاصة السبعة عشر</h1>
            <p className="mb-2 text-sm text-muted">اضغط مخرجاً لترى موضعه وحركة النطق على الرسم.</p>
            <DraftNote />
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
              <ol className="space-y-1.5">
                {d.makharij.map((x) => {
                  const on = active === x.id
                  return (
                    <li key={x.id} id={`makhraj-${x.id}`} className="scroll-mt-20">
                      <button
                        type="button"
                        onClick={() => {
                          setActive(x.id)
                          setLetterId(null)
                          revealOnMobile(`makhraj-${x.id}`, desktop)
                        }}
                        aria-pressed={on}
                        className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-start ${
                          on ? 'border-accent bg-accent-soft' : 'border-line bg-surface hover:border-accent/50'
                        }`}
                      >
                        <span className="w-7 shrink-0 text-center text-sm font-semibold text-muted">{arabicNumber(x.order)}</span>
                        <span className="min-w-0 flex-1 text-sm font-medium">{x.name}</span>
                        <span className="font-quran !text-xl !leading-none tracking-widest">{x.letters.split('').join(' ')}</span>
                      </button>
                      {!desktop && on && <div className="mt-2">{details}</div>}
                    </li>
                  )
                })}
              </ol>
              {desktop && <div className="sticky top-4 self-start">{details}</div>}
            </div>
            <Verses verses={d.makharij_verses} />
          </div>
        )
      }}
    </WithLetters>
  )
}

// ---------- الحروف ----------

function LettersGridBody({ d, base, title }) {
  const [q, setQ] = useState('')
  const mk = Object.fromEntries(d.makharij.map((m) => [m.id, m.name]))
  const match = makeMatcher(q)
  const shown = d.letters.filter((l) => match(l.char, l.name, l.laqab, mk[l.makhraj]))
  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">{title}</h1>
      <p className="mb-3 text-sm text-muted">اضغط حرفاً لترى مخرجه متحركاً وصفاته.</p>
      <FilterBox className="mb-4" value={q} onChange={setQ} placeholder="ابحث عن حرف: ض، الصاد، الحلقية، الشفتان…" label="تصفية الحروف" count={shown.length} total={d.letters.length} />
      {shown.length === 0 && <p className="rounded-xl border border-dashed border-line p-6 text-center text-muted">لا حرف مطابق.</p>}
      <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8">
        {shown.map((l) => (
              <li key={l.id}>
                <Link
                  to={`${base}/${l.id}`}
                  className="flex flex-col items-center rounded-xl border border-line bg-surface py-2 hover:border-accent hover:bg-accent-soft"
                >
                  <span className="glyph h-14 text-3xl">{l.char}</span>
                  <span className="text-[11px] text-muted">{l.name}</span>
                </Link>
              </li>
            ))}
      </ul>
    </div>
  )
}

export function LettersGrid({ base = '/makharij/letters', title = 'الحروف واحداً واحداً' }) {
  return <WithLetters>{(d) => <LettersGridBody d={d} base={base} title={title} />}</WithLetters>
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
        <span className="glyph size-16 rounded-2xl bg-accent-soft text-5xl text-accent">{letter.char}</span>
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
  const desktop = useIsDesktop()
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
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
              <div className="flex flex-wrap content-start gap-2" role="group" aria-label="اختر حرفاً">
                {d.letters
                  .filter((l) => l.id !== 'alif')
                  .map((l) => (
                    <LetterChip
                      key={l.id}
                      letter={l}
                      active={id === l.id}
                      onClick={() => {
                        setId(l.id)
                        revealOnMobile('finding-player', desktop)
                      }}
                    />
                  ))}
              </div>
              <div id="finding-player" className="scroll-mt-20 lg:sticky lg:top-4 lg:self-start">
                <LetterPlayer key={id} letter={letter} makhraj={d.makhrajById[letter.makhraj]} />
              </div>
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
              <span className="glyph size-10 shrink-0 text-3xl text-accent">{l.char}</span>
              <span className="text-sm leading-relaxed text-muted">{l.mistakes}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
