import { describe, expect, it } from 'vitest'
import { plan } from '../plan/plan'
import { dayMark, dayMinutes, minutesBySkillOf, weekProgress } from './marks'

describe('1日の時間', () => {
  it('1チェック = 10分', () => {
    expect(plan.logging.unitMinutes).toBe(10)
    expect(dayMinutes(plan, { vocab: 2, listening: 3 })).toBe(50)
    expect(minutesBySkillOf(plan, { speaking: 1 })).toMatchObject({ speaking: 10, vocab: 0 })
  })
  it('plan.json にない分類は数えない', () => {
    expect(dayMinutes(plan, { vocab: 1, policy: 5 })).toBe(10)
  })
})

describe('dayMark', () => {
  it('何もしていない日は印なし', () => {
    expect(dayMark(plan, {})).toBeNull()
  })
  it('合計20分以上で ○、20分未満は印なし', () => {
    expect(dayMark(plan, { vocab: 1 })).toBeNull()
    expect(dayMark(plan, { vocab: 2 })).toBe('circle')
    expect(dayMark(plan, { vocab: 1, pronunciation: 1 })).toBe('circle')
    expect(dayMark(plan, { listening: 5 })).toBe('circle')
  })
  it('合計60分以上で ◎', () => {
    expect(dayMark(plan, { listening: 6 })).toBe('double')
    expect(dayMark(plan, { vocab: 2, listening: 3, speaking: 1 })).toBe('double')
  })
})

describe('weekProgress', () => {
  const two = { vocab: 2 }
  it('印のある日が5日で週の達成', () => {
    const days = { '2026-10-12': two, '2026-10-13': two, '2026-10-14': two, '2026-10-15': two }
    expect(weekProgress(plan, '2026-10-15', days)).toMatchObject({ weekStart: '2026-10-12', markedDays: 4, met: false })
    expect(weekProgress(plan, '2026-10-18', { ...days, '2026-10-18': two })).toMatchObject({ markedDays: 5, target: 5, met: true })
  })
  it('前の週の記録は数えない', () => {
    expect(weekProgress(plan, '2026-10-12', { '2026-10-11': two }).markedDays).toBe(0)
  })
})
