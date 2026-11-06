import { Link, useParams } from 'react-router'
import { findSection, findSubsection, sectionPath, subsectionPath } from '../../data/sections'
import Icon from '../../components/Icon'
import NotFound from '../../pages/NotFound'

// المسائل الشرعية على فتاوى المرجع الذي اختاره صاحب البرنامج. النص يُنقل حرفياً من الرسالة العملية
// المنشورة في موقع مكتبه مع رقم كل مسألة، ولا يُصاغ ولا يُختصر، لأن أي تغيير في عبارة الفتوى قد يغيّر حكمها.
export const MARJA = {
  name: 'السيد علي الحسيني السيستاني (دام ظله)',
  book: 'المسائل المنتخبة',
  site: 'https://www.sistani.org/arabic/',
}

function MarjaNote() {
  return (
    <aside className="mt-6 rounded-2xl border border-line bg-surface p-4 text-sm leading-7">
      <p className="font-semibold">على فتاوى {MARJA.name}</p>
      <p className="text-muted">
        تُنقل المسائل بنصّها من رسالته العملية «{MARJA.book}» مع رقم كل مسألة، دون اختصار أو إعادة صياغة. وللاستفتاء في مسألة لا تجدها،
        راجع الموقع الرسمي لمكتبه.
      </p>
      <a href={MARJA.site} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 font-medium text-accent hover:underline">
        الموقع الرسمي لمكتب سماحته <Icon name="chevron" size={16} />
      </a>
    </aside>
  )
}

export function MasailHome() {
  const section = findSection('masail')
  return (
    <div>
      <header className="mb-6 flex items-center gap-4">
        <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent">
          <Icon name={section.icon} size={30} />
        </span>
        <div className="min-w-0">
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
      <MarjaNote />
    </div>
  )
}

export function MasailBab() {
  const { bab } = useParams()
  const section = findSection('masail')
  const sub = findSubsection('masail', bab)
  if (!sub) return <NotFound />
  return (
    <article>
      <h1 className="text-2xl font-bold">{sub.title}</h1>
      {sub.description && <p className="mt-1 text-muted">{sub.description}</p>}
      <div className="mt-6 rounded-2xl border border-dashed border-line bg-surface p-6 text-center">
        <p className="font-medium">مسائل هذا الباب قيد الإضافة</p>
        <p className="mt-1 text-sm text-muted">تُضاف بنصّها من «{MARJA.book}» بعد مراجعتها مسألةً مسألة.</p>
      </div>
      <MarjaNote />
      <p className="mt-6 text-sm">
        <Link to={sectionPath(section)} className="text-accent hover:underline">
          → كل أبواب المسائل
        </Link>
      </p>
    </article>
  )
}
