import { Capacitor } from '@capacitor/core'
import { api, STATIC } from './lib/api'

const BASE = import.meta.env.BASE_URL ?? '/'

/** تسجيل عامل الخدمة في نسخة الإنتاج على الويب (تطبيق أندرويد يحمل ملفاته معه فلا يحتاجه). */
export function registerServiceWorker() {
  if (!import.meta.env.PROD || Capacitor.isNativePlatform() || !('serviceWorker' in navigator)) return
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${BASE}sw.js`, { scope: BASE }).catch(() => {})
  })
}

const DATA_CACHE = 'tajweed-data-v1'
const API_CACHE = 'tajweed-api-v1'

async function serverUrls() {
  const lessons = await api('/lessons')
  const rules = await api('/rules')
  return [
    '/api/surahs', '/api/juz', '/api/rules', '/api/reciters', '/api/minshawi', '/api/lessons', '/api/letters', '/api/quiz',
    ...Array.from({ length: 114 }, (_, i) => `/api/surah/${i + 1}`),
    ...Array.from({ length: 30 }, (_, i) => `/api/juz/${i + 1}`),
    ...[1, 2, 3].map((l) => `/api/quiz?level=${l}`),
    ...lessons.lessons.map((l) => `/api/lessons/${l.id}`),
    ...rules.map((r) => `/api/rules/${r.id}/surahs`),
  ]
}

async function staticUrls() {
  const res = await fetch(`${BASE}data/manifest.json`)
  if (!res.ok) throw new Error('تعذّر تحميل قائمة الملفات')
  const { files } = await res.json()
  return files.map((f) => `${BASE}data/${f}`)
}

/** يحفظ كل النصوص والدروس في التخزين ليعمل البرنامج دون إنترنت. يرجع عدد الملفات. */
export async function cacheAllTexts(onProgress) {
  if (!('caches' in window)) throw new Error('هذا المتصفح لا يدعم التخزين دون إنترنت')
  const urls = STATIC ? await staticUrls() : await serverUrls()
  const cache = await caches.open(STATIC ? DATA_CACHE : API_CACHE)
  let done = 0
  const queue = [...urls]
  const worker = async () => {
    while (queue.length) {
      const url = queue.shift()
      const res = await fetch(url)
      if (!res.ok) throw new Error(`تعذّر حفظ ${url}`)
      await cache.put(url, res)
      onProgress?.(++done, urls.length)
    }
  }
  await Promise.all(Array.from({ length: 6 }, worker))
  return urls.length
}

/** هل حُفظت البيانات كاملة من قبل؟ */
export async function isFullyCached() {
  if (!STATIC || !('caches' in window)) return false
  try {
    const cache = await caches.open(DATA_CACHE)
    return !!(await cache.match(`${BASE}data/search-index.json`)) && !!(await cache.match(`${BASE}data/surah/114.json`))
  } catch {
    return false
  }
}
