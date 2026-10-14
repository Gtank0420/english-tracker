// フェーズと確認テストの日付の判定
import type { Checkpoint, IsoDate, Phase, Plan } from '../plan/types'
import { diffDays } from './date'

export type PhaseStatus =
  | { status: 'before'; phase: Phase } // 計画期間前は最初のフェーズとして扱う
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

/** その日以降でいちばん近い確認テスト (同じ日にあればそれ) と、そこまでの日数 */
export function nextCheckpoint(plan: Plan, date: IsoDate): { checkpoint: Checkpoint; daysLeft: number } | null {
  const next = [...plan.checkpoints].sort((a, b) => (a.date < b.date ? -1 : 1)).find((c) => c.date >= date)
  return next ? { checkpoint: next, daysLeft: diffDays(date, next.date) } : null
}

export function checkpointsOn(plan: Plan, date: IsoDate): Checkpoint[] {
  return plan.checkpoints.filter((c) => c.date === date)
}
