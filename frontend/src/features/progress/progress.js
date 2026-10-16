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
