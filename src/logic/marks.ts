// ○ / ◎ と週の達成の判定
import type { IsoDate, Plan } from '../plan/types'
import { addDays, weekStart } from './date'
import { allTasksForDate, tasksForDate, type DayTask } from './schedule'

export type Mark = 'circle' | 'double' | null

/** ○ の時間条件。最低ライン3項目の合計時間 (plan.json では 20分) */
export function circleMinutes(plan: Plan): number {
  return plan.minimumTasks.reduce((sum, t) => sum + t.minutes, 0)
}

/** その日に完了したタスク (その日のタスクにない ID は無視する) */
export function completedTasks(plan: Plan, date: IsoDate, done: readonly string[]): DayTask[] {
  const set = new Set(done)
  return allTasksForDate(plan, date).filter((t) => set.has(t.id))
}

export function dayMark(plan: Plan, date: IsoDate, done: readonly string[]): Mark {
  if (done.length === 0) return null
  const set = new Set(done)
  const standard = tasksForDate(plan, date).filter((t) => !t.optional)
  if (standard.length > 0 && standard.every((t) => set.has(t.id))) return 'double'
  const allMinimum = plan.minimumTasks.length > 0 && plan.minimumTasks.every((t) => set.has(t.id))
  const minutes = completedTasks(plan, date, done).reduce((sum, t) => sum + t.minutes, 0)
  if (allMinimum || minutes >= circleMinutes(plan)) return 'circle'
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
  doneByDate: Readonly<Record<IsoDate, readonly string[] | undefined>>,
): WeekProgress {
  const start = weekStart(anyDateInWeek, plan.markRules.weekStartsOn)
  let markedDays = 0
  for (let i = 0; i < 7; i++) {
    const d = addDays(start, i)
    if (dayMark(plan, d, doneByDate[d] ?? [])) markedDays++
  }
  const target = plan.markRules.weekTargetDays
  return { weekStart: start, markedDays, target, met: markedDays >= target }
}
