import { describe, expect, it } from 'vitest'
import { computeProgress } from '../logic/progress'
import { plan } from '../plan/plan'
import { buildExport, mergeRecords, parseExport } from './merge'
import type { DayRecord, Records } from './types'

const day = (done: string[], memo = '', updatedAt = 1, memoKind: DayRecord['memoKind'] = null): DayRecord => ({
  done,
  memo,
  memoKind,
  updatedAt,
})

describe('mergeRecords', () => {
  it('完了リストは和集合、メモは新しいほう', () => {
    const cloud: Records = { days: { '2026-10-12': day(['vocab'], 'クラウド', 100) }, checkpoints: {} }
    const local: Records = { days: { '2026-10-12': day(['listening', 'vocab'], '端末', 200) }, checkpoints: {} }
    expect(mergeRecords(cloud, local).days['2026-10-12']).toEqual(day(['vocab', 'listening'], '端末', 200))
  })
  it('新しいほうのメモが空なら、古いほうのメモを残す', () => {
    const a: Records = { days: { '2026-10-17': day(['fun'], 'The Diplomat', 100, 'fun') }, checkpoints: {} }
    const b: Records = { days: { '2026-10-17': day(['vocab'], '', 200) }, checkpoints: {} }
    expect(mergeRecords(a, b).days['2026-10-17']).toMatchObject({ memo: 'The Diplomat', memoKind: 'fun', updatedAt: 200 })
  })
  it('片方にしかない日はそのまま。確認テストは base を優先', () => {
    const base: Records = {
      days: { '2026-10-10': day(['vocab']) },
      checkpoints: { 'diag-vocab': { values: { rank1: 80 }, enteredAt: 1 } },
    }
    const inc: Records = {
      days: { '2026-10-11': day(['fun']) },
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
      '2026-10-10': day(['vocab', 'long-listening', 'summary-speech', 'fun'], 'The Diplomat', 5, 'fun'),
      '2026-10-12': day(['vocab', 'listening', 'speech']),
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
    expect(bad({ days: { '2026-10-10': { done: 'vocab' } } }).ok).toBe(false)
    expect(bad({ days: { '10/10': day(['vocab']) } }).ok).toBe(false)
    expect(bad({ days: { '2026-10-10': { ...day([]), memoKind: 'movie' } } }).ok).toBe(false)
    expect(bad({ checkpoints: { x: { values: { a: [1] }, enteredAt: 1 } } }).ok).toBe(false)
    expect(bad({ settings: { dayBoundaryHour: 9 } }).ok).toBe(false)
  })
  it('足りない項目は既定値で補う', () => {
    const r = parseExport(JSON.stringify({ app: 'english-tracker', days: { '2026-10-10': { done: ['vocab'] } }, checkpoints: {} }))
    expect(r.ok && r.records.days['2026-10-10']).toEqual(day(['vocab'], '', 0))
  })
})
