import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import { Capacitor } from '@capacitor/core'
import { api, arabicNumber } from '../../lib/api'
import { readJSON } from '../../lib/storage'
import { studentProfile } from '../teacher/report'
import { buildBlocks } from './blocks'
import { LINES_PER_PAGE, linesFor, paginate } from './model'
import './notebook.css'

export const NOTEBOOK_KEY = 'tajweed.notebook'
const num = arabicNumber

export function loadNotebookSettings() {
  const s = readJSON(NOTEBOOK_KEY, null) ?? {}
  return { notes: s.notes ?? {}, drawings: s.drawings !== false }
}

/** الدروس الكاملة (الأصلية + تعديلات المستخدم وإضافاته) ومعرّفات ما عدّله. */
async function loadLessons() {
  const index = await api('/lessons')
  const lessons = await Promise.all(index.lessons.map((l) => api(`/lessons/${l.id}`)))
  const edited = new Set(Object.keys(readJSON('tajweed.lessons.local', { lessons: {} }).lessons ?? {}))
  return { lessons, edited }
}

export function savePdf(title) {
  // أندرويد (تطبيق): جسر الطباعة الأصلي، وغيره: نافذة الطباعة (احفظ كـ PDF)
  if (Capacitor.isNativePlatform() && window.AndroidPrint?.print) window.AndroidPrint.print(title)
  else window.print()
}

function useLight() {
  // الدفتر ورقي دائماً: نُزيل الوضع الليلي أثناء عرضه
  useEffect(() => {
    const root = document.documentElement
    const was = root.classList.contains('dark')
    // مكوّن الإعدادات يعيد إضافة الصنف بعد تركيب الصفحة، فنراقبه ونزيله ما دام الدفتر معروضاً
    const strip = () => root.classList.contains('dark') && root.classList.remove('dark')
    strip()
    const watch = new MutationObserver(strip)
    watch.observe(root, { attributes: true, attributeFilter: ['class'] })
    return () => {
      watch.disconnect()
      if (was) root.classList.add('dark')
    }
  }, [])
}

function useZoom() {
  const [zoom, setZoom] = useState(1)
  useEffect(() => {
    const probe = document.createElement('div')
    probe.style.cssText = 'position:absolute;visibility:hidden;width:210mm'
    document.body.appendChild(probe)
    const fit = () => setZoom(Math.min(1, (window.innerWidth - 16) / probe.getBoundingClientRect().width))
    fit()
    window.addEventListener('resize', fit)
    return () => {
      window.removeEventListener('resize', fit)
      probe.remove()
    }
  }, [])
  return zoom
}

function Sheet({ children, header, no, kind = 'page' }) {
  return (
    <section className={`nb-sheet nb-${kind}`}>
      {kind === 'page' && (
        <>
          <div className="nb-lines">{Array.from({ length: LINES_PER_PAGE }, (_, i) => <i key={i} />)}</div>
          <div className="nb-margin" />
          {[48, 148.5, 249].map((y) => <div key={y} className="nb-hole" style={{ top: `${y - 3.5}mm` }} />)}
          <div className="nb-header"><span>{header}</span><span>دفتر أحكام التجويد وتلاوته</span></div>
          <div className="nb-content">{children}</div>
          <div className="nb-footer">{num(no)}</div>
        </>
      )}
      {kind !== 'page' && children}
    </section>
  )
}

function Cover({ name }) {
  return (
    <div className="nb-coverbox">
      <div className="nb-frame" />
      <div className="nb-frame nb-frame2" />
      <div className="nb-coverin">
        <div className="nb-bism font-quran">بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ</div>
        <div className="nb-gold" />
        <h1>دفتر أحكام التجويد<br />وتلاوته</h1>
        <div className="nb-sub2">برواية حفص عن عاصم من طريق الشاطبية</div>
        <div className="nb-chips"><span>الأحكام</span><span>المخارج</span><span>الصفات</span></div>
        <div className="nb-who">
          <div>اسم الطالب: <b>{name}</b></div>
          <div>المعلّم / الحلقة:</div>
          <div>التاريخ: <b>{new Date().toLocaleDateString('ar-u-nu-arab', { year: 'numeric', month: 'long', day: 'numeric' })}</b></div>
        </div>
      </div>
      <div className="nb-covfoot">من برنامج «تعلّم التجويد»</div>
    </div>
  )
}

export default function NotebookBook() {
  useLight()
  const zoom = useZoom()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [lines, setLines] = useState(null) // عدد سطور كل كتلة
  const [ready, setReady] = useState(false)
  const settings = useMemo(loadNotebookSettings, [])
  const profile = useMemo(studentProfile, [])
  const measure = useRef(null)

  useEffect(() => {
    let alive = true
    Promise.all([api('/letters'), loadLessons()])
      .then(([letters, l]) => alive && setData({ letters, ...l }))
      .catch((e) => alive && setError(e))
    return () => {
      alive = false
    }
  }, [])

  const blocks = useMemo(
    () => (data ? buildBlocks({ lessons: data.lessons, letters: data.letters, edited: data.edited, notes: settings.notes, drawings: settings.drawings }) : null),
    [data, settings],
  )

  // القياس: كل كتلة في حاوية بعرض المحتوى نفسه، بعد تحميل الخطوط
  useLayoutEffect(() => {
    if (!blocks || lines) return
    let alive = true
    const run = async () => {
      const root = measure.current
      const unit = root.querySelector('.nb-unit').getBoundingClientRect().height
      let prev = null
      for (let pass = 0; pass < 4 && alive; pass++) {
        await document.fonts.ready
        const hs = blocks.map((b, i) => {
          if (b.full) return LINES_PER_PAGE
          if (b.fill) return b.fill
          return linesFor(root.querySelector(`[data-i="${i}"]`).getBoundingClientRect().height, unit)
        })
        if (prev && hs.every((h, i) => h === prev[i])) break
        prev = hs
        await new Promise((r) => setTimeout(r, 120))
      }
      if (alive) setLines(prev)
    }
    run()
    return () => {
      alive = false
    }
  }, [blocks, lines])

  const layout = useMemo(() => {
    if (!blocks || !lines) return null
    const content = blocks.map((b, i) => ({ ...b, h: lines[i] }))
    const toc = content.map((b, i) => ({ b, i })).filter((x) => x.b.toc)
    // الفهرس: صفوفه ثابتة الطول، فيُعرف عدد صفحاته قبل ترقيم الباقي
    const rows = [{ h: 3, title: true }, ...toc.map((x) => ({ h: x.b.toc.level === 0 ? 2 : 1 }))]
    const tocPages = paginate(rows)
    const pages = paginate(content)
    const first = 2 + tocPages.length // رقم أول صفحة محتوى (الغلاف = ١)
    const pageOf = new Map()
    pages.forEach((p, pi) => p.forEach((i) => pageOf.set(i, first + pi)))
    return { content, toc, rows, tocPages, pages, pageOf }
  }, [blocks, lines])

  // بعد العرض: انتظر انتهاء تحريك الرسوم ثم فعّل زر الحفظ
  useEffect(() => {
    if (!layout) return
    const t = setTimeout(() => setReady(true), 2500)
    return () => clearTimeout(t)
  }, [layout])

  const goto = (e, id) => {
    e.preventDefault()
    document.getElementById(`nb-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const title = `دفتر التجويد${profile.name ? ` - ${profile.name}` : ''}`
  const edits = data ? [...data.edited].length : 0

  return (
    <div className="nb" dir="rtl">
      <div className="nb-toolbar no-print">
        <Link to="/settings/notebook" className="nb-btn nb-btn2">← خيارات الدفتر</Link>
        <div className="nb-ttl">
          {layout ? `${num(layout.pages.length + layout.tocPages.length + 1)} صفحة` : 'جارٍ إعداد دفترك…'}
          {edits > 0 && layout && ` · فيه ${num(edits)} من تعديلاتك`}
        </div>
        <button type="button" className="nb-btn" disabled={!ready} onClick={() => savePdf(title)}>
          {ready ? 'حفظ كملف PDF' : 'جارٍ التجهيز…'}
        </button>
      </div>

      {error && <p className="nb-err no-print">تعذّر تحميل المحتوى: {error.message}</p>}

      {blocks && !lines && (
        <div ref={measure} className="nb-measure" aria-hidden="true">
          <div className="nb-unit" />
          {blocks.map((b, i) => (
            <div key={b.id} data-i={i} className="nb-mw">{b.measureNode ?? b.node}</div>
          ))}
        </div>
      )}

      {layout && (
        <div className="nb-pages">
          <div className="nb-sheetwrap" style={{ zoom }}>
            <Sheet kind="cover"><Cover name={profile.name || '..........................'} /></Sheet>
          </div>

          {layout.tocPages.map((pg, pi) => (
            <div className="nb-sheetwrap" style={{ zoom }} key={`toc-${pi}`}>
              <Sheet header="الفهرس" no={2 + pi}>
                {pg.map((ri) => {
                  if (ri === 0) return <h2 key="t" className="nb-chapter nb-toc-title" style={{ height: `calc(3 * var(--u))` }}>الفهرس</h2>
                  const { b, i } = layout.toc[ri - 1]
                  const t = b.toc
                  return (
                    <a key={b.id} className={`nb-toc nb-toc${t.level}`} href={`#nb-${b.id}`} onClick={(e) => goto(e, b.id)}>
                      <span className="nb-tt">
                        {t.no && <span className="nb-tn">{t.no}</span>}
                        {t.title}
                        {t.mine && <span className="nb-mine">✎</span>}
                      </span>
                      <span className="nb-dots" />
                      <span className="nb-pn">{num(layout.pageOf.get(i))}</span>
                    </a>
                  )
                })}
              </Sheet>
            </div>
          ))}

          {layout.pages.map((pg, pi) => (
            <div className="nb-sheetwrap" style={{ zoom }} key={pi}>
              <Sheet header={layout.content[pg[0]].part} no={layout.pageOf.get(pg[0])}>
                {pg.map((i) => {
                  const b = layout.content[i]
                  return (
                    <div key={b.id} id={`nb-${b.id}`} className={`nb-b${b.full ? ' nb-full' : ''}`} style={{ height: `calc(${b.h} * var(--u))` }}>
                      {b.node}
                    </div>
                  )
                })}
              </Sheet>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
