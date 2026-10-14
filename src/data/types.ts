// 保存する記録の形 (Firestore と端末内保存で共通)。計算結果は保存しない。
import type { IsoDate } from '../plan/types'

export type MemoKind = 'fun' | 'policy' | null

export interface DayRecord {
  /** 分類ごとのチェック数 (1チェック = plan.json の logging.unitMinutes 分) */
  units: Record<string, number>
  memo: string
  memoKind: MemoKind
  /** 最終更新 (ミリ秒)。統合時にメモの新しいほうを選ぶのに使う */
  updatedAt: number
}

export interface CheckpointRecord {
  values: Record<string, number | string>
  enteredAt: number
}

export type Theme = 'light' | 'dark' | 'system'

export interface Settings {
  dayBoundaryHour: number
  theme: Theme
}

export interface Records {
  days: Record<IsoDate, DayRecord>
  checkpoints: Record<string, CheckpointRecord>
}
