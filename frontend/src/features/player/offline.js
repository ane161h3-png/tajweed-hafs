// تنزيل التلاوات للاستماع دون إنترنت: تُحفظ في IndexedDB في متصفح المستخدم.
const DB_NAME = 'tajweed-audio'
const STORE = 'files'
const EVENT = 'tajweed:offline'
const objectUrls = new Map()

function open() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('التخزين المحلي غير متاح في هذا المتصفح'))
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'url' })
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function tx(mode, fn) {
  const db = await open()
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode)
    const result = fn(t.objectStore(STORE))
    t.oncomplete = () => resolve(result?.result ?? result)
    t.onerror = () => reject(t.error)
  })
}

const notify = () => window.dispatchEvent(new Event(EVENT))
export const onOfflineChange = (cb) => {
  window.addEventListener(EVENT, cb)
  return () => window.removeEventListener(EVENT, cb)
}

/** قائمة المحفوظ (بلا الملفات نفسها). */
export async function listDownloads() {
  try {
    const all = await tx('readonly', (s) => s.getAll())
    return all.map(({ blob, ...meta }) => ({ ...meta, size: blob.size }))
  } catch {
    return []
  }
}

export async function isDownloaded(url) {
  try {
    return !!(await tx('readonly', (s) => s.getKey(url)))
  } catch {
    return false
  }
}

/** تنزيل ملف مع تقدّم التحميل (0..1). */
export async function download(url, meta = {}, onProgress) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`تعذّر التنزيل (${res.status})`)
  const total = Number(res.headers.get('content-length')) || 0
  const reader = res.body.getReader()
  const chunks = []
  let got = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    got += value.length
    if (total) onProgress?.(got / total)
  }
  const blob = new Blob(chunks, { type: res.headers.get('content-type') || 'audio/mpeg' })
  await tx('readwrite', (s) => s.put({ url, blob, at: Date.now(), ...meta }))
  notify()
  return blob.size
}

export async function removeDownload(url) {
  await tx('readwrite', (s) => s.delete(url))
  const obj = objectUrls.get(url)
  if (obj) URL.revokeObjectURL(obj)
  objectUrls.delete(url)
  notify()
}

/** رابط التشغيل: الملف المحفوظ إن وُجد، وإلا الرابط الأصلي. */
export async function resolveAudio(url) {
  if (objectUrls.has(url)) return objectUrls.get(url)
  try {
    const rec = await tx('readonly', (s) => s.get(url))
    if (rec?.blob) {
      const obj = URL.createObjectURL(rec.blob)
      objectUrls.set(url, obj)
      return obj
    }
  } catch {
    /* لا تخزين: نشغّل من الإنترنت */
  }
  return url
}

export function formatSize(bytes) {
  if (bytes > 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} م.ب`
  return `${Math.round(bytes / 1024)} ك.ب`
}
