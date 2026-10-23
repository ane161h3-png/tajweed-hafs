// وضع التطبيق دون خادم (أندرويد): يجيب عن مسارات /api نفسها من ملفات public/data،
// ويحفظ تعديلات الدروس على الجهاز (تُدمج فوق الدروس الأصلية).
import { readJSON, writeJSON } from './storage'
import { findWord, tokens } from './matching'
import { prepareIndex, search } from './search'

const BASE = `${import.meta.env.BASE_URL ?? '/'}data/`
const EDITS_KEY = 'tajweed.lessons.local'
const files = new Map()
let indexPromise = null

export class ApiError extends Error {
  constructor(status, detail) {
    super(detail)
    this.status = status
  }
}

function file(rel) {
  if (!files.has(rel)) {
    files.set(
      rel,
      fetch(BASE + rel).then((r) => {
        if (!r.ok) throw new ApiError(404, 'غير موجود')
        return r.json()
      }),
    )
    files.get(rel).catch(() => files.delete(rel))
  }
  return files.get(rel).then((d) => structuredClone(d))
}

const searchIndex = () => (indexPromise ??= file('search-index.json').then(prepareIndex))

// ---------- تعديلات الدروس على الجهاز ----------

const edits = () => readJSON(EDITS_KEY, { lessons: {}, deleted: [] })
const saveEdits = (e) => writeJSON(EDITS_KEY, e)

async function resolveExamples(lesson) {
  const examples = []
  for (const ex of lesson.examples ?? []) {
    const s = await file(`surah/${ex.surah}.json`).catch(() => null)
    const a = s?.ayahs.find((x) => x.ayah === ex.ayah)
    examples.push({ ...ex, ayah_text: a?.text ?? null, surah_name: s?.surah.name ?? null, match: a ? findWord(a.text, ex.word) : null })
  }
  return { ...lesson, examples }
}

const summary = (l) => ({
  id: l.id, section: l.section, order: l.order, title: l.title, status: l.status, updated_at: l.updated_at,
  examples: Array.isArray(l.examples) ? l.examples.length : l.examples, rules: l.rules ?? [],
})

async function lessonsIndex() {
  const base = await file('lessons.json')
  const e = edits()
  const map = new Map(base.lessons.map((l) => [l.id, l]))
  for (const [id, l] of Object.entries(e.lessons)) map.set(id, summary(l))
  for (const id of e.deleted) map.delete(id)
  const lessons = [...map.values()].sort((a, b) => a.section.localeCompare(b.section) || (a.order ?? 0) - (b.order ?? 0) || a.id.localeCompare(b.id))
  return { ...base, lessons }
}

async function getLesson(id) {
  const e = edits()
  if (e.deleted.includes(id)) throw new ApiError(404, 'الدرس غير موجود')
  if (e.lessons[id]) return resolveExamples(e.lessons[id])
  return file(`lessons/${id}.json`).catch(() => {
    throw new ApiError(404, 'الدرس غير موجود')
  })
}

function validate(data) {
  if (!data.title?.trim()) throw new ApiError(422, 'اكتب عنوان الدرس')
  if (!/^[a-z0-9-]+$/.test(data.section ?? '')) throw new ApiError(422, 'باب غير صالح')
}

export async function writeLesson(method, path, body) {
  const now = new Date().toISOString().slice(0, 19) + '+00:00'
  const e = edits()
  if (method === 'POST') {
    validate(body)
    const index = await lessonsIndex()
    const ids = new Set(index.lessons.map((l) => l.id))
    let n = 1
    while (ids.has(`${body.section}-${n}`)) n++
    const order = body.order || 1 + Math.max(0, ...index.lessons.filter((l) => l.section === body.section).map((l) => l.order ?? 0))
    const lesson = { ...body, order, id: `${body.section}-${n}`, updated_at: now }
    e.lessons[lesson.id] = lesson
    e.deleted = e.deleted.filter((x) => x !== lesson.id)
    saveEdits(e)
    return lesson
  }
  const id = decodeURIComponent(path.split('/')[2])
  await getLesson(id) // 404 إن لم يوجد
  if (method === 'PUT') {
    validate(body)
    e.lessons[id] = { ...body, id, updated_at: now }
    saveEdits(e)
    return resolveExamples(e.lessons[id])
  }
  if (method === 'DELETE') {
    delete e.lessons[id]
    e.deleted = [...new Set([...e.deleted, id])]
    saveEdits(e)
    return null
  }
  throw new ApiError(405, 'غير مدعوم')
}

// ---------- القراءة ----------

/** صفحة من مصحف المدينة: تُجمع آياتها من ملفات السور بالشكل نفسه الذي يرجعه الخادم (/api/page/{n}). */
async function staticPage(n) {
  const pages = await file('pages.json')
  if (!(n >= 1 && n <= pages.length)) throw new ApiError(404, 'رقم الصفحة من 1 إلى 604')
  const start = pages[n - 1]
  const next = pages[n]
  const lo = start.surah * 1000 + start.ayah
  const hi = next ? next.surah * 1000 + next.ayah : Infinity
  const last = next ? next.surah : 114
  const surahs = []
  const ayahs = []
  let bismillah = null
  for (let s = start.surah; s <= last; s++) {
    const f = await file(`surah/${s}.json`)
    bismillah ??= f.bismillah_text ?? null
    const part = f.ayahs.filter((a) => s * 1000 + a.ayah >= lo && s * 1000 + a.ayah < hi)
    if (!part.length) continue
    surahs.push(f.surah)
    ayahs.push(...part.map((a) => ({ ...a, surah: s })))
  }
  return {
    page: n,
    start: { surah: ayahs[0].surah, ayah: ayahs[0].ayah },
    end: { surah: ayahs.at(-1).surah, ayah: ayahs.at(-1).ayah },
    surahs,
    bismillah_text: bismillah,
    ayahs,
  }
}

export async function staticApi(path) {
  const url = new URL(path, 'http://x')
  const p = url.pathname.replace(/\/+$/, '')
  let m
  if ((m = p.match(/^\/(surahs|juz|pages|hizb|rules|reciters|minshawi|letters|health)$/))) return file(`${m[1]}.json`)
  if ((m = p.match(/^\/page\/(\d+)$/))) return staticPage(Number(m[1]))
  if ((m = p.match(/^\/surah\/(\d+)$/))) return file(`surah/${m[1]}.json`).catch(() => {
    throw new ApiError(404, 'لا توجد سورة بهذا الرقم (1–114)')
  })
  if ((m = p.match(/^\/juz\/(\d+)$/))) return file(`juz/${m[1]}.json`).catch(() => {
    throw new ApiError(404, 'رقم الجزء من 1 إلى 30')
  })
  if ((m = p.match(/^\/rules\/([a-z0-9_]+)\/surahs$/))) return file(`rules/${m[1]}/surahs.json`)
  if (p === '/quiz') {
    const data = await file('quiz.json')
    const level = Number(url.searchParams.get('level'))
    return level ? { ...data, questions: data.questions.filter((q) => q.level === level) } : data
  }
  if (p === '/lessons') return lessonsIndex()
  if ((m = p.match(/^\/lessons\/([\w-]+)$/))) return getLesson(m[1])
  if ((m = p.match(/^\/ayah\/(\d+)\/(\d+)$/))) {
    const s = await file(`surah/${m[1]}.json`).catch(() => null)
    const a = s?.ayahs.find((x) => x.ayah === Number(m[2]))
    if (!a) throw new ApiError(404, 'لا توجد آية بهذا الرقم')
    return {
      surah: Number(m[1]), ayah: a.ayah, surah_name: s.surah.name, text: a.text, tajweed: a.tajweed,
      words: tokens(a.text).map(({ start, end, text }) => ({ start, end, text })),
    }
  }
  if (p === '/search') {
    const q = url.searchParams.get('q') ?? ''
    if (!q.trim()) throw new ApiError(422, 'اكتب كلمة للبحث')
    return search(await searchIndex(), q, Number(url.searchParams.get('limit')) || 20)
  }
  throw new ApiError(404, 'مسار غير موجود')
}

/** للاختبارات */
export function resetStaticCache() {
  files.clear()
  indexPromise = null
}
