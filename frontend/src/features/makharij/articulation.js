// كيف يتحرك الرسم لكل حرف: وضع اللسان والشفتين، والأعضاء المظللة، وجريان الهواء.

/** وضع اللسان لكل مخرج (معرّفات المسارات tongue--* في head-sagittal.svg). */
const TONGUE_BY_MAKHRAJ = {
  qaf: 'qaf',
  kaf: 'kaf',
  'wasat-lisan': 'wasat',
  dad: 'dad',
  lam: 'lam',
  noon: 'noon',
  ra: 'ra',
  nit: 'nit',
  asal: 'asal',
  lithah: 'lithah',
}
// حروف الإطباق والاستعلاء يرتفع معها أقصى اللسان (ووسطه في الإطباق)
const TONGUE_BY_LETTER = { taa: 'nit-itbaq', sad: 'asal-itbaq', dhaa: 'lithah-itbaq', khaa: 'istila', ghain: 'istila' }
const LIPS_BY_LETTER = {
  ba: ['closed', 'closed'],
  meem: ['closed', 'closed'],
  fa: ['rest', 'fa'],
  waw: ['round', 'round'],
}

export const LIP_LETTERS = new Set(['ba', 'meem', 'fa', 'waw'])

/**
 * وصف حركة الحرف:
 * tongue: وضع اللسان عند الاعتماد، lips: [العليا، السفلى]،
 * air: 'blocked' (شديد: ينحبس ثم ينطلق) | 'flow' (رخو) | 'weak' (متوسط) ، nasal: يمر من الأنف (الغنة).
 */
export function articulation(letter) {
  if (!letter) return { tongue: 'rest', lips: ['rest', 'rest'], air: null, nasal: false }
  const sifat = new Set(letter.sifat)
  return {
    tongue: TONGUE_BY_LETTER[letter.id] ?? TONGUE_BY_MAKHRAJ[letter.makhraj] ?? 'rest',
    lips: LIPS_BY_LETTER[letter.id] ?? ['rest', 'rest'],
    air: sifat.has('shidda') ? 'blocked' : sifat.has('tawassut') ? 'weak' : 'flow',
    nasal: letter.extra.includes('ghunnah'),
  }
}

/** الأعضاء المظللة لمخرج: أعضاؤه + تسمياتها. */
export function organsFor(makhraj) {
  return makhraj?.organs ?? []
}

// ---------- تحريك مسارات SVG بين وضعين بنفس البنية ----------

const NUM = /-?\d+(?:\.\d+)?/g

export function pathNumbers(d) {
  return (d.match(NUM) ?? []).map(Number)
}

/** يستبدل أرقام مسار بأرقام جديدة مع إبقاء الأوامر (M C Z) كما هي. */
export function withNumbers(d, nums) {
  let i = 0
  return d.replace(NUM, () => {
    const n = nums[i++]
    return Number.isInteger(n) ? String(n) : n.toFixed(2)
  })
}

/** مسار وسيط بين a وb عند t ∈ [0،1]؛ إن اختلفت البنية يُرجع b مباشرة. */
export function lerpPath(a, b, t) {
  const na = pathNumbers(a)
  const nb = pathNumbers(b)
  if (na.length !== nb.length) return b
  return withNumbers(b, nb.map((v, i) => na[i] + (v - na[i]) * t))
}

const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2)

/** يحرّك سمة d لعنصر إلى مسار جديد؛ يرجع دالة إلغاء. */
export function morph(el, target, duration = 420) {
  if (!el || !target) return () => {}
  const from = el.getAttribute('d')
  if (from === target || duration <= 0 || typeof requestAnimationFrame === 'undefined') {
    el.setAttribute('d', target)
    return () => {}
  }
  let raf = 0
  const t0 = performance.now()
  const step = (now) => {
    const t = Math.min(1, (now - t0) / duration)
    el.setAttribute('d', lerpPath(from, target, ease(t)))
    if (t < 1) raf = requestAnimationFrame(step)
  }
  raf = requestAnimationFrame(step)
  return () => cancelAnimationFrame(raf)
}

/** نقاط أجزاء اللسان من مساره: الطرف، الذلق، الوسط، الأقصى. */
export function tongueParts(d) {
  const n = pathNumbers(d)
  return { tip: [n[0], n[1]], blade: [n[6], n[7]], middle: [n[12], n[13]], back: [n[18], n[19]] }
}
