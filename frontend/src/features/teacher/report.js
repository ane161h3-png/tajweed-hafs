// تقرير تقدّم الطالب: يُبنى على جهاز الطالب، ويُرسل للمعلّم رابطاً أو كوداً (لا خادم بينهما).
// يبقى الكود بعد علامة # في الرابط، فلا يصل إلى أي خادم.
import { readJSON, writeJSON } from '../../lib/storage'

const PROFILE_KEY = 'tajweed.student'
export const REPORT_VERSION = 1

export function studentProfile() {
  const p = readJSON(PROFILE_KEY, null)
  if (p?.id) return p
  const fresh = { id: Math.random().toString(36).slice(2, 10), name: '', group: '' }
  writeJSON(PROFILE_KEY, fresh)
  return fresh
}

export function saveStudentProfile(patch) {
  const next = { ...studentProfile(), ...patch }
  writeJSON(PROFILE_KEY, next)
  return next
}

/** التقرير: الدروس المقروءة ونتيجة كل سؤال جرّبه (صندوق المراجعة، صح، خطأ، آخر محاولة). */
export function buildReport({ profile, completed, srs, now = Date.now() }) {
  const q = Object.entries(srs).map(([id, s]) => [id, s.box, s.right, s.wrong, Math.round((s.last ?? 0) / 1000)])
  const times = [...Object.values(completed), ...Object.values(srs).map((s) => s.last ?? 0)]
  return {
    v: REPORT_VERSION,
    id: profile.id,
    n: profile.name.trim(),
    g: (profile.group ?? '').trim(),
    t: now,
    a: times.length ? Math.max(...times) : 0,
    l: Object.keys(completed),
    q,
  }
}

const toB64Url = (bytes) => {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
const fromB64Url = (s) => {
  let b = s.replace(/-/g, '+').replace(/_/g, '/')
  while (b.length % 4) b += '='
  return Uint8Array.from(atob(b), (c) => c.charCodeAt(0))
}

async function pipe(bytes, stream) {
  const writer = stream.writable.getWriter()
  writer.write(bytes).catch(() => {})
  writer.close().catch(() => {})
  const reader = stream.readable.getReader()
  const chunks = []
  for (let r = await reader.read(); !r.done; r = await reader.read()) chunks.push(r.value)
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0))
  let at = 0
  for (const c of chunks) out.set(c, (at += c.length) - c.length)
  return out
}

/** z = مضغوط (deflate)، j = نص JSON كما هو (متصفحات قديمة). */
export async function encodeReport(report) {
  const bytes = new TextEncoder().encode(JSON.stringify(report))
  if (typeof CompressionStream === 'function') return 'z' + toB64Url(await pipe(bytes, new CompressionStream('deflate-raw')))
  return 'j' + toB64Url(bytes)
}

export class ReportError extends Error {}

/** يقبل الكود وحده أو الرابط كاملاً. */
export async function decodeReport(input) {
  const raw = String(input ?? '').trim()
  const code = (/[#&]r=([A-Za-z0-9_-]+)/.exec(raw)?.[1] ?? raw).replace(/\s+/g, '')
  if (!/^[zj][A-Za-z0-9_-]+$/.test(code)) throw new ReportError('هذا ليس كود تقرير صحيحاً.')
  let report
  try {
    let bytes = fromB64Url(code.slice(1))
    if (code[0] === 'z') {
      if (typeof DecompressionStream !== 'function') throw new ReportError('حدّث المتصفح لقراءة هذا التقرير.')
      bytes = await pipe(bytes, new DecompressionStream('deflate-raw'))
    }
    report = JSON.parse(new TextDecoder().decode(bytes))
  } catch (e) {
    if (e instanceof ReportError) throw e
    throw new ReportError('الكود ناقص أو تالف؛ اطلب من الطالب إرساله مرة أخرى.')
  }
  if (report?.v !== REPORT_VERSION || !report.id || !Array.isArray(report.q) || !Array.isArray(report.l))
    throw new ReportError('صيغة التقرير غير معروفة؛ ليحدّث الطالب البرنامج.')
  return report
}

/** رابط التقرير إلى لوحة المعلّم في الموقع (حتى من داخل تطبيق أندرويد). */
export function reportLink(code) {
  const base = import.meta.env.VITE_LIVE_URL || `${window.location.origin}${import.meta.env.BASE_URL}`
  return `${base.replace(/\/?$/, '/')}teacher/students#r=${code}`
}

/**
 * تحليل التقرير بمعونة بنك الأسئلة: نتيجة كل مستوى، و«اقرأ بصوتك»، ومواضع الضعف.
 * questions: أسئلة quiz.json
 */
export function analyzeReport(report, questions = []) {
  const byId = new Map(questions.map((q) => [q.id, q]))
  const levels = { 1: blank(), 2: blank(), 3: blank() }
  const recite = blank()
  const weak = []
  for (const [id, box, right, wrong] of report.q) {
    const q = byId.get(id)
    const bucket = q?.type === 'recite' ? recite : levels[q?.level]
    if (bucket) {
      bucket.seen += 1
      bucket.right += right
      bucket.wrong += wrong
      if (box >= 4) bucket.mastered += 1
    }
    if (q && wrong > 0 && box <= 1) weak.push({ id, wrong, right, title: q.rule_title || q.topic, text: q.question ?? q.word ?? '', link: q.link })
  }
  const topics = {}
  for (const w of weak) topics[w.title] = (topics[w.title] ?? 0) + 1
  const all = [levels[1], levels[2], levels[3], recite].reduce((s, b) => ({ right: s.right + b.right, wrong: s.wrong + b.wrong }), { right: 0, wrong: 0 })
  return {
    lessons: report.l.length,
    levels,
    recite,
    accuracy: accuracy(all),
    mastered: levels[1].mastered + levels[2].mastered + levels[3].mastered + recite.mastered,
    seen: report.q.length,
    weak: weak.sort((a, b) => b.wrong - a.wrong),
    weakTopics: Object.entries(topics)
      .sort((a, b) => b[1] - a[1])
      .map(([title, count]) => ({ title, count })),
  }
}

function blank() {
  return { seen: 0, mastered: 0, right: 0, wrong: 0 }
}

/** نسبة الإجابات الصحيحة (0–100) أو null إن لم يجب شيئاً. */
export function accuracy({ right, wrong }) {
  return right + wrong ? Math.round((right / (right + wrong)) * 100) : null
}
