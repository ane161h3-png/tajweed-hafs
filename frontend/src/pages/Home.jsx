import { Link } from 'react-router'
import { motion } from 'framer-motion'
import { SECTIONS, sectionPath } from '../data/sections'
import { lastVisit, completedLessons } from '../features/progress/progress'
import Icon from '../components/Icon'
import { arabicNumber } from '../lib/api'
import InstallCard from '../components/InstallCard'
import ShareButton from '../components/ShareButton'

/** العدد مع المعدود: قسمان، ٣–١٠ أقسام، ١١ فأكثر قسماً */
function subsectionsLabel(n) {
  if (n === 1) return 'قسم فرعي واحد'
  if (n === 2) return 'قسمان فرعيان'
  if (n <= 10) return `${arabicNumber(n)} أقسام فرعية`
  return `${arabicNumber(n)} قسماً فرعياً`
}

export default function Home() {
  const last = lastVisit()
  const done = Object.keys(completedLessons()).length

  return (
    <div>
      <section className="mb-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold sm:text-3xl">تعلّم أحكام التجويد</h1>
            <p className="mt-1 text-muted">برواية حفص عن عاصم من طريق الشاطبية: الأحكام، ومخارج الحروف، وصفاتها.</p>
          </div>
          <ShareButton
            url={`${window.location.origin}${import.meta.env.BASE_URL}`}
            text="برنامج لتعلّم أحكام التجويد ومخارج الحروف وصفاتها برواية حفص: مصحف ملوّن بالأحكام، ودروس، ورسوم متحركة للمخارج، واختبارات. يعمل على كل الأجهزة ودون إنترنت."
          />
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-stretch">
          {last ? (
            <Link
              to={last.path}
              className="group flex flex-1 items-center gap-4 rounded-2xl bg-accent px-5 py-4 text-accent-ink shadow-sm transition hover:brightness-110"
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-white/15">
                <Icon name="resume" />
              </span>
              <span className="min-w-0">
                <span className="block font-semibold">أكمل من حيث توقفت</span>
                <span className="block truncate text-sm opacity-85">{last.title}</span>
              </span>
            </Link>
          ) : (
            <Link
              to="/ahkam"
              className="flex flex-1 items-center gap-4 rounded-2xl bg-accent px-5 py-4 text-accent-ink shadow-sm hover:brightness-110"
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-white/15">
                <Icon name="resume" />
              </span>
              <span>
                <span className="block font-semibold">ابدأ التعلّم</span>
                <span className="block text-sm opacity-85">من أحكام النون الساكنة والتنوين</span>
              </span>
            </Link>
          )}
          <div className="flex items-center gap-4 rounded-2xl border border-line bg-surface px-5 py-4 sm:w-64">
            {done > 0 ? (
              <>
                <div className="text-3xl font-bold tabular-nums text-accent">{arabicNumber(done)}</div>
                <div className="text-sm leading-snug text-muted">درساً مكتملاً</div>
              </>
            ) : (
              <div className="text-sm leading-snug text-muted">
                <span className="block font-medium text-ink">تقدّمك</span>
                لم تُكمل أي درس بعد
              </div>
            )}
          </div>
        </div>
      </section>

      <InstallCard />
      <h2 className="sr-only">الأقسام</h2>
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {SECTIONS.map((s, i) => (
          <motion.li
            key={s.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04, duration: 0.3 }}
          >
            <Link
              to={sectionPath(s)}
              className="flex h-full flex-col rounded-2xl border border-line bg-surface p-5 transition hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-md"
            >
              <span className="mb-3 grid size-12 place-items-center rounded-xl bg-accent-soft text-accent">
                <Icon name={s.icon} size={26} />
              </span>
              <span className="text-lg font-semibold">{s.title}</span>
              <span className="mt-1 text-sm text-muted">{s.description}</span>
              <span className="mt-auto pt-3 text-xs text-muted">{subsectionsLabel(s.subsections.length)}</span>
            </Link>
          </motion.li>
        ))}
      </ul>
    </div>
  )
}
