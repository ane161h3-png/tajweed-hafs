// اختبار العمل دون إنترنت: موقع إنتاج على خادم يحاكي GitHub Pages (مسار فرعي، و404 يرجع التطبيق)،
// يُحمَّل في متصفح جديد، ثم يُغلق الخادم كلياً وتُجرَّب كل الصفحات والميزات.
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { extname, join, normalize } from 'node:path'

const [edge, prof, dist] = process.argv.slice(2)
const LIVE = process.env.LIVE_ORIGIN // مثال: https://ane161h3-png.github.io
const PREFIX = '/tajweed-hafs/'
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.woff': 'font/woff', '.webmanifest': 'application/manifest+json', '.mp3': 'audio/mpeg' }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://x')
  if (!url.pathname.startsWith(PREFIX)) {
    res.writeHead(404).end('not found')
    return
  }
  let rel = normalize(decodeURIComponent(url.pathname.slice(PREFIX.length))).replace(/^(\.\.[/\\])+/, '')
  let file = join(dist, rel)
  if (rel === '' || (existsSync(file) && statSync(file).isDirectory())) file = join(dist, rel, 'index.html')
  if (existsSync(file) && statSync(file).isFile()) {
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' }).end(readFileSync(file))
  } else {
    // GitHub Pages: الرابط العميق يرجع 404.html بحالة 404
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' }).end(readFileSync(join(dist, '404.html')))
  }
})
if (!LIVE) await new Promise((r) => server.listen(5199, r))
const ORIGIN = LIVE ?? 'http://localhost:5199'

const chrome = spawn(edge, ['--headless=new', '--disable-gpu', '--remote-debugging-port=9666', `--user-data-dir=${prof}`, 'about:blank'])
await sleep(2500)
const tabs = await (await fetch('http://127.0.0.1:9666/json')).json()
const ws = new WebSocket(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl)
await new Promise((r) => (ws.onopen = r))
let id = 0
const pend = {}
const errors = []
const failed = []
ws.onmessage = (m) => {
  const d = JSON.parse(m.data)
  if (pend[d.id]) {
    pend[d.id](d)
    delete pend[d.id]
  }
  if (d.method === 'Runtime.exceptionThrown') errors.push(String(d.params.exceptionDetails?.exception?.description ?? d.params.exceptionDetails?.text).split('\n')[0])
  if (d.method === 'Network.loadingFailed' && !d.params.canceled) failed.push(d.params.errorText + ' ' + (d.params.requestId))
  if (d.method === 'Network.requestWillBeSent') reqs.set(d.params.requestId, d.params.request.url)
}
const reqs = new Map()
const send = (method, params = {}) => new Promise((r) => { pend[++id] = r; ws.send(JSON.stringify({ id, method, params })) })
const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result?.result?.value

await send('Page.enable')
await send('Runtime.enable')
await send('Network.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false })
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] })
await send('Page.addScriptToEvaluateOnNewDocument', { source: "try{localStorage.setItem('tajweed.onboarded','true')}catch(e){}" })

// ١) زيارة أولى على الإنترنت: ننتظر تسجيل عامل الخدمة وحفظ كل شيء تلقائياً
await send('Page.navigate', { url: `${ORIGIN}${PREFIX}` })
let ready = null
for (let i = 0; i < 90; i++) {
  await sleep(1000)
  ready = await ev(`(async()=>{const r=await navigator.serviceWorker?.getRegistration();const done=localStorage.getItem('tajweed.offlineBuild');return JSON.stringify({sw:!!r?.active,done})})()`)
  const o = JSON.parse(ready ?? '{}')
  if (o.sw && o.done) break
}
console.log('بعد الزيارة الأولى:', ready)
const stats = await ev(`(async()=>{const names=await caches.keys();const out={};for(const n of names){out[n]=(await (await caches.open(n)).keys()).length};const pre=await (await fetch('${PREFIX}precache.json')).json();const man=await (await fetch('${PREFIX}data/manifest.json')).json();return JSON.stringify({caches:out,precache:pre.length,dataFiles:man.files.length})})()`)
console.log('التخزين:', stats)

// ٢) نقطع الإنترنت كلياً: إغلاق الخادم + وضع «دون اتصال»
if (!LIVE) {
  server.closeAllConnections?.()
  await new Promise((r) => server.close(r))
}
await send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 })
console.log('— الإنترنت مقطوع: الخادم مغلق —')

const routes = [
  ['الرئيسية', '', `document.querySelector('h1')?.innerText.includes('تعلّم أحكام التجويد')`],
  ['المصحف: سورة', 'mushaf/surah/18', `document.querySelectorAll('.mushaf-page').length>3 && document.querySelectorAll('.ayah').length>20`],
  ['المصحف: صفحة ٢٥٥', 'mushaf/page/255', `document.querySelectorAll('.mushaf-page').length>=1 && document.querySelector('.mushaf-page')?.dataset.page==='255'`],
  ['المصحف: جزء ٣٠', 'mushaf/juz/30', `document.querySelectorAll('.mushaf-page').length===23`],
  ['قائمة الصفحات', 'mushaf/pages', `document.querySelectorAll('a[href*="/mushaf/page/"]').length>=600`],
  ['قائمة السور', 'mushaf/surahs', `document.querySelectorAll('a[href*="/mushaf/surah/"]').length===114`],
  ['تحليل آية', 'ayah/2/5?w=1', `[...document.querySelectorAll('h2')].some(h=>h.innerText.includes('المخارج')) && !!document.querySelector('[aria-pressed=true]')`],
  ['الأحكام: درس بأمثلته', 'ahkam/noon-sakinah/noon-sakinah-5', `document.querySelectorAll('figure').length>0`],
  ['المخارج: حرف برسمه', 'makharij/letters/dad', `!!document.querySelector('.mk svg')`],
  ['الصفات: المصفوفة', 'sifat/matrix', `document.querySelector('h1')!==null && document.querySelectorAll('table, [role=grid], button').length>10`],
  ['الاختبار: مستوى ١', 'quiz/level-1', `document.querySelector('h1')?.innerText.length>3 && !document.querySelector('[role=alert]')`],
  ['التسميع (صفحة تُحمَّل عند الطلب)', 'quiz/tasmee', `document.querySelector('h1')?.innerText.includes('التسميع') && document.querySelectorAll('option').length>=114`],
  ['اقرأ بصوتك', 'quiz/recite', `document.querySelector('h1')!==null && !document.querySelector('[role=alert]')`],
  ['الاستماع: القرّاء', 'listen/reciters', `document.querySelector('h1')!==null && !document.querySelector('[role=alert]')`],
  ['دليل الاستخدام', 'settings/guide', `document.querySelectorAll('details').length>=30`],
  ['دفتري: الخيارات', 'settings/notebook', `document.querySelector('h1')?.innerText.includes('دفتري')`],
  ['دفتري: الدفتر نفسه', 'notebook/book', `(async()=>{for(let i=0;i<60;i++){const b=[...document.querySelectorAll('.nb-btn')].find(x=>x.innerText.includes('حفظ'));if(b&&!b.disabled&&document.querySelectorAll('.nb-sheet').length>50)return true;await new Promise(r=>setTimeout(r,500))}return false})()`],
  ['المعلّم: اللوحة', 'teacher/students', `document.querySelector('h1')?.innerText.includes('لوحة المعلّم')`],
  ['المعلّم: الحضور', 'teacher/attendance', `document.querySelector('h1')?.innerText.includes('الحضور')`],
  ['المعلّم: بطاقة الباركود', 'teacher/card', `document.querySelector('h1')?.innerText.includes('بطاقة')`],
  ['المعلّم: الاشتراك', 'teacher/subscription', `document.querySelector('h1')?.innerText.includes('اشتراك')`],
  ['الإعدادات', 'settings/display', `document.querySelector('h1')!==null`],
  ['البحث الشامل (Ctrl+K)', '', `(async()=>{window.dispatchEvent(new KeyboardEvent('keydown',{key:'k',ctrlKey:true,bubbles:true}));await new Promise(r=>setTimeout(r,800));const i=document.querySelector('[role=dialog] input');const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;set.call(i,'الاخفاء');i.dispatchEvent(new Event('input',{bubbles:true}));for(let k=0;k<20;k++){await new Promise(r=>setTimeout(r,500));if(document.querySelectorAll('[role=option]').length>=3)return true}return false})()`],
  ['البحث في المصحف', 'mushaf/search', `(async()=>{const i=document.querySelector('input[type=search]');if(!i)return false;const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;set.call(i,'الله نور');i.dispatchEvent(new Event('input',{bubbles:true}));for(let k=0;k<20;k++){await new Promise(r=>setTimeout(r,500));if(document.querySelectorAll('[role=option]').length>=1)return true}return false})()`],
]

let bad = 0
for (const [name, path, check] of routes) {
  errors.length = 0
  failed.length = 0
  await send('Page.navigate', { url: `${ORIGIN}${PREFIX}${path}` })
  await sleep(2500)
  let ok = false
  for (let i = 0; i < 12 && !ok; i++) {
    ok = !!(await ev(`(async()=>{try{return !!(${check})}catch(e){return false}})()`))
    if (!ok) await sleep(700)
  }
  const failedAssets = failed.map((f) => reqs.get(f.split(' ').pop())).filter((u) => u && u.startsWith(ORIGIN) && !u.includes('version.json') && !u.includes('/audio/') && !u.includes('?t='))
  const line = `${ok && !errors.length && !failedAssets.length ? '✅' : '❌'} ${name}${errors.length ? '  [استثناء: ' + errors[0] + ']' : ''}${failedAssets.length ? '  [فشل تحميل: ' + failedAssets.slice(0, 2).join(', ') + ']' : ''}`
  if (!ok || errors.length || failedAssets.length) bad++
  console.log(line)
}
console.log(bad === 0 ? 'كل الصفحات والميزات تعمل دون إنترنت ✔' : `صفحات فيها مشكلة: ${bad}`)
ws.close()
chrome.kill()
process.exit(bad ? 1 : 0)
