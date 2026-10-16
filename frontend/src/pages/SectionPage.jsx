import { Link, useParams } from 'react-router'
import { findSection, subsectionPath } from '../data/sections'
import Icon from '../components/Icon'
import NotFound from './NotFound'

export default function SectionPage({ sectionId }) {
  const params = useParams()
  const section = findSection(sectionId ?? params.sectionId)
  if (!section) return <NotFound />

  return (
    <div>
      <header className="mb-6 flex items-center gap-4">
        <span className="grid size-14 place-items-center rounded-2xl bg-accent-soft text-accent">
          <Icon name={section.icon} size={30} />
        </span>
        <div>
          <h1 className="text-2xl font-bold">{section.title}</h1>
          <p className="text-muted">{section.description}</p>
        </div>
      </header>
      <ul className="grid gap-3 sm:grid-cols-2">
        {section.subsections.map((sub, i) => (
          <li key={sub.id}>
            <Link
              to={subsectionPath(section, sub)}
              className="flex h-full items-center gap-4 rounded-xl border border-line bg-surface px-4 py-3.5 transition hover:border-accent/50 hover:bg-surface-2"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-2 text-sm font-semibold tabular-nums text-muted">
                {(i + 1).toLocaleString('ar-EG')}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{sub.title}</span>
                {sub.description && <span className="block text-sm text-muted">{sub.description}</span>}
              </span>
              <Icon name="chevron" size={18} className="text-muted" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
