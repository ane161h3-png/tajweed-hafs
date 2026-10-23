// اختبار التحديث التلقائي: جهاز حمّل النسخة A (وحفظها للعمل دون إنترنت)، ثم تُنشر النسخة B.
// المتوقع: يكتشفها البرنامج وحده، ويُحدّث نفسه، ويُعيد حفظ بياناته، ويبقى يعمل دون إنترنت — بلا أي تثبيت.
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { extname, join, normalize } from 'node:path'

const [edge, prof, distA, distB] = process.argv.slice(2)
const PREFIX = '/tajweed-hafs/'
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.woff': 'font/woff', '.webmanifest': 'application/manifest+json' }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let dist = distA // الخادم يبدّل المجلد المنشور كما تفعل GitHub Pages عند النشر

const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://x')
  if (!url.pathname.startsWith(PREFIX)) return res.writeHead(404).end('nf')
  const rel = normalize(decodeURIComponent(url.pathname.slice(PREFIX.length)))
  let file = join(dist, rel)
  if (rel === '.' || rel === '' || (existsSync(file) && statSync(file).isDirectory())) file = join(dist, rel, 'index.html')
  if (existsSync(file) && statSync(file).isFile()) res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' }).end(readFileSync(file))
  else res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' }).end(readFileSync(join(dist, '404.html')))
})
await new Promise((r) => server.listen(5197, r))
const ORIGIN = 'http://localhost:5197'

const chrome = spawn(edge, ['--headless=new', '--disable-gpu', '--remote-debugging-port=9668', `--user-data-dir=${prof}`, 'about:blank'])
await sleep(2500)
const tabs = await (await fetch('http://127.0.0.1:9668/json')).json()
const ws = new WebSocket(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl)
await new Promise((r) => (ws.onopen = r))
let id = 0
const pend = {}
ws.onmessage = (m) => {
  const d = JSON.parse(m.data)
  if (pend[d.id]) { pend[d.id](d); delete pend[d.id] }
}
const send = (method, params = {}) => new Promise((r) => { pend[++id] = r; ws.send(JSON.stringify({ id, method, params })) })
const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result?.result?.value
await send('Page.enable')
await send('Runtime.enable')
await send('Page.addScriptToEvaluateOnNewDocument', { source: "try{localStorage.setItem('tajweed.onboarded','true')}catch(e){}" })

const state = async () => JSON.parse((await ev(`(async()=>JSON.stringify({entry:document.querySelector('script[type=module]')?.src.split('/').pop(),offlineBuild:localStorage.getItem('tajweed.offlineBuild'),shell:(await (await caches.open((await caches.keys()).find(k=>k.startsWith('tajweed-shell')))).keys()).length,data:(await (await caches.open('tajweed-data-v1')).keys()).length,swActive:!!(await navigator.serviceWorker.getRegistration())?.active}))()`)) ?? '{}')
const waitFor = async (cond, label, secs = 90) => {
  for (let i = 0; i < secs; i++) {
    await sleep(1000)
    try {
      const s = await state()
      if (cond(s)) return s
    } catch {
      /* الصفحة تُعاد تحميلها */
    }
  }
  throw new Error('انتهت المهلة: ' + label)
}

// النسخة A
await send('Page.navigate', { url: `${ORIGIN}${PREFIX}` })
const a = await waitFor((s) => s.swActive && s.offlineBuild, 'تحميل النسخة A')
console.log('النسخة A:', JSON.stringify(a))
const versionA = JSON.parse(await ev(`fetch('${PREFIX}version.json',{cache:'no-store'}).then(r=>r.text())`)).build

// نشر النسخة B ثم «عودة المستخدم إلى التطبيق» (يفحص عند الرجوع/الاتصال)
dist = distB
const versionB = JSON.parse(await (await fetch(`${ORIGIN}${PREFIX}version.json`)).text()).build
console.log('نُشرت النسخة B:', versionA, '←', versionB)
await sleep(500)
await ev(`(()=>{window.dispatchEvent(new Event('focus'));window.dispatchEvent(new Event('online'));document.dispatchEvent(new Event('visibilitychange'));return 1})()`)
const b = await waitFor((s) => s.entry && s.entry !== a.entry && s.offlineBuild === versionB, 'التحديث التلقائي إلى B', 120)
console.log('بعد التحديث التلقائي:', JSON.stringify(b))
console.log(b.offlineBuild === versionB ? '✅ حُدِّث وأعاد حفظ بياناته للنسخة الجديدة بلا تدخل' : '❌ لم يُعد الحفظ')
console.log(b.entry !== a.entry ? '✅ تغيّر ملف البرنامج إلى النسخة الجديدة' : '❌ بقي على القديم')

// دون إنترنت بعد التحديث
server.closeAllConnections?.()
await new Promise((r) => server.close(r))
await send('Network.enable')
await send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 })
let allOk = true
for (const [name, path, check] of [
  ['صفحة مصحف', 'mushaf/page/255', `document.querySelectorAll('.mushaf-page').length>=1`],
  ['دفتري (جزء يُحمَّل عند الطلب)', 'settings/notebook', `document.querySelector('h1')?.innerText.includes('دفتري')`],
  ['تحليل آية', 'ayah/2/5', `[...document.querySelectorAll('h2')].some(h=>h.innerText.includes('المخارج'))`],
]) {
  await send('Page.navigate', { url: `${ORIGIN}${PREFIX}${path}` })
  await sleep(3500)
  let ok = false
  for (let i = 0; i < 10 && !ok; i++) {
    ok = !!(await ev(`(async()=>{try{return !!(${check})}catch(e){return false}})()`))
    if (!ok) await sleep(600)
  }
  allOk &&= ok
  console.log(ok ? '✅' : '❌', 'دون إنترنت بعد التحديث:', name)
}
ws.close()
chrome.kill()
process.exit(allOk && b.offlineBuild === versionB && b.entry !== a.entry ? 0 : 1)
