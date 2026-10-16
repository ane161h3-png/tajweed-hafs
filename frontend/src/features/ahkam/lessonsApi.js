import { api, STATIC } from '../../lib/api'
import { writeLesson } from '../../lib/staticApi'

const BASE = import.meta.env.VITE_API_BASE ?? ''

async function send(method, path, body) {
  if (STATIC) return writeLesson(method, path, body) // تُحفظ التعديلات على الجهاز
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!res.ok) {
    let detail = `خطأ ${res.status}`
    try {
      const j = await res.json()
      detail = Array.isArray(j.detail) ? j.detail.map((d) => d.msg).join('، ') : (j.detail ?? detail)
    } catch {
      /* ليس JSON */
    }
    throw new Error(detail)
  }
  return res.status === 204 ? null : res.json()
}

export const listLessons = () => api('/lessons')
export const getLesson = (id) => api(`/lessons/${id}`)
export const createLesson = (data) => send('POST', '/lessons', data)
export const saveLesson = (id, data) => send('PUT', `/lessons/${id}`, data)
export const deleteLesson = (id) => send('DELETE', `/lessons/${id}`)

/** الحقول التي يقبلها الخادم فقط (يُستبعد ما أضافه للعرض مثل نص الآية). */
export function toPayload(lesson) {
  return {
    section: lesson.section,
    title: lesson.title,
    order: lesson.order ?? 0,
    status: lesson.status ?? 'draft',
    lugha: lesson.lugha ?? '',
    istilah: lesson.istilah ?? '',
    letters: lesson.letters ?? '',
    method: lesson.method ?? '',
    examples: (lesson.examples ?? []).map(({ surah, ayah, word, note }) => ({ surah, ayah, word: word ?? '', note: note ?? '' })),
    exceptions: lesson.exceptions ?? '',
    notes: lesson.notes ?? '',
    verses: lesson.verses ?? [],
    table: lesson.table?.headers?.length ? lesson.table : null,
    rules: lesson.rules ?? [],
  }
}

export const EMPTY_LESSON = {
  title: 'درس جديد',
  status: 'draft',
  lugha: '',
  istilah: '',
  letters: '',
  method: '',
  examples: [],
  exceptions: '',
  notes: '',
  verses: [],
  table: null,
  rules: [],
}
