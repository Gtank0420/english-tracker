// 旧版 (曜日ごとのタスク) の記録を、分類ごとのチェック数に移す
import type { IsoDate } from '../plan/types'
import { weekdayKey } from '../logic/date'
import legacy from './legacy-tasks.json'

type Entry = [string | null, number] // [分類, 分]

const schedule = legacy.schedule as unknown as Record<string, Record<string, Record<string, Entry>>>
const minimum = legacy.minimum as unknown as Record<string, Entry>
const special = legacy.special as unknown as Record<string, { remove: string[]; add: Record<string, Entry> }>

function legacyTasks(date: IsoDate): Record<string, Entry> {
  const phase = legacy.phases.find((p) => p.start <= date && date <= p.end) ?? (date < legacy.phases[0]!.start ? legacy.phases[0] : null)
  const base = phase ? { ...(schedule[phase.id]?.[weekdayKey(date)] ?? {}) } : {}
  const sp = special[date]
  if (sp) {
    for (const id of sp.remove) delete base[id]
    Object.assign(base, sp.add)
  }
  return { ...base, ...minimum }
}

/**
 * 旧版の完了リストを分類ごとのチェック数にする。
 * 分類ごとに時間を合計してから、unitMinutes 単位に切り上げる (15分 → 2チェック)。
 * 分類のないタスク (振り返り) は数えない。
 */
export function unitsFromLegacyDone(date: IsoDate, done: readonly string[], unitMinutes: number): Record<string, number> {
  const tasks = legacyTasks(date)
  const minutes: Record<string, number> = {}
  for (const id of new Set(done)) {
    const t = tasks[id]
    if (!t || !t[0]) continue
    minutes[t[0]] = (minutes[t[0]] ?? 0) + t[1]
  }
  return Object.fromEntries(Object.entries(minutes).map(([skill, m]) => [skill, Math.ceil(m / unitMinutes)]))
}
