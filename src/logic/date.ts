// 日付の計算。日付は "YYYY-MM-DD" の文字列で扱い、内部では UTC の 0 時として計算する。
import type { IsoDate, WeekdayKey } from '../plan/types'

const WEEKDAYS: WeekdayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
const DAY_MS = 24 * 60 * 60 * 1000

/**
 * いまの時刻を、指定タイムゾーンの「学習日」に変換する。
 * boundaryHour 時より前は前日扱い (深夜にやった分が翌日にならない)。
 */
export function logicalDate(now: Date, boundaryHour: number, timeZone: string): IsoDate {
  const shifted = new Date(now.getTime() - boundaryHour * 60 * 60 * 1000)
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(shifted)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

function toUtc(date: IsoDate): number {
  const [y, m, d] = date.split('-').map(Number)
  return Date.UTC(y!, m! - 1, d!)
}

function fromUtc(ms: number): IsoDate {
  return new Date(ms).toISOString().slice(0, 10)
}

export function addDays(date: IsoDate, days: number): IsoDate {
  return fromUtc(toUtc(date) + days * DAY_MS)
}

/** b − a の日数 */
export function diffDays(a: IsoDate, b: IsoDate): number {
  return Math.round((toUtc(b) - toUtc(a)) / DAY_MS)
}

export function weekdayKey(date: IsoDate): WeekdayKey {
  return WEEKDAYS[new Date(toUtc(date)).getUTCDay()]!
}

/** その日を含む週の初日 (weekStartsOn の曜日) */
export function weekStart(date: IsoDate, weekStartsOn: WeekdayKey = 'mon'): IsoDate {
  const day = new Date(toUtc(date)).getUTCDay()
  const startDay = WEEKDAYS.indexOf(weekStartsOn)
  return addDays(date, -((day - startDay + 7) % 7))
}

/** from から to まで (両端を含む) の日付 */
export function dateRange(from: IsoDate, to: IsoDate): IsoDate[] {
  const out: IsoDate[] = []
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d)
  return out
}

/** タイムスタンプ (ミリ秒) を指定タイムゾーンの日付にする (切り替え時刻は考えない) */
export function dateOfTimestamp(ms: number, timeZone: string): IsoDate {
  return logicalDate(new Date(ms), 0, timeZone)
}
