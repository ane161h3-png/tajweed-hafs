// طلاب المعلّم وسجل حضورهم: آخر تقرير وصل من كل طالب، محفوظ على جهاز المعلّم فقط.
import { readJSON, writeJSON } from '../../lib/storage'

const KEY = 'tajweed.teacher'
export const FREE_STUDENTS = 3

// roster = { students: { id: { report, receivedAt, manual? } }, attendance: { 'YYYY-MM-DD': { id: status } } }
export function loadRoster() {
  const r = readJSON(KEY, null)
  return { students: r?.students ?? {}, attendance: r?.attendance ?? {} }
}

const save = (next) => (writeJSON(KEY, next), next)
const sameName = (a, b) => a.replace(/\s+/g, ' ').trim() === b.replace(/\s+/g, ' ').trim()

/**
 * يضيف تقرير طالب أو يحدّثه. الطالب الموجود يُحدَّث دائماً؛ الطالب الجديد يحتاج اشتراكاً بعد الحد المجاني.
 * إن كان المعلّم أضاف الطالب باسمه للحضور، يُربط التقرير به ويبقى سجل حضوره.
 * يرجع { status: 'added' | 'linked' | 'updated' | 'same' | 'older' | 'limit', roster }
 */
export function addReport(report, { premium, now = Date.now(), roster = loadRoster() }) {
  const prev = roster.students[report.id]
  if (prev && prev.report.t === report.t) return { status: 'same', roster }
  if (prev && prev.report.t > report.t) return { status: 'older', roster }
  const entry = { report, receivedAt: now }
  if (!prev && report.n) {
    const manual = Object.entries(roster.students).find(([, s]) => s.manual && sameName(s.report.n, report.n))
    if (manual) return { status: 'linked', roster: save(renameStudent(roster, manual[0], report.id, entry)) }
  }
  if (!prev && !premium && Object.keys(roster.students).length >= FREE_STUDENTS) return { status: 'limit', roster }
  return { status: prev ? 'updated' : 'added', roster: save({ ...roster, students: { ...roster.students, [report.id]: entry } }) }
}

function renameStudent(roster, from, to, entry) {
  const students = { ...roster.students }
  delete students[from]
  students[to] = entry
  const attendance = Object.fromEntries(
    Object.entries(roster.attendance).map(([day, marks]) => {
      const m = { ...marks }
      if (from in m) {
        m[to] = m[from]
        delete m[from]
      }
      return [day, m]
    }),
  )
  return { students, attendance }
}

/** يضيف طالباً باسمه فقط (لتسجيل حضوره قبل أن يرسل تقريره). */
export function addManualStudent(name, group, { premium, now = Date.now(), roster = loadRoster() }) {
  const n = name.replace(/\s+/g, ' ').trim()
  if (!n) return { status: 'empty', roster }
  if (Object.values(roster.students).some((s) => sameName(s.report.n, n) && (s.report.g ?? '') === (group ?? '').trim()))
    return { status: 'exists', roster }
  if (!premium && Object.keys(roster.students).length >= FREE_STUDENTS) return { status: 'limit', roster }
  const id = `m-${now.toString(36)}${Math.random().toString(36).slice(2, 6)}`
  const report = { v: 1, id, n, g: (group ?? '').trim(), t: 0, a: 0, l: [], q: [] }
  return { status: 'added', id, roster: save({ ...roster, students: { ...roster.students, [id]: { report, receivedAt: now, manual: true } } }) }
}

export function removeStudent(id, roster = loadRoster()) {
  const students = { ...roster.students }
  delete students[id]
  const attendance = Object.fromEntries(
    Object.entries(roster.attendance).map(([day, marks]) => {
      const m = { ...marks }
      delete m[id]
      return [day, m]
    }),
  )
  return save({ students, attendance })
}

/* ———— الحضور ———— */

export const ATTENDANCE = {
  present: { label: 'حاضر', short: 'ح' },
  late: { label: 'متأخر', short: 'ت' },
  absent: { label: 'غائب', short: 'غ' },
  excused: { label: 'مستأذن', short: 'س' },
}

/** تاريخ اليوم بتوقيت الجهاز YYYY-MM-DD. */
export function localDay(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** status = null يمسح التسجيل. ids مصفوفة لتسجيل عدة طلاب معاً. */
export function setAttendance(day, ids, status, roster = loadRoster()) {
  const marks = { ...(roster.attendance[day] ?? {}) }
  for (const id of [].concat(ids)) {
    if (status) marks[id] = status
    else delete marks[id]
  }
  const attendance = { ...roster.attendance, [day]: marks }
  if (!Object.keys(marks).length) delete attendance[day]
  return save({ ...roster, attendance })
}

/** إحصاء حضور طالب: النسبة = (حاضر + متأخر) ÷ (الأيام المسجّلة عدا المستأذن). */
export function attendanceStats(roster, id) {
  const s = { present: 0, late: 0, absent: 0, excused: 0, days: [] }
  for (const [day, marks] of Object.entries(roster.attendance)) {
    const st = marks[id]
    if (!st) continue
    s[st] += 1
    s.days.push({ day, status: st })
  }
  s.days.sort((a, b) => b.day.localeCompare(a.day))
  const counted = s.present + s.late + s.absent
  s.rate = counted ? Math.round(((s.present + s.late) / counted) * 100) : null
  return s
}

/* ———— التصدير ———— */

const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
const csv = (rows) => '﻿' + rows.map((r) => r.map(cell).join(',')).join('\r\n')

/** CSV بترميز UTF-8 مع BOM ليفتح بالعربية في Excel. */
export function rosterCsv(rows) {
  const head = ['الاسم', 'الحلقة', 'الدروس المقروءة', 'أسئلة جرّبها', 'أتقنها', 'نسبة الصواب %', 'اقرأ بصوتك %', 'الحضور %', 'آخر نشاط', 'تاريخ التقرير']
  const date = (t) => (t ? new Date(t).toISOString().slice(0, 10) : '')
  return csv([
    head,
    ...rows.map((r) => [r.name, r.group, r.lessons, r.seen, r.mastered, r.accuracy ?? '', r.reciteAccuracy ?? '', r.attendance ?? '', date(r.lastActive), date(r.reportAt)]),
  ])
}

/** سجل الحضور: صف لكل طالب وعمود لكل يوم. */
export function attendanceCsv(roster, ids) {
  const days = Object.keys(roster.attendance).sort()
  const head = ['الاسم', 'الحلقة', ...days, 'حاضر', 'متأخر', 'غائب', 'مستأذن', 'النسبة %']
  return csv([
    head,
    ...ids.map((id) => {
      const { report } = roster.students[id]
      const s = attendanceStats(roster, id)
      return [report.n, report.g, ...days.map((d) => ATTENDANCE[roster.attendance[d][id]]?.label ?? ''), s.present, s.late, s.absent, s.excused, s.rate ?? '']
    }),
  ])
}
