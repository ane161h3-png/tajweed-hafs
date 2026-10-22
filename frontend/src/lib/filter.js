// تصفية القوائم: بحث متسامح (بلا تشكيل، يفهم الأرقام العربية، ويطابق كل كلمة مكتوبة على حدة).
import { normalize } from './arabic'

export const norm = (s) => normalize(String(s ?? '')).toLowerCase()

/** دالة مطابقة: matcher(...حقول) ترجع true إن وُجدت كل كلمات الاستعلام في الحقول مجتمعة. الاستعلام الفارغ يطابق كل شيء. */
export function makeMatcher(query) {
  const words = norm(query).split(' ').filter(Boolean)
  if (!words.length) return () => true
  return (...fields) => {
    const hay = fields.map(norm).join(' ')
    return words.every((w) => hay.includes(w))
  }
}

/** يقسم النص إلى أجزاء مظلَّلة وغير مظلَّلة: [{text, hit}]. التشكيل يبقى داخل الكلمة المظلَّلة. */
export function highlightParts(text, query) {
  const t = String(text ?? '')
  const words = norm(query).split(' ').filter(Boolean)
  if (!words.length) return [{ text: t, hit: false }]
  // النص المطبَّع حرفاً بحرف مع موضع كل حرف في الأصل (التشكيل يُسقَط فلا موضع له)
  const map = []
  let plain = ''
  for (let i = 0; i < t.length; i++) {
    const c = t[i] === ' ' ? ' ' : norm(t[i])
    if (c.length === 1) {
      plain += c
      map.push(i)
    }
  }
  const hits = new Array(t.length).fill(false)
  for (const w of words) {
    let from = 0
    for (;;) {
      const at = plain.indexOf(w, from)
      if (at < 0) break
      const a = map[at]
      // حتى الحرف التالي المطبَّع، فتدخل حركات آخر حرف مطابق في التظليل
      const end = at + w.length < map.length ? map[at + w.length] : t.length
      for (let k = a; k < end; k++) hits[k] = true
      from = at + w.length
    }
  }
  const out = []
  for (let i = 0; i < t.length; i++) {
    if (out.length && out.at(-1).hit === hits[i]) out.at(-1).text += t[i]
    else out.push({ text: t[i], hit: hits[i] })
  }
  return out
}
