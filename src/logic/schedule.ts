// フェーズとその日のタスクの判定
import type { Checkpoint, IsoDate, Phase, Plan } from '../plan/types'
import { diffDays, weekdayKey } from './date'

export type PhaseStatus =
  | { status: 'before'; phase: Phase } // 計画期間前は p1 として扱う
  | { status: 'active'; phase: Phase }
  | { status: 'after'; phase: null } // 計画を完走した

export function phaseFor(plan: Plan, date: IsoDate): PhaseStatus {
  const first = plan.phases[0]!
  if (date < first.start) return { status: 'before', phase: first }
  const phase = plan.phases.find((p) => p.start <= date && date <= p.end)
  if (phase) return { status: 'active', phase }
  return { status: 'after', phase: null }
}

export function isInPeriod(plan: Plan, date: IsoDate): boolean {
  return plan.period.start <= date && date <= plan.period.end
}

/** 画面と判定で使う、1日分のタスク */
export interface DayTask {
  id: string
  menuId: string | null
  label: string
  minutes: number
  optional: boolean
  /** メニューの技能。振り返りのようにメニューがないタスクは null */
  skill: string | null
  /** 最低ラインのタスクなら true */
  minimum: boolean
}

function skillOfMenu(plan: Plan, menuId: string | null): string | null {
  if (!menuId) return null
  return plan.menus.find((m) => m.id === menuId)?.skill ?? null
}

/** schedule[フェーズ][曜日] に specialDays を当てた、その日の標準タスクとおまけ */
export function tasksForDate(plan: Plan, date: IsoDate): DayTask[] {
  const { phase } = phaseFor(plan, date)
  if (!phase) return []
  const base = plan.schedule[phase.id]?.[weekdayKey(date)] ?? []
  const special = plan.specialDays.find((s) => s.date === date)
  const tasks = special
    ? [...base.filter((t) => !special.replaceTaskIds.includes(t.id)), ...special.addTasks]
    : base
  return tasks.map((t) => ({
    id: t.id,
    menuId: t.menuId,
    label: t.label,
    minutes: t.minutes,
    optional: t.optional ?? false,
    skill: skillOfMenu(plan, t.menuId),
    minimum: false,
  }))
}

export function minimumTasks(plan: Plan): DayTask[] {
  return plan.minimumTasks.map((t) => ({
    id: t.id,
    menuId: t.menuId,
    label: t.label,
    minutes: t.minutes,
    optional: false,
    skill: t.skill,
    minimum: true,
  }))
}

/** その日にチェックできるすべてのタスク (標準・おまけ・最低ライン) */
export function allTasksForDate(plan: Plan, date: IsoDate): DayTask[] {
  return [...tasksForDate(plan, date), ...minimumTasks(plan)]
}

/** その日以降でいちばん近い確認テスト (同じ日にあればそれ) と、そこまでの日数 */
export function nextCheckpoint(plan: Plan, date: IsoDate): { checkpoint: Checkpoint; daysLeft: number } | null {
  const next = [...plan.checkpoints].sort((a, b) => (a.date < b.date ? -1 : 1)).find((c) => c.date >= date)
  return next ? { checkpoint: next, daysLeft: diffDays(date, next.date) } : null
}

export function checkpointsOn(plan: Plan, date: IsoDate): Checkpoint[] {
  return plan.checkpoints.filter((c) => c.date === date)
}
