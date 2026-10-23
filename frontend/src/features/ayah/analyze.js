// تحليل الآية: كلماتها ← حروفها ← (مخرج كل حرف وصفاته وما عليه من أحكام).
// دوال نقية تعمل على نص الآية كما هو في المصحف وعلامات الأحكام (tajweed: [{rule,start,end}]) ومحتوى letters.json.
// ملاحظة: التحليل آلي مبني على قواعد الرسم العثماني؛ يُراجَع مع المعلّم في المواضع الدقيقة.
import { tokens } from '../../lib/matching'

// أحكام يُقرأ معها الحرف بغنّة (فيشارك الخيشوم)
const GHUNNAH_RULES = new Set(['ghunnah', 'ikhfa', 'idghaam_ghunnah', 'iqlab', 'ikhfa_shafawi', 'idghaam_shafawi'])
// أحكام تجعل الحرف غير منطوق في الوصل
const SILENT_RULES = { hamzat_wasl: 'همزة وصل: لا تُنطق في وصل الكلام', lam_shamsiyyah: 'لام شمسية: تُدغم فيما بعدها', silent: 'حرف لا يُنطق' }

const HAMZA = new Set(['ء', 'أ', 'إ', 'ؤ', 'ئ'])
const SIGNS = {
  fatha: 'َ', damma: 'ُ', kasra: 'ِ', sukun: 'ْ', shadda: 'ّ', dagger: 'ٰ',
  zero1: '۟', zero2: '۠', sukun2: 'ۡ', smallWaw: 'ۥ', smallYa: 'ۦ', maddah: 'ٓ', hamzaAbove: 'ٔ', hamzaBelow: 'ٕ',
}
const TANWEEN = new Set(['ً', 'ٌ', 'ٍ'])
// علامات التشكيل والوقف (ليست حروفاً)
const isMark = (c) => {
  const n = c.codePointAt(0)
  return (n >= 0x64b && n <= 0x65f) || n === 0x670 || (n >= 0x6d6 && n <= 0x6dc) || (n >= 0x6df && n <= 0x6e4) || n === 0x6e7 || n === 0x6e8 || (n >= 0x6ea && n <= 0x6ed)
}
// حروف وما في حكمها (٠٦E٥ و٠٦E٦: الواو والياء الصغيرتان ترمزان إلى مد)
const isLetter = (c) => {
  const n = c.codePointAt(0)
  return (n >= 0x621 && n <= 0x64a) || n === 0x671 || n === 0x6e5 || n === 0x6e6 || n === 0x6cc || n === 0x6c0 || n === 0x640
}

/** يقسم كلمة إلى مقاطع: حرف أساسي وما عليه من علامات، مع موضع الحرف في نص الآية. */
function clusters(word) {
  const out = []
  for (let i = 0; i < word.text.length; i++) {
    const ch = word.text[i]
    if (isLetter(ch) && !isMark(ch)) out.push({ base: ch, marks: '', at: word.start + i })
    else if (out.length) out.at(-1).marks += ch
  }
  return out
}

const vowelOf = (c) => (c.marks.includes(SIGNS.fatha) ? 'fatha' : c.marks.includes(SIGNS.damma) ? 'damma' : c.marks.includes(SIGNS.kasra) ? 'kasra' : null)

/**
 * يحلّل آية. letters: محتوى letters.json.
 * يرجع { words: [{ index, text, start, end, letters: [...], rules: [{rule,start,end,text}] }] }
 * كل حرف: { id, char, at, kind: 'letter'|'mad'|'wasl'|'tanween'|'marbuta', doubled, silent, why, rules: [ruleId] }
 */
export function analyzeAyah(text, tajweed, letters) {
  const byChar = Object.fromEntries(letters.letters.map((l) => [l.char, l]))
  const byId = Object.fromEntries(letters.letters.map((l) => [l.id, l]))
  const marks = (tajweed ?? []).filter((m) => m.start < m.end)
  const rulesAt = (i) => [...new Set(marks.filter((m) => m.start <= i && i < m.end).map((m) => m.rule))]

  const words = tokens(text).map((w, index) => {
    const cl = clusters(w)
    const items = []
    const push = (id, base, extra = {}) => {
      const letter = byId[id]
      if (!letter) return
      const rules = rulesAt(base.at)
      const item = { id, char: letter.char, at: base.at, kind: 'letter', doubled: false, silent: false, why: null, rules, ...extra }
      const silentRule = rules.find((r) => SILENT_RULES[r])
      if (silentRule && item.kind !== 'mad' && item.kind !== 'tanween') {
        item.silent = true
        item.why = SILENT_RULES[silentRule]
      }
      items.push(item)
    }

    cl.forEach((c, k) => {
      const { base, marks: mk } = c
      const prev = cl[k - 1]
      const doubled = mk.includes(SIGNS.shadda)
      const zero = mk.includes(SIGNS.zero1) || mk.includes(SIGNS.zero2)
      const vowel = vowelOf(c)
      const hasHamzaSign = mk.includes(SIGNS.hamzaAbove) || mk.includes(SIGNS.hamzaBelow)

      if (base === 'ـ') {
        if (hasHamzaSign) push('hamza', c)
      } else if (zero) {
        // حرف مكتوب لا يُنطق (علامة الصفر المستدير فوقه)
        const id = byChar[base]?.id ?? (base === 'ا' ? 'alif' : null)
        if (id) {
          const rules = rulesAt(c.at)
          items.push({ id, char: byId[id].char, at: c.at, kind: 'letter', doubled: false, silent: true, why: 'حرف مكتوب لا يُنطق', rules })
        }
      } else if (HAMZA.has(base) || (hasHamzaSign && 'اويى'.includes(base))) {
        push('hamza', c, { doubled })
      } else if (base === 'آ') {
        push('hamza', c)
        push('alif', c, { kind: 'mad' })
      } else if (base === 'ٱ') {
        push('hamza', c, { kind: 'wasl' })
      } else if (base === 'ا') {
        push('alif', c, { kind: 'mad' })
      } else if (base === 'ى') {
        if (!mk.includes(SIGNS.dagger)) push('alif', c, { kind: 'mad' })
      } else if (base === 'ة') {
        push('ta', c, { kind: 'marbuta' })
      } else if (base === 'ۥ') {
        push('waw', c, { kind: 'mad' })
      } else if (base === 'ۦ') {
        push('ya', c, { kind: 'mad' })
      } else if (base === 'و' || base === 'ي' || base === 'ی') {
        const id = base === 'و' ? 'waw' : 'ya'
        const wantVowel = base === 'و' ? 'damma' : 'kasra'
        // مدّ: ساكنة (أو بلا حركة) بعد حركة تناسبها: الواو بعد ضمة والياء بعد كسرة
        const isMad = !doubled && !vowel && !!prev && vowelOf(prev) === wantVowel
        if (isMad) push(id, c, { kind: 'mad' })
        else push(id, c, { doubled })
      } else if (byChar[base]) {
        push(byChar[base].id, c, { doubled })
      }

      // ألف صغيرة (ٰ) فوق الحرف = ألف مد
      if (mk.includes(SIGNS.dagger) && !zero) push('alif', { at: c.at }, { kind: 'mad' })
      // التنوين يُنطق نوناً ساكنة
      if ([...mk].some((m) => TANWEEN.has(m)) && !zero) push('noon', { at: c.at }, { kind: 'tanween' })
    })

    const inWord = marks
      .filter((m) => m.start < w.end && m.end > w.start)
      .map((m) => ({ rule: m.rule, start: Math.max(m.start, w.start), end: Math.min(m.end, w.end), from: m.start, to: m.end }))
      .map((m) => ({ ...m, text: text.slice(m.start, m.end) }))
    return { index, text: w.text, start: w.start, end: w.end, letters: items, rules: inWord }
  })
  return { words }
}

/** هل يشارك هذا الحرف الخيشوم (غنّة)؟ */
function hasGhunnah(l) {
  if (l.id !== 'noon' && l.id !== 'meem') return false
  return l.doubled || l.kind === 'tanween' || l.rules.some((r) => GHUNNAH_RULES.has(r))
}

const SIFA_NAMES_FALLBACK = { khafa: 'الخفاء', ghunnah: 'الغنة' }

/**
 * يلخّص مجموعة كلمات (الآية كلها أو كلمة واحدة): أحكامها ومخارجها وصفاتها.
 * lessons اختياري: لربط كل حكم بدرسه.
 */
export function summarize(words, letters, { ruleInfo = {}, lessons = [] } = {}) {
  const byId = Object.fromEntries(letters.letters.map((l) => [l.id, l]))
  const spoken = words.flatMap((w) => w.letters.filter((l) => !l.silent).map((l) => ({ ...l, word: w.index })))
  const silent = words.flatMap((w) => w.letters.filter((l) => l.silent).map((l) => ({ ...l, word: w.index })))

  // ---- الأحكام ----
  const ruleMap = new Map()
  const seen = new Set() // حكم يمتد على كلمتين يُحسب مرة واحدة
  for (const w of words) {
    for (const r of w.rules) {
      const key = `${r.rule}:${r.from}:${r.to}`
      if (seen.has(key)) continue
      seen.add(key)
      if (!ruleMap.has(r.rule)) ruleMap.set(r.rule, [])
      ruleMap.get(r.rule).push({ word: w.index, wordText: w.text, text: r.text, start: r.start, end: r.end })
    }
  }
  const lessonFor = (id) => lessons.find((l) => (l.rules ?? []).includes(id)) ?? null
  const rules = [...ruleMap.entries()].map(([id, occ]) => ({ id, name: ruleInfo[id]?.name ?? id, color: ruleInfo[id]?.color, description: ruleInfo[id]?.description, count: occ.length, occurrences: occ, lesson: lessonFor(id) }))

  // ---- المخارج ----
  const mk = new Map()
  const addMk = (id, l) => {
    if (!mk.has(id)) mk.set(id, new Map())
    const m = mk.get(id)
    const key = l.id
    m.set(key, { id: l.id, char: byId[l.id].char, count: (m.get(key)?.count ?? 0) + 1, kinds: [...new Set([...(m.get(key)?.kinds ?? []), l.kind])] })
  }
  for (const l of spoken) {
    const letter = byId[l.id]
    addMk(l.kind === 'mad' && letter.madd_makhraj ? letter.madd_makhraj : l.id === 'alif' ? 'jawf' : letter.makhraj, l)
    if (hasGhunnah(l)) addMk('khayshum', l)
  }
  const makharij = [...letters.makharij]
    .sort((a, b) => a.order - b.order)
    .filter((m) => mk.has(m.id))
    .map((m) => ({ ...m, letters: [...mk.get(m.id).values()], count: [...mk.get(m.id).values()].reduce((n, x) => n + x.count, 0) }))

  // ---- الصفات المتضادة ----
  const count = (pred) => spoken.filter(pred)
  const group = (l, sifa) => byId[l.id].sifat.includes(sifa)
  const opposite = letters.opposite.map((g) => ({
    id: g.id,
    name: g.name,
    sides: g.items.map((it) => {
      const hit = count((l) => group(l, it.id))
      return { id: it.id, name: it.name, strength: it.strength, lugha: it.lugha, istilah: it.istilah, count: hit.length, letters: tally(hit, byId) }
    }),
  }))

  // ---- الصفات غير المتضادة ----
  const named = Object.fromEntries(letters.non_opposite.map((s) => [s.id, s]))
  const nonOpposite = []
  for (const id of Object.keys(named)) {
    const hit = count((l) => byId[l.id].extra.includes(id) || (id === 'ghunnah' && hasGhunnah(l)))
    if (hit.length) nonOpposite.push({ id, name: named[id].name ?? SIFA_NAMES_FALLBACK[id] ?? id, lugha: named[id].lugha, istilah: named[id].istilah, count: hit.length, letters: tally(hit, byId) })
  }
  return { rules, makharij, opposite, nonOpposite, silent, letterCount: spoken.length }
}

function tally(list, byId) {
  const m = new Map()
  for (const l of list) m.set(l.id, { id: l.id, char: byId[l.id].char, count: (m.get(l.id)?.count ?? 0) + 1 })
  return [...m.values()]
}
