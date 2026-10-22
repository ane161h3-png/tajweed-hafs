import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { findSection } from '../../data/sections'
import { arabicNumber, useApi } from '../../lib/api'
import { makeMatcher } from '../../lib/filter'
import { openGlobalSearch } from '../search/GlobalSearch'
import Icon from '../../components/Icon'
import { completedLessons, lastVisit } from '../progress/progress'

/** الصفحة الرئيسية لقسم الأحكام: الأبواب بتقدّمها، والبحث في كل الدروس، وأكمل من آخر درس. */
export default function AhkamHome() {
  const section = findSection('ahkam')
  const navigate = useNavigate()
  const { data } = useApi('/lessons')
  const [q, setQ] = useState('')
  const done = completedLessons()
  const lessons = data?.lessons ?? []
  const last = lastVisit()
  const lastLesson = last?.path?.startsWith('/ahkam/') && last.path.split('/').length === 4 ? last : null

  const results = useMemo(() => {
    if (!q.trim()) return []
    const match = makeMatcher(q)
    const bab = (l) => section.subsections.find((s) => s.id === l.section)?.title
    return lessons.filter((l) => match(l.title, bab(l))).slice(0, 20)
  }, [q, lessons, section])

  const total = lessons.length
  const doneCount = lessons.filter((l) => done[l.id]).length

  return (
    <div>
      <header className="mb-5 flex items-center gap-4">
        <span className="grid size-14 place-items-center rounded-2xl bg-accent-soft text-accent">
          <Icon name="ahkam" size={30} />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold">{section.title}</h1>
          <p className="text-muted">برواية حفص عن عاصم من طريق الشاطبية · {arabicNumber(total)} درساً في {arabicNumber(section.subsections.length)} باباً</p>
        </div>
      </header>

      <div className="mb-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="relative">
          <label htmlFor="ahkam-search" className="sr-only">
            ابحث في الدروس
          </label>
          <input
            id="ahkam-search"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setQ('')
              if (e.key === 'Enter' && results[0]) navigate(`/ahkam/${results[0].section}/${results[0].id}`)
            }}
            autoComplete="off"
            placeholder="ابحث عن درس: الإخفاء، المد اللازم، القلقلة…"
            className="w-full rounded-xl border border-line bg-surface px-4 py-3 outline-none focus:border-accent"
          />
          {q.trim() && results.length === 0 && (
            <div className="absolute inset-x-0 top-full z-20 mt-1 rounded-xl border border-line bg-surface p-3 text-sm text-muted shadow-xl">
              لا درس بهذا الاسم.{' '}
              <button type="button" onClick={openGlobalSearch} className="font-medium text-accent underline-offset-4 hover:underline">
                ابحث في نصوص الدروس وكل البرنامج
              </button>
            </div>
          )}
          {results.length > 0 && (
            <ul className="absolute inset-x-0 top-full z-20 mt-1 max-h-[60vh] overflow-y-auto rounded-xl border border-line bg-surface shadow-xl">
              {results.map((l) => (
                <li key={l.id}>
                  <Link to={`/ahkam/${l.section}/${l.id}`} className="block border-b border-line/60 px-4 py-2 last:border-0 hover:bg-accent-soft">
                    <span className="font-medium">{l.title}</span>
                    <span className="ms-2 text-xs text-muted">{section.subsections.find((s) => s.id === l.section)?.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-2">
          <div className="h-2 flex-1 rounded-full bg-surface-2">
            <div className="h-2 rounded-full bg-accent" style={{ width: `${total ? (doneCount / total) * 100 : 0}%` }} />
          </div>
          <span className="text-sm tabular-nums text-muted">
            {arabicNumber(doneCount)} / {arabicNumber(total)}
          </span>
        </div>
      </div>

      {lastLesson && (
        <Link to={lastLesson.path} className="mb-5 flex items-center gap-3 rounded-2xl bg-accent px-5 py-3 text-accent-ink hover:brightness-110">
          <Icon name="resume" />
          <span>
            <span className="block font-semibold">أكمل الدرس</span>
            <span className="block text-sm opacity-85">{lastLesson.title}</span>
          </span>
        </Link>
      )}

      <ul className="grid gap-3 sm:grid-cols-2">
        {section.subsections.map((sub, i) => {
          const list = lessons.filter((l) => l.section === sub.id)
          const d = list.filter((l) => done[l.id]).length
          const complete = list.length > 0 && d === list.length
          return (
            <li key={sub.id}>
              <Link
                to={`/ahkam/${sub.id}`}
                className="flex h-full items-center gap-4 rounded-xl border border-line bg-surface px-4 py-3.5 transition hover:border-accent/50 hover:bg-surface-2"
              >
                <span className={`grid size-10 shrink-0 place-items-center rounded-full text-sm font-semibold ${complete ? 'bg-accent text-accent-ink' : 'bg-surface-2 text-muted'}`}>
                  {complete ? '✓' : arabicNumber(i + 1)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{sub.title}</span>
                  <span className="mt-1 flex items-center gap-2">
                    <span className="h-1.5 flex-1 rounded-full bg-surface-2">
                      <span className="block h-1.5 rounded-full bg-accent" style={{ width: `${list.length ? (d / list.length) * 100 : 0}%` }} />
                    </span>
                    <span className="text-xs tabular-nums text-muted">
                      {arabicNumber(d)}/{arabicNumber(list.length)}
                    </span>
                  </span>
                </span>
                <Icon name="chevron" size={18} className="text-muted" />
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
