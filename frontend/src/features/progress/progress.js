import { readJSON, writeJSON } from '../../lib/storage'

const LAST_KEY = 'tajweed.lastVisited'
const DONE_KEY = 'tajweed.completed'

/** يحفظ آخر صفحة زارها المستخدم (عدا الرئيسية) لزر «أكمل من حيث توقفت». */
export function rememberVisit(path, crumbs) {
  if (path === '/' || crumbs.length < 2) return
  writeJSON(LAST_KEY, { path, title: crumbs.slice(1).map((c) => c.title).join(' ← '), at: Date.now() })
}

export function lastVisit() {
  return readJSON(LAST_KEY, null)
}

/** الدروس المكتملة: { lessonId: timestamp } — تُستعمل من المرحلة الثالثة. */
export function completedLessons() {
  return readJSON(DONE_KEY, {})
}

export function markCompleted(lessonId) {
  writeJSON(DONE_KEY, { ...completedLessons(), [lessonId]: Date.now() })
}

export function clearProgress() {
  writeJSON(LAST_KEY, null)
  writeJSON(DONE_KEY, {})
}

// ---------- النشاط اليومي: السلسلة ودقائق الأسبوع ----------

const ACTIVITY_KEY = 'tajweed.activity'
const KEEP_DAYS = 60

/** مفتاح اليوم بالتوقيت المحلي: YYYY-MM-DD */
export function dayKey(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** سجل النشاط: { 'YYYY-MM-DD': ثوانٍ } */
export function activityLog() {
  return readJSON(ACTIVITY_KEY, {})
}

/** يضيف ثوانيَ إلى نشاط اليوم ويحذف ما مضى عليه أكثر من شهرين. */
export function logActivity(seconds, now = new Date()) {
  const log = activityLog()
  const today = dayKey(now)
  log[today] = (log[today] || 0) + seconds
  const cutoff = dayKey(new Date(now.getTime() - KEEP_DAYS * 86400000))
  for (const k of Object.keys(log)) if (k < cutoff) delete log[k]
  writeJSON(ACTIVITY_KEY, log)
}

/** عدد الأيام المتتالية التي فيها نشاط، تنتهي اليوم أو أمس (فلا تنقطع قبل أن يفتح البرنامج اليوم). */
export function streak(log = activityLog(), now = new Date()) {
  const d = new Date(now)
  if (!log[dayKey(d)]) d.setDate(d.getDate() - 1)
  let n = 0
  while (log[dayKey(d)]) {
    n++
    d.setDate(d.getDate() - 1)
  }
  return n
}

/** الأيام السبعة الأخيرة (الأقدم أولاً) مع دقائق كل يوم. */
export function lastSevenDays(log = activityLog(), now = new Date()) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now)
    d.setDate(d.getDate() - (6 - i))
    return { date: d, key: dayKey(d), minutes: Math.round((log[dayKey(d)] || 0) / 60) }
  })
}
