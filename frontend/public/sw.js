// عامل الخدمة: يجعل البرنامج يعمل دون إنترنت ويُثبَّت تطبيقاً على أي جهاز.
// - ملفات الواجهة (assets) والأيقونات: من التخزين أولاً.
// - ملفات البيانات (data/): من التخزين فوراً، وتُحدَّث من الشبكة في الخلفية.
// - بيانات الخادم (api/، نسخة الخادم): من الشبكة أولاً، ومن التخزين عند انقطاعها.
// - الصفحات: من الشبكة، وعند الانقطاع الصفحة الرئيسية المخزّنة (التطبيق يتولى التنقل).
// التلاوات المنزّلة تُحفظ في IndexedDB لا هنا.
const VERSION = 'v4'
const SHELL = `tajweed-shell-${VERSION}`
const DATA = 'tajweed-data-v1' // يُمسح عند نشر نسخة جديدة (UpdateWatcher) ثم يُعاد حفظه
const API = 'tajweed-api-v1'
const SCOPE = new URL(self.registration.scope).pathname // '/' أو '/مجلد/' حسب مكان الاستضافة
const SHELL_FILES = [SCOPE, `${SCOPE}manifest.webmanifest`, `${SCOPE}icon.svg`, `${SCOPE}icon-192.png`]

// يحفظ كل ملفات الواجهة المذكورة في precache.json (يُنتجها البناء). فشل ملف لا يُفشل التثبيت.
async function precacheAssets(cache) {
  try {
    const res = await fetch(`${SCOPE}precache.json`, { cache: 'no-cache' })
    if (!res.ok) return
    const files = await res.json()
    const queue = [...files]
    const worker = async () => {
      while (queue.length) {
        const f = queue.shift()
        try {
          const r = await fetch(`${SCOPE}${f}`)
          if (r.ok) await cache.put(`${SCOPE}${f}`, r)
        } catch {
          /* يُحفظ لاحقاً عند أول طلب */
        }
      }
    }
    await Promise.all(Array.from({ length: 6 }, worker))
  } catch {
    /* دون precache.json (بيئة تطوير): يُحفظ كل ملف عند أول طلب */
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then(async (c) => {
        await c.addAll(SHELL_FILES)
        await precacheAssets(c)
      })
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('tajweed-shell-') && k !== SHELL).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  try {
    // no-cache: نتحقق من الخادم دائماً فتصل النسخة الجديدة فوراً بعد النشر
    const res = await fetch(request, { cache: 'no-cache' })
    if (res.ok) cache.put(request, res.clone())
    return res
  } catch (e) {
    const hit = await cache.match(request, { ignoreSearch: false })
    if (hit) return hit
    throw e
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  const hit = await cache.match(request)
  if (hit) return hit
  const res = await fetch(request)
  if (res.ok) cache.put(request, res.clone())
  return res
}

async function staleWhileRevalidate(request, cacheName, event) {
  const cache = await caches.open(cacheName)
  const hit = await cache.match(request)
  const update = fetch(request)
    .then((res) => {
      if (res.ok) cache.put(request, res.clone())
      return res
    })
    .catch(() => null)
  if (hit) {
    event.waitUntil(update)
    return hit
  }
  return (await update) ?? new Response('', { status: 504 })
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin || !url.pathname.startsWith(SCOPE)) return
  const rel = url.pathname.slice(SCOPE.length)

  if (rel === 'version.json') return // يُطلب دائماً من الشبكة لمعرفة التحديثات
  if (rel.startsWith('data/')) {
    event.respondWith(staleWhileRevalidate(request, DATA, event))
  } else if (rel.startsWith('api/')) {
    event.respondWith(
      networkFirst(request, API).catch(
        () =>
          new Response(JSON.stringify({ detail: 'لا يوجد اتصال، وهذه الصفحة لم تُحفظ للعمل دون إنترنت' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
          }),
      ),
    )
  } else if (request.mode === 'navigate') {
    event.respondWith(
      networkFirst(request, SHELL)
        .then(async (res) => {
          // GitHub Pages يرسل التطبيق للروابط العميقة بحالة 404 (صفحة 404.html)؛ نعيده صفحةً عادية 200
          // حتى لا يظنها المتصفح أو تطبيق أندرويد خطأً
          if (res.status !== 404) return res
          const index = (await fetch(SCOPE, { cache: 'no-cache' }).catch(() => null)) ?? (await caches.match(SCOPE, { cacheName: SHELL }))
          return index ? new Response(await index.blob(), { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }) : res
        })
        .catch(() => caches.match(SCOPE, { cacheName: SHELL })),
    )
  } else if (rel.startsWith('assets/') || rel.startsWith('audio/') || /\.(svg|png|webmanifest)$/.test(rel)) {
    event.respondWith(cacheFirst(request, SHELL))
  }
})
