// plan.json の読み込み。ビルド時に取り込むので、plan.json を直して push すれば画面に反映される。
import rawPlan from '../../plan.json'
import type { Plan } from './types'

export const plan = rawPlan as Plan

/** plan.json の参照切れを見つける。問題がなければ空配列 */
export function validatePlan(p: Plan): string[] {
  const errors: string[] = []
  const skillIds = new Set(p.skills.map((s) => s.id))
  const menuIds = new Set(p.menus.map((m) => m.id))
  const materialIds = new Set(p.materials.map((m) => m.id))
  const copyIds = new Set(p.copyTexts.map((c) => c.id))
  const checkpointIds = new Set(p.checkpoints.map((c) => c.id))
  const weekdays = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const

  for (const m of p.menus) {
    if (!skillIds.has(m.skill)) errors.push(`menu ${m.id}: 技能 ${m.skill} がない`)
    for (const id of m.materialIds) if (!materialIds.has(id)) errors.push(`menu ${m.id}: 教材 ${id} がない`)
    for (const id of m.copyTextIds) if (!copyIds.has(id)) errors.push(`menu ${m.id}: コピー文 ${id} がない`)
  }
  for (const t of p.minimumTasks) {
    if (!skillIds.has(t.skill)) errors.push(`minimumTasks ${t.id}: 技能 ${t.skill} がない`)
    if (t.menuId && !menuIds.has(t.menuId)) errors.push(`minimumTasks ${t.id}: メニュー ${t.menuId} がない`)
  }
  for (const ph of p.phases) {
    const week = p.schedule[ph.id]
    if (!week) {
      errors.push(`schedule に ${ph.id} がない`)
      continue
    }
    for (const d of weekdays) {
      const tasks = week[d]
      if (!tasks) {
        errors.push(`schedule.${ph.id}.${d} がない`)
        continue
      }
      const seen = new Set<string>()
      for (const t of tasks) {
        if (seen.has(t.id)) errors.push(`schedule.${ph.id}.${d}: タスク ID ${t.id} が重複`)
        seen.add(t.id)
        if (t.menuId && !menuIds.has(t.menuId)) errors.push(`schedule.${ph.id}.${d}.${t.id}: メニュー ${t.menuId} がない`)
      }
    }
  }
  for (const sd of p.specialDays) {
    for (const t of sd.addTasks) {
      if (t.menuId && !menuIds.has(t.menuId)) errors.push(`specialDays ${sd.date}.${t.id}: メニュー ${t.menuId} がない`)
    }
  }
  for (const m of p.materials) {
    if (!skillIds.has(m.skill)) errors.push(`material ${m.id}: 技能 ${m.skill} がない`)
  }
  for (const row of p.levelTable) {
    if (!skillIds.has(row.skill)) errors.push(`levelTable: 技能 ${row.skill} がない`)
    for (const m of row.match ?? []) {
      if (m.checkpoint && !checkpointIds.has(m.checkpoint)) errors.push(`levelTable: 確認テスト ${m.checkpoint} がない`)
    }
  }
  return errors
}
