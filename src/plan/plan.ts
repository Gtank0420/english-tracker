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

  for (const s of p.skills) {
    for (const id of s.menuIds) if (!menuIds.has(id)) errors.push(`分類 ${s.id}: メニュー ${id} がない`)
  }
  for (const m of p.menus) {
    if (!skillIds.has(m.skill)) errors.push(`menu ${m.id}: 分類 ${m.skill} がない`)
    for (const id of m.materialIds) if (!materialIds.has(id)) errors.push(`menu ${m.id}: 教材 ${id} がない`)
    for (const id of m.copyTextIds) if (!copyIds.has(id)) errors.push(`menu ${m.id}: コピー文 ${id} がない`)
  }
  for (const m of p.materials) {
    if (!skillIds.has(m.skill)) errors.push(`material ${m.id}: 分類 ${m.skill} がない`)
  }
  for (const row of p.levelTable) {
    if (!skillIds.has(row.skill)) errors.push(`levelTable: 分類 ${row.skill} がない`)
    for (const m of row.match ?? []) {
      if (m.checkpoint && !checkpointIds.has(m.checkpoint)) errors.push(`levelTable: 確認テスト ${m.checkpoint} がない`)
    }
  }
  const { unitMinutes, initialBoxes } = p.logging
  if (!(unitMinutes > 0) || !(initialBoxes > 0)) errors.push('logging: unitMinutes と initialBoxes は1以上')
  if (p.markRules.circleMinutes > p.markRules.doubleCircleMinutes) errors.push('markRules: ○ の分数が ◎ より大きい')
  for (const b of p.gamification.badges) {
    const m = /^(.+)-(\d+)h$/.exec(b.id)
    if (m && !skillIds.has(m[1]!)) errors.push(`badge ${b.id}: 分類 ${m[1]} がない`)
  }
  return errors
}
