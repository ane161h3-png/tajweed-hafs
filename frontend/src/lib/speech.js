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

/**
 * استماع متواصل للتسميع: يرسل كل كلمة جديدة ثبتت في التعرّف (onWords) دون انتظار نهاية الجملة،
 * ويعيد تشغيل التعرّف تلقائياً كلما توقف (السكوت يوقفه في أغلب الأجهزة) حتى يُستدعى stop().
 * onError(SpeechError) عند رفض الإذن أو انقطاع الخدمة.
 */
export function listenContinuous({ onWords, onError, toWords }) {
  let active = true
  let cleanup = () => {}
  // لكل مقطع مسموع: كم كلمة منه أُرسلت. آخر كلمة في النتيجة الجزئية قد تتغير فلا تُرسل حتى تثبت.
  const utterance = () => {
    let sent = 0
    return (transcript, final) => {
      const words = toWords(transcript)
      const stable = final ? words.length : words.length - 1
      if (stable > sent) onWords(words.slice(sent, stable))
      sent = Math.max(sent, stable)
    }
  }
  const fail = (code) => {
    if (!active) return
    active = false
    cleanup()
    onError?.(new SpeechError(code))
  }

  ;(async () => {
    const plugin = await nativePlugin()
    if (plugin) {
      const perm = await plugin.checkPermissions().catch(() => ({ speechRecognition: 'prompt' }))
      if (perm.speechRecognition !== 'granted' && (await plugin.requestPermissions()).speechRecognition !== 'granted') return fail('denied')
      let current = utterance()
      let last = ''
      const partial = await plugin.addListener('partialResults', (d) => {
        last = d.matches?.[0] ?? last
        current(last, false)
      })
      const state = await plugin.addListener('listeningState', (d) => {
        if (d.status !== 'stopped') return
        current(last, true)
        current = utterance()
        last = ''
        if (active) setTimeout(start, 150)
      })
      const start = () => {
        if (!active) return
        plugin
          .start({ language: LANG, maxResults: 1, partialResults: true, popup: false })
          .then((res) => res?.matches?.[0] && current(res.matches[0], true))
          .catch(() => active && setTimeout(start, 500))
      }
      cleanup = () => {
        plugin.stop().catch(() => {})
        partial.remove()
        state.remove()
      }
      if (!active) return cleanup()
      start()
      return
    }

    const Recognition = webRecognition()
    if (!Recognition) return fail('unsupported')
    let rec
    const start = () => {
      if (!active) return
      rec = new Recognition()
      rec.lang = LANG
      rec.continuous = true
      rec.interimResults = true
      rec.maxAlternatives = 1
      const parts = []
      rec.onresult = (e) => {
        for (let i = e.resultIndex; i < e.results.length; i++) {
          parts[i] ??= utterance()
          parts[i](e.results[i][0].transcript, e.results[i].isFinal)
        }
      }
      rec.onerror = (e) => {
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') fail('denied')
        else if (e.error === 'network') fail('network')
        // no-speech و aborted: يعاد التشغيل عند onend
      }
      rec.onend = () => active && setTimeout(start, 150)
      try {
        rec.start()
      } catch {
        setTimeout(start, 500)
      }
    }
    cleanup = () => {
      if (rec) {
        rec.onend = null
        rec.abort?.()
      }
    }
    start()
  })()

  return {
    stop() {
      if (!active) return
      active = false
      cleanup()
    },
  }
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
