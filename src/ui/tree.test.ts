import { describe, expect, it } from 'vitest'
import { buildTree, type TreeData } from './Tree'

const data = (over: Partial<TreeData> = {}): TreeData => ({
  xp: 3000,
  minutesBySkill: { vocab: 800, listening: 700, speaking: 500, reading: 200, pronunciation: 300, toefl: 0 },
  leaves: 100,
  flowers: 20,
  fruits: 3,
  ...over,
})

describe('育つ木', () => {
  it('同じ記録なら毎回同じ形', () => {
    expect(JSON.stringify(buildTree(data()))).toBe(JSON.stringify(buildTree(data())))
  })
  it('葉が1枚増えても、既存の葉は動かない', () => {
    const a = buildTree(data({ leaves: 100 }))
    const b = buildTree(data({ leaves: 101 }))
    expect(b.leaves.slice(0, 100)).toEqual(a.leaves)
    expect(b.leaves).toHaveLength(101)
  })
  it('葉の描画は300枚まで。超えたぶんは葉が大きくなる', () => {
    const a = buildTree(data({ leaves: 300 }))
    const b = buildTree(data({ leaves: 1200 }))
    expect(b.leaves).toHaveLength(300)
    expect(b.leaves[0]!.size).toBeGreaterThan(a.leaves[0]!.size)
  })
  it('時間のない技能の枝は伸びない', () => {
    const t = buildTree(data())
    expect(t.branchInfo.find((b) => b.skill === 'toefl')!.length).toBe(0)
    expect(t.branchInfo.find((b) => b.skill === 'vocab')!.length).toBeGreaterThan(t.branchInfo.find((b) => b.skill === 'reading')!.length)
  })
  it('XP が増えると幹が伸びる (9,500XP 以降は最大)', () => {
    const h = (xp: number) => buildTree(data({ xp })).top.y
    expect(h(1000)).toBeGreaterThan(h(5000))
    expect(h(5000)).toBeGreaterThan(h(9500))
    expect(h(9500)).toBe(h(15000))
  })
})
