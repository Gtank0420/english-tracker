import { describe, expect, it } from 'vitest'
import { computeProgress } from '../logic/progress'
import { plan } from '../plan/plan'
import { buildExport, mergeRecords, parseExport } from './merge'
import type { DayRecord, Records } from './types'

const day = (units: Record<string, number>, memo = '', updatedAt = 1, memoKind: DayRecord['memoKind'] = null): DayRecord => ({
  units,
  memo,
  memoKind,
  updatedAt,
})

describe('mergeRecords', () => {
  it('チェック数は分類ごとに多いほう、メモは新しいほう', () => {
    const cloud: Records = { days: { '2026-10-12': day({ vocab: 3, speaking: 1 }, 'クラウド', 100) }, checkpoints: {} }
    const local: Records = { days: { '2026-10-12': day({ vocab: 2, listening: 2 }, '端末', 200) }, checkpoints: {} }
    expect(mergeRecords(cloud, local).days['2026-10-12']).toEqual(day({ vocab: 3, speaking: 1, listening: 2 }, '端末', 200))
  })
  it('新しいほうのメモが空なら、古いほうのメモを残す', () => {
    const a: Records = { days: { '2026-10-17': day({ listening: 3 }, 'The Diplomat', 100, 'fun') }, checkpoints: {} }
    const b: Records = { days: { '2026-10-17': day({ vocab: 1 }, '', 200) }, checkpoints: {} }
    expect(mergeRecords(a, b).days['2026-10-17']).toMatchObject({ memo: 'The Diplomat', memoKind: 'fun', updatedAt: 200 })
  })
  it('片方にしかない日はそのまま。確認テストは base を優先', () => {
    const base: Records = {
      days: { '2026-10-10': day({ vocab: 1 }) },
      checkpoints: { 'diag-vocab': { values: { rank1: 80 }, enteredAt: 1 } },
    }
    const inc: Records = {
      days: { '2026-10-11': day({ listening: 3 }) },
      checkpoints: { 'diag-vocab': { values: { rank1: 50 }, enteredAt: 2 }, 'diag-toefl': { values: { overall: 3 }, enteredAt: 3 } },
    }
    const m = mergeRecords(base, inc)
    expect(Object.keys(m.days).sort()).toEqual(['2026-10-10', '2026-10-11'])
    expect(m.checkpoints['diag-vocab']!.values.rank1).toBe(80)
    expect(m.checkpoints['diag-toefl']).toBeDefined()
  })
})

describe('書き出しと読み込み', () => {
  const records: Records = {
    days: {
      '2026-10-10': day({ vocab: 2, listening: 6, speaking: 2 }, 'The Diplomat', 5, 'fun'),
      '2026-10-12': day({ vocab: 2, listening: 3, speaking: 2 }),
    },
    checkpoints: { 'test-midterm': { values: { reading: 70, weakest: 'Build a Sentence' }, enteredAt: 1766800000000 } },
  }
  const settings = { dayBoundaryHour: 3, theme: 'system' as const }

  it('書き出して読み込み直すと同じ記録と同じ計算結果', () => {
    const text = JSON.stringify(buildExport(records, settings))
    const r = parseExport(text)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.records).toEqual(records)
    expect(r.settings).toEqual(settings)
    expect(computeProgress(plan, r.records)).toEqual(computeProgress(plan, records))
  })
  it('壊れたファイルは受け付けない', () => {
    expect(parseExport('{not json').ok).toBe(false)
    expect(parseExport(JSON.stringify({ app: 'other', days: {}, checkpoints: {} })).ok).toBe(false)
    const bad = (patch: object) => parseExport(JSON.stringify({ ...buildExport(records, settings), ...patch }))
    expect(bad({ days: { '2026-10-10': { units: { vocab: 'two' } } } }).ok).toBe(false)
    expect(bad({ days: { '2026-10-10': { units: { vocab: -1 } } } }).ok).toBe(false)
    expect(bad({ days: { '2026-10-10': { done: 'vocab' } } }).ok).toBe(false)
    expect(bad({ days: { '10/10': day({ vocab: 1 }) } }).ok).toBe(false)
    expect(bad({ days: { '2026-10-10': { ...day({}), memoKind: 'movie' } } }).ok).toBe(false)
    expect(bad({ checkpoints: { x: { values: { a: [1] }, enteredAt: 1 } } }).ok).toBe(false)
    expect(bad({ settings: { dayBoundaryHour: 9 } }).ok).toBe(false)
  })
  it('足りない項目は既定値で補う', () => {
    const r = parseExport(JSON.stringify({ app: 'english-tracker', days: { '2026-10-10': { units: { vocab: 1 } } }, checkpoints: {} }))
    expect(r.ok && r.records.days['2026-10-10']).toEqual(day({ vocab: 1 }, '', 0))
  })
  it('旧版の書き出しファイル (タスクの完了リスト) も読み込める', () => {
    const old = {
      app: 'english-tracker',
      exportedAt: '2026-10-13T00:00:00Z',
      days: { '2026-10-12': { done: ['vocab', 'listening', 'speech'], memo: 'メモ', memoKind: null, updatedAt: 9 } },
      checkpoints: {},
      settings: { dayBoundaryHour: 3, theme: 'system' },
    }
    const r = parseExport(JSON.stringify(old))
    expect(r.ok && r.records.days['2026-10-12']).toEqual(day({ vocab: 2, listening: 3, speaking: 2 }, 'メモ', 9))
  })
})
