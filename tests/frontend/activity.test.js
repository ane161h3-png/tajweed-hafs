import { beforeEach, describe, expect, it } from 'vitest'
import { activityLog, dayKey, lastSevenDays, logActivity, streak } from '../../frontend/src/features/progress/progress'

const day = (offset, base = new Date(2026, 10, 6, 12)) => {
  const d = new Date(base)
  d.setDate(d.getDate() + offset)
  return d
}

describe('النشاط اليومي', () => {
  beforeEach(() => localStorage.clear())

  it('يجمع الثواني في يوم واحد', () => {
    logActivity(30, day(0))
    logActivity(30, day(0))
    expect(activityLog()[dayKey(day(0))]).toBe(60)
  })

  it('السلسلة تعدّ الأيام المتتالية وتبقى قائمة إن لم يُفتح البرنامج اليوم بعد', () => {
    const log = { [dayKey(day(-1))]: 60, [dayKey(day(-2))]: 60, [dayKey(day(-4))]: 60 }
    expect(streak(log, day(0))).toBe(2)
    expect(streak({ ...log, [dayKey(day(0))]: 1 }, day(0))).toBe(3)
    expect(streak(log, day(1))).toBe(0)
  })

  it('الأيام السبعة الأخيرة بالدقائق، والأقدم أولاً', () => {
    const days = lastSevenDays({ [dayKey(day(0))]: 600 }, day(0))
    expect(days).toHaveLength(7)
    expect(days.at(-1).minutes).toBe(10)
    expect(days[0].key).toBe(dayKey(day(-6)))
  })

  it('يحذف ما مضى عليه أكثر من شهرين', () => {
    logActivity(60, day(-90))
    logActivity(60, day(0))
    expect(Object.keys(activityLog())).toEqual([dayKey(day(0))])
  })
})
