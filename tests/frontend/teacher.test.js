import { beforeEach, describe, expect, it } from 'vitest'
import { analyzeReport, buildReport, decodeReport, encodeReport } from '../../frontend/src/features/teacher/report'
import { encodeCard, parseCard } from '../../frontend/src/features/teacher/card'
import { addManualStudent, addReport, checkIn, attendanceCsv, attendanceStats, loadRoster, localDay, removeStudent, rosterCsv, setAttendance } from '../../frontend/src/features/teacher/roster'

const QUESTIONS = [
  { id: 'a', level: 1, type: 'mcq', topic: 'المخارج', question: 'س١' },
  { id: 'b', level: 2, type: 'extract', topic: 'الأحكام', rule_title: 'الإخفاء', word: 'مِن تَحۡتِهَا', link: '/ahkam/noon-sakinah/noon-sakinah-5' },
  { id: 'c', level: 2, type: 'recite', topic: 'الأحكام', rule_title: 'الإقلاب', word: 'مِنۢ بَعۡدِ' },
]
const SRS = {
  a: { box: 4, right: 4, wrong: 0, last: 1_700_000_000_000 },
  b: { box: 1, right: 1, wrong: 3, last: 1_700_000_500_000 },
  c: { box: 2, right: 1, wrong: 1, last: 1_700_000_100_000 },
}
const profile = { id: 's1', name: ' أحمد ', group: 'حلقة الفجر' }
const report = (over = {}) => ({ ...buildReport({ profile, completed: { 'noon-sakinah-1': 1_700_000_900_000 }, srs: SRS, now: 1_700_001_000_000 }), ...over })

describe('تقرير الطالب', () => {
  it('يُرمَّز ويُفكّ كما هو، من الكود أو من الرابط كاملاً', async () => {
    const r = report()
    const code = await encodeReport(r)
    expect(code).toMatch(/^[zj][A-Za-z0-9_-]+$/)
    expect(await decodeReport(code)).toEqual(r)
    expect(await decodeReport(`https://x.github.io/tajweed-hafs/teacher/students#r=${code}`)).toEqual(r)
  })

  it('الاسم بلا مسافات زائدة، وآخر نشاط هو أحدث وقت', () => {
    const r = report()
    expect(r.n).toBe('أحمد')
    expect(r.a).toBe(1_700_000_900_000)
    expect(r.l).toEqual(['noon-sakinah-1'])
  })

  it('يرفض الكود التالف برسالة مفهومة', async () => {
    await expect(decodeReport('zAAAA')).rejects.toThrow(/تالف|صيغة/)
    await expect(decodeReport('مرحبا')).rejects.toThrow(/ليس كود/)
  })

  it('يحلّل النتائج: المستويات، واقرأ بصوتك، ومواضع الضعف', () => {
    const a = analyzeReport(report(), QUESTIONS)
    expect(a.levels[1]).toMatchObject({ seen: 1, mastered: 1, right: 4, wrong: 0 })
    expect(a.levels[2]).toMatchObject({ seen: 1, right: 1, wrong: 3 })
    expect(a.recite).toMatchObject({ seen: 1, right: 1, wrong: 1 })
    expect(a.accuracy).toBe(Math.round((6 / 10) * 100))
    expect(a.weak.map((w) => w.title)).toEqual(['الإخفاء'])
    expect(a.weakTopics).toEqual([{ title: 'الإخفاء', count: 1 }])
  })
})

describe('طلاب المعلّم', () => {
  beforeEach(() => localStorage.clear())

  it('يضيف ويحدّث ويتجاهل التقرير الأقدم', () => {
    expect(addReport(report()).status).toBe('added')
    expect(addReport(report({ t: 1_700_002_000_000 })).status).toBe('updated')
    expect(addReport(report({ t: 1_700_002_000_000 })).status).toBe('same')
    expect(addReport(report({ t: 1_600_000_000_000 })).status).toBe('older')
    expect(Object.keys(loadRoster().students)).toEqual(['s1'])
  })

  it('لا حد لعدد الطلاب، وتحديث الطالب الموجود مسموح دائماً', () => {
    for (let i = 0; i < 10; i++) expect(addReport(report({ id: `s${i}` })).status).toBe('added')
    expect(addReport(report({ id: 's0', t: 1_800_000_000_000 })).status).toBe('updated')
    removeStudent('s9')
    expect(Object.keys(loadRoster().students)).toHaveLength(9)
  })

  it('CSV بالعربية يفتح في Excel', () => {
    const csv = rosterCsv([{ name: 'أحمد "الصغير"', group: 'الفجر', lessons: 3, seen: 10, mastered: 2, accuracy: 80, reciteAccuracy: null, lastActive: 0, reportAt: Date.UTC(2026, 9, 17) }])
    expect(csv.startsWith('﻿')).toBe(true)
    expect(csv).toContain('"أحمد ""الصغير"""')
    expect(csv).toContain('"2026-10-17"')
  })
})

describe('الحضور', () => {
  beforeEach(() => localStorage.clear())

  it('يسجّل ويغيّر ويمسح، ويحسب النسبة دون أيام الاستئذان', () => {
    addReport(report())
    setAttendance('2026-10-01', 's1', 'present')
    setAttendance('2026-10-02', 's1', 'late')
    setAttendance('2026-10-03', 's1', 'absent')
    setAttendance('2026-10-04', 's1', 'excused')
    setAttendance('2026-10-05', 's1', 'absent')
    setAttendance('2026-10-05', 's1', null)
    const s = attendanceStats(loadRoster(), 's1')
    expect(s).toMatchObject({ present: 1, late: 1, absent: 1, excused: 1, rate: 67 })
    expect(s.days.map((d) => d.day)).toEqual(['2026-10-04', '2026-10-03', '2026-10-02', '2026-10-01'])
    expect(loadRoster().attendance['2026-10-05']).toBeUndefined()
  })

  it('طالب بلا تسجيل: النسبة غير معروفة', () => {
    expect(attendanceStats(loadRoster(), 'x').rate).toBeNull()
  })

  it('إضافة طالب باسمه، ثم ربط تقريره به مع بقاء حضوره', () => {
    const { id, status } = addManualStudent('  أحمد  ', 'حلقة الفجر')
    expect(status).toBe('added')
    expect(addManualStudent('أحمد', 'حلقة الفجر').status).toBe('exists')
    setAttendance('2026-10-01', id, 'present')
    expect(addReport(report()).status).toBe('linked')
    const r = loadRoster()
    expect(Object.keys(r.students)).toEqual(['s1'])
    expect(r.students.s1.manual).toBeUndefined()
    expect(r.attendance['2026-10-01']).toEqual({ s1: 'present' })
  })

  it('الإضافة بالاسم بلا حد', () => {
    for (let i = 0; i < 10; i++) expect(addManualStudent(`طالب ${i}`, '').status).toBe('added')
    expect(addManualStudent('زائد', '').status).toBe('added')
  })

  it('حذف الطالب يحذف حضوره، والتسجيل الجماعي يعمل', () => {
    addReport(report())
    addReport(report({ id: 's2', n: 'علي' }))
    setAttendance('2026-10-01', ['s1', 's2'], 'present')
    removeStudent('s1')
    expect(loadRoster().attendance['2026-10-01']).toEqual({ s2: 'present' })
  })

  it('سجل الحضور CSV: عمود لكل يوم', () => {
    addReport(report())
    setAttendance('2026-10-01', 's1', 'present')
    setAttendance('2026-10-02', 's1', 'absent')
    const lines = attendanceCsv(loadRoster(), ['s1']).replace('﻿', '').split('\r\n')
    expect(lines[0]).toContain('"2026-10-01","2026-10-02"')
    expect(lines[1]).toBe('"أحمد","حلقة الفجر","حاضر","غائب","1","0","1","0","50"')
  })

  it('localDay بتوقيت الجهاز', () => {
    expect(localDay(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05')
  })
})

describe('باركود الحضور', () => {
  beforeEach(() => localStorage.clear())
  const card = { id: 's1', name: 'أحمد', group: 'حلقة الفجر' }

  it('يُرمَّز ويُقرأ، ويرفض الباركودات الأخرى', () => {
    expect(parseCard(encodeCard({ id: 's1', name: ' أحمد ', group: 'حلقة الفجر' }))).toEqual(card)
    expect(parseCard('https://example.com')).toBeNull()
    expect(parseCard('{"t":"other","i":"x","n":"y"}')).toBeNull()
    expect(parseCard('{"t":"tjw-s","i":"x","n":"  "}')).toBeNull()
  })

  it('المسح يضيف الطالب الجديد ويسجّله حاضراً، والمسح الثاني لا يكرر', () => {
    expect(checkIn('2026-10-01', card).status).toBe('joined')
    expect(checkIn('2026-10-01', card).status).toBe('already')
    expect(loadRoster().students.s1.report.n).toBe('أحمد')
    expect(loadRoster().attendance['2026-10-01']).toEqual({ s1: 'present' })
  })

  it('يغيّر «غائب» إلى «حاضر» عند المسح', () => {
    addReport(report())
    setAttendance('2026-10-01', 's1', 'absent')
    expect(checkIn('2026-10-01', card).status).toBe('present')
    expect(loadRoster().attendance['2026-10-01'].s1).toBe('present')
  })

  it('معرّف الباركود هو معرّف التقرير، فيُحدَّث الطالب نفسه عند وصول تقريره', () => {
    checkIn('2026-10-01', card)
    expect(addReport(report()).status).toBe('updated')
    const r = loadRoster()
    expect(Object.keys(r.students)).toEqual(['s1'])
    expect(r.students.s1.manual).toBeUndefined()
    expect(r.attendance['2026-10-01']).toEqual({ s1: 'present' })
  })

  it('مسح باركود طالب جديد يضيفه بلا حد', () => {
    for (let i = 0; i < 10; i++) expect(checkIn('2026-10-01', { ...card, id: `s${i}`, name: `طالب ${i}` }).status).toBe('joined')
    expect(checkIn('2026-10-01', { ...card, id: 'new', name: 'جديد' }).status).toBe('joined')
    expect(loadRoster().students.new).toBeDefined()
  })
})
