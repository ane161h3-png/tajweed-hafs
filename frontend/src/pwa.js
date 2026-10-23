import { Capacitor } from '@capacitor/core'
import { api, STATIC } from './lib/api'

const BASE = import.meta.env.BASE_URL ?? '/'

/**
 * تسجيل عامل الخدمة في نسخة الإنتاج. تطبيق أندرويد يفتح الموقع المنشور نفسه فيسجّله أيضاً ليعمل دون إنترنت،
 * إلا النسخة الاحتياطية المحمولة داخل التطبيق (localhost) فلا تحتاجه.
 */
export function registerServiceWorker() {
  const bundled = Capacitor.isNativePlatform() && window.location.hostname === 'localhost'
  if (!import.meta.env.PROD || bundled || !('serviceWorker' in navigator)) return
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${BASE}sw.js`, { scope: BASE }).catch(() => {})
    // بعد التحميل بقليل: احفظ كل النصوص تلقائياً ليعمل البرنامج كله دون إنترنت، بلا حاجة إلى ضغط زر
    setTimeout(ensureOfflineData, 4000)
    window.addEventListener('online', () => setTimeout(ensureOfflineData, 1500))
  })
}

const CURRENT = typeof __BUILD_ID__ === 'undefined' ? 'dev' : __BUILD_ID__ // eslint-disable-line no-undef
const DONE_KEY = 'tajweed.offlineBuild'
let running = null

/**
 * يحفظ كل بيانات البرنامج في الخلفية إن لم تكن محفوظة لهذه النسخة (مرة واحدة بعد كل تحديث).
 * لا يعمل مع «توفير البيانات»، ولا دون اتصال، ولا يُشغَّل مرتين معاً.
 */
export function ensureOfflineData() {
  if (running) return running
  if (!STATIC || !('caches' in window) || !navigator.onLine || navigator.connection?.saveData) return Promise.resolve(false)
  running = (async () => {
    try {
      if (await isFullyCached()) return true
      await cacheAllTexts((done, total) => window.dispatchEvent(new CustomEvent('tajweed:cache-progress', { detail: { done, total } })))
      window.dispatchEvent(new Event('tajweed:cached'))
      return true
    } catch {
      return false // تُعاد المحاولة عند الاتصال التالي
    } finally {
      running = null
    }
  })()
  return running
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
  try {
    localStorage.setItem(DONE_KEY, CURRENT) // اكتمل الحفظ لهذه النسخة
  } catch {
    /* لا تخزين */
  }
  return urls.length
}

/** هل حُفظت البيانات كاملة من قبل؟ */
export async function isFullyCached() {
  if (!STATIC || !('caches' in window)) return false
  try {
    const cache = await caches.open(DATA_CACHE)
    // محفوظة كاملة لهذه النسخة فقط (بعد كل تحديث تُحفظ من جديد)
    return localStorage.getItem(DONE_KEY) === CURRENT && !!(await cache.match(`${BASE}data/search-index.json`)) && !!(await cache.match(`${BASE}data/surah/114.json`))
  } catch {
    return false
  }
}
