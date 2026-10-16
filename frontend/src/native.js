// تكامل التطبيق على أندرويد: زر الرجوع في الهاتف يرجع صفحة، ومن الرئيسية يخرج من التطبيق.
import { Capacitor } from '@capacitor/core'

export async function setupNative() {
  if (!Capacitor.isNativePlatform()) return
  const { App } = await import('@capacitor/app')
  App.addListener('backButton', ({ canGoBack }) => {
    // نافذة مفتوحة (فهرس الألوان، المزيد، خيارات الآية): Escape يغلقها أولاً
    if (document.querySelector('[role=dialog]')) {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
      return
    }
    if (canGoBack && window.location.pathname !== '/') window.history.back()
    else App.exitApp()
  })
}
