import { describe, expect, it } from 'vitest'
import type { DayRecord, Records } from '../data/types'
import { plan } from '../plan/plan'
import { addDays, dateRange } from './date'
import { tasksForDate } from './schedule'
import { collectionEntries, computeProgress, levelForXp, matchedLevelRows, titleForLevel, xpForLevel } from './progress'

const day = (done: string[], extra: Partial<DayRecord> = {}): DayRecord => ({
  done,
  memo: '',
  memoKind: null,
  updatedAt: 0,
  ...extra,
})
const empty: Records = { days: {}, checkpoints: {} }
const MIN = ['min-vocab', 'min-repeat', 'min-record']

/** from から to まで、その日の標準タスク (optional を除く) をすべて完了した記録 */
function perfectDays(from: string, to: string): Records['days'] {
  return Object.fromEntries(
    dateRange(from, to).map((d) => [d, day(tasksForDate(plan, d).filter((t) => !t.optional).map((t) => t.id))]),
  )
}

describe('レベル', () => {
  it('plan.json の例と一致する', () => {
    for (const [level, xp] of Object.entries(plan.gamification.level.examples)) {
      expect(xpForLevel(plan, Number(level))).toBe(xp)
    }
  })
  it('累計XPからレベル', () => {
    expect(levelForXp(plan, 0)).toBe(1)
    expect(levelForXp(plan, 49)).toBe(1)
    expect(levelForXp(plan, 50)).toBe(2)
    expect(levelForXp(plan, 149)).toBe(2)
    expect(levelForXp(plan, 9500)).toBe(20)
  })
  it('称号', () => {
    expect(titleForLevel(plan, 1)).toBe('種')
    expect(titleForLevel(plan, 5)).toBe('芽')
    expect(titleForLevel(plan, 6)).toBe('若葉')
    expect(titleForLevel(plan, 25)).toBe('大樹')
  })
})

describe('computeProgress: 経験値', () => {
  it('記録なし', () => {
    const p = computeProgress(plan, empty)
    expect(p).toMatchObject({ xp: 0, level: 1, title: '種', totalMinutes: 0, completedCount: 0, fruits: 0 })
    expect(p.badges.every((b) => b.earnedOn === null)).toBe(true)
  })
  it('時間 × 1 に ◎ のボーナス 20 を足す', () => {
    // 月曜を ◎ (60分) + 火曜に単語だけ (15分、印なし)
    const p = computeProgress(plan, {
      days: { '2026-10-12': day(['vocab', 'listening', 'speech']), '2026-10-13': day(['vocab']) },
      checkpoints: {},
    })
    expect(p.totalMinutes).toBe(75)
    expect(p.doubleDays).toEqual(['2026-10-12'])
    expect(p.xp).toBe(75 + 20)
    expect(p.minutesBySkill).toMatchObject({ vocab: 30, listening: 25, speaking: 20, policy: 0 })
    expect(p.completedCount).toBe(4)
  })
  it('おまけと最低ラインも時間に入る。振り返りは技能別に入らない', () => {
    const p = computeProgress(plan, {
      days: { '2026-10-11': day(['fun', 'weekly-review']), '2026-10-12': day(MIN) },
      checkpoints: {},
    })
    expect(p.totalMinutes).toBe(30 + 20 + 20)
    expect(p.minutesBySkill).toMatchObject({ fun: 30, vocab: 10, listening: 5, speaking: 5 })
  })
  it('週の達成ごとに 50', () => {
    const days = Object.fromEntries(dateRange('2026-10-12', '2026-10-16').map((d) => [d, day(MIN)]))
    const p = computeProgress(plan, { days, checkpoints: {} })
    expect(p.weeksMet).toEqual(['2026-10-12'])
    expect(p.xp).toBe(5 * 20 + 50)
  })
  it('計画期間を全部こなすと Lv20 を超える', () => {
    const p = computeProgress(plan, { days: perfectDays(plan.period.start, plan.period.end), checkpoints: {} })
    expect(p.level).toBeGreaterThanOrEqual(20)
  })
  it('結果を入力した test と diagnosis の数だけ実がなる (録音は数えない)', () => {
    const p = computeProgress(plan, {
      days: {},
      checkpoints: {
        'diag-vocab': { values: { rank1: 85 }, enteredAt: 0 },
        'test-midterm': { values: { reading: 60 }, enteredAt: 0 },
        'rec-2026-10': { values: { words: 70 }, enteredAt: 0 },
      },
    })
    expect(p.fruits).toBe(2)
  })
  it('書き出して読み込み直しても同じ結果', () => {
    const records: Records = {
      days: perfectDays('2026-10-10', '2026-12-31'),
      checkpoints: { 'diag-toefl': { values: { overall: 3 }, enteredAt: 1760500000000 } },
    }
    const restored = JSON.parse(JSON.stringify(records)) as Records
    expect(computeProgress(plan, restored)).toEqual(computeProgress(plan, records))
  })
})

describe('computeProgress: バッジ', () => {
  const earnedOn = (records: Records, id: string) => computeProgress(plan, records).badges.find((b) => b.id === id)?.earnedOn

  it('はじめの一歩と初めての ◎', () => {
    const records: Records = {
      days: { '2026-10-12': day(['vocab']), '2026-10-13': day(['vocab', 'listening', 'policy']) },
      checkpoints: {},
    }
    expect(earnedOn(records, 'first-check')).toBe('2026-10-12')
    expect(earnedOn(records, 'first-double')).toBe('2026-10-13')
  })
  it('週5日達成と4週連続', () => {
    const days: Records['days'] = {}
    // 4週続けて月〜金に最低ライン。3週目と4週目の間を空けない
    for (let w = 0; w < 4; w++) {
      for (let i = 0; i < 5; i++) days[addDays('2026-10-12', w * 7 + i)] = day(MIN)
    }
    const records = { days, checkpoints: {} }
    expect(earnedOn(records, 'week-target')).toBe('2026-10-16')
    expect(earnedOn(records, 'week-target-4')).toBe('2026-11-06')
  })
  it('週が途切れると連続はやり直し', () => {
    const days: Records['days'] = {}
    for (const w of [0, 1, 2, 4, 5, 6]) {
      for (let i = 0; i < 5; i++) days[addDays('2026-10-12', w * 7 + i)] = day(MIN)
    }
    expect(earnedOn({ days, checkpoints: {} }, 'week-target-4')).toBeNull()
  })
  it('累計時間はボーナスを除く', () => {
    const days = perfectDays('2026-10-10', '2026-10-25')
    const p = computeProgress(plan, { days, checkpoints: {} })
    const hours10 = p.badges.find((b) => b.id === 'hours-10')!
    expect(p.totalMinutes).toBeGreaterThanOrEqual(600)
    // 600分に届いた日を手で確かめる
    let sum = 0
    let reached: string | null = null
    for (const d of Object.keys(days).sort()) {
      sum += tasksForDate(plan, d).filter((t) => days[d]!.done.includes(t.id)).reduce((s, t) => s + t.minutes, 0)
      if (sum >= 600) {
        reached = d
        break
      }
    }
    expect(hours10.earnedOn).toBe(reached)
  })
  it('回数のバッジ: 英会話は eikaiwa の ID だけ、AI会話は m5 のタスク', () => {
    const days: Records['days'] = {}
    // 強化期の火・金 (英会話) を10回
    let d = '2026-11-10'
    for (let i = 0; i < 10; i++) {
      days[d] = day(['eikaiwa', 'eikaiwa-prep-review'])
      d = addDays(d, i % 2 === 0 ? 3 : 4)
    }
    const p = computeProgress(plan, { days, checkpoints: {} })
    expect(p.badges.find((b) => b.id === 'eikaiwa-10')?.earnedOn).not.toBeNull()
    expect(p.badges.find((b) => b.id === 'ai-20')?.earnedOn).toBeNull()
  })
  it('フェーズ到達', () => {
    const records: Records = { days: { '2026-11-09': day(['vocab']) }, checkpoints: {} }
    expect(earnedOn(records, 'phase-2')).toBe('2026-11-09')
    expect(earnedOn(records, 'phase-3')).toBeNull()
  })
  it('確認テストのバッジは入力した日', () => {
    const enteredAt = new Date('2026-12-27T21:00:00+09:00').getTime()
    const records: Records = { days: {}, checkpoints: { 'test-midterm': { values: { reading: 70 }, enteredAt } } }
    expect(earnedOn(records, 'midterm')).toBe('2026-12-27')
    expect(earnedOn(records, 'mock-1')).toBeNull()
  })
  it('チェックのない日は記録に数えない', () => {
    const records: Records = { days: { '2026-11-09': day([], { memo: 'メモだけ' }) }, checkpoints: {} }
    expect(earnedOn(records, 'first-check')).toBeNull()
    expect(earnedOn(records, 'phase-2')).toBeNull()
  })
})

describe('collectionEntries', () => {
  it('楽しみ枠を完了した日のメモだけを集める', () => {
    const records: Records = {
      days: {
        '2026-10-17': day(['fun'], { memo: 'The Diplomat S1E1', memoKind: 'fun' }),
        '2026-10-18': day(['vocab-review'], { memo: '見ていない', memoKind: 'fun' }),
        '2026-10-24': day(['fun'], { memo: ' The Diplomat S1E2 ', memoKind: 'fun' }),
        '2026-10-13': day(['policy'], { memo: 'MIC の記事', memoKind: 'policy' }),
      },
      checkpoints: {},
    }
    expect(collectionEntries(plan, records, 'fun')).toEqual([
      { date: '2026-10-24', memo: 'The Diplomat S1E2' },
      { date: '2026-10-17', memo: 'The Diplomat S1E1' },
    ])
    expect(collectionEntries(plan, records, 'policy')).toEqual([{ date: '2026-10-13', memo: 'MIC の記事' }])
  })
})

describe('matchedLevelRows', () => {
  const rowsOf = (checkpoints: Records['checkpoints']) =>
    matchedLevelRows(plan, checkpoints).map((i) => `${plan.levelTable[i]!.skill}:${plan.levelTable[i]!.condition}`)

  it('結果がなければ何も当てはまらない', () => {
    expect(rowsOf({})).toEqual([])
  })
  it('単語は Rank 1 と Rank 2 の組み合わせで決まる', () => {
    const vocab = (rank1: number, rank2: number) => ({ 'diag-vocab': { values: { rank1, rank2 }, enteredAt: 0 } })
    expect(rowsOf(vocab(70, 40))).toEqual(['vocab:Rank 1 の正答が80%未満'])
    expect(rowsOf(vocab(80, 79))).toEqual(['vocab:Rank 1 は80%以上、Rank 2 は80%未満'])
    expect(rowsOf(vocab(95, 85))).toEqual(['vocab:Rank 2 も80%以上'])
  })
  it('リスニングの境目 (50 と 70 は上の行)', () => {
    const l = (comprehension: number) => ({ 'diag-listening': { values: { comprehension }, enteredAt: 0 } })
    expect(rowsOf(l(49))).toEqual(['listening:初見理解度が50%未満'])
    expect(rowsOf(l(50))).toEqual(['listening:初見理解度が50〜70%'])
    expect(rowsOf(l(70))).toEqual(['listening:初見理解度が70%以上'])
  })
  it('スピーキングはいちばん新しい月末録音の語数', () => {
    expect(
      rowsOf({
        'rec-2026-10': { values: { words: 55 }, enteredAt: 0 },
        'rec-2026-11': { values: { words: 72 }, enteredAt: 0 },
      }),
    ).toEqual(['speaking:60秒で60〜90語'])
  })
})
