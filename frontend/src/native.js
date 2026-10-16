// تكامل التطبيق على أندرويد: زر الرجوع في الهاتف يرجع صفحة، ومن الرئيسية يخرج من التطبيق.
import { Capacitor } from '@capacitor/core'

// الموقع المنشور: يفتحه التطبيق ليتحدّث مع كل نشر (capacitor.config.json ← server.url)
const LIVE_URL = import.meta.env.VITE_LIVE_URL

/**
 * النسخة المحمولة داخل التطبيق (localhost) تُفتح فقط حين يتعذّر الوصول إلى الموقع (دون إنترنت).
 * فإذا عاد الاتصال رجعنا إلى الموقع المنشور بأحدث نسخة.
 */
function returnToLiveSiteWhenOnline() {
  if (!LIVE_URL || window.location.hostname !== 'localhost') return
  const tryLive = async () => {
    try {
      const res = await fetch(`${LIVE_URL}version.json?t=${Date.now()}`, { cache: 'no-store' })
      if (res.ok) window.location.replace(LIVE_URL)
    } catch {
      /* ما زال دون اتصال */
    }
  }
  tryLive()
  window.addEventListener('online', tryLive)
  setInterval(tryLive, 60 * 1000)
}

export async function setupNative() {
  if (!Capacitor.isNativePlatform()) return
  returnToLiveSiteWhenOnline()
  const { App } = await import('@capacitor/app')
  App.addListener('backButton', ({ canGoBack }) => {
    // نافذة مفتوحة (فهرس الألوان، المزيد، خيارات الآية): Escape يغلقها أولاً
    if (document.querySelector('[role=dialog]')) {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
      return
    }
    if (canGoBack && window.location.pathname !== import.meta.env.BASE_URL) window.history.back()
    else App.exitApp()
  })
}
