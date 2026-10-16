import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

/**
 * نافذة صغيرة بجانب عنصر (anchor: DOMRect). تُغلق بالضغط خارجها أو بـ Escape،
 * وتبقى داخل حدود الشاشة.
 */
export default function Popover({ anchor, onClose, label, children, width = 300 }) {
  const ref = useRef(null)
  const [pos, setPos] = useState({ top: -9999, left: -9999 })

  useLayoutEffect(() => {
    if (!anchor || !ref.current) return
    const h = ref.current.offsetHeight
    const w = Math.min(width, window.innerWidth - 16)
    let top = anchor.bottom + 8
    if (top + h > window.innerHeight - 8) top = Math.max(8, anchor.top - h - 8)
    let left = anchor.left + anchor.width / 2 - w / 2
    left = Math.min(Math.max(8, left), window.innerWidth - w - 8)
    setPos({ top, left, width: w })
  }, [anchor, width])

  useEffect(() => {
    if (!anchor) return
    const onKey = (e) => e.key === 'Escape' && onClose()
    const onDown = (e) => ref.current && !ref.current.contains(e.target) && onClose()
    const onScroll = () => onClose()
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onDown, true)
    window.addEventListener('scroll', onScroll, { passive: true })
    ref.current?.querySelector('button, a')?.focus({ preventScroll: true })
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('scroll', onScroll)
    }
  }, [anchor, onClose])

  if (!anchor) return null
  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-label={label}
      className="fixed z-50 rounded-xl border border-line bg-surface p-3 text-sm shadow-xl"
      style={pos}
    >
      {children}
    </div>,
    document.body,
  )
}
