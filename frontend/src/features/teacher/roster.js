// طلاب المعلّم: آخر تقرير وصل من كل طالب، محفوظ على جهاز المعلّم فقط.
import { readJSON, writeJSON } from '../../lib/storage'

const KEY = 'tajweed.teacher'
export const FREE_STUDENTS = 3

export function loadRoster() {
  return readJSON(KEY, { students: {} })
}

/**
 * يضيف تقرير طالب أو يحدّثه. الطالب الموجود يُحدَّث دائماً؛ الطالب الجديد يحتاج اشتراكاً بعد الحد المجاني.
 * يرجع { status: 'added' | 'updated' | 'same' | 'older' | 'limit', roster }
 */
export function addReport(report, { premium, now = Date.now(), roster = loadRoster() }) {
  const prev = roster.students[report.id]
  if (prev && prev.report.t === report.t) return { status: 'same', roster }
  if (prev && prev.report.t > report.t) return { status: 'older', roster }
  if (!prev && !premium && Object.keys(roster.students).length >= FREE_STUDENTS) return { status: 'limit', roster }
  const next = { ...roster, students: { ...roster.students, [report.id]: { report, receivedAt: now } } }
  writeJSON(KEY, next)
  return { status: prev ? 'updated' : 'added', roster: next }
}

export function removeStudent(id, roster = loadRoster()) {
  const students = { ...roster.students }
  delete students[id]
  const next = { ...roster, students }
  writeJSON(KEY, next)
  return next
}

/** CSV بترميز UTF-8 مع BOM ليفتح بالعربية في Excel. */
export function rosterCsv(rows) {
  const head = ['الاسم', 'الحلقة', 'الدروس المقروءة', 'أسئلة جرّبها', 'أتقنها', 'نسبة الصواب %', 'اقرأ بصوتك %', 'آخر نشاط', 'تاريخ التقرير']
  const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const date = (t) => (t ? new Date(t).toISOString().slice(0, 10) : '')
  const lines = rows.map((r) =>
    [r.name, r.group, r.lessons, r.seen, r.mastered, r.accuracy ?? '', r.reciteAccuracy ?? '', date(r.lastActive), date(r.reportAt)].map(cell).join(','),
  )
  return '﻿' + [head.map(cell).join(','), ...lines].join('\r\n')
}
