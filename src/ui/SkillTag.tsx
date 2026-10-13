import type { CSSProperties } from 'react'
import { plan } from '../plan/plan'

export function skillColor(skillId: string | null): string | undefined {
  return plan.skills.find((s) => s.id === skillId)?.color
}

export function skillStyle(skillId: string | null): CSSProperties {
  const color = skillColor(skillId)
  return color ? ({ '--skill': color } as CSSProperties) : {}
}

/** 技能の色と名前。技能のないタスクは「振り返り」 */
export function SkillTag({ skill }: { skill: string | null }) {
  const name = plan.skills.find((s) => s.id === skill)?.name ?? '振り返り'
  return (
    <span className="skill-tag" style={skillStyle(skill)}>
      {name}
    </span>
  )
}
