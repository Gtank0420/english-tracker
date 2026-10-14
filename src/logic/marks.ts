// ○ / ◎ と週の達成の判定。記録は分類ごとのチェック数 (units)
import type { IsoDate, Plan } from '../plan/types'
import { addDays, weekStart } from './date'

export type Mark = 'circle' | 'double' | null
export type Units = Readonly<Record<string, number>>

/** 分類ごとの分数。plan.json にない分類は数えない */
export function minutesBySkillOf(plan: Plan, units: Units): Record<string, number> {
  return Object.fromEntries(plan.skills.map((s) => [s.id, Math.max(0, units[s.id] ?? 0) * plan.logging.unitMinutes]))
}

/** その日の合計時間 (分) */
export function dayMinutes(plan: Plan, units: Units): number {
  return Object.values(minutesBySkillOf(plan, units)).reduce((a, b) => a + b, 0)
}

/** その日のチェックの数 */
export function dayChecks(plan: Plan, units: Units): number {
  return dayMinutes(plan, units) / plan.logging.unitMinutes
}

export function dayMark(plan: Plan, units: Units): Mark {
  const m = dayMinutes(plan, units)
  if (m > 0 && m >= plan.markRules.doubleCircleMinutes) return 'double'
  if (m > 0 && m >= plan.markRules.circleMinutes) return 'circle'
  return null
}

export interface WeekProgress {
  weekStart: IsoDate
  markedDays: number
  target: number
  met: boolean
}

export function weekProgress(
  plan: Plan,
  anyDateInWeek: IsoDate,
  unitsByDate: Readonly<Record<IsoDate, Units | undefined>>,
): WeekProgress {
  const start = weekStart(anyDateInWeek, plan.markRules.weekStartsOn)
  let markedDays = 0
  for (let i = 0; i < 7; i++) {
    const d = addDays(start, i)
    if (dayMark(plan, unitsByDate[d] ?? {})) markedDays++
  }
  const target = plan.markRules.weekTargetDays
  return { weekStart: start, markedDays, target, met: markedDays >= target }
}
