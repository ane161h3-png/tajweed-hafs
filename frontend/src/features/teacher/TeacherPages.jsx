import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import ShareButton from '../../components/ShareButton'
import { usePageCrumb } from '../../components/Breadcrumb'
import { arabicNumber, useApi } from '../../lib/api'
import { DataState } from '../mushaf/MushafLists'
import { completedLessons } from '../progress/progress'
import { loadSrs } from '../quiz/srs'
import { accuracy, analyzeReport, buildReport, decodeReport, encodeReport, reportLink, saveStudentProfile, studentProfile } from './report'
import { FREE_STUDENTS, addReport, loadRoster, removeStudent, rosterCsv } from './roster'
import { CONTACT_EMAIL, PLAY_PLANS, activateCode, buyPlan, deactivate, isNative, playProducts, refreshPlay, usePremium } from './premium'

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

      <section className={`${card} space-y-3`}>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">اسمك</span>
          <input className={input} value={profile.name} onChange={(e) => update({ name: e.target.value })} placeholder="مثلاً: أحمد علي" maxLength={60} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">الحلقة أو الصف (اختياري)</span>
          <input className={input} value={profile.group} onChange={(e) => update({ group: e.target.value })} placeholder="مثلاً: حلقة الفجر" maxLength={60} />
        </label>
      </section>

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

/* ———————————— المعلّم: لوحة الطلاب ———————————— */

function useQuizBank() {
  const { data, loading, error } = useApi('/quiz')
  return { questions: data?.questions, loading, error }
}

function studentRows(roster, questions) {
  return Object.values(roster.students).map(({ report, receivedAt }) => {
    const a = analyzeReport(report, questions)
    return {
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
  same: (n) => `تقرير «${n}» هذا مضاف من قبل ✓`,
  older: (n) => `لدى اللوحة تقرير أحدث لـ«${n}».`,
  limit: () => `الخطة المجانية تتسع لـ${arabicNumber(FREE_STUDENTS)} طلاب. اشترك لإضافة عدد غير محدود.`,
}

export function TeacherDashboard() {
  const premium = usePremium()
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
      const res = addReport(report, { premium: premium.active })
      setRoster(res.roster)
      setMessage({ ok: res.status !== 'limit', text: IMPORT_MESSAGES[res.status](report.n || 'بلا اسم'), limit: res.status === 'limit' })
      if (res.status !== 'limit') setCode('')
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

  const exportCsv = () => {
    const blob = new Blob([rosterCsv(shown)], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `طلاب-التجويد-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-bold">لوحة المعلّم</h1>
        <Link to="/teacher/subscription" className="text-sm text-accent underline-offset-4 hover:underline">
          {premium.active ? 'مشترك ✓' : `الخطة المجانية: ${arabicNumber(count)} من ${arabicNumber(FREE_STUDENTS)} طلاب`}
        </Link>
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
          {message.text}{' '}
          {message.limit && (
            <Link to="/teacher/subscription" className="font-medium underline">
              الاشتراك
            </Link>
          )}
        </p>
      )}

      {!questions ? (
        <DataState loading={loading} error={error} />
      ) : count === 0 ? (
        <p className="rounded-xl border border-dashed border-line bg-surface p-6 text-center text-muted">
          لا طلاب بعد. اطلب من طلابك فتح «المعلّم والطلاب ← أرسل تقدّمي للمعلّم» وإرسال الرابط لك.
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
            <button
              type="button"
              className="rounded-lg border border-line bg-surface px-3 py-2 text-sm hover:border-accent disabled:opacity-50"
              onClick={premium.active ? exportCsv : () => navigate('/teacher/subscription')}
              title={premium.active ? '' : 'متاح للمشتركين'}
            >
              تصدير Excel (CSV){premium.active ? '' : ' 🔒'}
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
                  <p className="mt-1 text-sm text-muted">آخر نشاط: {ago(r.lastActive)}</p>
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
          {report.g && `${report.g} · `}آخر نشاط: {ago(report.a)} · التقرير بتاريخ {new Date(report.t).toLocaleDateString('ar')}
        </p>
      </div>

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

      <button type="button" onClick={remove} className="rounded-lg border border-[var(--pen-red)] px-4 py-2 text-sm text-[var(--pen-red)]">
        حذف الطالب من اللوحة
      </button>
    </div>
  )
}

/* ———————————— الاشتراك ———————————— */

const REASONS = {
  format: 'صيغة الكود غير صحيحة؛ انسخه كاملاً كما وصلك.',
  signature: 'الكود غير صالح.',
  expired: 'انتهت صلاحية هذا الكود.',
}

export function Subscription() {
  const premium = usePremium()
  const native = isNative()
  const [code, setCode] = useState('')
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)
  const [products, setProducts] = useState(null)

  useEffect(() => {
    if (native) playProducts().then(setProducts)
  }, [native])

  const activate = async (e) => {
    e.preventDefault()
    setBusy(true)
    const res = await activateCode(code)
    setBusy(false)
    setMsg(res.ok ? { ok: true, text: 'فُعّل الاشتراك ✓' } : { ok: false, text: REASONS[res.reason] })
    if (res.ok) setCode('')
  }
  const buy = async (id) => {
    setBusy(true)
    setMsg(null)
    try {
      await buyPlan(id)
    } catch (e) {
      if (!/cancel/i.test(e.message)) setMsg({ ok: false, text: e.message || 'لم يكتمل الشراء.' })
    }
    setBusy(false)
  }

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold">اشتراك لوحة المعلّم</h1>

      {premium.active ? (
        <section className={`${card} border-accent`}>
          <p className="text-lg font-semibold text-accent">اشتراكك فعّال ✓</p>
          <p className="mt-1 text-sm text-muted">
            {premium.source === 'code'
              ? `بكود تفعيل${premium.name ? ` باسم ${premium.name}` : ''}، صالح حتى ${new Date(premium.until).toLocaleDateString('ar')}.`
              : 'عبر Google Play؛ يُجدَّد تلقائياً، وتُديره أو تلغيه من Google Play ← الدفعات والاشتراكات.'}
          </p>
          {premium.source === 'code' && (
            <button type="button" className="mt-3 text-sm text-muted underline" onClick={() => window.confirm('إزالة كود التفعيل من هذا الجهاز؟') && deactivate()}>
              إزالة الكود من هذا الجهاز
            </button>
          )}
        </section>
      ) : (
        <p className="text-muted">لوحة المعلّم مجانية حتى {arabicNumber(FREE_STUDENTS)} طلاب. الاشتراك يفتح:</p>
      )}

      <ul className={`${card} space-y-2`}>
        {['عدد غير محدود من الطلاب', 'تنظيمهم في حلقات وتصفيتهم', 'تصدير تقدّم الطلاب إلى Excel', 'دعم استمرار تطوير البرنامج'].map((f) => (
          <li key={f} className="flex gap-2">
            <span className="text-accent">✓</span>
            {f}
          </li>
        ))}
      </ul>

      {!premium.active && native && (
        <section className={`${card} space-y-3`}>
          <h2 className="font-semibold">الاشتراك عبر Google Play</h2>
          {products === null ? (
            <p className="text-sm text-muted">جارٍ جلب الأسعار…</p>
          ) : products.length === 0 ? (
            <p className="text-sm text-muted">الاشتراك غير متاح في هذه النسخة بعد. ثبّت التطبيق من Google Play، أو حاول لاحقاً.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {PLAY_PLANS.map((p) => {
                const prod = products.find((x) => x.identifier === p.id)
                return (
                  prod && (
                    <button key={p.id} type="button" className={btn} disabled={busy} onClick={() => buy(p.id)}>
                      {p.title} · {prod.priceString}
                    </button>
                  )
                )
              })}
            </div>
          )}
          <button type="button" className="text-sm text-accent underline" onClick={() => refreshPlay({ restore: true })}>
            استعادة اشتراك سابق
          </button>
        </section>
      )}

      {!premium.active && !native && (
        <section className={`${card} space-y-3`}>
          <h2 className="font-semibold">التفعيل بكود</h2>
          <p className="text-sm text-muted">
            للحصول على كود اشتراك راسلنا على{' '}
            <a href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('اشتراك لوحة المعلّم')}`} className="text-accent" dir="ltr">
              {CONTACT_EMAIL}
            </a>
            ، ثم الصقه هنا.
          </p>
          <form onSubmit={activate} className="flex flex-col gap-2 sm:flex-row">
            <input className={input} dir="ltr" value={code} onChange={(e) => setCode(e.target.value)} placeholder="TJW-…" aria-label="كود التفعيل" />
            <button type="submit" className={`${btnOutline} shrink-0`} disabled={!code.trim() || busy}>
              تفعيل
            </button>
          </form>
        </section>
      )}

      {msg && (
        <p role="status" className={`text-sm ${msg.ok ? 'text-accent' : 'text-[var(--pen-red)]'}`}>
          {msg.text}
        </p>
      )}
      <Link to="/teacher/students" className="inline-block text-accent underline-offset-4 hover:underline">
        لوحة المعلّم ←
      </Link>
    </div>
  )
}
