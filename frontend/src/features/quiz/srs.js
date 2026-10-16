// مراجعة الأخطاء بالتكرار المتباعد (نظام صناديق لايتنر).
// الإجابة الخاطئة تعيد السؤال إلى الصندوق الأول (يُراجع فوراً)، والصحيحة تنقله صندوقاً أعلى بفاصل أطول.
import { readJSON, writeJSON } from '../../lib/storage'

const KEY = 'tajweed.quiz'
const DAY = 24 * 60 * 60 * 1000
export const INTERVALS = [0, 1 * DAY, 3 * DAY, 7 * DAY, 14 * DAY, 30 * DAY]

export function loadSrs() {
  return readJSON(KEY, {})
}

/** يسجّل نتيجة سؤال ويرجع حالته الجديدة. now للاختبار. */
export function record(id, correct, now = Date.now(), store = loadSrs()) {
  const prev = store[id] ?? { box: 0, right: 0, wrong: 0 }
  const box = correct ? Math.min(prev.box + 1, INTERVALS.length - 1) : 1
  const next = {
    box,
    right: prev.right + (correct ? 1 : 0),
    wrong: prev.wrong + (correct ? 0 : 1),
    due: now + INTERVALS[correct ? box : 0],
    last: now,
  }
  const updated = { ...store, [id]: next }
  writeJSON(KEY, updated)
  return next
}

/** أسئلة أُخطئ فيها وحان موعد مراجعتها، الأقدم موعداً أولاً. */
export function dueForReview(store = loadSrs(), now = Date.now()) {
  return Object.entries(store)
    .filter(([, s]) => s.wrong > 0 && s.due <= now && s.box < INTERVALS.length - 1)
    .sort((a, b) => a[1].due - b[1].due)
    .map(([id]) => id)
}

export function stats(store = loadSrs()) {
  const all = Object.values(store)
  return {
    seen: all.length,
    mastered: all.filter((s) => s.box >= 4).length,
    due: dueForReview(store).length,
  }
}

export function clearSrs() {
  writeJSON(KEY, {})
}

/** خلط مع بذرة اختيارية. */
export function shuffle(list, rand = Math.random) {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
