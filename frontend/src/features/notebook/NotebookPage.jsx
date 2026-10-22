import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Capacitor } from '@capacitor/core'
import { arabicNumber } from '../../lib/api'
import { readJSON, writeJSON } from '../../lib/storage'
import { saveStudentProfile, studentProfile } from '../teacher/report'
import { NOTEBOOK_KEY, loadNotebookSettings } from './NotebookBook'

const card = 'rounded-2xl border border-line bg-surface p-4'
const input = 'w-full rounded-lg border border-line bg-bg px-3 py-2 focus:border-accent focus:outline-none'

/** رابط النسخة العامة الجاهزة (PDF): في تطبيق أندرويد من الموقع الحي، وفي الموقع من المسار نفسه. */
export function notebookUrl() {
  const live = import.meta.env.VITE_LIVE_URL
  const base = Capacitor.isNativePlatform() && live ? live : `${window.location.origin}${import.meta.env.BASE_URL}`
  return `${base.replace(/\/?$/, '/')}notebook.pdf`
}

const NOTE_PARTS = [
  ['ahkam', 'الأحكام'],
  ['makharij', 'المخارج'],
  ['sifat', 'الصفات'],
]

export default function NotebookPage() {
  const [profile, setProfile] = useState(studentProfile)
  const [settings, setSettings] = useState(loadNotebookSettings)
  const edits = useMemo(() => Object.keys(readJSON('tajweed.lessons.local', { lessons: {} }).lessons ?? {}).length, [])
  const removed = useMemo(() => (readJSON('tajweed.lessons.local', { deleted: [] }).deleted ?? []).length, [])

  const save = (patch) => {
    const next = { ...settings, ...patch }
    setSettings(next)
    writeJSON(NOTEBOOK_KEY, next)
  }

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold">دفتري: دفتر أحكام التجويد وتلاوته</h1>
      <p className="text-muted">
        دفتر خاص بك على شكل دفتر مسطّر: غلاف وفهرس بأرقام الصفحات، ثم ثلاثة أبواب (الأحكام، المخارج، الصفات) برسم لمخرج كل حرف. يحمل **تعديلاتك وإضافاتك** على الدروس
        وملاحظاتك التي تكتبها هنا، فكل مستخدم يحصل على دفتر مختلف.
      </p>

      <section className={`${card} space-y-3`}>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">اسمك (يظهر على الغلاف)</span>
          <input className={input} value={profile.name} onChange={(e) => setProfile(saveStudentProfile({ name: e.target.value }))} placeholder="مثلاً: أحمد علي" maxLength={60} />
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" className="h-5 w-5" checked={settings.drawings} onChange={(e) => save({ drawings: e.target.checked })} />
          <span>إدراج رسوم المخارج لكل حرف ولكل مخرج</span>
        </label>
      </section>

      <section className={card}>
        <h2 className="mb-1 font-semibold">تعديلاتك على الدروس</h2>
        {edits + removed === 0 ? (
          <p className="text-sm text-muted">
            لم تعدّل أي درس بعد. من أي درس في «أحكام التجويد» اضغط «تعديل المحتوى» لتعدّل أو تضيف، وستظهر تعديلاتك في دفترك بعلامة «✎ من تعديلك».
          </p>
        ) : (
          <p className="text-sm">
            في دفترك <b>{arabicNumber(edits)}</b> درساً عدّلته أو أضفته، تظهر بعلامة «✎ من تعديلك»
            {removed > 0 && <> ، و{arabicNumber(removed)} درساً حذفته لا يظهر فيه</>}.
          </p>
        )}
      </section>

      <section className={`${card} space-y-3`}>
        <h2 className="font-semibold">ملاحظاتك في الدفتر</h2>
        <p className="text-sm text-muted">ما تكتبه هنا يُطبع على الصفحات المسطّرة في آخر كل باب، وإن تركته فارغاً تبقى صفحة مسطّرة فارغة لتكتب بخط يدك.</p>
        {NOTE_PARTS.map(([key, title]) => (
          <label key={key} className="block">
            <span className="mb-1 block text-sm font-medium">ملاحظاتي على {title}</span>
            <textarea
              className={`${input} h-24`}
              value={settings.notes[key] ?? ''}
              onChange={(e) => save({ notes: { ...settings.notes, [key]: e.target.value } })}
              placeholder="اكتب ملاحظاتك…"
            />
          </label>
        ))}
      </section>

      <Link to="/notebook/book" className="flex items-center justify-center gap-3 rounded-2xl bg-accent px-6 py-4 text-lg font-semibold text-accent-ink shadow-sm hover:brightness-110">
        افتح دفتري واحفظه PDF
      </Link>
      <p className="text-xs text-muted">
        يُبنى الدفتر على جهازك الآن من محتوى البرنامج وتعديلاتك (قد يستغرق ثوانيَ)، وفي صفحته زر «حفظ كملف PDF».
        {Capacitor.isNativePlatform() ? ' في تطبيق أندرويد تظهر نافذة الطباعة: اختر «حفظ كملف PDF».' : ''}
      </p>

      <section className={`${card} text-sm`}>
        <h2 className="mb-1 font-semibold">النسخة العامة الجاهزة</h2>
        <p className="mb-2 text-muted">دفتر بمحتوى البرنامج الأصلي دون تعديلاتك، للتحميل المباشر.</p>
        <a href={notebookUrl()} download="دفتر-أحكام-التجويد.pdf" target={Capacitor.isNativePlatform() ? '_system' : undefined} rel="noreferrer" className="font-medium text-accent underline-offset-4 hover:underline">
          تحميل النسخة العامة (PDF)
        </a>
      </section>
    </div>
  )
}
