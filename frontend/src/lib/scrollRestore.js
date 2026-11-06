// حفظ موضع التمرير لكل صفحة في السجل: الرجوع (زر الرجوع في البرنامج أو المتصفح أو الهاتف)
// يعيدك إلى الموضع نفسه الذي تركته، والانتقال إلى صفحة جديدة يبدأ من أعلاها.
import { useEffect, useLayoutEffect, useRef } from 'react'
import { useLocation, useNavigationType } from 'react-router'

const STORE = 'tajweed.scroll'
const KEEP = 100 // آخر ١٠٠ صفحة في السجل تكفي
const GIVE_UP_MS = 3000 // مهلة انتظار تحميل محتوى الصفحة قبل التوقف عن محاولة الإرجاع

function load() {
  try {
    return JSON.parse(sessionStorage.getItem(STORE)) || {}
  } catch {
    return {}
  }
}

let positions = load()
let stopRestore = null
let restoredKey = null

function save(key, y) {
  delete positions[key]
  positions[key] = Math.round(y)
  const keys = Object.keys(positions)
  if (keys.length > KEEP) for (const k of keys.slice(0, keys.length - KEEP)) delete positions[k]
  try {
    sessionStorage.setItem(STORE, JSON.stringify(positions))
  } catch {
    /* التخزين غير متاح: يبقى الحفظ في الذاكرة */
  }
}

/** يوقف إرجاع التمرير الجاري (لصفحة تريد أن تحدد موضعها بنفسها). */
export function cancelScrollRestore() {
  stopRestore?.()
}

/** هل هذه الصفحة فُتحت بالرجوع ولها موضع محفوظ يُعاد إليه؟ */
export function isRestoringScroll(location) {
  return restoredKey != null && restoredKey === (location.key === 'default' ? `default:${location.pathname}` : location.key)
}

const INTERRUPT = ['wheel', 'touchstart', 'keydown', 'pointerdown']

/** يمرّر إلى y ويعيد المحاولة حتى يكتمل تحميل محتوى الصفحة، ويتوقف إن مرّر المستخدم بنفسه. */
function restoreTo(y) {
  cancelScrollRestore()
  let frame = 0
  let done = false
  const start = performance.now()
  const stop = () => {
    done = true
    cancelAnimationFrame(frame)
    INTERRUPT.forEach((e) => window.removeEventListener(e, stop))
    if (stopRestore === stop) stopRestore = null
  }
  INTERRUPT.forEach((e) => window.addEventListener(e, stop, { passive: true }))
  stopRestore = stop
  const tick = () => {
    if (done) return
    window.scrollTo?.(0, y)
    if (Math.abs(window.scrollY - y) < 2 || performance.now() - start > GIVE_UP_MS) return stop()
    frame = requestAnimationFrame(tick)
  }
  tick()
}

export function useScrollRestoration() {
  const location = useLocation()
  const { pathname } = location
  // أول صفحة تُفتح في التبويب مفتاحها 'default' دائماً؛ نضيف إليها المسار حتى لا تتشارك الصفحات موضعاً واحداً
  const key = location.key === 'default' ? `default:${pathname}` : location.key
  const type = useNavigationType()
  const current = useRef(key)
  const prevPath = useRef(null)

  useEffect(() => {
    if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual'
    let raf = 0
    const onScroll = () => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        save(current.current, window.scrollY)
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(raf)
    }
  }, [])

  useLayoutEffect(() => {
    const samePage = prevPath.current === pathname
    prevPath.current = pathname
    current.current = key
    restoredKey = null
    if (type === 'POP' && positions[key] > 0) {
      restoredKey = key
      restoreTo(positions[key])
    } else if (samePage) {
      // تغيّر الاستعلام فقط (اختيار كلمة، حكم، آية): يبقى الموضع كما هو
      save(key, window.scrollY)
    } else {
      cancelScrollRestore()
      window.scrollTo?.(0, 0)
    }
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
}
