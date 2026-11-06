// بيانات المسائل الشرعية (يبنيها scripts/fetch_sistani_qa.py) والبحث فيها. دوال نقية قابلة للاختبار.
import { makeMatcher, norm } from '../../lib/filter'

let promise = null

/** يحمّل الاستفتاءات مرة واحدة (ملف مستقل يُحفظ مع البرنامج فيعمل دون إنترنت). */
export function loadMasail() {
  promise ??= import('./data/qa.json').then((m) => m.default ?? m)
  promise.catch(() => (promise = null))
  return promise
}

export const qaUrl = (ref) => `https://www.sistani.org/arabic/qa/${ref}/`

// النص المطبَّع لكل استفتاء يُحسب مرة واحدة، فيبقى البحث سريعاً مع آلاف الاستفتاءات
const normCache = new WeakMap()
const hay = (item, topic) => {
  let h = normCache.get(item)
  if (h === undefined) {
    h = norm(`${topic.title} ${item.q} ${item.a}`)
    normCache.set(item, h)
  }
  return h
}

/** يبحث في عنوان الموضوع والسؤال والجواب؛ ما طابق سؤاله أولاً. */
export function searchQa(data, query, { bab = null, limit = 60 } = {}) {
  const words = norm(query).split(' ').filter(Boolean)
  if (!words.length) return []
  const inQ = makeMatcher(query)
  const first = []
  const rest = []
  for (const topic of data.topics) {
    if (bab && topic.bab !== bab) continue
    for (const item of topic.qa) {
      const h = hay(item, topic)
      if (!words.every((w) => h.includes(w))) continue
      ;(inQ(topic.title, item.q) ? first : rest).push({ item, topic })
      if (first.length >= limit) return first
    }
  }
  return [...first, ...rest].slice(0, limit)
}
