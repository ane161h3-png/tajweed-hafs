// صندوق الشكاوى والاقتراحات: الرسالة تذهب إلى صاحب البرنامج وحده، ولا تُعرض لأي مستخدم آخر.
//
// طريقتا الإرسال:
// 1) VITE_FEEDBACK_URL: عنوان نموذج (Formspree أو Web3Forms أو أي خدمة تستقبل JSON) يوصل الرسائل إلى بريد المالك.
//    و VITE_FEEDBACK_KEY اختياري: مفتاح الوصول لـ Web3Forms (مفتاح عام مصمَّم ليكون في الواجهة).
// 2) إن لم يُضبط العنوان، أو فشل الإرسال: يُفتح تطبيق البريد برسالة جاهزة إلى بريد التواصل.

export const FEEDBACK_URL = import.meta.env.VITE_FEEDBACK_URL || ''
const FEEDBACK_KEY = import.meta.env.VITE_FEEDBACK_KEY || ''
export const CONTACT_EMAIL = 'hydrzyd83@gmail.com'

export const KINDS = [
  { id: 'complaint', label: 'شكوى', hint: 'مشكلة واجهتك أو خطأ في البرنامج' },
  { id: 'suggestion', label: 'اقتراح إضافة', hint: 'ميزة أو قسم تحب أن يُضاف' },
  { id: 'content', label: 'ملاحظة على المحتوى', hint: 'حكم أو مثال أو معلومة تحتاج مراجعة' },
]

export const MAX_LEN = 2000
export const MIN_LEN = 5

export const kindLabel = (id) => KINDS.find((k) => k.id === id)?.label ?? id

/** يتحقق من المدخلات ويعيد رسالة الخطأ أو null. */
export function validate({ kind, message, contact }) {
  if (!KINDS.some((k) => k.id === kind)) return 'اختر نوع الرسالة'
  const text = (message || '').trim()
  if (text.length < MIN_LEN) return 'اكتب رسالتك (بضع كلمات على الأقل)'
  if (text.length > MAX_LEN) return `الرسالة أطول من ${MAX_LEN} حرف`
  if ((contact || '').length > 200) return 'وسيلة التواصل طويلة جداً'
  return null
}

/** معلومات تقنية عامة تساعد على فهم الشكوى، دون أي بيانات شخصية. */
export function deviceInfo() {
  const native = typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.()
  return {
    platform: native ? 'android-app' : 'web',
    page: typeof window !== 'undefined' ? window.location.pathname : '',
    version: typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : '',
  }
}

export function buildPayload(form, info = deviceInfo()) {
  const kind = kindLabel(form.kind)
  const payload = {
    subject: `تعلّم التجويد · ${kind}`,
    type: kind,
    message: form.message.trim(),
    contact: (form.contact || '').trim() || 'لم يُذكر',
    platform: info.platform,
    version: info.version,
  }
  if (FEEDBACK_KEY) payload.access_key = FEEDBACK_KEY
  return payload
}

/** رابط mailto برسالة جاهزة، للإرسال من تطبيق البريد. */
export function mailtoLink(form, info = deviceInfo()) {
  const p = buildPayload(form, info)
  const body = `${p.message}\n\n— النوع: ${p.type}\n— للتواصل: ${p.contact}\n— الجهاز: ${p.platform} ${p.version}`
  return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(p.subject)}&body=${encodeURIComponent(body)}`
}

/** يرسل الرسالة إلى عنوان النموذج. يرمي خطأ إن لم يُضبط أو فشل الإرسال. */
export async function sendFeedback(form, { fetchImpl = fetch, url = FEEDBACK_URL } = {}) {
  if (!url) throw new Error('no-endpoint')
  const res = await fetchImpl(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(buildPayload(form)),
  })
  if (!res.ok) throw new Error(`status ${res.status}`)
  return true
}
