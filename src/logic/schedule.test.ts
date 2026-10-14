import { describe, expect, it } from 'vitest'
import { plan } from '../plan/plan'
import { checkpointsOn, nextCheckpoint, phaseFor } from './schedule'

describe('phaseFor', () => {
  it('各フェーズの境目', () => {
    expect(phaseFor(plan, '2026-10-10').phase?.id).toBe('p1')
    expect(phaseFor(plan, '2026-11-08').phase?.id).toBe('p1')
    expect(phaseFor(plan, '2026-11-09').phase?.id).toBe('p2')
    expect(phaseFor(plan, '2027-02-07').phase?.id).toBe('p2')
    expect(phaseFor(plan, '2027-02-08').phase?.id).toBe('p3')
    expect(phaseFor(plan, '2027-03-31').phase?.id).toBe('p3')
  })
  it('期間前は p1、期間後は完走', () => {
    expect(phaseFor(plan, '2026-10-01')).toMatchObject({ status: 'before', phase: { id: 'p1' } })
    expect(phaseFor(plan, '2027-04-01')).toEqual({ status: 'after', phase: null })
  })
})

describe('確認テストの日付', () => {
  it('当日のテストは 0 日後', () => {
    expect(nextCheckpoint(plan, '2026-10-16')).toMatchObject({ checkpoint: { id: 'diag-listening' }, daysLeft: 0 })
  })
  it('次のテストまでの日数', () => {
    expect(nextCheckpoint(plan, '2026-10-13')).toMatchObject({ checkpoint: { id: 'diag-listening' }, daysLeft: 3 })
    expect(nextCheckpoint(plan, '2027-03-29')).toBeNull()
  })
  it('同じ日に複数あるとき', () => {
    expect(checkpointsOn(plan, '2026-12-27').map((c) => c.id)).toEqual(['test-midterm', 'rec-2026-12'])
  })
})
