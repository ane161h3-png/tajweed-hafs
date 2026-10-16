import { memo, useEffect, useRef } from 'react'
import lipsSvg from '../../assets/makharij/lips-front.svg?raw'
import { morph } from './articulation'

const Static = memo(function Static({ innerRef }) {
  return <div ref={innerRef} dangerouslySetInnerHTML={{ __html: lipsSvg }} />
})

/** منظر أمامي للشفتين: rest | closed (ب م) | fa (ف) | round (و). */
export default function LipsFront({ pose = 'rest' }) {
  const box = useRef(null)
  useEffect(() => {
    const q = (id) => box.current?.querySelector(`#${id}`)
    const c1 = morph(q('lips-upper'), q(`lips-upper--${pose}`)?.getAttribute('d'))
    const c2 = morph(q('lips-lower'), q(`lips-lower--${pose}`)?.getAttribute('d'))
    return () => {
      c1()
      c2()
    }
  }, [pose])
  return (
    <div className="mk" role="img" aria-label="منظر أمامي للشفتين">
      <Static innerRef={box} />
    </div>
  )
}
