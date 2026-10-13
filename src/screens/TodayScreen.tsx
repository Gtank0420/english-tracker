// 今日の画面
import { useEffect, useRef, useState } from 'react'
import { emptyDay, setMemo, setTaskDone, useStore } from '../data/store'
import type { MemoKind } from '../data/types'
import { weekdayKey } from '../logic/date'
import { completedTasks, dayMark, weekProgress } from '../logic/marks'
import { COLLECTION_KINDS, matchedLevelRows } from '../logic/progress'
import { checkpointsOn, minimumTasks, nextCheckpoint, phaseFor, tasksForDate, type DayTask } from '../logic/schedule'
import { plan } from '../plan/plan'
import type { IsoDate } from '../plan/types'
import { CheckIcon, ChevronIcon } from '../ui/Icons'
import { Sheet } from '../ui/Sheet'
import { SkillTag } from '../ui/SkillTag'
import { MenuDetail } from './MenuDetail'
import { useProgress } from '../hooks/useProgress'
import { navigate } from '../hooks/useHashRoute'
import { Tree, treeDataOf } from '../ui/Tree'

const WEEKDAY_JA = { mon: '月', tue: '火', wed: '水', thu: '木', fri: '金', sat: '土', sun: '日' } as const

export function formatDate(date: IsoDate): string {
  const [, m, d] = date.split('-').map(Number)
  return `${m}月${d}日 (${WEEKDAY_JA[weekdayKey(date)]})`
}

// 「最低ラインだけ」はその日のうちだけ覚えておく
const MINIMUM_KEY = 'minimumModeDate'
function readMinimumMode(date: IsoDate): boolean {
  try {
    return localStorage.getItem(MINIMUM_KEY) === date
  } catch {
    return false
  }
}
function writeMinimumMode(date: IsoDate, on: boolean) {
  try {
    if (on) localStorage.setItem(MINIMUM_KEY, date)
    else localStorage.removeItem(MINIMUM_KEY)
  } catch {
    // 保存できなくても切り替え自体は効く
  }
}

export function TaskRow({
  task,
  checked,
  onToggle,
  onOpen,
}: {
  task: DayTask
  checked: boolean
  onToggle: (checked: boolean) => void
  onOpen?: () => void
}) {
  const inputId = `task-${task.id}`
  return (
    <li className={`task${checked ? ' is-done' : ''}`}>
      <label className="check" htmlFor={inputId}>
        <input id={inputId} type="checkbox" checked={checked} onChange={(e) => onToggle(e.target.checked)} />
        <span className="box">
          <CheckIcon />
        </span>
        <span className="visually-hidden">{task.label}を完了</span>
      </label>
      <button type="button" className="task-body" onClick={onOpen} disabled={!onOpen}>
        <span className="task-text">
          <span className="task-label">{task.label}</span>
          <span className="task-meta">
            <span>{task.minutes}分</span>
            <SkillTag skill={task.skill} />
          </span>
        </span>
        {onOpen && (
          <span className="chevron">
            <ChevronIcon />
            <span className="visually-hidden">手順を見る</span>
          </span>
        )}
      </button>
    </li>
  )
}

export function MarkBadge({ date, done }: { date: IsoDate; done: string[] }) {
  const mark = dayMark(plan, date, done)
  if (!mark) return null
  return (
    <div className="day-mark">
      <span className={`mark-symbol ${mark}`}>{mark === 'double' ? '◎' : '○'}</span>
      <span>{mark === 'double' ? '標準のタスクをすべて終えました' : '今日の印がつきました'}</span>
    </div>
  )
}

export function MemoField({ date, eligibleKinds }: { date: IsoDate; eligibleKinds: Exclude<MemoKind, null>[] }) {
  const { records } = useStore()
  const day = records.days[date] ?? emptyDay()
  const [draft, setDraft] = useState(day.memo)
  // undefined はまだ選んでいない状態 (null は「ふつうのメモ」を選んだ状態)
  const [kind, setKind] = useState<MemoKind | undefined>(day.memo ? day.memoKind : undefined)
  const timer = useRef<number | undefined>(undefined)

  // まだ選んでいなければ、完了した楽しみ枠か政策英語のコレクションを初期値にする
  const effectiveKind: MemoKind = kind !== undefined ? kind : eligibleKinds.length === 1 ? eligibleKinds[0]! : null

  const save = (memo: string, k: MemoKind) => {
    window.clearTimeout(timer.current)
    setMemo(date, memo, memo.trim() ? k : null)
  }
  const onChange = (memo: string) => {
    setDraft(memo)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => save(memo, effectiveKind), 800)
  }

  const kindName = (k: Exclude<MemoKind, null>) =>
    plan.gamification.collections.find((c) => COLLECTION_KINDS[c.id] === k)?.name ?? k
  const placeholder =
    effectiveKind === 'fun' ? '例: The Diplomat シーズン1 第3話' : effectiveKind === 'policy' ? '例: 読んだ記事の見出し' : '今日のひとこと'

  return (
    <div className="field">
      <label htmlFor="memo">{effectiveKind ? `${kindName(effectiveKind)}を1行で` : '1行メモ'}</label>
      <input
        id="memo"
        className="input"
        type="text"
        value={draft}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => save(draft, effectiveKind)}
        enterKeyHint="done"
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      />
      {eligibleKinds.length > 0 && (
        <fieldset className="seg">
          <legend>メモの残し方</legend>
          {[null, ...eligibleKinds].map((k) => (
            <label key={k ?? 'plain'}>
              <input
                type="radio"
                name="memo-kind"
                checked={effectiveKind === k}
                onChange={() => {
                  setKind(k)
                  if (draft.trim()) save(draft, k)
                }}
              />
              <span>{k ? `${kindName(k)}に残す` : 'ふつうのメモ'}</span>
            </label>
          ))}
        </fieldset>
      )}
    </div>
  )
}

export function TodayScreen({ today }: { today: IsoDate }) {
  const { records } = useStore()
  const [minimumMode, setMinimumMode] = useState(() => readMinimumMode(today))
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)

  useEffect(() => setMinimumMode(readMinimumMode(today)), [today])

  const phase = phaseFor(plan, today)
  const day = records.days[today] ?? emptyDay()
  const done = day.done
  const doneByDate = Object.fromEntries(Object.entries(records.days).map(([d, r]) => [d, r.done]))
  const week = weekProgress(plan, today, doneByDate)
  const { progress, glowKey } = useProgress()
  const next = nextCheckpoint(plan, today)
  const todaysCheckpoints = checkpointsOn(plan, today)

  const tasks = tasksForDate(plan, today)
  const standard = tasks.filter((t) => !t.optional)
  const optional = tasks.filter((t) => t.optional)
  const minimum = minimumTasks(plan)
  const minimumDone = minimum.filter((t) => done.includes(t.id))
  const minimumTotal = minimum.reduce((s, t) => s + t.minutes, 0)

  const eligibleKinds = [
    ...new Set(
      completedTasks(plan, today, done)
        .map((t) => t.skill)
        .filter((s): s is 'fun' | 'policy' => s === 'fun' || s === 'policy'),
    ),
  ]

  const levelSpan = progress.nextLevelXp - progress.levelStartXp
  const levelRatio = levelSpan > 0 ? (progress.xp - progress.levelStartXp) / levelSpan : 0
  const openMenu = plan.menus.find((m) => m.id === openMenuId)

  const row = (t: DayTask) => (
    <TaskRow
      key={t.id}
      task={t}
      checked={done.includes(t.id)}
      onToggle={(c) => setTaskDone(today, t.id, c)}
      onOpen={t.menuId ? () => setOpenMenuId(t.menuId) : undefined}
    />
  )

  return (
    <div className="stack">
      <header className="card today-head">
        <div className="today-date">
          <h1>{formatDate(today)}</h1>
          <span className="phase-name">
            {phase.status === 'after' ? '計画を完走しました' : `${phase.phase.name}・${phase.phase.focus}`}
          </span>
        </div>
        <div className="today-level">
          <button type="button" className="mini-tree" onClick={() => navigate('record')} aria-label="記録画面で木を見る">
            <Tree data={treeDataOf(progress)} size={112} glowKey={glowKey} minSpan={130} />
          </button>
          <div className="level-info">
            <span className="stat-label">レベルと称号</span>
            <span className="stat-value">
              Lv.{progress.level} {progress.title}
            </span>
            <div
              className="bar"
              role="progressbar"
              aria-label="次のレベルまで"
              aria-valuemin={0}
              aria-valuemax={levelSpan}
              aria-valuenow={progress.xp - progress.levelStartXp}
            >
              <span style={{ width: `${Math.round(levelRatio * 100)}%` }} />
            </div>
            <span className="small muted">
              累計 {progress.xp.toLocaleString()} XP・次のレベルまで {(progress.nextLevelXp - progress.xp).toLocaleString()} XP
            </span>
          </div>
        </div>
        <div className="stats" style={{ marginTop: 4 }}>
          <div>
            <span className="stat-label">今週の印</span>
            <span className="stat-value">
              {week.markedDays} / {week.target} 日
            </span>
          </div>
          <div>
            <span className="stat-label">次の確認テスト</span>
            <span className="stat-value">{next ? (next.daysLeft === 0 ? '今日' : `あと ${next.daysLeft} 日`) : 'なし'}</span>
            {next && next.daysLeft > 0 && <span className="small muted" style={{ display: 'block' }}>{next.checkpoint.title}</span>}
          </div>
        </div>
      </header>

      {todaysCheckpoints.map((c) => {
        const entered = records.checkpoints[c.id]
        return (
          <section key={c.id} className="card checkpoint-card" aria-label="今日の確認テスト">
            <span className="stat-label">今日は確認テストの日</span>
            <h2>{c.title}</h2>
            <p>{c.type === 'recording' ? plan.recordingCheck.howTo : c.howTo}</p>
            {(c.target || c.type === 'recording') && (
              <p className="small muted">目標: {c.target ?? plan.recordingCheck.target}</p>
            )}
            <button
              type="button"
              className={entered ? 'btn' : 'btn btn-primary'}
              style={{ marginTop: 8 }}
              onClick={() => navigate(`plan/cp/${c.id}`)}
            >
              {entered ? '入力した結果を見る' : '結果を入力する'}
            </button>
          </section>
        )
      })}

      {phase.status === 'after' ? (
        <section className="card">
          <h2>計画を完走しました</h2>
          <p>入省までの計画はここまでです。記録画面でこれまでの歩みを振り返れます。</p>
        </section>
      ) : (
        <section className="card" aria-labelledby="tasks-title">
          <div className="card-title">
            <h2 id="tasks-title">今日のタスク</h2>
          </div>
          <label className="switch">
            <span>
              最低ラインだけ
              <span className="small muted" style={{ display: 'block' }}>
                {minimum.length}項目・{minimumTotal}分
              </span>
            </span>
            <input
              type="checkbox"
              role="switch"
              checked={minimumMode}
              onChange={(e) => {
                setMinimumMode(e.target.checked)
                writeMinimumMode(today, e.target.checked)
              }}
            />
            <span className="track" aria-hidden="true" />
          </label>

          <ul className="task-list">{(minimumMode ? minimum : standard).map(row)}</ul>

          {!minimumMode && optional.length > 0 && (
            <>
              <p className="section-label">おまけ</p>
              <ul className="task-list">{optional.map(row)}</ul>
            </>
          )}
          {!minimumMode && minimumDone.length > 0 && (
            <>
              <p className="section-label">最低ライン</p>
              <ul className="task-list">{minimumDone.map(row)}</ul>
            </>
          )}

          <div style={{ marginTop: 12 }} aria-live="polite">
            <MarkBadge date={today} done={done} />
          </div>
        </section>
      )}

      {phase.status !== 'after' && (
        <section className="card">
          <MemoField key={today} date={today} eligibleKinds={eligibleKinds} />
        </section>
      )}

      {openMenu && (
        <Sheet label={openMenu.name} onClose={() => setOpenMenuId(null)}>
          <MenuDetail menu={openMenu} highlightRows={matchedLevelRows(plan, records.checkpoints)} />
        </Sheet>
      )}
    </div>
  )
}
