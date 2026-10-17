import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { normalize } from '../../frontend/src/lib/arabic'
import { Tracker, heardWords, surahWords } from '../../frontend/src/lib/tasmee'

const here = (p) => fileURLToPath(new URL(p, import.meta.url))
const DATA = here('../../frontend/public/data/surah/')
const surah = (n) => JSON.parse(readFileSync(`${DATA}${n}.json`, 'utf-8'))

/** يغذّي المتابِع بنص كما يكتبه التعرّف الآلي، ويرجع الأحداث المهمة. */
function run(tracker, text) {
  const events = []
  for (const w of heardWords(text)) {
    const e = tracker.feed(w)
    if (e && e.type !== 'ok') events.push(e)
    if (e?.type === 'mistake') break
  }
  return events
}

const fatiha = () => new Tracker(surahWords(surah(1).ayahs))
const ikhlas = () => {
  const s = surah(112)
  return new Tracker(surahWords(s.ayahs, s.bismillah_text))
}

describe('التسميع: متابعة القراءة', () => {
  it('قراءة الفاتحة صحيحة بالإملاء الحديث حتى النهاية', () => {
    const t = fatiha()
    const events = run(
      t,
      'بسم الله الرحمن الرحيم الحمد لله رب العالمين الرحمن الرحيم مالك يوم الدين إياك نعبد وإياك نستعين اهدنا الصراط المستقيم صراط الذين أنعمت عليهم غير المغضوب عليهم ولا الضالين',
    )
    expect(events.at(-1).type).toBe('end')
    expect(t.mistakes).toEqual([])
    expect(t.status.every((s) => s === 'ok' || s === 'tolerated')).toBe(true)
  })

  it('يتجاهل الاستعاذة قبل البدء', () => {
    const t = ikhlas()
    run(t, 'أعوذ بالله من الشيطان الرجيم بسم الله الرحمن الرحيم قل هو الله أحد')
    expect(t.mistakes).toEqual([])
    expect(t.words[t.pos - 1].ayah).toBe(1)
  })

  it('البسملة اختيارية: يمكن البدء بأول السورة', () => {
    const t = ikhlas()
    run(t, 'قل هو الله أحد الله الصمد')
    expect(t.mistakes).toEqual([])
    expect(t.status.filter((s) => s === 'tolerated').length).toBe(4)
  })

  it('كلمة خاطئة: ينبّه ويحدد الكلمة الصحيحة', () => {
    const t = ikhlas()
    const [e] = run(t, 'قل هو الله أحد الله الواحد لم يلد')
    expect(e).toMatchObject({ type: 'mistake', kind: 'wrong', heard: 'الواحد' })
    expect(e.word.a).toBe('الصمد')
  })

  it('كلمة منسية: ينبّه إليها', () => {
    const t = ikhlas()
    const [e] = run(t, 'قل هو الله أحد الله الصمد لم يلد ولم يولد ولم يكن له أحد')
    expect(e).toMatchObject({ type: 'mistake', kind: 'skip' })
    expect(e.word.a).toBe('كفوا')
    const t2 = ikhlas()
    const [e2] = run(t2, 'قل هو الله أحد الله الصمد لم ولم يولد')
    expect(e2).toMatchObject({ type: 'mistake', kind: 'skip' })
    expect(e2.word.a).toBe('يلد')
  })

  it('كلمتان لا تطابقان شيئاً = خطأ؛ كلمة شاذة واحدة من التعرّف لا تُعدّ', () => {
    const t = ikhlas()
    expect(run(t, 'قل هو الله أحد آه الله الصمد')).toEqual([])
    const t2 = ikhlas()
    const [e] = run(t2, 'قل هو الله أحد سبحان ربي')
    expect(e).toMatchObject({ kind: 'wrong', heard: 'سبحان ربي' })
  })

  it('بعد التنبيه يعيد القارئ من أول الآية ويكمل، فتصبح الكلمة «مصحّحة»', () => {
    const t = ikhlas()
    const [e] = run(t, 'قل هو الله أحد الله الواحد لم')
    t.resume()
    const after = run(t, 'الله الصمد لم يلد ولم يولد ولم يكن له كفوا أحد')
    expect(after.at(-1).type).toBe('end')
    expect(t.status[e.index]).toBe('corrected')
    expect(t.mistakes).toHaveLength(1)
  })

  it('البدء من آية معيّنة', () => {
    const s = surah(112)
    const words = surahWords(s.ayahs)
    const start = words.findIndex((w) => w.ayah === 3)
    const t = new Tracker(words, start)
    expect(run(t, 'لم يلد ولم يولد ولم يكن له كفوا أحد').at(-1).type).toBe('end')
    expect(t.mistakes).toEqual([])
  })

  it('قراءة القرآن كاملاً كما هو (بالإملاء) بلا أي تنبيه خاطئ', () => {
    const bad = []
    for (let n = 1; n <= 114; n++) {
      const s = surah(n)
      const t = new Tracker(surahWords(s.ayahs, s.bismillah_text))
      for (const a of s.ayahs) for (const w of heardWords(normalize(a.text, { spellDagger: true }))) t.feed(w)
      if (t.mistakes.length || !t.done) bad.push([n, t.mistakes[0]?.word.a ?? `pos ${t.pos}/${t.words.length}`])
    }
    expect(bad).toEqual([])
  }, 60_000)
})
