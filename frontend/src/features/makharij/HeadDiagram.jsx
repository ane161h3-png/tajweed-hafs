import { memo, useEffect, useRef } from 'react'
import headSvg from '../../assets/makharij/head-sagittal.svg?raw'
import { morph, tongueParts } from './articulation'

const SVG_NS = 'http://www.w3.org/2000/svg'

// الرسم يُدرج مرة واحدة ولا يعيد React رسمه؛ التغييرات تتم على عناصره مباشرة بالمعرّفات.
const StaticSvg = memo(function StaticSvg({ innerRef }) {
  return <div ref={innerRef} dangerouslySetInnerHTML={{ __html: headSvg }} />
})

/** أقرب موضع على مسار الهواء لنقطة (كنسبة من طوله)، لإيقاف السهم عند المخرج في الحروف الشديدة. */
function fractionAt(path, x, y) {
  const len = path.getTotalLength()
  let best = 0
  let bestD = Infinity
  for (let i = 0; i <= 120; i++) {
    const p = path.getPointAtLength((len * i) / 120)
    const d = (p.x - x) ** 2 + (p.y - y) ** 2
    if (d < bestD) {
      bestD = d
      best = i / 120
    }
  }
  return best
}

/**
 * مقطع جانبي متحرك لأعضاء النطق.
 * makhraj: المخرج المظلَّل (كائن من letters.json)، articulation: وضع الحرف (من articulation.js)،
 * phase: 'rest' | 'contact' | 'release'، highlight: أعضاء إضافية للتظليل،
 * quiz: إظهار مواضع المخارج للضغط عليها، onSpot(id)، picked/correct: لتلوين الإجابة.
 */
export default function HeadDiagram({
  makhraj = null,
  art = null,
  phase = 'contact',
  highlight = [],
  labels = true,
  quiz = false,
  onSpot,
  picked = null,
  correct = null,
  className = '',
}) {
  const box = useRef(null)
  const cancel = useRef([])

  const q = (id) => box.current?.querySelector(`#${CSS.escape(id)}`)
  const svg = () => box.current?.querySelector('svg')

  // التظليل: الأعضاء والتسميات والموضع النابض
  useEffect(() => {
    const root = box.current
    if (!root) return
    root.querySelectorAll('.on').forEach((el) => el.classList.remove('on'))
    const organs = [...(makhraj?.organs ?? []), ...highlight]
    for (const id of organs) {
      q(id)?.classList.add('on')
      q(`label--${id}`)?.classList.add('on')
      if (id === 'upper-lip' || id === 'lower-lip') q('label--lips')?.classList.add('on')
    }
    if (makhraj && !quiz) q(`spot--${makhraj.id}`)?.classList.add('on')
  }, [makhraj, highlight, quiz]) // eslint-disable-line react-hooks/exhaustive-deps

  // وضع اللسان والشفتين وجريان الهواء حسب المرحلة
  useEffect(() => {
    cancel.current.forEach((c) => c())
    cancel.current = []
    const contact = phase === 'contact'
    const tonguePose = contact && art ? art.tongue : 'rest'
    const [up, low] = contact && art ? art.lips : ['rest', 'rest']
    const tongue = q('tongue')
    cancel.current.push(morph(tongue, q(`tongue--${tonguePose}`)?.getAttribute('d')))
    cancel.current.push(morph(q('upper-lip'), q(`upper-lip--${up}`)?.getAttribute('d')))
    cancel.current.push(morph(q('lower-lip'), q(`lower-lip--${low}`)?.getAttribute('d')))

    // علامات أجزاء اللسان المظللة تتبع وضعه
    let markers = svg()?.querySelector('#part-markers')
    if (!markers && svg()) {
      markers = document.createElementNS(SVG_NS, 'g')
      markers.id = 'part-markers'
      svg().insertBefore(markers, svg().querySelector('#spots'))
    }
    if (markers) {
      markers.innerHTML = ''
      const parts = tongueParts(q(`tongue--${tonguePose}`)?.getAttribute('d') ?? tongue.getAttribute('d'))
      const want = { 'tongue-tip': parts.tip, 'tongue-middle': parts.middle, 'tongue-back': parts.back, 'tongue-edge': parts.blade }
      for (const id of makhraj?.organs ?? []) {
        if (!want[id]) continue
        const c = document.createElementNS(SVG_NS, 'circle')
        c.setAttribute('class', 'part-marker')
        c.setAttribute('cx', want[id][0])
        c.setAttribute('cy', want[id][1] + (id === 'tongue-edge' ? 4 : 0))
        c.setAttribute('r', id === 'tongue-edge' ? 6 : 4)
        if (id === 'tongue-edge') c.setAttribute('style', 'fill-opacity:.5;stroke-dasharray:2 2')
        markers.appendChild(c)
      }
    }

    // الهواء
    const oral = q('air--oral')
    const nasal = q('air--nasal')
    for (const el of [oral, nasal]) {
      el.classList.remove('flow', 'weak', 'blocked')
      el.removeAttribute('stroke-dasharray')
      el.style.removeProperty('stroke-dasharray')
    }
    if (!art || phase === 'rest') return
    if (art.nasal) nasal.classList.add('flow')
    const lipClosed = art.lips[0] === 'closed'
    if (art.air === 'blocked' && contact) {
      // ينحبس الصوت عند المخرج: يُرسم السهم حتى موضع الاعتماد فقط
      const spot = makhraj && q(`spot--${makhraj.id}`)
      const len = oral.getTotalLength()
      const frac = spot ? fractionAt(oral, +spot.getAttribute('cx'), +spot.getAttribute('cy')) : 0.5
      oral.classList.add('blocked')
      oral.style.strokeDasharray = `${len * frac} ${len}`
    } else if (!(lipClosed && contact && art.nasal)) {
      oral.classList.add('flow')
      if (art.air === 'weak') oral.classList.add('weak')
    }
  }, [art, phase, makhraj]) // eslint-disable-line react-hooks/exhaustive-deps

  // وضع الاختبار: مواضع المخارج قابلة للضغط
  useEffect(() => {
    const root = box.current
    if (!root) return
    root.querySelectorAll('.spot').forEach((s) => {
      s.classList.toggle('picked', quiz && s.id === `spot--${picked}`)
      s.classList.toggle('correct', quiz && s.id === `spot--${correct}`)
      if (quiz) {
        s.setAttribute('tabindex', '0')
        s.setAttribute('role', 'button')
      } else {
        s.removeAttribute('tabindex')
        s.removeAttribute('role')
      }
    })
  }, [quiz, picked, correct])

  useEffect(() => () => cancel.current.forEach((c) => c()), [])

  const onClick = (e) => {
    const spot = e.target.closest?.('.spot')
    if (quiz && spot && onSpot) onSpot(spot.id.replace('spot--', ''))
  }
  const onKey = (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.classList?.contains('spot')) {
      e.preventDefault()
      onClick(e)
    }
  }

  return (
    <div
      className={`mk ${labels ? '' : 'no-labels'} ${quiz ? 'quiz' : ''} ${className}`}
      onClick={onClick}
      onKeyDown={onKey}
      role="figure"
      aria-label={makhraj ? `مقطع جانبي لأعضاء النطق، المخرج: ${makhraj.name}` : 'مقطع جانبي لأعضاء النطق'}
    >
      <StaticSvg innerRef={box} />
    </div>
  )
}
