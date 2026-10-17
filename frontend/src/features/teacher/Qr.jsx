import { useEffect, useRef, useState } from 'react'

/** رسم الباركود (QR) بصيغة SVG؛ المكتبة تُحمَّل عند الحاجة فقط. */
export function QrCode({ text, size = 220, className = '' }) {
  const [svg, setSvg] = useState('')
  useEffect(() => {
    let alive = true
    import('qrcode').then((QR) =>
      QR.toString(text, { type: 'svg', errorCorrectionLevel: 'M', margin: 2, color: { dark: '#000000', light: '#ffffff' } }).then((s) => alive && setSvg(s)),
    )
    return () => {
      alive = false
    }
  }, [text])
  return (
    <div
      role="img"
      aria-label="باركود الحضور"
      className={`bg-white ${className}`}
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: svg.replace('<svg ', `<svg width="${size}" height="${size}" `) }}
    />
  )
}

/**
 * ماسح الباركود بكاميرا الجهاز (الخلفية إن وُجدت). onScan(text) لكل باركود يُقرأ؛
 * الباركود نفسه لا يُقرأ ثانية إلا بعد إبعاده عن الكاميرا ثلاث ثوانٍ.
 */
export function QrScannerView({ onScan, onClose }) {
  const video = useRef(null)
  const last = useRef({ text: '', at: 0 })
  const [error, setError] = useState(null)
  const handler = useRef(onScan)
  handler.current = onScan

  useEffect(() => {
    let scanner
    let stopped = false
    import('qr-scanner')
      .then(async ({ default: QrScanner }) => {
        if (stopped) return
        scanner = new QrScanner(
          video.current,
          (res) => {
            const now = Date.now()
            // ما دامت البطاقة نفسها أمام الكاميرا لا تُقرأ ثانية
            const repeat = res.data === last.current.text && now - last.current.at < 3000
            last.current = { text: res.data, at: now }
            if (repeat) return
            handler.current(res.data)
          },
          { preferredCamera: 'environment', highlightScanRegion: true, highlightCodeOutline: true, maxScansPerSecond: 8, returnDetailedScanResult: true },
        )
        await scanner.start()
      })
      .catch((e) => {
        const denied = /NotAllowed|Permission|denied/i.test(String(e?.name ?? e))
        setError(
          denied
            ? 'لم يُسمح باستعمال الكاميرا. اسمح بها من إعدادات المتصفح أو التطبيق ثم أعد المحاولة.'
            : /NotFound|camera not found|no camera/i.test(String(e?.name ?? e))
              ? 'لا توجد كاميرا في هذا الجهاز.'
              : 'تعذّر تشغيل الكاميرا.',
        )
      })
    return () => {
      stopped = true
      scanner?.stop()
      scanner?.destroy()
    }
  }, [])

  return (
    <div className="space-y-2">
      <div className="relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-2xl bg-black">
        <video ref={video} className="h-full w-full object-cover" muted playsInline />
        {error && <p className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-white">{error}</p>}
      </div>
      <div className="text-center">
        <button type="button" onClick={onClose} className="rounded-xl border border-line bg-surface px-5 py-2 font-medium">
          إيقاف المسح
        </button>
      </div>
    </div>
  )
}
