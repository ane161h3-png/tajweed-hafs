import { useEffect, useState } from 'react'
import { cacheAllTexts, isFullyCached } from '../pwa'
import { STATIC } from '../lib/api'

const BASE = import.meta.env.BASE_URL ?? '/'
const CURRENT = typeof __BUILD_ID__ === 'undefined' ? 'dev' : __BUILD_ID__ // eslint-disable-line no-undef
const RECACHE_KEY = 'tajweed.recacheAfterUpdate'
const CHECK_EVERY = 3 * 60 * 1000

async function remoteBuild() {
  try {
    // no-store: نتجاوز ذاكرة المتصفح وذاكرة GitHub Pages (١٠ دقائق)
    const res = await fetch(`${BASE}version.json?t=${Date.now()}`, { cache: 'no-store' })
    if (!res.ok) return null
    return (await res.json()).build ?? null
  } catch {
    return null // دون إنترنت: نبقى على النسخة الحالية
  }
}

const TRIED_KEY = 'tajweed.updateTried'

/** حماية من التكرار: إن أعدنا التحميل لهذه النسخة قبل دقيقتين ولم تصل، ننتظر الفحص التالي. */
function recentlyTried(build) {
  try {
    const t = JSON.parse(sessionStorage.getItem(TRIED_KEY) || 'null')
    return t && t.build === build && Date.now() - t.at < 2 * 60 * 1000
  } catch {
    return false
  }
}

function markTried(build) {
  try {
    sessionStorage.setItem(TRIED_KEY, JSON.stringify({ build, at: Date.now() }))
  } catch {
    /* لا تخزين */
  }
}

/** هل يكتب المستخدم الآن في محرّر الدرس؟ لا نقطع عليه عمله. */
const busy = () => !!document.querySelector('.notebook-field')

async function applyUpdate() {
  // البيانات القديمة (الدروس، الأسئلة…) تُمسح لتُحمَّل الجديدة، ثم تُحفظ ثانيةً للعمل دون إنترنت
  try {
    if ('caches' in window) {
      const hadAll = await isFullyCached()
      await caches.delete('tajweed-data-v1')
      await caches.delete('tajweed-api-v1')
      if (hadAll) localStorage.setItem(RECACHE_KEY, '1')
    }
    const reg = await navigator.serviceWorker?.getRegistration()
    await reg?.update()
  } catch {
    /* نكمل التحديث على أي حال */
  }
  window.location.reload()
}

/**
 * يتحقق من نسخة أحدث عند فتح البرنامج، وكل ثلاث دقائق، وعند الرجوع إليه أو عودة الإنترنت،
 * ثم يحدّث تلقائياً (على الويب والآيفون والأندرويد) مع إشعار قصير.
 */
export default function UpdateWatcher() {
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    if (!import.meta.env.PROD || CURRENT === 'dev') return
    // بعد تحديث: أعد حفظ النصوص للعمل دون إنترنت في الخلفية إن كانت محفوظة قبله
    try {
      if (STATIC && localStorage.getItem(RECACHE_KEY)) {
        localStorage.removeItem(RECACHE_KEY)
        cacheAllTexts().catch(() => {})
      }
    } catch {
      /* لا تخزين */
    }

    let stopped = false
    const check = async () => {
      if (stopped || document.visibilityState === 'hidden') return
      const remote = await remoteBuild()
      if (!remote || remote === CURRENT || stopped) return
      if (busy() || recentlyTried(remote)) return // نعيد المحاولة في الفحص التالي
      markTried(remote)
      setUpdating(true)
      setTimeout(applyUpdate, 1200)
    }
    check()
    const timer = setInterval(check, CHECK_EVERY)
    const onVisible = () => document.visibilityState === 'visible' && check()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', check)
    window.addEventListener('focus', check)
    return () => {
      stopped = true
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', check)
      window.removeEventListener('focus', check)
    }
  }, [])

  if (!updating) return null
  return (
    <div role="status" className="fixed inset-x-0 top-3 z-[60] mx-auto w-fit rounded-full bg-accent px-5 py-2 text-sm font-medium text-accent-ink shadow-lg">
      نسخة جديدة متاحة، جارٍ التحديث…
    </div>
  )
}
