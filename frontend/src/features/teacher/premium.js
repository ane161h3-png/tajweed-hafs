// الاشتراك في لوحة المعلّم: عبر Google Play في تطبيق أندرويد، أو بكود تفعيل في الموقع (الحاسوب والآيفون).
import { useEffect, useSyncExternalStore } from 'react'
import { Capacitor } from '@capacitor/core'
import { verifyLicense } from '../../lib/license'
import { readJSON, writeJSON } from '../../lib/storage'

const KEY = 'tajweed.premium'

// يجب أن تطابق ما يُنشأ في Play Console ← Monetize ← Subscriptions
export const PLAY_PLANS = [
  { id: 'teacher_monthly', plan: 'monthly', title: 'شهري' },
  { id: 'teacher_yearly', plan: 'yearly', title: 'سنوي' },
]
export const CONTACT_EMAIL = 'hydrzyd83@gmail.com'

export const isNative = () => Capacitor.isNativePlatform()

let state = readJSON(KEY, null) // { source: 'code', code, until, name } | { source: 'play', product, checkedAt }
const listeners = new Set()
const set = (next) => {
  state = next
  writeJSON(KEY, next)
  listeners.forEach((l) => l())
}

export function premiumActive(s = state, now = new Date()) {
  if (!s) return false
  if (s.source === 'code') return s.until >= now.toISOString().slice(0, 10)
  if (s.source === 'play') return true
  return false
}

/** يفعّل كود الاشتراك؛ يرجع نتيجة التحقق. */
export async function activateCode(code) {
  const res = await verifyLicense(code)
  if (res.ok) set({ source: 'code', code: code.replace(/\s+/g, ''), until: res.until, name: res.name })
  return res
}

export function deactivate() {
  set(null)
}

async function plugin() {
  if (!isNative()) return null
  const mod = await import('@capgo/native-purchases')
  const { isBillingSupported } = await mod.NativePurchases.isBillingSupported().catch(() => ({ isBillingSupported: false }))
  return isBillingSupported ? mod : null
}

/** أسعار الخطط من المتجر بعملة المستخدم؛ [] إن لم تكن متاحة بعد. */
export async function playProducts() {
  const mod = await plugin()
  if (!mod) return []
  try {
    const { products } = await mod.NativePurchases.getProducts({ productIdentifiers: PLAY_PLANS.map((p) => p.id), productType: mod.PURCHASE_TYPE.SUBS })
    return products ?? []
  } catch {
    return []
  }
}

export async function buyPlan(planId) {
  const mod = await plugin()
  if (!mod) throw new Error('الشراء متاح فقط في التطبيق المثبّت من Google Play.')
  const plan = PLAY_PLANS.find((p) => p.id === planId)
  await mod.NativePurchases.purchaseProduct({ productIdentifier: plan.id, planIdentifier: plan.plan, productType: mod.PURCHASE_TYPE.SUBS })
  await refreshPlay()
}

/** يسأل Google Play عن الاشتراكات الفعّالة (عند فتح التطبيق، وبعد الشراء، وزر «استعادة»). */
export async function refreshPlay({ restore = false } = {}) {
  const mod = await plugin()
  if (!mod) return
  try {
    if (restore) await mod.NativePurchases.restorePurchases()
    const { purchases } = await mod.NativePurchases.getPurchases({ productType: mod.PURCHASE_TYPE.SUBS })
    const ids = new Set(PLAY_PLANS.map((p) => p.id))
    const active = (purchases ?? []).find((p) => ids.has(p.productIdentifier) && (p.purchaseState === 'PURCHASED' || p.purchaseState === '1' || p.isActive))
    if (active) set({ source: 'play', product: active.productIdentifier, checkedAt: Date.now() })
    else if (state?.source === 'play') set(null)
  } catch {
    /* بلا اتصال بالمتجر: نُبقي آخر حالة معروفة */
  }
}

const subscribe = (l) => (listeners.add(l), () => listeners.delete(l))

export function usePremium() {
  const s = useSyncExternalStore(subscribe, () => state)
  useEffect(() => {
    refreshPlay()
  }, [])
  return { active: premiumActive(s), ...(s ?? {}) }
}
