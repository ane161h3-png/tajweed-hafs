import { beforeEach, describe, expect, it } from 'vitest'
import { verifyLicense } from '../../frontend/src/lib/license'
import { analyzeReport, buildReport, decodeReport, encodeReport } from '../../frontend/src/features/teacher/report'
import { FREE_STUDENTS, addManualStudent, addReport, attendanceCsv, attendanceStats, loadRoster, localDay, removeStudent, rosterCsv, setAttendance } from '../../frontend/src/features/teacher/roster'

// كود حقيقي من scripts/make_license.py (باسم «اختبار»، صالح حتى 2026-11-16)
const CODE =
  'TJW-eyJwIjoidGVhY2hlciIsImUiOiIyMDI2LTExLTE2IiwibiI6Itin2K7Yqtio2KfYsSIsImkiOiIzNWM1YWM3YSJ9.2aRItoWBbrpKFkkwqMzuf18AwDr8yWtZ-ZLzz0wclhhZusvT3cAU91XkdHeHr2AgoYLc-zRcqblt4elgQiesAw'
const BEFORE = new Date('2026-10-20T12:00:00Z')

describe('كود تفعيل الاشتراك', () => {
  it('يقبل كوداً موقّعاً صالحاً', async () => {
    const r = await verifyLicense(CODE, BEFORE)
    expect(r).toMatchObject({ ok: true, until: '2026-11-16', name: 'اختبار' })
  })

  it('يتجاهل المسافات وفواصل الأسطر عند اللصق', async () => {
    const r = await verifyLicense(`  ${CODE.slice(0, 40)}\n${CODE.slice(40)} `, BEFORE)
    expect(r.ok).toBe(true)
  })

  it('يرفض الكود بعد انتهاء صلاحيته', async () => {
    expect(await verifyLicense(CODE, new Date('2026-11-17T00:00:00Z'))).toMatchObject({ ok: false, reason: 'expired' })
  })

  it('يرفض كوداً عُدّل تاريخه (التوقيع لا يطابق)', async () => {
    const [, payload, sig] = /^TJW-([^.]+)\.(.+)$/.exec(CODE)
    const json = new TextDecoder().decode(Uint8Array.from(atob(payload.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)))
    const forged = btoa(String.fromCharCode(...new TextEncoder().encode(json.replace('2026-11-16', '2099-11-16'))))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
    expect(await verifyLicense(`TJW-${forged}.${sig}`, BEFORE)).toMatchObject({ ok: false, reason: 'signature' })
  })

  it('يرفض النص العشوائي', async () => {
    expect(await verifyLicense('hello', BEFORE)).toMatchObject({ ok: false, reason: 'format' })
  })
})

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
    expect(addReport(report(), { premium: false }).status).toBe('added')
    expect(addReport(report({ t: 1_700_002_000_000 }), { premium: false }).status).toBe('updated')
    expect(addReport(report({ t: 1_700_002_000_000 }), { premium: false }).status).toBe('same')
    expect(addReport(report({ t: 1_600_000_000_000 }), { premium: false }).status).toBe('older')
    expect(Object.keys(loadRoster().students)).toEqual(['s1'])
  })

  it(`الخطة المجانية ${FREE_STUDENTS} طلاب، والاشتراك بلا حد، وتحديث الطالب الموجود مسموح دائماً`, () => {
    for (let i = 0; i < FREE_STUDENTS; i++) addReport(report({ id: `s${i}` }), { premium: false })
    expect(addReport(report({ id: 'new' }), { premium: false }).status).toBe('limit')
    expect(addReport(report({ id: 's0', t: 1_800_000_000_000 }), { premium: false }).status).toBe('updated')
    expect(addReport(report({ id: 'new' }), { premium: true }).status).toBe('added')
    removeStudent('new')
    expect(Object.keys(loadRoster().students)).toHaveLength(FREE_STUDENTS)
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
    addReport(report(), { premium: false })
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
    const { id, status } = addManualStudent('  أحمد  ', 'حلقة الفجر', { premium: false })
    expect(status).toBe('added')
    expect(addManualStudent('أحمد', 'حلقة الفجر', { premium: false }).status).toBe('exists')
    setAttendance('2026-10-01', id, 'present')
    expect(addReport(report(), { premium: false }).status).toBe('linked')
    const r = loadRoster()
    expect(Object.keys(r.students)).toEqual(['s1'])
    expect(r.students.s1.manual).toBeUndefined()
    expect(r.attendance['2026-10-01']).toEqual({ s1: 'present' })
  })

  it('الإضافة بالاسم تخضع لحد الخطة المجانية', () => {
    for (let i = 0; i < FREE_STUDENTS; i++) addManualStudent(`طالب ${i}`, '', { premium: false })
    expect(addManualStudent('زائد', '', { premium: false }).status).toBe('limit')
    expect(addManualStudent('زائد', '', { premium: true }).status).toBe('added')
  })

  it('حذف الطالب يحذف حضوره، والتسجيل الجماعي يعمل', () => {
    addReport(report(), { premium: false })
    addReport(report({ id: 's2', n: 'علي' }), { premium: false })
    setAttendance('2026-10-01', ['s1', 's2'], 'present')
    removeStudent('s1')
    expect(loadRoster().attendance['2026-10-01']).toEqual({ s2: 'present' })
  })

  it('سجل الحضور CSV: عمود لكل يوم', () => {
    addReport(report(), { premium: false })
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
