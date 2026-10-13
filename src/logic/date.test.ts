import { describe, expect, it } from 'vitest'
import { addDays, dateRange, diffDays, logicalDate, weekStart, weekdayKey } from './date'

const TZ = 'Asia/Tokyo'
const jst = (s: string) => new Date(`${s}+09:00`)

describe('logicalDate', () => {
  it('切り替え時刻 3時: 午前2時は前日扱い', () => {
    expect(logicalDate(jst('2026-10-13T02:00:00'), 3, TZ)).toBe('2026-10-12')
    expect(logicalDate(jst('2026-10-13T02:59:59'), 3, TZ)).toBe('2026-10-12')
  })
  it('切り替え時刻 3時: 3時ちょうどからその日', () => {
    expect(logicalDate(jst('2026-10-13T03:00:00'), 3, TZ)).toBe('2026-10-13')
    expect(logicalDate(jst('2026-10-13T23:59:00'), 3, TZ)).toBe('2026-10-13')
  })
  it('切り替え時刻 0時: 暦どおり', () => {
    expect(logicalDate(jst('2026-10-13T00:30:00'), 0, TZ)).toBe('2026-10-13')
  })
  it('端末のタイムゾーンではなく Asia/Tokyo で判定する', () => {
    // UTC では 10/12 18:00 だが、東京では 10/13 03:00
    expect(logicalDate(new Date('2026-10-12T18:00:00Z'), 3, TZ)).toBe('2026-10-13')
  })
  it('年をまたぐ', () => {
    expect(logicalDate(jst('2027-01-01T01:00:00'), 3, TZ)).toBe('2026-12-31')
  })
})

describe('日付の計算', () => {
  it('曜日キー', () => {
    expect(weekdayKey('2026-10-12')).toBe('mon')
    expect(weekdayKey('2026-11-10')).toBe('tue')
    expect(weekdayKey('2027-02-13')).toBe('sat')
    expect(weekdayKey('2026-10-18')).toBe('sun')
  })
  it('週は月曜始まり', () => {
    expect(weekStart('2026-10-12')).toBe('2026-10-12')
    expect(weekStart('2026-10-18')).toBe('2026-10-12')
    expect(weekStart('2026-10-10')).toBe('2026-10-05')
  })
  it('日数の加減と差', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2027-03-01', -1)).toBe('2027-02-28')
    expect(diffDays('2026-10-10', '2027-03-31')).toBe(172)
    expect(dateRange('2026-10-30', '2026-11-02')).toEqual(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02'])
  })
})
