// 記録の統合と、書き出しファイルの検証 (画面や保存先に依存しない)
import { plan } from '../plan/plan'
import { unitsFromLegacyDone } from './legacy'
import type { CheckpointRecord, DayRecord, MemoKind, Records, Settings, Theme } from './types'

/** 日付ごとに統合する。チェック数は分類ごとに多いほう、メモは新しいほう。確認テストは base を優先 */
export function mergeRecords(base: Records, incoming: Records): Records {
  const days: Records['days'] = { ...base.days }
  for (const [date, inc] of Object.entries(incoming.days)) {
    const cur = days[date]
    days[date] = cur ? mergeDay(cur, inc) : inc
  }
  return { days, checkpoints: { ...incoming.checkpoints, ...base.checkpoints } }
}

export function mergeDay(a: DayRecord, b: DayRecord): DayRecord {
  const newer = b.updatedAt > a.updatedAt ? b : a
  // 片方のメモが空なら、もう片方を残す
  const memoSource = newer.memo.trim() ? newer : a.memo.trim() ? a : b
  const units: Record<string, number> = { ...a.units }
  for (const [skill, n] of Object.entries(b.units)) units[skill] = Math.max(units[skill] ?? 0, n)
  return {
    units,
    memo: memoSource.memo,
    memoKind: memoSource.memoKind,
    updatedAt: Math.max(a.updatedAt, b.updatedAt),
  }
}

export function isEmptyRecords(r: Records): boolean {
  return Object.keys(r.days).length === 0 && Object.keys(r.checkpoints).length === 0
}

// ---- 書き出しファイル ----

export const APP_ID = 'english-tracker'

/** 書き出しファイルの形の版。2 から分類ごとのチェック数 (units) */
export const EXPORT_VERSION = 2

export interface ExportFile {
  app: typeof APP_ID
  version: number
  exportedAt: string
  days: Records['days']
  checkpoints: Records['checkpoints']
  settings: Settings
}

export function buildExport(records: Records, settings: Settings, now = new Date()): ExportFile {
  return { app: APP_ID, version: EXPORT_VERSION, exportedAt: now.toISOString(), days: records.days, checkpoints: records.checkpoints, settings }
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const THEMES: Theme[] = ['light', 'dark', 'system']
const MEMO_KINDS: MemoKind[] = ['fun', 'policy', null]

/** 旧版 (タスクの完了リスト done) の形か */
export function isLegacyDay(v: unknown): boolean {
  return isObject(v) && v.units === undefined && v.done !== undefined
}

function parseUnits(v: unknown): Record<string, number> | null {
  if (!isObject(v)) return null
  const out: Record<string, number> = {}
  for (const [k, n] of Object.entries(v)) {
    if (typeof n !== 'number' || !Number.isInteger(n) || n < 0) return null
    if (n > 0) out[k] = n
  }
  return out
}

/** Firestore や書き出しファイルの1日分を DayRecord に整える。旧版の形は変換する。形が違えば null */
export function parseDay(v: unknown, date: string): DayRecord | null {
  if (!isObject(v)) return null
  let units: Record<string, number> | null
  if (isLegacyDay(v)) {
    const done = v.done
    if (!Array.isArray(done) || !done.every((x) => typeof x === 'string')) return null
    units = unitsFromLegacyDone(date, done as string[], plan.logging.unitMinutes)
  } else {
    units = parseUnits(v.units ?? {})
  }
  if (!units) return null
  const memo = v.memo ?? ''
  if (typeof memo !== 'string') return null
  const memoKind = (v.memoKind ?? null) as MemoKind
  if (!MEMO_KINDS.includes(memoKind)) return null
  const updatedAt = v.updatedAt ?? 0
  if (typeof updatedAt !== 'number' || !Number.isFinite(updatedAt)) return null
  return { units, memo, memoKind, updatedAt }
}

export function parseCheckpoint(v: unknown): CheckpointRecord | null {
  if (!isObject(v) || !isObject(v.values)) return null
  const values = v.values
  if (!Object.values(values).every((x) => typeof x === 'string' || (typeof x === 'number' && Number.isFinite(x)))) return null
  if (typeof v.enteredAt !== 'number' || !Number.isFinite(v.enteredAt)) return null
  return { values: values as CheckpointRecord['values'], enteredAt: v.enteredAt }
}

export function parseSettings(v: unknown): Partial<Settings> | null {
  if (v === undefined) return {}
  if (!isObject(v)) return null
  const out: Partial<Settings> = {}
  if (v.dayBoundaryHour !== undefined) {
    const h = v.dayBoundaryHour
    if (typeof h !== 'number' || !Number.isInteger(h) || h < 0 || h > 5) return null
    out.dayBoundaryHour = h
  }
  if (v.theme !== undefined) {
    if (!THEMES.includes(v.theme as Theme)) return null
    out.theme = v.theme as Theme
  }
  return out
}

export type ParseResult =
  | { ok: true; records: Records; settings: Partial<Settings> }
  | { ok: false; error: string }

/** 書き出しファイルを検証する。1か所でも壊れていれば全体を受け付けない */
export function parseExport(text: string): ParseResult {
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    return { ok: false, error: 'JSON として読めないファイルです' }
  }
  if (!isObject(json) || json.app !== APP_ID) return { ok: false, error: 'このアプリの書き出しファイルではありません' }
  if (!isObject(json.days) || !isObject(json.checkpoints)) return { ok: false, error: '記録の形が正しくありません' }

  const days: Records['days'] = {}
  for (const [date, v] of Object.entries(json.days)) {
    const day = DATE_RE.test(date) ? parseDay(v, date) : null
    if (!day) return { ok: false, error: `${date} の記録が壊れています` }
    days[date] = day
  }
  const checkpoints: Records['checkpoints'] = {}
  for (const [id, v] of Object.entries(json.checkpoints)) {
    const cp = parseCheckpoint(v)
    if (!cp) return { ok: false, error: `確認テスト ${id} の記録が壊れています` }
    checkpoints[id] = cp
  }
  const settings = parseSettings(json.settings)
  if (!settings) return { ok: false, error: '設定の形が正しくありません' }
  return { ok: true, records: { days, checkpoints }, settings }
}
