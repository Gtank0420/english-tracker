// 経験値・レベル・バッジ・実・コレクション。すべて保存済みの記録から毎回計算する。
import type { CheckpointRecord, MemoKind, Records } from '../data/types'
import type { IsoDate, Plan } from '../plan/types'
import { addDays, dateOfTimestamp, weekStart } from './date'
import { dayMark, minutesBySkillOf } from './marks'

// ---- レベル ----

/** 「レベル L に必要な累計XP = 係数 × (L − 1) × L」の係数。plan.json の examples から求める */
function levelCoefficient(plan: Plan): number {
  const [level, xp] = Object.entries(plan.gamification.level.examples)[0]!
  const L = Number(level)
  return xp / ((L - 1) * L)
}

export function xpForLevel(plan: Plan, level: number): number {
  return levelCoefficient(plan) * (level - 1) * level
}

export function levelForXp(plan: Plan, xp: number): number {
  let level = 1
  while (xpForLevel(plan, level + 1) <= xp) level++
  return level
}

export function titleForLevel(plan: Plan, level: number): string {
  const titles = [...plan.gamification.titles].sort((a, b) => a.fromLevel - b.fromLevel)
  let name = titles[0]?.name ?? ''
  for (const t of titles) if (level >= t.fromLevel) name = t.name
  return name
}

// ---- バッジ ----

// バッジ ID の形で判定を決める。数値は ID から読む
//   hours-50        ボーナスを除く学習時間の合計が50時間
//   speaking-10h    その分類の記録が累計10時間
//   week-target(-4) 週の達成 (4週連続)
//   phase-2         2番目のフェーズに入ってから記録した
const CHECKPOINT_BADGES: Record<string, string> = {
  midterm: 'test-midterm',
  'mock-1': 'test-mock1',
  'mock-2': 'test-mock2',
}

export interface BadgeStatus {
  id: string
  name: string
  rule: string
  /** 獲得した日。未獲得なら null */
  earnedOn: IsoDate | null
}

// ---- まとめて計算 ----

export interface Progress {
  /** ボーナスを除く学習時間 (分) */
  totalMinutes: number
  /** 分類ごとの学習時間 (分) */
  minutesBySkill: Record<string, number>
  /** チェックの数 (葉の数) */
  checks: number
  /** ◎ の日 (花の数) */
  doubleDays: IsoDate[]
  /** 週の達成を満たした週の初日 */
  weeksMet: IsoDate[]
  /** 結果を入力した test と diagnosis の数 (実の数) */
  fruits: number
  xp: number
  level: number
  title: string
  /** 今のレベルの下限と、次のレベルに必要な累計XP */
  levelStartXp: number
  nextLevelXp: number
  badges: BadgeStatus[]
}

export function computeProgress(plan: Plan, records: Records): Progress {
  const { perMinute, bonusDoubleCircleDay, bonusWeekTargetMet } = plan.gamification.xp
  const tz = plan.timezone
  const dates = Object.keys(records.days).sort()

  let totalMinutes = 0
  const minutesBySkill: Record<string, number> = Object.fromEntries(plan.skills.map((s) => [s.id, 0]))
  const doubleDays: IsoDate[] = []
  const weeksMet: IsoDate[] = []
  const markedInWeek = new Map<IsoDate, number>()

  // 判定の途中経過から、各バッジの獲得日を記録する
  const earned = new Map<string, IsoDate>()
  const earn = (id: string, date: IsoDate) => {
    if (!earned.has(id)) earned.set(id, date)
  }
  let firstCheck: IsoDate | null = null
  let firstDouble: IsoDate | null = null
  let streak = 0
  let streakDates: IsoDate[] = [] // 連続 n 週目を初めて達成した日 (index = n-1)

  for (const date of dates) {
    const units = records.days[date]!.units
    const dayBySkill = minutesBySkillOf(plan, units)
    const minutes = Object.values(dayBySkill).reduce((a, b) => a + b, 0)
    if (minutes === 0) continue

    firstCheck ??= date
    totalMinutes += minutes
    for (const [skill, m] of Object.entries(dayBySkill)) minutesBySkill[skill]! += m

    const mark = dayMark(plan, units)
    if (mark === 'double') {
      doubleDays.push(date)
      firstDouble ??= date
    }
    if (mark) {
      const ws = weekStart(date, plan.markRules.weekStartsOn)
      const n = (markedInWeek.get(ws) ?? 0) + 1
      markedInWeek.set(ws, n)
      if (n === plan.markRules.weekTargetDays) {
        const prev = weeksMet[weeksMet.length - 1]
        streak = prev && addDays(prev, 7) === ws ? streak + 1 : 1
        weeksMet.push(ws)
        if (streak > streakDates.length) streakDates = [...streakDates, date]
      }
    }

    // その日までの累計で決まるバッジ
    for (const badge of plan.gamification.badges) {
      if (earned.has(badge.id)) continue
      const skillHours = /^(.+)-(\d+)h$/.exec(badge.id)
      if (skillHours) {
        if ((minutesBySkill[skillHours[1]!] ?? 0) >= Number(skillHours[2]) * 60) earn(badge.id, date)
        continue
      }
      const m = /^(.*)-(\d+)$/.exec(badge.id)
      const prefix = m?.[1]
      const num = m ? Number(m[2]) : NaN
      if (prefix === 'hours' && totalMinutes >= num * 60) earn(badge.id, date)
      else if (prefix === 'phase') {
        const phase = plan.phases[num - 1]
        if (phase && date >= phase.start) earn(badge.id, date)
      }
    }
  }

  const fruits = Object.keys(records.checkpoints).filter((id) => {
    const type = plan.checkpoints.find((c) => c.id === id)?.type
    return type === 'test' || type === 'diagnosis'
  }).length

  const xp = totalMinutes * perMinute + doubleDays.length * bonusDoubleCircleDay + weeksMet.length * bonusWeekTargetMet
  const level = levelForXp(plan, xp)

  const badges: BadgeStatus[] = plan.gamification.badges.map((b) => {
    let earnedOn: IsoDate | null = earned.get(b.id) ?? null
    if (b.id === 'first-check') earnedOn = firstCheck
    else if (b.id === 'first-double') earnedOn = firstDouble
    else if (b.id === 'week-target') earnedOn = streakDates[0] ?? null
    else if (b.id.startsWith('week-target-')) {
      const n = Number(b.id.slice('week-target-'.length))
      earnedOn = streakDates[n - 1] ?? null
    } else if (CHECKPOINT_BADGES[b.id]) {
      const rec = records.checkpoints[CHECKPOINT_BADGES[b.id]!]
      earnedOn = rec ? dateOfTimestamp(rec.enteredAt, tz) : null
    }
    return { id: b.id, name: b.name, rule: b.rule, earnedOn }
  })

  return {
    totalMinutes,
    minutesBySkill,
    checks: totalMinutes / plan.logging.unitMinutes,
    doubleDays,
    weeksMet,
    fruits,
    xp,
    level,
    title: titleForLevel(plan, level),
    levelStartXp: xpForLevel(plan, level),
    nextLevelXp: xpForLevel(plan, level + 1),
    badges,
  }
}

// ---- コレクション ----

export interface CollectionEntry {
  date: IsoDate
  memo: string
}

/** 1行メモを「見た作品」(fun) や「読んだ政策記事」(policy) として残した日。新しい順 */
export function collectionEntries(records: Records, kind: Exclude<MemoKind, null>): CollectionEntry[] {
  return Object.entries(records.days)
    .filter(([, day]) => day.memoKind === kind && day.memo.trim())
    .map(([date, day]) => ({ date, memo: day.memo.trim() }))
    .sort((a, b) => (a.date < b.date ? 1 : -1))
}

// ---- レベル表の自動判定 ----

/** 確認テストの結果に当てはまるレベル表の行の番号 */
export function matchedLevelRows(plan: Plan, checkpoints: Readonly<Record<string, CheckpointRecord>>): number[] {
  const valueOf = (m: { checkpoint?: string; checkpointType?: string; key: string }): number | null => {
    let ids: string[] = []
    if (m.checkpoint) ids = [m.checkpoint]
    else if (m.checkpointType) {
      // 同じ種類が複数あるときは、日付がいちばん新しい結果を使う
      ids = plan.checkpoints
        .filter((c) => c.type === m.checkpointType)
        .sort((a, b) => (a.date < b.date ? 1 : -1))
        .map((c) => c.id)
    }
    for (const id of ids) {
      const v = checkpoints[id]?.values[m.key]
      if (typeof v === 'number' && Number.isFinite(v)) return v
    }
    return null
  }

  const rows: number[] = []
  plan.levelTable.forEach((row, i) => {
    if (!row.match?.length) return
    const ok = row.match.every((m) => {
      const v = valueOf(m)
      if (v === null) return false
      if (m.min !== undefined && v < m.min) return false
      if (m.max !== undefined && v >= m.max) return false
      return true
    })
    if (ok) rows.push(i)
  })
  return rows
}
