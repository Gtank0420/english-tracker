import { describe, expect, it } from 'vitest'
import { plan, validatePlan } from './plan'

// plan.json を書き換えたときに参照切れを見つけるためのテスト
describe('plan.json', () => {
  it('参照切れがない', () => {
    expect(validatePlan(plan)).toEqual([])
  })
  it('フェーズが計画期間を隙間なく覆う', () => {
    expect(plan.phases[0]!.start).toBe(plan.period.start)
    expect(plan.phases[plan.phases.length - 1]!.end).toBe(plan.period.end)
  })
})
