import { Link, useParams } from 'react-router'
import { findSection, findSubsection, sectionPath, subsectionPath } from '../data/sections'
import NotFound from './NotFound'

const PHASES = {
  2: 'المرحلة الثانية: المصحف',
  3: 'المرحلة الثالثة: دروس الأحكام',
  4: 'المرحلة الرابعة: المخارج والرسوم',
  5: 'المرحلة الخامسة: الصفات',
  6: 'المرحلة السادسة: الاستماع والاختبارات والإعدادات',
}

/** صفحة القسم الفرعي العامة؛ تُستبدل بصفحة القسم الحقيقية في مرحلتها. */
export default function SubsectionPage() {
  const { sectionId, subId } = useParams()
  const section = findSection(sectionId)
  const sub = findSubsection(sectionId, subId)
  if (!section || !sub) return <NotFound />
  const index = section.subsections.indexOf(sub)
  const prev = section.subsections[index - 1]
  const next = section.subsections[index + 1]
  const phase = sub.phase ?? section.phase

  return (
    <article>
      <h1 className="text-2xl font-bold">{sub.title}</h1>
      {sub.description && <p className="mt-1 text-muted">{sub.description}</p>}

      <div className="mt-6 rounded-2xl border border-dashed border-line bg-surface p-6 text-center">
        <p className="font-medium">هذا القسم قيد الإنشاء</p>
        <p className="mt-1 text-sm text-muted">يُبنى محتواه في {PHASES[phase] ?? 'مرحلة لاحقة'}.</p>
      </div>

      <nav aria-label="التنقل بين الأقسام الفرعية" className="mt-8 flex justify-between gap-3 text-sm">
        {prev ? (
          <Link to={subsectionPath(section, prev)} className="rounded-lg border border-line bg-surface px-4 py-2 hover:border-accent">
            → {prev.title}
          </Link>
        ) : (
          <Link to={sectionPath(section)} className="rounded-lg border border-line bg-surface px-4 py-2 hover:border-accent">
            → {section.title}
          </Link>
        )}
        {next && (
          <Link to={subsectionPath(section, next)} className="rounded-lg border border-line bg-surface px-4 py-2 hover:border-accent">
            {next.title} ←
          </Link>
        )}
      </nav>
    </article>
  )
}
