// مطابقة كلمة (أو كلمات) داخل نص آية: نسخة مطابقة لـ backend/app/matching.py.
import { normalize } from './arabic'

/** كلمات الآية بمواقعها؛ علامات الوقف المنفصلة تُستبعد. */
export function tokens(text) {
  const out = []
  for (const m of text.matchAll(/\S+/g)) {
    const a = normalize(m[0])
    if (a) out.push({ start: m.index, end: m.index + m[0].length, text: m[0], a, b: normalize(m[0], { spellDagger: true }) })
  }
  return out
}

/** [بداية، نهاية] الكلمة داخل النص أو null. */
export function findWord(text, word) {
  if (!word?.trim()) return null
  if (text.includes(word)) {
    let i = text.indexOf(word)
    let j = i + word.length
    while (i > 0 && !/\s/.test(text[i - 1])) i--
    while (j < text.length && !/\s/.test(text[j])) j++
    return [i, j]
  }
  const split = (s) => s.split(' ').filter(Boolean)
  const targets = [split(normalize(word)), split(normalize(word, { spellDagger: true }))]
  for (const t of [...targets]) if (t.length > 1) targets.push([t.join('')])
  const toks = tokens(text)
  for (const target of targets) {
    const n = target.length
    for (let i = 0; i + n <= toks.length; i++) {
      if (target.every((t, j) => t === toks[i + j].a || t === toks[i + j].b)) return [toks[i].start, toks[i + n - 1].end]
    }
  }
  for (const target of targets) {
    if (target.length !== 1) continue
    const t = toks.find((x) => x.a.includes(target[0]) || x.b.includes(target[0]))
    if (t) return [t.start, t.end]
  }
  return null
}
