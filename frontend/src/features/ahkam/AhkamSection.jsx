import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { findSection, findSubsection, subsectionPath } from '../../data/sections'
import { arabicNumber, useApi } from '../../lib/api'
import { DataState } from '../mushaf/MushafLists'
import { createLesson, EMPTY_LESSON } from './lessonsApi'
import NotFound from '../../pages/NotFound'
import { useSettings } from '../settings/SettingsContext'

/** العدد مع المعدود: مثال، مثالان، ٣–١٠ أمثلة، ١١ فأكثر مثالاً */
function examplesLabel(n) {
  if (!n) return ''
  if (n === 1) return 'مثال واحد'
  if (n === 2) return 'مثالان'
  return n <= 10 ? `${arabicNumber(n)} أمثلة` : `${arabicNumber(n)} مثالاً`
}

/** فهرس دروس القسم الفرعي، كصفحة الفهرس في أول الدفتر. */
export default function AhkamSection() {
  const { subId } = useParams()
  const navigate = useNavigate()
  const section = findSection('ahkam')
  const sub = findSubsection('ahkam', subId)
  const { data, loading, error } = useApi('/lessons')
  const [creating, setCreating] = useState(false)
  const { settings } = useSettings()
  if (!sub) return <NotFound />

  const lessons = (data?.lessons ?? []).filter((l) => l.section === subId)
  const add = async () => {
    setCreating(true)
    try {
      const created = await createLesson({ ...EMPTY_LESSON, section: subId })
      navigate(`/ahkam/${subId}/${created.id}?edit=1`)
    } catch (e) {
      window.alert(`تعذّر إنشاء الدرس: ${e.message}`)
      setCreating(false)
    }
  }
  const index = section.subsections.indexOf(sub)
  const nextSub = section.subsections[index + 1]

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{sub.title}</h1>
        {settings.editMode && (
          <button type="button" onClick={add} disabled={creating} className="rounded-lg bg-accent px-4 text-sm font-medium leading-10 text-accent-ink disabled:opacity-50">
            + درس جديد
          </button>
        )}
      </div>

      {!data ? (
        <DataState loading={loading} error={error} />
      ) : (
        <div className="notebook">
          <h2 className="notebook-title">فهرس الدروس</h2>
          {lessons.length === 0 ? (
            <p className="text-muted">لا دروس في هذا الباب بعد.{settings.editMode ? ' اضغط «درس جديد» لكتابة أول درس.' : ''}</p>
          ) : (
            <ol>
              {lessons.map((l, i) => (
                <li key={l.id}>
                  <Link to={`/ahkam/${subId}/${l.id}`} className="group flex items-baseline gap-3 hover:text-[var(--pen-blue)]">
                    <span className="notebook-label w-8 shrink-0">{arabicNumber(i + 1)}.</span>
                    <span className="font-medium group-hover:underline underline-offset-4">{l.title}</span>
                    <span className="flex-1 border-b border-dotted border-muted/40" aria-hidden="true" />
                    <span className="text-xs text-muted">
                      {examplesLabel(l.examples)}
                      {l.status === 'draft' ? ' · مسودة' : ' · رُوجع'}
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      {nextSub && (
        <div className="mt-6 text-sm">
          <Link to={subsectionPath(section, nextSub)} className="rounded-lg border border-line bg-surface px-4 py-2 hover:border-accent">
            الباب التالي: {nextSub.title} ←
          </Link>
        </div>
      )}
    </div>
  )
}
