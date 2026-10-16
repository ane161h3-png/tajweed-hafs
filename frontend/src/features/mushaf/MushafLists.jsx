import { Link } from 'react-router'
import { arabicNumber, useApi } from '../../lib/api'

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
  if (!data) return <DataState loading={loading} error={error} />
  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">السور</h1>
      <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {data.map((s) => (
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

export function JuzList() {
  const { data, loading, error } = useApi('/juz')
  if (!data) return <DataState loading={loading} error={error} />
  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">الأجزاء</h1>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {data.map((j) => (
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
