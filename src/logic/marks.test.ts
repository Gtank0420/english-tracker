import { describe, expect, it } from 'vitest'
import { plan } from '../plan/plan'
import { circleMinutes, dayMark, weekProgress } from './marks'

const MON = '2026-10-12' // 再起動期の月曜: vocab 15, listening 25, speech 20
const SAT = '2026-10-17' // 再起動期の土曜: おまけの楽しみ枠あり

describe('dayMark', () => {
  it('何もしていない日は印なし', () => {
    expect(dayMark(plan, MON, [])).toBeNull()
  })
  it('最低ライン3項目を完了すると ○', () => {
    expect(circleMinutes(plan)).toBe(20)
    expect(dayMark(plan, MON, ['min-vocab', 'min-repeat', 'min-record'])).toBe('circle')
  })
  it('最低ラインが2項目 (15分) だけなら印なし', () => {
    expect(dayMark(plan, MON, ['min-vocab', 'min-repeat'])).toBeNull()
  })
  it('合計20分以上で ○、20分未満は印なし', () => {
    expect(dayMark(plan, MON, ['vocab'])).toBeNull() // 15分
    expect(dayMark(plan, MON, ['vocab', 'min-record'])).toBe('circle') // 20分
    expect(dayMark(plan, MON, ['listening'])).toBe('circle') // 25分
  })
  it('標準タスクをすべて完了すると ◎', () => {
    expect(dayMark(plan, MON, ['vocab', 'listening', 'speech'])).toBe('double')
  })
  it('おまけ (optional) は ◎ に要らない', () => {
    expect(dayMark(plan, SAT, ['vocab', 'long-listening', 'summary-speech'])).toBe('double')
    expect(dayMark(plan, SAT, ['vocab', 'long-listening', 'fun'])).toBe('circle')
  })
  it('その日にない ID は無視する', () => {
    expect(dayMark(plan, MON, ['policy', 'eikaiwa'])).toBeNull()
  })
  it('模試の日は模試が標準タスク', () => {
    expect(dayMark(plan, '2027-02-13', ['vocab', 'mock'])).toBe('double')
    expect(dayMark(plan, '2027-02-13', ['vocab', 'weak-practice'])).toBeNull()
  })
})

describe('weekProgress', () => {
  const full = ['min-vocab', 'min-repeat', 'min-record']
  it('印のある日が5日で週の達成', () => {
    const days = {
      '2026-10-12': full,
      '2026-10-13': full,
      '2026-10-14': full,
      '2026-10-15': full,
    }
    expect(weekProgress(plan, '2026-10-15', days)).toMatchObject({ weekStart: '2026-10-12', markedDays: 4, met: false })
    expect(weekProgress(plan, '2026-10-18', { ...days, '2026-10-18': full })).toMatchObject({ markedDays: 5, target: 5, met: true })
  })
  it('前の週の記録は数えない', () => {
    expect(weekProgress(plan, '2026-10-12', { '2026-10-11': full }).markedDays).toBe(0)
  })
})
