import { memo, useEffect, useRef } from 'react'
import teethSvg from '../../assets/makharij/teeth.svg?raw'

const NAMES = {
  thanaya: 'ثنية',
  rubaiyat: 'رباعية',
  anyab: 'ناب',
  dawahik: 'ضاحك',
  tawahin: 'طاحن',
  nawajidh: 'ناجذ',
}

const Static = memo(function Static({ innerRef }) {
  return <div ref={innerRef} dangerouslySetInnerHTML={{ __html: teethSvg }} />
})

/** رسم الأسنان: تظليل نوع (active)، والضغط على سنّ يختار نوعه (onPick). */
export default function TeethChart({ active, onPick }) {
  const box = useRef(null)
  useEffect(() => {
    box.current?.querySelectorAll('.tooth').forEach((t) => {
      t.classList.toggle('on', t.dataset.kind === active)
      if (!t.querySelector('title')) {
        const title = document.createElementNS('http://www.w3.org/2000/svg', 'title')
        title.textContent = NAMES[t.dataset.kind]
        t.appendChild(title)
      }
    })
  }, [active])
  const onClick = (e) => {
    const t = e.target.closest?.('.tooth')
    if (t) onPick?.(t.dataset.kind === active ? null : t.dataset.kind)
  }
  return (
    <div className="mk rounded-2xl border border-line bg-surface p-2" onClick={onClick} role="figure" aria-label="رسم الأسنان الاثنين والثلاثين">
      <Static innerRef={box} />
    </div>
  )
}
