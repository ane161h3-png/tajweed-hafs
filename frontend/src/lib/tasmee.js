// التسميع: يتابع قراءة المتعلّم كلمةً كلمة مقابل نص السورة، ويكتشف الكلمة الخاطئة أو المنسية.
// يعمل على كلمات التعرّف الآلي (الإملاء الحديث)، فيتسامح مع ما يضيع منه عادةً:
// الكلمات القصيرة (حرفان فأقل) والبسملة، والكلمات قبل أول تطابق (الاستعاذة)، وتكرار ما قُرئ.
import { normalize } from './arabic'
import { tokens } from './matching'
import { sameWord } from './recitation'

const AHEAD = 4 // أقصى عدد كلمات يُبحث فيه للأمام
const BEHIND = 10 // إعادة القارئ لما قرأه (بعد التصحيح أو تكراراً) لا تُعدّ خطأ
const PENDING_LIMIT = 2 // كلمتان مسموعتان لا تطابقان شيئاً = خطأ

/**
 * كلمات السورة للمتابعة. ayahs: [{ ayah, text }]، bismillah: نص البسملة أو null.
 * لكل كلمة: { text, a, b, ayah, optional }
 */
export function surahWords(ayahs, bismillah = null) {
  const words = []
  if (bismillah) for (const t of tokens(bismillah)) words.push({ ...t, ayah: 0, optional: true })
  for (const a of ayahs) for (const t of tokens(a.text)) words.push({ ...t, ayah: a.ayah, optional: false })
  return words
}

/** كلمات النص المسموع بعد التطبيع. */
export function heardWords(transcript) {
  return normalize(transcript ?? '').split(' ').filter(Boolean)
}

const tolerable = (w) => w.optional || w.a.length <= 2

function joinedMatch(w1, w2, heard) {
  return [w1.a + w2.a, w1.b + w2.b].includes(heard)
}

export class Tracker {
  constructor(words, start = 0) {
    this.words = words
    this.pos = start
    this.status = words.map((_, i) => (i < start ? 'before' : null)) // ok | tolerated | mistake | corrected
    this.pending = []
    this.started = false
    this.mistakes = []
  }

  get done() {
    return this.pos >= this.words.length
  }

  /** يعالج كلمة مسموعة. يرجع null أو { type: 'ok', from, to } أو { type: 'mistake', ...} أو { type: 'end' }. */
  feed(heard) {
    if (this.done) return { type: 'end' }
    const { words, pos } = this
    // كلمات البسملة الاختيارية لا تُحسب من نافذة البحث (قد يبدأ القارئ بأول السورة)
    let optional = 0
    while (pos + optional < words.length && words[pos + optional].optional) optional++
    for (let k = 0; k < AHEAD + optional && pos + k < words.length; k++) {
      const j = pos + k
      // قبل البدء لا يُقبل إلا أول البسملة أو أول المقطع (فلا تُحسب «الرجيم» في الاستعاذة «الرحيم»)
      if (!this.started && j !== pos && j !== pos + optional) continue
      let len = 0
      if (sameWord(words[j], heard)) len = 1
      else if (j + 1 < words.length && joinedMatch(words[j], words[j + 1], heard)) len = 2
      if (!len) continue
      if (k > 0) {
        // كلمات تجاوزها القارئ: إن قرأ بدلها شيئاً فهو خطأ في الكلمة، وإلا فهي منسية (ما لم تكن مما يضيع في التعرّف)
        const skipped = words.slice(pos, j)
        const first = skipped.findIndex((w) => !tolerable(w))
        if (this.pending.length && this.started) return this.mistake('wrong', pos, this.pending.join(' '))
        if (first !== -1 && this.started) return this.mistake('skip', pos + first, '')
        for (let i = pos; i < j; i++) this.status[i] = 'tolerated'
      }
      for (let i = j; i < j + len; i++) this.status[i] = this.status[i] === 'mistake' ? 'corrected' : 'ok'
      this.pos = j + len
      this.pending = []
      this.started = true
      return { type: this.done ? 'end' : 'ok', from: j, to: this.pos }
    }
    // إعادة لما قُرئ قبل قليل (بعد التنبيه يرجع القارئ إلى أول الآية مثلاً)
    for (let i = pos - 1; i >= Math.max(0, pos - BEHIND); i--) if (sameWord(words[i], heard)) return null
    if (!this.started) return null // الاستعاذة أو كلام قبل البدء
    this.pending.push(heard)
    if (this.pending.length >= PENDING_LIMIT) return this.mistake('wrong', pos, this.pending.join(' '))
    return null
  }

  mistake(kind, index, heard) {
    this.status[index] = 'mistake'
    this.pos = index
    this.pending = []
    const m = { type: 'mistake', kind, index, heard, word: this.words[index], at: Date.now() }
    this.mistakes.push(m)
    return m
  }

  /** بعد التنبيه: يتابع القارئ من الكلمة التي أخطأ فيها. */
  resume() {
    this.pending = []
  }
}
