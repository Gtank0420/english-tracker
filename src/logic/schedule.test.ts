import { describe, expect, it } from 'vitest'
import { plan } from '../plan/plan'
import { nextCheckpoint, phaseFor, tasksForDate } from './schedule'

const ids = (date: string) => tasksForDate(plan, date).map((t) => t.id)

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

describe('tasksForDate (受け入れ条件)', () => {
  it('2026-10-12 (月) は再起動期の月曜', () => {
    expect(ids('2026-10-12')).toEqual(['vocab', 'listening', 'speech'])
  })
  it('2026-11-10 (火) は強化期の火曜', () => {
    expect(ids('2026-11-10')).toEqual(['vocab', 'eikaiwa', 'eikaiwa-prep-review', 'my-deck'])
  })
  it('2027-02-13 (土) は模試が入った仕上げ期の土曜', () => {
    const tasks = tasksForDate(plan, '2027-02-13')
    expect(tasks.map((t) => t.id)).toEqual(['vocab', 'fun', 'mock'])
    expect(tasks.find((t) => t.id === 'mock')).toMatchObject({ minutes: 120, skill: 'toefl', optional: false })
  })
  it('模試のない仕上げ期の土曜は弱い形式の演習', () => {
    expect(ids('2027-02-20')).toEqual(['vocab', 'weak-practice', 'fun'])
  })
  it('技能はメニューから引き、振り返りは技能なし', () => {
    const sun = tasksForDate(plan, '2026-10-11')
    expect(sun.find((t) => t.id === 'vocab-review')?.skill).toBe('vocab')
    expect(sun.find((t) => t.id === 'weekly-review')?.skill).toBeNull()
    expect(sun.find((t) => t.id === 'fun')?.optional).toBe(true)
  })
  it('期間後はタスクなし', () => {
    expect(ids('2027-04-01')).toEqual([])
  })
})

describe('nextCheckpoint', () => {
  it('当日のテストは 0 日後', () => {
    expect(nextCheckpoint(plan, '2026-10-16')).toMatchObject({ checkpoint: { id: 'diag-listening' }, daysLeft: 0 })
  })
  it('次のテストまでの日数', () => {
    expect(nextCheckpoint(plan, '2026-10-13')).toMatchObject({ checkpoint: { id: 'diag-listening' }, daysLeft: 3 })
    expect(nextCheckpoint(plan, '2027-03-29')).toBeNull()
  })
})
