import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { usePageCrumb } from '../../components/Breadcrumb'
import { findSubsection } from '../../data/sections'
import { arabicNumber, useApi } from '../../lib/api'
import { markCompleted } from '../progress/progress'
import { DataState } from '../mushaf/MushafLists'
import AyahExample, { useReciter } from './AyahExample'
import { ExamplesEditor, Field, RulesPicker, TableEditor, VersesEditor } from './LessonEditor'
import { deleteLesson, getLesson, saveLesson, toPayload } from './lessonsApi'
import { useRules } from '../mushaf/useRules'
import { useSettings } from '../settings/SettingsContext'
import ShareButton from '../../components/ShareButton'
import LessonExercise from './LessonExercise'

/** أزرار «اعرض مواضع هذا الحكم في المصحف»: تفتح أول سورة فيها الحكم مع إبرازه. */
function RuleLinks({ ids }) {
  const { byId } = useRules()
  const list = ids.map((id) => byId[id]).filter((r) => r?.first)
  if (!list.length) return null
  return (
    <div className="mt-[var(--rule)] flex flex-wrap gap-2 leading-normal">
      {list.map((r) => (
        <Link
          key={r.id}
          to={`/mushaf/surah/${r.first.surah}?rule=${r.id}&at=${r.first.ayah}`}
          className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-sm hover:border-accent hover:text-accent"
        >
          <span className="size-2.5 rounded-full" style={{ background: r.color }} aria-hidden="true" />
          اعرض مواضع {list.length > 1 ? `«${r.name}»` : 'هذا الحكم'} في المصحف
        </Link>
      ))}
    </div>
  )
}

function Block({ label, children }) {
  return (
    <section className="mt-[var(--rule)]">
      <h2 className="notebook-label text-lg">{label}</h2>
      {children}
    </section>
  )
}

function StatusStamp({ status }) {
  return status === 'reviewed' ? (
    <span className="stamp text-accent">رُوجع</span>
  ) : (
    <span className="stamp text-[var(--pen-red)]" title="هذا المحتوى مسودة يجب أن يراجعها مقرئ متخصص">
      مسودة · يراجعها المقرئ
    </span>
  )
}

function Verses({ verses }) {
  const bySource = verses.reduce((acc, v) => {
    ;(acc[v.source || ''] ??= []).push(v)
    return acc
  }, {})
  return Object.entries(bySource).map(([source, list]) => (
    <div key={source} className="mt-1">
      {source && <p className="text-sm text-muted">من {source}:</p>}
      {list.map((v, i) => (
        <p key={i} className="grid grid-cols-1 text-center font-medium text-[var(--pen-blue)] sm:grid-cols-2 sm:gap-8">
          <span>{v.first}</span>
          <span>{v.second}</span>
        </p>
      ))}
    </div>
  ))
}

function LessonTable({ table }) {
  return (
    <div className="my-[calc(var(--rule)*0.5)] overflow-x-auto rounded-lg border border-line bg-surface leading-normal">
      <table className="w-full text-center text-sm">
        {table.caption && <caption className="p-2 font-semibold">{table.caption}</caption>}
        <thead className="bg-accent-soft text-accent">
          <tr>
            {table.headers.map((h, i) => (
              <th key={i} className="px-3 py-2">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, r) => (
            <tr key={r} className="border-t border-line">
              {row.map((c, i) => (
                <td key={i} className="px-3 py-2">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** ورقة الدرس للقراءة: تُخفى الأقسام الفارغة. */
function LessonView({ lesson, reciter }) {
  const text = (label, value) =>
    value?.trim() ? (
      <Block label={label}>
        <p className="notebook-text">{value}</p>
      </Block>
    ) : null
  const hasDefinition = lesson.lugha?.trim() || lesson.istilah?.trim()
  return (
    <>
      {hasDefinition && (
        <Block label="التعريف">
          {lesson.lugha?.trim() && (
            <p className="notebook-text">
              <span className="font-semibold text-[var(--pen-blue)]">لغةً: </span>
              {lesson.lugha}
            </p>
          )}
          {lesson.istilah?.trim() && (
            <p className="notebook-text">
              <span className="font-semibold text-[var(--pen-blue)]">اصطلاحاً: </span>
              {lesson.istilah}
            </p>
          )}
        </Block>
      )}
      {text('الحروف', lesson.letters)}
      {text('طريقة الأداء', lesson.method)}
      {lesson.examples?.length > 0 && (
        <Block label="أمثلة من القرآن الكريم">
          {lesson.examples.map((ex, i) => (
            <AyahExample key={i} example={ex} reciter={reciter} />
          ))}
        </Block>
      )}
      {lesson.table?.headers?.length > 0 && (
        <Block label="جدول">
          <LessonTable table={lesson.table} />
        </Block>
      )}
      {text('الاستثناءات', lesson.exceptions)}
      {text('فوائد وتنبيهات', lesson.notes)}
      {lesson.verses?.length > 0 && (
        <Block label="من المنظومات">
          <Verses verses={lesson.verses} />
        </Block>
      )}
      {lesson.rules?.length > 0 && <RuleLinks ids={lesson.rules} />}
      <div className="no-print">
        <LessonExercise lesson={lesson} />
      </div>
      {!hasDefinition && !lesson.examples?.length && !lesson.method?.trim() && (
        <p className="mt-[var(--rule)] text-muted">الورقة فارغة. اضغط «تعديل» لكتابة الدرس.</p>
      )}
    </>
  )
}

function LessonForm({ draft, setDraft }) {
  const set = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }))
  return (
    <>
      <Block label="التعريف">
        <Field id="f-lugha" label="لغةً:" value={draft.lugha} onChange={set('lugha')} placeholder="معنى الكلمة في اللغة" />
        <Field id="f-istilah" label="اصطلاحاً:" value={draft.istilah} onChange={set('istilah')} rows={3} placeholder="التعريف عند علماء التجويد" />
      </Block>
      <Block label="الحروف">
        <Field id="f-letters" label="" value={draft.letters} onChange={set('letters')} placeholder="حروف الحكم إن وُجدت" />
      </Block>
      <Block label="طريقة الأداء">
        <Field id="f-method" label="" value={draft.method} onChange={set('method')} rows={3} placeholder="كيف يُنطق الحكم" />
      </Block>
      <Block label="أمثلة من القرآن الكريم">
        <ExamplesEditor examples={draft.examples} onChange={set('examples')} />
      </Block>
      <Block label="جدول (اختياري)">
        <TableEditor table={draft.table} onChange={set('table')} />
      </Block>
      <Block label="الاستثناءات">
        <Field id="f-exceptions" label="" value={draft.exceptions} onChange={set('exceptions')} placeholder="المواضع المستثناة" />
      </Block>
      <Block label="فوائد وتنبيهات">
        <Field id="f-notes" label="" value={draft.notes} onChange={set('notes')} placeholder="أخطاء شائعة، فروق، تنبيهات" />
      </Block>
      <Block label="من المنظومات">
        <VersesEditor verses={draft.verses} onChange={set('verses')} />
      </Block>
      <Block label="الأحكام المرتبطة في المصحف">
        <p className="text-sm text-muted">تُستعمل لزر «اعرض مواضع هذا الحكم في المصحف».</p>
        <RulesPicker value={draft.rules} onChange={set('rules')} />
      </Block>
      <Block label="حالة المراجعة">
        <div className="flex flex-wrap gap-4 leading-normal">
          {[
            ['draft', 'مسودة · يراجعها المقرئ'],
            ['reviewed', 'رُوجع واعتُمد'],
          ].map(([v, label]) => (
            <label key={v} className="flex items-center gap-2">
              <input type="radio" name="status" checked={draft.status === v} onChange={() => setDraft((d) => ({ ...d, status: v }))} />
              {label}
            </label>
          ))}
        </div>
      </Block>
    </>
  )
}

const btn = 'rounded-lg px-4 text-sm leading-10 font-medium disabled:opacity-50'

export default function LessonPage() {
  const { subId, lessonId } = useParams()
  const sectionId = 'ahkam'
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const [lesson, setLesson] = useState(null)
  const [error, setError] = useState(null)
  const [draft, setDraft] = useState(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)
  const reciter = useReciter()
  const { settings } = useSettings()
  const { data: index } = useApi('/lessons')
  const editing = draft !== null

  useEffect(() => {
    let alive = true
    setLesson(null)
    setDraft(null)
    getLesson(lessonId).then(
      (l) => {
        if (!alive) return
        setLesson(l)
        if (params.get('edit')) setDraft(structuredClone(l))
      },
      (e) => alive && setError(e),
    )
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId])

  usePageCrumb(lesson?.title)
  useEffect(() => {
    if (lesson && !editing) markCompleted(lesson.id)
  }, [lesson, editing])

  const dirty = useMemo(
    () => editing && lesson && JSON.stringify(toPayload(draft)) !== JSON.stringify(toPayload(lesson)),
    [editing, draft, lesson],
  )
  useEffect(() => {
    if (!dirty) return
    const warn = (e) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const startEdit = () => setDraft(structuredClone(lesson))
  const cancel = () => {
    if (dirty && !window.confirm('لديك تعديلات لم تُحفظ. هل تريد تجاهلها؟')) return
    setDraft(null)
    if (params.get('edit')) setParams({}, { replace: true })
  }
  const save = useCallback(async () => {
    if (!draft.title.trim()) return setMessage({ type: 'error', text: 'اكتب عنوان الدرس' })
    setSaving(true)
    try {
      const saved = await saveLesson(lesson.id, toPayload(draft))
      setLesson(saved)
      setDraft(null)
      setParams({}, { replace: true })
      setMessage({ type: 'ok', text: 'حُفظ الدرس' })
    } catch (e) {
      setMessage({ type: 'error', text: `تعذّر الحفظ: ${e.message}` })
    } finally {
      setSaving(false)
    }
  }, [draft, lesson, setParams])
  const remove = async () => {
    if (!window.confirm(`حذف درس «${lesson.title}»؟ تبقى نسخة احتياطية في مجلد data/content/backups.`)) return
    await deleteLesson(lesson.id)
    navigate(`/${sectionId}/${subId}`)
  }

  useEffect(() => {
    if (!message) return
    const t = setTimeout(() => setMessage(null), 3500)
    return () => clearTimeout(t)
  }, [message])

  useEffect(() => {
    if (!editing) return
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        save()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editing, save])

  if (!lesson) return <DataState loading={!error} error={error} />
  const siblings = (index?.lessons ?? []).filter((l) => l.section === lesson.section)
  const pos = siblings.findIndex((l) => l.id === lesson.id)
  const prev = siblings[pos - 1]
  const next = siblings[pos + 1]
  const sub = findSubsection(sectionId, subId)
  const view = editing ? draft : lesson

  return (
    <article>
      <div className="no-print sticky top-0 z-20 -mx-4 mb-4 flex flex-wrap items-center gap-2 bg-bg/90 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
        {editing ? (
          <>
            <button type="button" onClick={save} disabled={saving} className={`${btn} bg-accent text-accent-ink`}>
              {saving ? 'جارٍ الحفظ…' : 'حفظ'}
            </button>
            <button type="button" onClick={cancel} className={`${btn} border border-line bg-surface`}>
              إلغاء
            </button>
            {dirty && <span className="text-sm text-muted">تعديلات لم تُحفظ · Ctrl+S للحفظ</span>}
            <button type="button" onClick={remove} className={`${btn} ms-auto text-[var(--pen-red)] hover:bg-surface-2`}>
              حذف الدرس
            </button>
          </>
        ) : (
          <>
            {settings.editMode && (
              <button type="button" onClick={startEdit} className={`${btn} bg-accent text-accent-ink`}>
                ✎ تعديل
              </button>
            )}
            <span className="text-sm text-muted">
              {sub?.title} · الدرس {arabicNumber(pos + 1)} من {arabicNumber(siblings.length || 1)}
            </span>
            <span className="ms-auto flex gap-2">
              <ShareButton title={`درس ${lesson.title} · تعلّم التجويد`} compact />
              <button type="button" onClick={() => window.print()} className={`${btn} border border-line bg-surface`} title="طباعة ورقة الدرس">
                ⎙ طباعة
              </button>
            </span>
          </>
        )}
        {message && (
          <span role="status" className={`text-sm ${message.type === 'error' ? 'text-[var(--pen-red)]' : 'text-accent'}`}>
            {message.text}
          </span>
        )}
      </div>

      <div className="notebook">
        <header className="flex flex-wrap items-start justify-between gap-3">
          {editing ? (
            <label className="block flex-1">
              <span className="sr-only">عنوان الدرس</span>
              <input
                className="notebook-field notebook-title"
                style={{ height: 'calc(var(--rule) * 2)' }}
                value={draft.title}
                onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
              />
            </label>
          ) : (
            <h1 className="notebook-title">{lesson.title}</h1>
          )}
          <StatusStamp status={view.status} />
        </header>
        {editing ? <LessonForm draft={draft} setDraft={setDraft} /> : <LessonView lesson={lesson} reciter={reciter} />}
      </div>

      {!editing && (
        <nav aria-label="الدرس السابق والتالي" className="no-print mt-6 flex justify-between gap-3 text-sm">
          {prev ? (
            <Link to={`/${sectionId}/${subId}/${prev.id}`} className="rounded-lg border border-line bg-surface px-4 py-2 hover:border-accent">
              → {prev.title}
            </Link>
          ) : (
            <Link to={`/${sectionId}/${subId}`} className="rounded-lg border border-line bg-surface px-4 py-2 hover:border-accent">
              → فهرس {sub?.title}
            </Link>
          )}
          {next && (
            <Link to={`/${sectionId}/${subId}/${next.id}`} className="rounded-lg border border-line bg-surface px-4 py-2 hover:border-accent">
              {next.title} ←
            </Link>
          )}
        </nav>
      )}
    </article>
  )
}
