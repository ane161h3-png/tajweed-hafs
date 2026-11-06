import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { AnimatePresence, motion } from 'framer-motion'
import { lastVisit, completedLessons, activityLog, streak, lastSevenDays, dayKey } from '../features/progress/progress'
import { useLastRead } from '../features/mushaf/reading'
import { stats as srsStats } from '../features/quiz/srs'
import { openGlobalSearch } from '../features/search/GlobalSearch'
import Icon from '../components/Icon'
import TileArt from '../components/TileArt'
import { arabicNumber } from '../lib/api'
import InstallCard from '../components/InstallCard'
import ShareButton from '../components/ShareButton'

const DAILY_GOAL = 10 // دقائق

// الميزات الرئيسية في الشبكة، ولكل واحدة رسم مجسّم في TileArt
const TILES = [
  { to: '/mushaf', label: 'المصحف', art: 'mushaf' },
  { to: '/ahkam', label: 'أحكام التجويد', art: 'ahkam' },
  { to: '/makharij/letters', label: 'المخارج', art: 'makharij' },
  { to: '/sifat/matrix', label: 'الصفات', art: 'sifat' },
  { to: '/listen/reciters', label: 'الاستماع', art: 'listen' },
  { to: '/quiz/tasmee', label: 'التسميع', art: 'tasmee' },
  { to: '/quiz', label: 'الاختبارات', art: 'quiz', badge: 'due' },
]

// تظهر عند الضغط على «المزيد»
const MORE = [
  { to: '/quiz/recite', label: 'اقرأ بصوتك', icon: 'mic' },
  { to: '/quiz/review', label: 'مراجعة الأخطاء', icon: 'review' },
  { to: '/settings/notebook', label: 'دفتري (PDF)', icon: 'notebook' },
  { to: '/sifat/similar', label: 'الحروف المتشابهة', icon: 'sifat' },
  { to: '/teacher/students', label: 'المعلّم والطلاب', icon: 'teacher' },
  { to: '/settings/guide', label: 'دليل الاستخدام', icon: 'guide' },
  { to: '/mushaf/bookmarks', label: 'العلامات', icon: 'star' },
  { to: '/settings', label: 'الإعدادات', icon: 'settings' },
]

function fmt(locale, opts, date) {
  try {
    return new Intl.DateTimeFormat(locale, opts).format(date)
  } catch {
    return ''
  }
}

function greeting(h) {
  if (h < 5) return 'طابت ليلتك'
  if (h < 12) return 'صباح الخير'
  if (h < 17) return 'طاب يومك'
  return 'مساء الخير'
}

/** نقش هندسي (نجمة ثمانية) يتكرر خلفيةً للبطاقة العلوية */
function Pattern() {
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.09]" aria-hidden="true">
      <defs>
        <pattern id="home-star" width="56" height="56" patternUnits="userSpaceOnUse">
          <g fill="none" stroke="#fff" strokeWidth="1.2" transform="translate(28 28)">
            <rect x="-13" y="-13" width="26" height="26" />
            <rect x="-13" y="-13" width="26" height="26" transform="rotate(45)" />
            <circle r="5" />
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#home-star)" />
    </svg>
  )
}

function Hero({ now }) {
  const hijri = fmt('ar-SA-u-ca-islamic-umalqura', { day: 'numeric', month: 'long', year: 'numeric' }, now)
  const greg = fmt('ar-IQ', { weekday: 'long', day: 'numeric', month: 'long' }, now)
  return (
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-bl from-[#1d6b52] via-[#124634] to-[#0b2c21] px-5 pb-5 pt-6 text-white shadow-lg sm:px-7">
      <Pattern />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-white/70">{greeting(now.getHours())}</p>
          <h1 className="text-2xl font-bold sm:text-3xl">رحلتك في التجويد</h1>
          <p className="mt-0.5 text-sm text-white/75">
            {hijri}
            {hijri && greg && ' · '}
            {greg}
          </p>
        </div>
        <div className="shrink-0">
          <ShareButton
            className="inline-flex items-center gap-1.5 rounded-full bg-white/12 px-3.5 py-2 text-sm font-medium text-white ring-1 ring-white/20 hover:bg-white/20"
            url={`${window.location.origin}${import.meta.env.BASE_URL}`}
            text="برنامج لتعلّم أحكام التجويد ومخارج الحروف وصفاتها برواية حفص: مصحف ملوّن بالأحكام، ودروس، ورسوم متحركة للمخارج، واختبارات. يعمل على كل الأجهزة ودون إنترنت."
          />
        </div>
      </div>
      <button
        type="button"
        onClick={openGlobalSearch}
        className="relative mt-5 flex h-12 w-full items-center gap-3 rounded-2xl bg-white/12 px-4 text-start text-white/75 ring-1 ring-white/15 backdrop-blur transition hover:bg-white/18"
        aria-label="ابحث في البرنامج"
      >
        <Icon name="search" size={20} />
        <span className="flex-1">ابحث عن سورة أو حكم أو حرف…</span>
      </button>
    </section>
  )
}

function Tile({ tile, due }) {
  return (
    <motion.li whileTap={{ scale: 0.94 }} whileHover={{ y: -3 }} transition={{ type: 'spring', stiffness: 400, damping: 22 }}>
      <Link to={tile.to} className="relative flex flex-col items-center gap-2 rounded-2xl p-2 text-center">
        <TileArt name={tile.art} className="size-[4.75rem] drop-shadow-sm transition-transform sm:size-24" />
        {tile.badge === 'due' && due > 0 && (
          <span className="absolute end-1 top-0 grid min-w-5 place-items-center rounded-full bg-[#d64545] px-1.5 text-xs font-bold leading-5 text-white ring-2 ring-bg">
            {arabicNumber(due)}
          </span>
        )}
        <span className="text-[0.82rem] font-semibold leading-tight sm:text-sm">{tile.label}</span>
      </Link>
    </motion.li>
  )
}

function FeatureGrid({ due }) {
  const [open, setOpen] = useState(false)
  return (
    <section className="mt-6" aria-labelledby="features-h">
      <h2 id="features-h" className="sr-only">الميزات</h2>
      <ul className="grid grid-cols-4 gap-x-1 gap-y-3 sm:gap-x-3">
        {TILES.map((t) => (
          <Tile key={t.to} tile={t} due={due} />
        ))}
        <motion.li whileTap={{ scale: 0.94 }}>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="home-more"
            className="flex w-full flex-col items-center gap-2 rounded-2xl p-2"
          >
            <span className="relative grid size-[4.75rem] place-items-center sm:size-24">
              <span className="grid place-items-center">
                <motion.span animate={{ rotate: open ? 90 : 0 }} className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="size-3.5 rounded-full bg-[radial-gradient(circle_at_35%_30%,#fbe6a8,#c9993f_55%,#7a561c)] shadow" />
                  ))}
                </motion.span>
              </span>
            </span>
            <span className="text-[0.82rem] font-semibold leading-tight sm:text-sm">{open ? 'أقل' : 'المزيد'}</span>
          </button>
        </motion.li>
      </ul>
      <AnimatePresence initial={false}>
        {open && (
          <motion.ul
            id="home-more"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="mt-2 grid grid-cols-2 gap-2 overflow-hidden sm:grid-cols-4"
          >
            {MORE.map((m) => (
              <li key={m.to}>
                <Link
                  to={m.to}
                  className="flex items-center gap-2.5 rounded-xl border border-line bg-surface px-3 py-2.5 text-sm font-medium hover:border-accent/50"
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
                    <Icon name={m.icon} size={18} />
                  </span>
                  {m.label}
                </Link>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </section>
  )
}

/** حلقة تقدّم هدف اليوم */
function GoalRing({ value, size = 64 }) {
  const r = size / 2 - 5
  const c = 2 * Math.PI * r
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeOpacity=".15" strokeWidth="6" />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="#e2bd6c"
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={c}
        initial={{ strokeDashoffset: c }}
        animate={{ strokeDashoffset: c * (1 - Math.min(1, value)) }}
        transition={{ duration: 0.9, ease: 'easeOut' }}
      />
    </svg>
  )
}

function DailyJourney({ todayMinutes }) {
  const raw = useLastRead()
  const read = raw ? JSON.parse(raw) : null
  const lesson = lastVisit()
  const pct = todayMinutes / DAILY_GOAL
  const to = read ? `/mushaf/surah/${read.surah}?at=${read.ayah}` : '/mushaf'
  const chip = read ? `آخر قراءة: سورة ${read.surahName} · ${arabicNumber(read.ayah)}` : 'ابدأ القراءة من المصحف الملوّن'
  return (
    <section className="mt-6 rounded-3xl bg-gradient-to-bl from-[#123d2f] to-[#0d2a20] p-1.5 text-white shadow-md">
      <Link to={to} className="group flex items-stretch overflow-hidden rounded-[1.25rem] bg-white/[0.04] ring-1 ring-white/10">
        <div className="flex min-w-0 flex-1 items-center gap-4 p-4">
          <div className="relative grid shrink-0 place-items-center">
            <GoalRing value={pct} />
            <span className="absolute text-center text-xs leading-tight">
              <b className="block text-base tabular-nums">{arabicNumber(Math.min(todayMinutes, 999))}</b>
              <span className="text-white/60">من {arabicNumber(DAILY_GOAL)}</span>
            </span>
          </div>
          <div className="min-w-0">
            <span className="mb-1 inline-block max-w-full truncate rounded-full border border-[#4cc59a]/60 px-2.5 py-0.5 text-xs text-[#7fe0bb]">
              {chip}
            </span>
            <h2 className="text-lg font-bold leading-snug">رحلتك اليومية مع القرآن</h2>
            <p className="text-sm text-white/65">
              {pct >= 1 ? 'أتممت هدف اليوم، بارك الله فيك' : `هدفك ${arabicNumber(DAILY_GOAL)} دقائق تلاوةً وتعلّماً كل يوم`}
            </p>
          </div>
        </div>
        <span className="grid w-14 shrink-0 place-items-center bg-gradient-to-b from-[#24b07f] to-[#14805a] transition group-hover:w-16">
          <Icon name="chevron" size={26} strokeWidth={2.4} />
        </span>
      </Link>
      <Link
        to={lesson ? lesson.path : '/ahkam/noon-sakinah'}
        className="mt-1.5 flex items-center gap-3 rounded-[1.25rem] px-4 py-2.5 text-sm hover:bg-white/[0.06]"
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white/10">
          <Icon name="resume" size={16} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="font-semibold">{lesson ? 'أكمل من حيث توقفت' : 'ابدأ التعلّم'}</span>
          <span className="block truncate text-white/60">{lesson ? lesson.title : 'من أحكام النون الساكنة والتنوين'}</span>
        </span>
      </Link>
    </section>
  )
}

const DAY_NAMES = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت']

function WeekBars({ days }) {
  const [sel, setSel] = useState(days.length - 1)
  const max = Math.max(DAILY_GOAL, ...days.map((d) => d.minutes))
  const total = days.reduce((a, d) => a + d.minutes, 0)
  const d = days[sel]
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-accent">
          <Icon name="clock" size={18} /> هذا الأسبوع
        </span>
        <span className="text-sm text-muted">
          <b className="text-lg text-ink tabular-nums">{arabicNumber(total)}</b> دقيقة
        </span>
      </div>
      <div className="mt-3 flex h-24 items-end justify-between gap-1.5" role="group" aria-label="دقائق كل يوم">
        {days.map((day, i) => (
          <button
            key={day.key}
            type="button"
            onClick={() => setSel(i)}
            aria-pressed={sel === i}
            aria-label={`${DAY_NAMES[day.date.getDay()]}: ${arabicNumber(day.minutes)} دقيقة`}
            className="flex h-full flex-1 flex-col items-center justify-end gap-1"
          >
            <motion.span
              className={`w-full max-w-7 rounded-md ${sel === i ? 'bg-accent' : day.minutes ? 'bg-accent/45' : 'bg-line'}`}
              initial={{ height: 4 }}
              animate={{ height: `${Math.max(6, (day.minutes / max) * 100)}%` }}
              transition={{ delay: i * 0.05, duration: 0.5 }}
            />
            <span className={`text-[0.65rem] ${sel === i ? 'font-bold text-ink' : 'text-muted'}`}>
              {DAY_NAMES[day.date.getDay()]}
            </span>
          </button>
        ))}
      </div>
      <p className="mt-2 text-center text-xs text-muted" aria-live="polite">
        {i18nDay(d)}: {d.minutes ? `${arabicNumber(d.minutes)} دقيقة` : 'لا نشاط'}
      </p>
    </div>
  )
}

function i18nDay(d) {
  return d.key === dayKey() ? 'اليوم' : `يوم ال${DAY_NAMES[d.date.getDay()]}`
}

function StatCard({ icon, label, value, unit, to, tone = 'text-accent' }) {
  const body = (
    <>
      <span className={`flex items-center gap-1.5 text-sm font-semibold ${tone}`}>
        <Icon name={icon} size={18} /> {label}
      </span>
      <span className="mt-2 block">
        <b className="text-3xl tabular-nums">{arabicNumber(value)}</b> <span className="text-muted">{unit}</span>
      </span>
    </>
  )
  const cls = 'block rounded-2xl border border-line bg-surface p-4 transition'
  return to ? (
    <Link to={to} className={`${cls} hover:border-accent/50 hover:shadow-md`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  )
}

function Engagement({ days, streakDays, due, mastered }) {
  const done = Object.keys(completedLessons()).length
  return (
    <section className="mt-6" aria-labelledby="engage-h">
      <div className="mb-3 flex items-center justify-between">
        <h2 id="engage-h" className="text-lg font-bold">تفاعلك مع التجويد</h2>
        <Link to="/settings/progress" className="flex items-center gap-1 text-sm text-accent hover:underline">
          التفاصيل <Icon name="chevron" size={16} />
        </Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid grid-cols-2 gap-3">
          <StatCard icon="flame" label="السلسلة" value={streakDays} unit={streakDays === 1 ? 'يوم' : 'أيام'} tone="text-[#e07a2f]" />
          <StatCard icon="ahkam" label="دروس مكتملة" value={done} unit="درس" to="/ahkam" />
          <StatCard
            icon="review"
            label="للمراجعة"
            value={due}
            unit="سؤال"
            to={due ? '/quiz/review' : '/quiz'}
            tone={due ? 'text-[#d64545]' : 'text-accent'}
          />
          <StatCard icon="star" label="أتقنتَ" value={mastered} unit="سؤال" to="/quiz" tone="text-gold" />
        </div>
        <WeekBars days={days} />
      </div>
    </section>
  )
}

export default function Home() {
  const now = useMemo(() => new Date(), [])
  const log = activityLog()
  const days = lastSevenDays(log, now)
  const { due, mastered } = srsStats()

  return (
    <div className="-mt-1">
      <Hero now={now} />
      <FeatureGrid due={due} />
      <DailyJourney todayMinutes={days.at(-1).minutes} />
      <Engagement days={days} streakDays={streak(log, now)} due={due} mastered={mastered} />
      <div className="mt-6">
        <InstallCard />
      </div>
    </div>
  )
}
