// كلمات الآية بمواقعها (مثل tokens في الخادم)؛ علامات الوقف المنفصلة تُستبعد.
const MARK_ONLY = /^[ؐ-ًؚ-ٟۖ-ٰۭ]+$/

export function tokens(text) {
  const out = []
  for (const m of text.matchAll(/\S+/g)) {
    if (MARK_ONLY.test(m[0])) continue
    out.push({ start: m.index, end: m.index + m[0].length, text: m[0] })
  }
  return out
}
