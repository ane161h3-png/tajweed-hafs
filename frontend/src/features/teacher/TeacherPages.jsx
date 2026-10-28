import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import ShareButton from '../../components/ShareButton'
import { usePageCrumb } from '../../components/Breadcrumb'
import { arabicNumber, useApi } from '../../lib/api'
import { DataState } from '../mushaf/MushafLists'
import { completedLessons } from '../progress/progress'
import { loadSrs } from '../quiz/srs'
import { accuracy, analyzeReport, buildReport, decodeReport, encodeReport, reportLink, saveStudentProfile, studentProfile } from './report'
import { ATTENDANCE, addManualStudent, checkIn, addReport, attendanceCsv, attendanceStats, loadRoster, localDay, removeStudent, rosterCsv, setAttendance } from './roster'
import { encodeCard, parseCard } from './card'
import { QrCode, QrScannerView } from './Qr'

const card = 'rounded-2xl border border-line bg-surface p-4'
const input = 'w-full rounded-lg border border-line bg-bg px-3 py-2 focus:border-accent focus:outline-none'
const btn = 'rounded-xl bg-accent px-4 py-2.5 font-medium text-accent-ink hover:opacity-90 disabled:opacity-50'
const btnOutline = 'rounded-xl border border-accent bg-surface px-4 py-2.5 font-medium text-accent hover:bg-accent-soft'

const pct = (n) => (n == null ? '—' : `${arabicNumber(n)}٪`)

function ago(t) {
  if (!t) return 'لا نشاط بعد'
  const days = Math.floor((Date.now() - t) / 86400000)
  if (days <= 0) return 'اليوم'
  if (days === 1) return 'أمس'
  return `قبل ${arabicNumber(days)} يوماً`
}

function Stat({ label, value }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-3 text-center">
      <p className="text-2xl font-bold text-accent">{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  )
}

function downloadCsv(text, name) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${name}-${localDay()}.csv`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

/* ———————————— الطالب: أرسل تقدّمي ———————————— */

export function ShareProgress() {
  const [profile, setProfile] = useState(studentProfile)
  const [link, setLink] = useState(null)
  const [busy, setBusy] = useState(false)
  const completed = completedLessons()
  const srs = loadSrs()
  const seen = Object.keys(srs).length

  const update = (patch) => {
    setProfile(saveStudentProfile(patch))
    setLink(null)
  }
  const create = async () => {
    setBusy(true)
    const code = await encodeReport(buildReport({ profile, completed, srs }))
    setLink(reportLink(code))
    setBusy(false)
  }

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold">أرسل تقدّمي للمعلّم</h1>
      <p className="text-muted">
        ينشئ البرنامج رابطاً فيه تقدّمك (الدروس التي قرأتها ونتائج اختباراتك ومواضع أخطائك). أرسله لمعلّمك عبر واتساب أو غيره، فيفتحه في
        «لوحة المعلّم» ويتابعك. أرسل رابطاً جديداً كل مدة ليتحدّث تقدّمك عنده.
      </p>

      <ProfileFields profile={profile} onChange={update} />

      <div className="grid grid-cols-2 gap-3">
        <Stat label="دروس قرأتها" value={arabicNumber(Object.keys(completed).length)} />
        <Stat label="أسئلة جرّبتها" value={arabicNumber(seen)} />
      </div>

      {!link ? (
        <button type="button" className={btn} disabled={!profile.name.trim() || busy} onClick={create}>
          {busy ? 'جارٍ الإنشاء…' : 'أنشئ رابط التقرير'}
        </button>
      ) : (
        <section className={`${card} space-y-3`}>
          <p className="font-medium">الرابط جاهز ✓</p>
          <div className="flex flex-wrap gap-2">
            <ShareButton title="تقرير تقدّمي في تعلّم التجويد" text={`تقرير تقدّم ${profile.name} في تعلّم التجويد`} url={link} />
          </div>
          <details className="text-sm">
            <summary className="cursor-pointer text-muted">عرض الرابط لنسخه يدوياً</summary>
            <textarea readOnly className={`${input} mt-2 h-28 font-mono text-xs`} dir="ltr" value={link} onFocus={(e) => e.target.select()} />
          </details>
        </section>
      )}
      {!profile.name.trim() && <p className="text-sm text-muted">اكتب اسمك أولاً ليعرفك المعلّم.</p>}
      <p className="text-xs text-muted">يحتوي التقرير اسمك وتقدّمك فقط، ولا يُرسل إلى أي خادم؛ يصل إلى من ترسل له الرابط وحده.</p>
    </div>
  )
}

/* ———————————— الطالب: بطاقة الحضور ———————————— */

function ProfileFields({ profile, onChange }) {
  return (
    <section className={`${card} space-y-3`}>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">اسمك</span>
        <input className={input} value={profile.name} onChange={(e) => onChange({ name: e.target.value })} placeholder="مثلاً: أحمد علي" maxLength={60} />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">الحلقة أو الصف (اختياري)</span>
        <input className={input} value={profile.group} onChange={(e) => onChange({ group: e.target.value })} placeholder="مثلاً: حلقة الفجر" maxLength={60} />
      </label>
    </section>
  )
}

export function AttendanceCard() {
  const [profile, setProfile] = useState(studentProfile)
  const named = profile.name.trim()
  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="no-print text-2xl font-bold">بطاقة الحضور</h1>
      <p className="no-print text-muted">اعرض هذا الباركود على معلّمك عند دخول الحلقة، فيمسحه بجهازه ويُسجَّل حضورك. يمكنك أيضاً طباعته.</p>
      <div className="no-print">
        <ProfileFields profile={profile} onChange={(patch) => setProfile(saveStudentProfile(patch))} />
      </div>
      {named ? (
        <>
          <StudentCard id={profile.id} name={named} group={profile.group.trim()} size={240} />
          <div className="no-print flex justify-center">
            <button type="button" className={btnOutline} onClick={() => window.print()}>
              طباعة البطاقة
            </button>
          </div>
        </>
      ) : (
        <p className="no-print text-sm text-muted">اكتب اسمك أولاً ليظهر الباركود.</p>
      )}
    </div>
  )
}

function StudentCard({ id, name, group, size = 160 }) {
  return (
    <figure className="mx-auto flex w-fit break-inside-avoid flex-col items-center gap-2 rounded-2xl border border-line bg-white p-4 text-center text-black">
      <QrCode text={encodeCard({ id, name, group })} size={size} />
      <figcaption>
        <p className="text-lg font-bold">{name}</p>
        {group && <p className="text-sm">{group}</p>}
        <p className="text-xs opacity-60">تعلّم التجويد · بطاقة الحضور</p>
      </figcaption>
    </figure>
  )
}

/* ———————————— المعلّم: طباعة بطاقات الباركود ———————————— */

export function PrintCards() {
  const roster = loadRoster()
  const [group, setGroup] = useState('')
  const students = Object.values(roster.students)
    .map((s) => s.report)
    .sort((a, b) => a.n.localeCompare(b.n, 'ar'))
  const groups = [...new Set(students.map((s) => s.g).filter(Boolean))].sort()
  const shown = students.filter((s) => !group || s.g === group)
  return (
    <div className="space-y-4">
      <div className="no-print space-y-3">
        <h1 className="text-2xl font-bold">بطاقات الباركود</h1>
        <p className="text-muted">
          اطبع بطاقة لكل طالب (مفيدة لمن ليس لديه هاتف)، ثم امسحها من «تسجيل الحضور». الطالب الذي لديه البرنامج يجد بطاقته في «المعلّم والطلاب ← بطاقة الحضور».
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {groups.length > 0 && (
            <select className="rounded-lg border border-line bg-surface px-3 py-2 text-sm" value={group} onChange={(e) => setGroup(e.target.value)} aria-label="الحلقة">
              <option value="">كل الحلقات</option>
              {groups.map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
          )}
          <button type="button" className={btn} disabled={!shown.length} onClick={() => window.print()}>
            طباعة ({arabicNumber(shown.length)} بطاقة)
          </button>
        </div>
      </div>
      {shown.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line bg-surface p-6 text-center text-muted">
          لا طلاب بعد. أضفهم من <Link to="/teacher/attendance" className="text-accent">تسجيل الحضور</Link>.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 print:grid-cols-3">
          {shown.map((s) => (
            <StudentCard key={s.id} id={s.id} name={s.n} group={s.g} />
          ))}
        </div>
      )}
    </div>
  )
}

/* ———————————— المعلّم: مسح الباركود في صفحة الحضور ———————————— */

const SCAN_MESSAGES = {
  present: (n) => ({ ok: true, text: `✓ ${n}: حاضر` }),
  joined: (n) => ({ ok: true, text: `✓ ${n}: أُضيف وسُجّل حاضراً` }),
  already: (n) => ({ ok: true, text: `${n}: مسجّل حاضراً من قبل` }),
}

function AttendanceScanner({ day, onRoster }) {
  const [open, setOpen] = useState(false)
  const [log, setLog] = useState([])
  const onScan = (text) => {
    const c = parseCard(text)
    const res = c ? checkIn(day, c) : null
    const msg = c ? SCAN_MESSAGES[res.status](c.name) : { ok: false, text: 'هذا الباركود ليس بطاقة حضور من البرنامج.' }
    if (res) onRoster(res.roster)
    navigator.vibrate?.(msg.ok ? 80 : [60, 60, 60])
    setLog((l) => [{ ...msg, at: Date.now() }, ...l].slice(0, 6))
  }
  return (
    <section className={`${card} space-y-3`}>
      {!open ? (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={btn} onClick={() => setOpen(true)}>
            📷 مسح باركود الحضور
          </button>
          <Link to="/teacher/cards" className="text-sm text-accent underline-offset-4 hover:underline">
            طباعة بطاقات الباركود
          </Link>
        </div>
      ) : (
        <QrScannerView onScan={onScan} onClose={() => setOpen(false)} />
      )}
      {log.length > 0 && (
        <ul className="space-y-1 text-sm" aria-live="polite">
          {log.map((m) => (
            <li key={m.at} className={m.ok ? 'text-accent' : 'text-[var(--pen-red)]'}>
              {m.text}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/* ———————————— المعلّم: لوحة الطلاب ———————————— */

function useQuizBank() {
  const { data, loading, error } = useApi('/quiz')
  return { questions: data?.questions, loading, error }
}

function studentRows(roster, questions) {
  return Object.values(roster.students).map(({ report, receivedAt, manual }) => {
    const a = analyzeReport(report, questions)
    return {
      manual: !!manual,
      attendance: attendanceStats(roster, report.id).rate,
      id: report.id,
      name: report.n || 'بلا اسم',
      group: report.g,
      lessons: a.lessons,
      seen: a.seen,
      mastered: a.mastered,
      accuracy: a.accuracy,
      reciteAccuracy: accuracy(a.recite),
      weakTop: a.weakTopics[0]?.title,
      lastActive: report.a,
      reportAt: report.t,
      receivedAt,
    }
  })
}

const IMPORT_MESSAGES = {
  added: (n) => `أُضيف الطالب «${n}» ✓`,
  updated: (n) => `حُدّث تقدّم «${n}» ✓`,
  linked: (n) => `رُبط تقرير «${n}» بالطالب المسجّل في الحضور ✓`,
  same: (n) => `تقرير «${n}» هذا مضاف من قبل ✓`,
  older: (n) => `لدى اللوحة تقرير أحدث لـ«${n}».`,
}

export function TeacherDashboard() {
  const { questions, loading, error } = useQuizBank()
  const [roster, setRoster] = useState(loadRoster)
  const [code, setCode] = useState('')
  const [message, setMessage] = useState(null)
  const [group, setGroup] = useState('')
  const location = useLocation()
  const navigate = useNavigate()

  const importCode = async (raw) => {
    try {
      const report = await decodeReport(raw)
      const res = addReport(report, {})
      setRoster(res.roster)
      setMessage({ ok: true, text: IMPORT_MESSAGES[res.status](report.n || 'بلا اسم') })
      setCode('')
    } catch (e) {
      setMessage({ ok: false, text: e.message })
    }
  }

  // فتح رابط تقرير من الطالب: …/teacher/students#r=… (مرة واحدة لكل رابط)
  const imported = useRef(null)
  useEffect(() => {
    if (location.hash.startsWith('#r=') && imported.current !== location.hash) {
      imported.current = location.hash
      importCode(location.hash)
      navigate(location.pathname, { replace: true })
    }
  }, [location.hash]) // eslint-disable-line react-hooks/exhaustive-deps

  const rows = useMemo(() => (questions ? studentRows(roster, questions) : []), [roster, questions])
  const groups = [...new Set(rows.map((r) => r.group).filter(Boolean))].sort()
  const shown = rows.filter((r) => !group || r.group === group).sort((a, b) => (b.lastActive ?? 0) - (a.lastActive ?? 0))
  const count = rows.length

  const exportCsv = () => downloadCsv(rosterCsv(shown), 'طلاب-التجويد')

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-bold">لوحة المعلّم</h1>
        {count > 0 && <span className="text-sm text-muted">{arabicNumber(count)} طالب</span>}
      </div>
      <p className="text-muted">
        يرسل كل طالب رابط تقريره من «أرسل تقدّمي للمعلّم»، فتفتحه هنا أو تلصقه في الخانة أدناه. يُحفظ طلابك على هذا الجهاز فقط.
      </p>

      <form
        className={`${card} flex flex-col gap-2 sm:flex-row`}
        onSubmit={(e) => {
          e.preventDefault()
          if (code.trim()) importCode(code)
        }}
      >
        <input className={input} dir="ltr" value={code} onChange={(e) => setCode(e.target.value)} placeholder="الصق رابط التقرير أو الكود هنا" aria-label="رابط التقرير أو الكود" />
        <button type="submit" className={`${btn} shrink-0`} disabled={!code.trim()}>
          إضافة
        </button>
      </form>

      {message && (
        <p role="status" className={`rounded-xl border p-3 text-sm ${message.ok ? 'border-accent bg-accent-soft' : 'border-[var(--pen-red)] text-[var(--pen-red)]'}`}>
          {message.text}
        </p>
      )}

      {!questions ? (
        <DataState loading={loading} error={error} />
      ) : count === 0 ? (
        <p className="rounded-xl border border-dashed border-line bg-surface p-6 text-center text-muted">
          لا طلاب بعد. اطلب من طلابك فتح «المعلّم والطلاب ← أرسل تقدّمي للمعلّم» وإرسال الرابط لك، أو أضفهم بأسمائهم من{' '}
          <Link to="/teacher/attendance" className="text-accent">
            تسجيل الحضور
          </Link>
          .
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {groups.length > 0 && (
              <select className="rounded-lg border border-line bg-surface px-3 py-2 text-sm" value={group} onChange={(e) => setGroup(e.target.value)} aria-label="الحلقة">
                <option value="">كل الحلقات</option>
                {groups.map((g) => (
                  <option key={g}>{g}</option>
                ))}
              </select>
            )}
            <Link to="/teacher/attendance" className="rounded-lg border border-accent bg-surface px-3 py-2 text-sm font-medium text-accent">
              تسجيل الحضور
            </Link>
            <button
              type="button"
              className="rounded-lg border border-line bg-surface px-3 py-2 text-sm hover:border-accent disabled:opacity-50"
              onClick={exportCsv}
            >
              تصدير Excel (CSV)
            </button>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {shown.map((r) => (
              <li key={r.id}>
                <Link to={`/teacher/students/${r.id}`} className={`${card} block hover:border-accent`}>
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-lg font-semibold">{r.name}</p>
                    {r.group && <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs">{r.group}</span>}
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    {r.manual ? 'لم يرسل تقريره بعد' : `آخر نشاط: ${ago(r.lastActive)}`}
                    {r.attendance != null && ` · الحضور ${pct(r.attendance)}`}
                  </p>
                  <dl className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
                    <div>
                      <dt className="text-xs text-muted">دروس</dt>
                      <dd className="font-bold">{arabicNumber(r.lessons)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted">الصواب</dt>
                      <dd className="font-bold">{pct(r.accuracy)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted">أتقن</dt>
                      <dd className="font-bold">{arabicNumber(r.mastered)}</dd>
                    </div>
                  </dl>
                  {r.weakTop && <p className="mt-2 text-sm text-[var(--pen-red)]">يحتاج مراجعة: {r.weakTop}</p>}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

export function StudentDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { questions, loading, error } = useQuizBank()
  const lessons = useApi('/lessons')
  const entry = loadRoster().students[id]
  usePageCrumb(entry?.report.n || 'طالب')
  if (!entry)
    return (
      <p className="rounded-xl border border-dashed border-line bg-surface p-6 text-center text-muted">
        هذا الطالب غير موجود في لوحتك. <Link to="/teacher/students" className="text-accent">لوحة المعلّم</Link>
      </p>
    )
  if (!questions) return <DataState loading={loading} error={error} />
  const { report } = entry
  const a = analyzeReport(report, questions)
  const att = attendanceStats(loadRoster(), id)
  const titles = new Map((lessons.data?.lessons ?? []).map((l) => [l.id, l.title]))
  const LEVELS = { 1: 'المستوى الأول', 2: 'المستوى الثاني', 3: 'المستوى الثالث' }

  const remove = () => {
    if (!window.confirm(`حذف «${report.n}» من لوحتك؟`)) return
    removeStudent(id)
    navigate('/teacher/students')
  }

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold">{report.n || 'بلا اسم'}</h1>
        <p className="text-sm text-muted">
          {report.g && `${report.g} · `}
          {entry.manual ? 'أُضيف للحضور ولم يرسل تقريره بعد' : `آخر نشاط: ${ago(report.a)} · التقرير بتاريخ ${new Date(report.t).toLocaleDateString('ar-u-nu-arab')}`}
        </p>
      </div>

      <section className={card}>
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <h2 className="font-semibold">الحضور</h2>
          <Link to="/teacher/attendance" className="text-sm text-accent">
            تسجيل الحضور ←
          </Link>
        </div>
        {att.days.length === 0 ? (
          <p className="text-sm text-muted">لم يُسجَّل حضوره بعد.</p>
        ) : (
          <>
            <p className="mb-3 text-sm">
              نسبة الحضور <b className="text-accent">{pct(att.rate)}</b> ·{' '}
              {Object.entries(ATTENDANCE)
                .map(([k, v]) => `${v.label} ${arabicNumber(att[k])}`)
                .join(' · ')}
            </p>
            <ul className="flex flex-wrap gap-1.5 text-xs">
              {att.days.slice(0, 30).map((d) => (
                <li key={d.day} className={`rounded-md border px-2 py-1 ${STATUS_STYLE[d.status]}`} title={ATTENDANCE[d.status].label}>
                  {new Date(`${d.day}T12:00`).toLocaleDateString('ar-u-nu-arab', { day: 'numeric', month: 'short' })} · {ATTENDANCE[d.status].label}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {!entry.manual && (
        <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="دروس قرأها" value={arabicNumber(a.lessons)} />
        <Stat label="أسئلة جرّبها" value={arabicNumber(a.seen)} />
        <Stat label="أتقنها" value={arabicNumber(a.mastered)} />
        <Stat label="نسبة الصواب" value={pct(a.accuracy)} />
      </div>

      <section className={card}>
        <h2 className="mb-3 font-semibold">النتائج حسب المستوى</h2>
        <table className="w-full text-sm">
          <thead className="text-muted">
            <tr>
              <th className="py-1 text-start font-normal">الاختبار</th>
              <th className="font-normal">جرّب</th>
              <th className="font-normal">أتقن</th>
              <th className="font-normal">الصواب</th>
            </tr>
          </thead>
          <tbody className="text-center">
            {[...Object.entries(LEVELS).map(([k, t]) => [t, a.levels[k]]), ['اقرأ بصوتك', a.recite]].map(([t, b]) => (
              <tr key={t} className="border-t border-line">
                <td className="py-2 text-start">{t}</td>
                <td>{arabicNumber(b.seen)}</td>
                <td>{arabicNumber(b.mastered)}</td>
                <td>{pct(accuracy(b))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className={card}>
        <h2 className="mb-1 font-semibold">مواضع الضعف</h2>
        {a.weak.length === 0 ? (
          <p className="text-sm text-muted">لا أخطاء متكررة حالياً.</p>
        ) : (
          <>
            <p className="mb-3 text-sm text-muted">الأحكام التي أخطأ فيها ولم يُتقنها بعد، الأكثر تكراراً أولاً:</p>
            <ul className="mb-4 flex flex-wrap gap-2">
              {a.weakTopics.slice(0, 8).map((t) => (
                <li key={t.title} className="rounded-full border border-[var(--pen-red)] px-3 py-1 text-sm text-[var(--pen-red)]">
                  {t.title} ({arabicNumber(t.count)})
                </li>
              ))}
            </ul>
            <ul className="space-y-2 text-sm">
              {a.weak.slice(0, 15).map((w) => (
                <li key={w.id} className="border-t border-line pt-2">
                  <span className="font-medium">{w.title}</span>
                  {w.text && <span className="text-muted"> — {w.text}</span>}
                  <span className="text-muted"> (أخطأ {arabicNumber(w.wrong)})</span>
                  {w.link && (
                    <Link to={w.link} className="ms-2 text-accent">
                      الدرس ←
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className={card}>
        <h2 className="mb-2 font-semibold">الدروس المقروءة ({arabicNumber(report.l.length)})</h2>
        {report.l.length === 0 ? (
          <p className="text-sm text-muted">لم يقرأ دروساً بعد.</p>
        ) : (
          <ul className="flex flex-wrap gap-2 text-sm">
            {report.l.map((l) => (
              <li key={l} className="rounded-lg border border-line px-2 py-1">
                {titles.get(l) ?? l}
              </li>
            ))}
          </ul>
        )}
      </section>

        </>
      )}

      <button type="button" onClick={remove} className="rounded-lg border border-[var(--pen-red)] px-4 py-2 text-sm text-[var(--pen-red)]">
        حذف الطالب من اللوحة
      </button>
    </div>
  )
}

/* ———————————— المعلّم: تسجيل الحضور ———————————— */

const STATUS_STYLE = {
  present: 'border-accent bg-accent-soft text-accent',
  late: 'border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-400',
  absent: 'border-[var(--pen-red)] bg-[var(--pen-red)]/10 text-[var(--pen-red)]',
  excused: 'border-sky-500 bg-sky-500/10 text-sky-700 dark:text-sky-400',
}

function shiftDay(day, n) {
  const d = new Date(`${day}T12:00`)
  d.setDate(d.getDate() + n)
  return localDay(d)
}

export function AttendancePage() {
  const [roster, setRoster] = useState(loadRoster)
  const [day, setDay] = useState(localDay)
  const [group, setGroup] = useState('')
  const [name, setName] = useState('')
  const [newGroup, setNewGroup] = useState('')
  const [message, setMessage] = useState(null)

  const students = Object.values(roster.students)
    .map((s) => s.report)
    .sort((a, b) => a.n.localeCompare(b.n, 'ar'))
  const groups = [...new Set(students.map((s) => s.g).filter(Boolean))].sort()
  const shown = students.filter((s) => !group || s.g === group)
  const marks = roster.attendance[day] ?? {}
  const counts = Object.fromEntries(Object.keys(ATTENDANCE).map((k) => [k, shown.filter((s) => marks[s.id] === k).length]))
  const unmarked = shown.filter((s) => !marks[s.id])
  const isToday = day === localDay()

  const mark = (id, status) => setRoster(setAttendance(day, id, marks[id] === status ? null : status))
  const addStudent = (e) => {
    e.preventDefault()
    const res = addManualStudent(name, newGroup || group)
    setRoster(res.roster)
    setMessage(
      {
        added: { ok: true, text: `أُضيف «${name.trim()}» ✓` },
        exists: { ok: false, text: 'هذا الطالب موجود في القائمة.' },
        empty: null,
      }[res.status],
    )
    if (res.status === 'added') setName('')
  }

  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-2xl font-bold">تسجيل الحضور</h1>

      <div className={`${card} flex flex-wrap items-center gap-2`}>
        <button type="button" className="rounded-lg border border-line px-3 py-2" onClick={() => setDay(shiftDay(day, -1))} aria-label="اليوم السابق">
          →
        </button>
        <input
          type="date"
          className="rounded-lg border border-line bg-bg px-3 py-2"
          value={day}
          max={localDay()}
          onChange={(e) => e.target.value && setDay(e.target.value)}
          aria-label="التاريخ"
        />
        <button type="button" className="rounded-lg border border-line px-3 py-2 disabled:opacity-40" disabled={isToday} onClick={() => setDay(shiftDay(day, 1))} aria-label="اليوم التالي">
          ←
        </button>
        <span className="text-sm text-muted">
          {isToday ? 'اليوم، ' : ''}
          {new Date(`${day}T12:00`).toLocaleDateString('ar-u-nu-arab', { weekday: 'long', day: 'numeric', month: 'long' })}
        </span>
        {!isToday && (
          <button type="button" className="text-sm text-accent underline" onClick={() => setDay(localDay())}>
            اليوم
          </button>
        )}
      </div>

      <AttendanceScanner day={day} onRoster={setRoster} />

      {students.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {groups.length > 0 && (
              <select className="rounded-lg border border-line bg-surface px-3 py-2 text-sm" value={group} onChange={(e) => setGroup(e.target.value)} aria-label="الحلقة">
                <option value="">كل الحلقات</option>
                {groups.map((g) => (
                  <option key={g}>{g}</option>
                ))}
              </select>
            )}
            <button
              type="button"
              className="rounded-lg border border-accent bg-surface px-3 py-2 text-sm font-medium text-accent disabled:opacity-40"
              disabled={!unmarked.length}
              onClick={() => setRoster(setAttendance(day, unmarked.map((s) => s.id), 'present'))}
            >
              الباقون حاضرون ({arabicNumber(unmarked.length)})
            </button>
            <button
              type="button"
              className="rounded-lg border border-line bg-surface px-3 py-2 text-sm hover:border-accent"
              onClick={() => downloadCsv(attendanceCsv(roster, shown.map((s) => s.id)), 'سجل-الحضور')}
            >
              تصدير سجل الحضور (CSV)
            </button>
          </div>
          <p className="text-sm text-muted" aria-live="polite">
            {Object.entries(ATTENDANCE)
              .map(([k, v]) => `${v.label}: ${arabicNumber(counts[k])}`)
              .join(' · ')}{' '}
            · لم يُسجَّل: {arabicNumber(unmarked.length)}
          </p>
        </>
      )}

      <ul className="space-y-2">
        {shown.map((s) => (
          <li key={s.id} className={`${card} flex flex-wrap items-center justify-between gap-2 py-3`}>
            <Link to={`/teacher/students/${s.id}`} className="min-w-0 font-medium hover:text-accent">
              {s.n}
              {s.g && !group && <span className="ms-2 text-xs text-muted">{s.g}</span>}
            </Link>
            <div className="flex gap-1.5" role="group" aria-label={`حضور ${s.n}`}>
              {Object.entries(ATTENDANCE).map(([k, v]) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={marks[s.id] === k}
                  onClick={() => mark(s.id, k)}
                  className={`min-w-14 rounded-lg border px-2.5 py-1.5 text-sm ${marks[s.id] === k ? `${STATUS_STYLE[k]} font-semibold` : 'border-line text-muted hover:border-accent'}`}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>

      <form onSubmit={addStudent} className={`${card} space-y-2`}>
        <h2 className="font-semibold">إضافة طالب باسمه</h2>
        <p className="text-sm text-muted">لتسجيل حضوره قبل أن يرسل تقريره. عندما يرسل تقريراً بالاسم نفسه يُربط به تلقائياً.</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="اسم الطالب" aria-label="اسم الطالب" maxLength={60} />
          <input
            className={input}
            value={newGroup}
            onChange={(e) => setNewGroup(e.target.value)}
            placeholder={group || 'الحلقة (اختياري)'}
            aria-label="الحلقة"
            list="groups-list"
            maxLength={60}
          />
          <datalist id="groups-list">
            {groups.map((g) => (
              <option key={g} value={g} />
            ))}
          </datalist>
          <button type="submit" className={`${btn} shrink-0`} disabled={!name.trim()}>
            إضافة
          </button>
        </div>
        {message && (
          <p role="status" className={`text-sm ${message.ok ? 'text-accent' : 'text-[var(--pen-red)]'}`}>
            {message.text}
          </p>
        )}
      </form>
    </div>
  )
}
