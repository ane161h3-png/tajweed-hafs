// التعرّف على الكلام بالعربية: Web Speech في المتصفحات (كروم، سفاري آيفون)، وإضافة أصلية في تطبيق أندرويد
// (متصفح التطبيق الداخلي لا يدعم Web Speech). يحتاج إنترنت في أغلب الأجهزة.
import { Capacitor } from '@capacitor/core'

const LANG = 'ar-SA'
// يُقرأ عند الاستعمال لا عند التحميل (بعض المتصفحات تضيفه متأخراً)
const webRecognition = () => (typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null)

async function nativePlugin() {
  if (!Capacitor.isNativePlatform()) return null
  try {
    const { SpeechRecognition } = await import('@capacitor-community/speech-recognition')
    const { available } = await SpeechRecognition.available()
    return available ? SpeechRecognition : null
  } catch {
    return null
  }
}

/** هل يمكن التعرّف على الكلام في هذا الجهاز؟ */
export async function speechSupported() {
  if (await nativePlugin()) return true
  return !!webRecognition()
}

/**
 * يستمع حتى يسكت المتكلم، ويرجع بدائل ما سُمع (الأرجح أولاً).
 * onInterim: النص الجزئي أثناء الكلام (في المتصفح). يرجع { promise, stop }.
 */
export function listen({ onInterim } = {}) {
  let stopFn = () => {}
  const promise = (async () => {
    const plugin = await nativePlugin()
    if (plugin) {
      const perm = await plugin.checkPermissions().catch(() => ({ speechRecognition: 'prompt' }))
      if (perm.speechRecognition !== 'granted') {
        const asked = await plugin.requestPermissions()
        if (asked.speechRecognition !== 'granted') throw new SpeechError('denied')
      }
      stopFn = () => plugin.stop().catch(() => {})
      const res = await plugin.start({ language: LANG, maxResults: 5, partialResults: false, popup: false })
      return res?.matches ?? []
    }
    const Recognition = webRecognition()
    if (!Recognition) throw new SpeechError('unsupported')
    return new Promise((resolve, reject) => {
      const rec = new Recognition()
      rec.lang = LANG
      rec.interimResults = true
      rec.continuous = false
      rec.maxAlternatives = 5
      let finals = []
      rec.onresult = (e) => {
        const last = e.results[e.results.length - 1]
        if (last.isFinal) finals = Array.from(last, (alt) => alt.transcript)
        else onInterim?.(Array.from(e.results, (r) => r[0].transcript).join(' '))
      }
      rec.onerror = (e) => reject(new SpeechError(e.error === 'not-allowed' || e.error === 'service-not-allowed' ? 'denied' : e.error === 'no-speech' ? 'no-speech' : 'network'))
      rec.onend = () => resolve(finals)
      stopFn = () => rec.stop()
      rec.start()
    })
  })()
  return { promise, stop: () => stopFn() }
}

export class SpeechError extends Error {
  constructor(code) {
    super(
      {
        denied: 'لم يُسمح باستعمال الميكروفون. اسمح به من إعدادات المتصفح أو التطبيق ثم أعد المحاولة.',
        unsupported: 'هذا المتصفح لا يدعم التعرّف على الكلام. استعمل كروم أو سفاري أو تطبيق أندرويد.',
        'no-speech': 'لم يُسمع صوت. اقترب من الميكروفون واقرأ بصوت واضح.',
        network: 'تعذّر التعرّف على الكلام؛ تحقق من الاتصال بالإنترنت.',
      }[code] ?? 'تعذّر التعرّف على الكلام.',
    )
    this.code = code
  }
}
