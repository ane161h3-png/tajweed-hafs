import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { arabicNumber, useApi } from '../../lib/api'
import FilterBox from '../../components/FilterBox'
import { toAsciiDigits } from '../../lib/arabic'
import { makeMatcher } from '../../lib/filter'

export function DataState({ loading, error }) {
  if (loading) return <p className="py-10 text-center text-muted">جارٍ التحميل…</p>
  if (error)
    return (
      <div role="alert" className="rounded-xl border border-line bg-surface p-5">
        <p className="font-medium">تعذّر جلب البيانات</p>
        <p className="mt-1 text-sm text-muted">{error.message}</p>
      </div>
    )
  return null
}

export function SurahList() {
  const { data, loading, error } = useApi('/surahs')
  const [q, setQ] = useState('')
  const shown = useMemo(() => {
    if (!data) return []
    const match = makeMatcher(q)
    return data.filter((s) => match(`سورة ${s.name}`, s.name_en, s.revelation, String(s.number), `جزء ${s.juz}`))
  }, [data, q])
  if (!data) return <DataState loading={loading} error={error} />
  return (
    <div>
      <h1 className="mb-3 text-2xl font-bold">السور</h1>
      <FilterBox className="mb-4" value={q} onChange={setQ} placeholder="ابحث باسم السورة أو رقمها (مثال: يس، ٣٦، مكية)" label="تصفية السور" count={shown.length} total={data.length} />
      {shown.length === 0 && <p className="rounded-xl border border-dashed border-line p-6 text-center text-muted">لا توجد سورة بهذا الاسم.</p>}
      <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {shown.map((s) => (
          <li key={s.number}>
            <Link
              to={`/mushaf/surah/${s.number}`}
              className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 hover:border-accent/50 hover:bg-surface-2"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent-soft text-sm font-semibold text-accent">
                {arabicNumber(s.number)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium">سورة {s.name}</span>
                <span className="block text-xs text-muted">
                  {s.revelation} · {arabicNumber(s.ayah_count)} آية · الجزء {arabicNumber(s.juz)}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

export const JUZ_NAMES = { 1: 'الم', 2: 'سيقول', 3: 'تلك الرسل', 4: 'لن تنالوا', 5: 'والمحصنات', 6: 'لا يحب الله', 7: 'وإذا سمعوا', 8: 'ولو أننا', 9: 'قال الملأ', 10: 'واعلموا', 11: 'يعتذرون', 12: 'وما من دابة', 13: 'وما أبرئ', 14: 'ربما', 15: 'سبحان الذي', 16: 'قال ألم', 17: 'اقترب للناس', 18: 'قد أفلح', 19: 'وقال الذين', 20: 'أمن خلق', 21: 'اتل ما أوحي', 22: 'ومن يقنت', 23: 'وما لي', 24: 'فمن أظلم', 25: 'إليه يرد', 26: 'حم', 27: 'قال فما خطبكم', 28: 'قد سمع', 29: 'تبارك', 30: 'عم' }

export function JuzList() {
  const { data, loading, error } = useApi('/juz')
  const [q, setQ] = useState('')
  const shown = useMemo(() => {
    if (!data) return []
    const match = makeMatcher(q)
    return data.filter((j) => match(`جزء ${j.juz}`, String(j.juz), j.surah_name, JUZ_NAMES[j.juz]))
  }, [data, q])
  if (!data) return <DataState loading={loading} error={error} />
  return (
    <div>
      <h1 className="mb-3 text-2xl font-bold">الأجزاء</h1>
      <FilterBox className="mb-4" value={q} onChange={setQ} placeholder="رقم الجزء أو اسمه أو سورة بدايته (مثال: ٣٠، عم، البقرة)" label="تصفية الأجزاء" count={shown.length} total={data.length} />
      {shown.length === 0 && <p className="rounded-xl border border-dashed border-line p-6 text-center text-muted">لا يوجد جزء مطابق.</p>}
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {shown.map((j) => (
          <li key={j.juz}>
            <Link
              to={`/mushaf/juz/${j.juz}`}
              className="block rounded-xl border border-line bg-surface px-4 py-3 text-center hover:border-accent/50 hover:bg-surface-2"
            >
              <span className="block font-medium">الجزء {arabicNumber(j.juz)}</span>
              <span className="block text-xs text-muted">
                {j.surah_name} {arabicNumber(j.ayah)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** صفحات المصحف الـ ٦٠٤: اذهب إلى رقم، أو تصفّح بحسب الأجزاء، أو ابحث باسم سورة. */
export function PageList() {
  const { data: pages, loading, error } = useApi('/pages')
  const { data: juz } = useApi('/juz')
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [jump, setJump] = useState('')
  const [bad, setBad] = useState(false)

  const groups = useMemo(() => {
    if (!pages || !juz) return []
    const starts = juz.map((j) => j.surah * 1000 + j.ayah)
    const out = juz.map((j) => ({ juz: j.juz, pages: [] }))
    for (const p of pages) {
      const key = p.surah * 1000 + p.ayah
      let g = 0
      while (g + 1 < starts.length && starts[g + 1] <= key) g++
      out[g].pages.push(p)
    }
    return out
  }, [pages, juz])

  if (!pages || !juz) return <DataState loading={loading} error={error} />
  const match = makeMatcher(q)
  const go = (e) => {
    e.preventDefault()
    const n = Number(toAsciiDigits(jump.trim()))
    if (n >= 1 && n <= pages.length) navigate(`/mushaf/page/${n}`)
    else setBad(true)
  }
  const filtering = q.trim().length > 0
  const hits = groups
    .map((g) => ({ ...g, pages: g.pages.filter((p) => match(p.surah_name, `سورة ${p.surah_name}`, String(p.page), `صفحة ${p.page}`)) }))
    .filter((g) => g.pages.length)
  const total = hits.reduce((n, g) => n + g.pages.length, 0)

  return (
    <div>
      <h1 className="mb-3 text-2xl font-bold">صفحات المصحف</h1>
      <p className="mb-4 text-muted">صفحات مصحف المدينة (حفص): ٦٠٤ صفحة. اكتب رقم الصفحة للانتقال إليها، أو اختر من الأجزاء.</p>

      <form onSubmit={go} className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-surface p-3">
        <label htmlFor="jump-page" className="font-medium">
          اذهب إلى صفحة
        </label>
        <input
          id="jump-page"
          inputMode="numeric"
          value={jump}
          onChange={(e) => {
            setJump(e.target.value)
            setBad(false)
          }}
          placeholder="١ – ٦٠٤"
          aria-invalid={bad}
          className="h-11 w-28 rounded-xl border border-line bg-bg px-3 text-center text-base focus:border-accent focus:outline-none"
        />
        <button type="submit" disabled={!jump.trim()} className="h-11 rounded-xl bg-accent px-5 font-semibold text-accent-ink disabled:opacity-50">
          اذهب
        </button>
        {bad && (
          <span role="alert" className="text-sm text-[var(--pen-red)]">
            اكتب رقماً من ١ إلى {arabicNumber(pages.length)}.
          </span>
        )}
      </form>

      <FilterBox className="mb-5" value={q} onChange={setQ} placeholder="ابحث باسم سورة لترى صفحاتها (مثال: الكهف)" label="تصفية الصفحات" count={total} total={pages.length} />
      {filtering && total === 0 && <p className="rounded-xl border border-dashed border-line p-6 text-center text-muted">لا توجد صفحة مطابقة.</p>}

      <div className="space-y-5">
        {hits.map((g) => (
          <section key={g.juz} aria-label={`الجزء ${g.juz}`}>
            <h2 className="mb-2 flex items-baseline gap-2 text-sm font-semibold text-muted">
              <Link to={`/mushaf/juz/${g.juz}`} className="text-ink hover:text-accent">
                الجزء {arabicNumber(g.juz)}
              </Link>
              <span>
                ص {arabicNumber(g.pages[0].page)}–{arabicNumber(g.pages.at(-1).page)}
              </span>
            </h2>
            <ul className="grid grid-cols-4 gap-1.5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10">
              {g.pages.map((p) => (
                <li key={p.page}>
                  <Link
                    to={`/mushaf/page/${p.page}`}
                    title={`صفحة ${p.page}: ${p.surah_name} ${p.ayah}`}
                    className={`flex h-12 flex-col items-center justify-center rounded-lg border text-sm hover:border-accent ${p.ayah === 1 ? 'border-accent/60 bg-accent-soft font-semibold text-accent' : 'border-line bg-surface'}`}
                  >
                    <span className="tabular-nums">{arabicNumber(p.page)}</span>
                    {p.ayah === 1 && <span className="max-w-full truncate px-0.5 text-[0.62rem] leading-none">{p.surah_name}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}
