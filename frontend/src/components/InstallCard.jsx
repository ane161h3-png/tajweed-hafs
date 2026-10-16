import { useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { STATIC, arabicNumber } from '../lib/api'
import { cacheAllTexts, isFullyCached } from '../pwa'
import { readJSON, writeJSON } from '../lib/storage'

const HIDE_KEY = 'tajweed.installCard.hidden'
let deferredPrompt = null
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredPrompt = e
    window.dispatchEvent(new Event('tajweed:installable'))
  })
}

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
const isStandalone = () => window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true

/**
 * بطاقة في الرئيسية (نسخة الويب): تثبيت البرنامج تطبيقاً على الجهاز، وحفظ كل النصوص للعمل دون إنترنت.
 * لا تظهر داخل تطبيق أندرويد، وتختفي إذا اكتمل الأمران أو أخفاها المستخدم.
 */
export default function InstallCard() {
  const [installable, setInstallable] = useState(!!deferredPrompt)
  const [cached, setCached] = useState(true)
  const [progress, setProgress] = useState(null)
  const [error, setError] = useState(null)
  const [hidden, setHidden] = useState(() => readJSON(HIDE_KEY, false))

  useEffect(() => {
    const on = () => setInstallable(true)
    window.addEventListener('tajweed:installable', on)
    isFullyCached().then(setCached)
    return () => window.removeEventListener('tajweed:installable', on)
  }, [])

  if (!STATIC || Capacitor.isNativePlatform() || hidden || !import.meta.env.PROD) return null
  const standalone = isStandalone()
  if (standalone && cached) return null

  const install = async () => {
    deferredPrompt?.prompt()
    const { outcome } = (await deferredPrompt?.userChoice) ?? {}
    if (outcome === 'accepted') setInstallable(false)
    deferredPrompt = null
  }
  const save = async () => {
    setError(null)
    setProgress(0)
    try {
      await cacheAllTexts((done, total) => setProgress(done / total))
      setCached(true)
    } catch (e) {
      setError(e.message)
    } finally {
      setProgress(null)
    }
  }

  return (
    <section className="mb-6 rounded-2xl border border-accent/40 bg-accent-soft p-4" aria-label="التثبيت والعمل دون إنترنت">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1 space-y-3">
          {!standalone && (
            <div>
              <p className="font-semibold">ثبّت البرنامج على جهازك</p>
              {installable ? (
                <button type="button" onClick={install} className="mt-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-ink">
                  ثبّت التطبيق
                </button>
              ) : isIos() ? (
                <p className="mt-1 text-sm text-muted">
                  في Safari: اضغط زر المشاركة <span aria-hidden="true">⎙</span> ثم «إضافة إلى الشاشة الرئيسية».
                </p>
              ) : (
                <p className="mt-1 text-sm text-muted">من قائمة المتصفح اختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية».</p>
              )}
            </div>
          )}
          {!cached && (
            <div>
              <p className="font-semibold">احفظه للعمل دون إنترنت</p>
              <p className="text-sm text-muted">المصحف كاملاً والدروس والمخارج والأسئلة والبحث، نحو ١١ م.ب مرة واحدة.</p>
              {progress === null ? (
                <button type="button" onClick={save} className="mt-1.5 rounded-lg border border-accent bg-surface px-4 py-2 text-sm font-medium text-accent">
                  احفظ الآن
                </button>
              ) : (
                <p className="mt-1.5 text-sm tabular-nums text-accent" aria-live="polite">
                  جارٍ الحفظ… {arabicNumber(Math.round(progress * 100))}٪
                </p>
              )}
              {error && <p className="mt-1 text-sm text-[var(--pen-red)]">{error}</p>}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            writeJSON(HIDE_KEY, true)
            setHidden(true)
          }}
          className="text-muted hover:text-ink"
          aria-label="إخفاء"
        >
          ✕
        </button>
      </div>
    </section>
  )
}
