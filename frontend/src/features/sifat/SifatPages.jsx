import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router'
import { arabicNumber } from '../../lib/api'
import { DataState } from '../mushaf/MushafLists'
import { DraftNote, LetterChip, SifaBadges, Verses } from '../makharij/MakharijPages'
import { LEVEL_COLORS, useLetters } from '../makharij/letters'

const card = 'rounded-2xl border border-line bg-surface p-4'

function useLettersPage() {
  const res = useLetters()
  const { hash } = useLocation()
  // الانتقال إلى صفة محددة (#hams) بعد التحميل
  useEffect(() => {
    if (res.data && hash) document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' })
  }, [res.data, hash])
  return res
}

function Letters({ d, chars }) {
  return (
    <p className="mt-2 flex flex-wrap gap-1.5">
      {[...chars].map((c) => {
        const l = d.letterByChar[c]
        return l ? <LetterChip key={c} letter={l} to={`/makharij/letters/${l.id}`} /> : null
      })}
    </p>
  )
}

function Definition({ s }) {
  return (
    <dl className="mt-1 text-sm leading-relaxed">
      <div>
        <dt className="inline font-semibold text-[var(--pen-blue)]">لغةً: </dt>
        <dd className="inline text-muted">{s.lugha}</dd>
      </div>
      <div>
        <dt className="inline font-semibold text-[var(--pen-blue)]">اصطلاحاً: </dt>
        <dd className="inline text-muted">{s.istilah}</dd>
      </div>
    </dl>
  )
}

// ---------- الصفات المتضادة ----------

export function OppositeSifat() {
  const { data: d, loading, error } = useLettersPage()
  if (!d) return <DataState loading={loading} error={error} />
  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">الصفات المتضادة</h1>
      <p className="mb-3 text-sm text-muted">خمس صفات لها أضداد؛ لكل حرف صفة واحدة من كل زوج.</p>
      <DraftNote />
      <div className="space-y-4">
        {d.opposite.map((g) => (
          <section key={g.id} className={card} aria-labelledby={`g-${g.id}`}>
            <h2 id={`g-${g.id}`} className="mb-3 text-lg font-semibold">{g.name}</h2>
            <div className={`grid gap-4 ${g.items.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
              {g.items.map((s) => {
                const sifa = d.sifat[s.id]
                return (
                  <div key={s.id} id={s.id} className="scroll-mt-20 rounded-xl bg-surface-2 p-3">
                    <p className="flex items-baseline justify-between gap-2">
                      <span className="font-semibold">{s.name}</span>
                      <span className="text-xs text-muted">{arabicNumber([...sifa.letters].length)} أحرف</span>
                    </p>
                    {s.code && <p className="font-quran text-xl text-accent">{s.code}</p>}
                    <Definition s={s} />
                    <Letters d={d} chars={sifa.letters} />
                  </div>
                )
              })}
            </div>
          </section>
        ))}
      </div>
      <Verses verses={d.sifat_verses.slice(0, 4)} />
    </div>
  )
}

// ---------- الصفات غير المتضادة ----------

export function NonOppositeSifat() {
  const { data: d, loading, error } = useLettersPage()
  if (!d) return <DataState loading={loading} error={error} />
  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">الصفات غير المتضادة</h1>
      <p className="mb-3 text-sm text-muted">صفات تختص بها بعض الحروف، ولا ضدّ لها.</p>
      <DraftNote />
      <ul className="grid gap-3 sm:grid-cols-2">
        {d.non_opposite.map((s) => (
          <li key={s.id} id={s.id} className={`${card} scroll-mt-20`}>
            <p className="flex items-baseline justify-between">
              <span className="text-lg font-semibold">{s.name}</span>
              <span className={`text-xs ${s.strength === 'strong' ? 'text-accent' : 'text-muted'}`}>
                {s.strength === 'strong' ? 'صفة قوية' : 'صفة ضعيفة'}
              </span>
            </p>
            <Definition s={s} />
            <Letters d={d} chars={s.letters} />
          </li>
        ))}
      </ul>
      <Verses verses={d.sifat_verses.slice(4)} />
    </div>
  )
}

// ---------- بطاقة كل حرف ----------

export function LetterCards() {
  const { data: d, loading, error } = useLettersPage()
  if (!d) return <DataState loading={loading} error={error} />
  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">بطاقة كل حرف</h1>
      <p className="mb-4 text-sm text-muted">مخرج الحرف وصفاته وقوته في بطاقة واحدة. اضغط الحرف لرؤية مخرجه متحركاً.</p>
      <DraftNote />
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {d.letters.map((l) => (
          <li key={l.id} className={card}>
            <div className="mb-2 flex items-center gap-3">
              <Link to={`/makharij/letters/${l.id}`} className="grid size-12 shrink-0 place-items-center rounded-xl bg-accent-soft font-quran text-3xl text-accent">
                {l.char}
              </Link>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{l.name}</p>
                <p className="truncate text-xs text-muted">{d.makhrajById[l.makhraj].name}</p>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-xs ${LEVEL_COLORS[l.level]}`}>{l.level}</span>
            </div>
            <SifaBadges letter={l} sifat={d.sifat} />
          </li>
        ))}
      </ul>
    </div>
  )
}

// ---------- المصفوفة التفاعلية ----------

export function SifatMatrix() {
  const { data: d, loading, error } = useLettersPage()
  const [sifa, setSifa] = useState(null)
  const [letter, setLetter] = useState(null)
  const columns = useMemo(() => (d ? [...d.opposite.flatMap((g) => g.items), ...d.non_opposite] : []), [d])
  if (!d) return <DataState loading={loading} error={error} />
  const has = (l, id) => l.sifat.includes(id) || l.extra.includes(id)
  const selected = letter && d.letterById[letter]
  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">مصفوفة الصفات</h1>
      <p className="mb-3 text-sm text-muted">اضغط صفة (رأس العمود) لتظليل حروفها، أو حرفاً (رأس الصف) لعرض صفاته.</p>
      <div className="mb-3 min-h-12 rounded-xl border border-line bg-surface px-4 py-2 text-sm" aria-live="polite">
        {sifa ? (
          <p>
            <strong>{d.sifat[sifa].name}</strong>: <span className="font-quran text-xl tracking-wider">{[...d.sifat[sifa].letters].join(' ')}</span>
          </p>
        ) : selected ? (
          <div className="flex flex-wrap items-center gap-2">
            <strong className="font-quran text-2xl">{selected.char}</strong>
            <SifaBadges letter={selected} sifat={d.sifat} />
          </div>
        ) : (
          <p className="text-muted">لا تحديد.</p>
        )}
      </div>
      <div className="overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full border-collapse text-center text-xs">
          <thead>
            <tr>
              <th className="sticky start-0 z-10 bg-surface p-1" scope="col">
                <span className="sr-only">الحرف</span>
              </th>
              {columns.map((c) => (
                <th key={c.id} scope="col" className="border-b border-line p-0">
                  <button
                    type="button"
                    onClick={() => {
                      setSifa(sifa === c.id ? null : c.id)
                      setLetter(null)
                    }}
                    aria-pressed={sifa === c.id}
                    className={`h-24 w-8 px-0.5 [writing-mode:vertical-rl] ${sifa === c.id ? 'bg-accent text-accent-ink' : 'hover:bg-surface-2'}`}
                  >
                    {c.name}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {d.letters.map((l) => (
              <tr key={l.id} className={letter === l.id ? 'bg-accent-soft' : ''}>
                <th scope="row" className="sticky start-0 z-10 border-e border-line bg-inherit p-0">
                  <button
                    type="button"
                    onClick={() => {
                      setLetter(letter === l.id ? null : l.id)
                      setSifa(null)
                    }}
                    aria-pressed={letter === l.id}
                    className="w-10 bg-surface py-0.5 font-quran text-xl hover:text-accent"
                    aria-label={l.name}
                  >
                    {l.char}
                  </button>
                </th>
                {columns.map((c) => {
                  const on = has(l, c.id)
                  const lit = on && (sifa === c.id || letter === l.id)
                  return (
                    <td
                      key={c.id}
                      className={`border-b border-line/60 ${lit ? 'bg-accent text-accent-ink' : sifa && sifa !== c.id ? 'opacity-40' : ''}`}
                    >
                      {on ? <span aria-label={`${l.name}: ${c.name}`}>●</span> : <span className="sr-only">لا</span>}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------- قوة الحروف ----------

export function LetterStrength() {
  const { data: d, loading, error } = useLettersPage()
  if (!d) return <DataState loading={loading} error={error} />
  const sorted = [...d.letters].sort((a, b) => b.score - a.score)
  const max = Math.max(...sorted.map((l) => l.score))
  const min = Math.min(...sorted.map((l) => l.score))
  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">قوة الحروف</h1>
      <p className="mb-3 text-sm text-muted">
        تُقاس قوة الحرف بعدد صفاته القوية (الجهر، الشدة، الاستعلاء، الإطباق، الصفير، القلقلة، الانحراف، التكرير، التفشي،
        الاستطالة، الغنة) مطروحاً منها صفاته الضعيفة (الهمس، الرخاوة، الاستفال، الانفتاح، اللين، الخفاء).
      </p>
      <DraftNote text="الترتيب محسوب بعدّ الصفات، وفي تصنيف بعض الحروف خلاف بين العلماء؛ يراجعه المقرئ." />
      <div className="mb-4 flex flex-wrap gap-2 text-xs">
        {d.strength_levels.map((lv) => (
          <span key={lv} className={`rounded-full px-2.5 py-1 ${LEVEL_COLORS[lv]}`}>
            {lv}
          </span>
        ))}
      </div>
      <ol className="space-y-1">
        {sorted.map((l) => {
          const width = ((l.score - min) / (max - min || 1)) * 85 + 15
          return (
            <li key={l.id} className="flex items-center gap-2">
              <Link to={`/makharij/letters/${l.id}`} className="w-8 text-center font-quran text-2xl hover:text-accent" aria-label={l.name}>
                {l.char}
              </Link>
              <div className="h-6 flex-1 rounded-full bg-surface-2">
                <div className={`flex h-6 items-center rounded-full px-2 text-xs ${LEVEL_COLORS[l.level]}`} style={{ width: `${width}%` }}>
                  {l.level}
                </div>
              </div>
              <span className="w-10 text-xs tabular-nums text-muted" dir="ltr">
                {l.score > 0 ? '+' : ''}
                {l.score}
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

// ---------- الحروف المتشابهة ----------

export function SimilarLetters() {
  const { data: d, loading, error } = useLettersPage()
  const [active, setActive] = useState(0)
  if (!d) return <DataState loading={loading} error={error} />
  const cmp = d.comparisons[active]
  const letters = cmp.letters.map((id) => d.letterById[id])
  const rows = [
    ['المخرج', (l) => d.makhrajById[l.makhraj].name],
    ...d.opposite.map((g) => [g.name, (l) => d.sifat[l.sifat.find((s) => g.items.some((i) => i.id === s))].name]),
    ['صفات أخرى', (l) => l.extra.map((x) => d.sifat[x].name).join('، ') || '—'],
    ['القوة', (l) => l.level],
  ]
  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">الفرق بين الحروف المتشابهة</h1>
      <p className="mb-3 text-sm text-muted">ما يختلف بين الحروف مظلَّل.</p>
      <DraftNote />
      <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="المجموعات">
        {d.comparisons.map((c, i) => (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={i === active}
            onClick={() => setActive(i)}
            className={`rounded-full border px-3 py-1 font-quran text-lg ${i === active ? 'border-accent bg-accent-soft text-accent' : 'border-line bg-surface'}`}
          >
            {c.letters.map((id) => d.letterById[id].char).join(' / ')}
          </button>
        ))}
      </div>
      <div className="overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line">
              <th className="p-2 text-start text-muted" scope="col">
                <span className="sr-only">البند</span>
              </th>
              {letters.map((l) => (
                <th key={l.id} scope="col" className="p-2">
                  <Link to={`/makharij/letters/${l.id}`} className="font-quran text-3xl hover:text-accent">
                    {l.char}
                  </Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, fn]) => {
              const values = letters.map(fn)
              const differs = new Set(values).size > 1
              return (
                <tr key={label} className="border-b border-line/60">
                  <th scope="row" className="p-2 text-start font-medium">
                    {label}
                  </th>
                  {values.map((v, i) => (
                    <td key={i} className={`p-2 text-center ${differs ? 'bg-gold/15 font-semibold' : 'text-muted'}`}>
                      {v}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className={`${card} mt-3 text-sm leading-relaxed`}>{cmp.note}</p>
    </div>
  )
}
