// 記録画面: 大きな木、カレンダー、累計時間、バッジ、コレクション、確認テストの結果
import { useState } from 'react'
import { emptyDay, setTaskDone, useStore } from '../data/store'
import type { MemoKind } from '../data/types'
import { useProgress } from '../hooks/useProgress'
import { addDays, weekStart } from '../logic/date'
import { completedTasks, dayMark } from '../logic/marks'
import { COLLECTION_KINDS, collectionEntries } from '../logic/progress'
import { checkpointsOn, isInPeriod, minimumTasks, tasksForDate } from '../logic/schedule'
import { plan } from '../plan/plan'
import type { IsoDate } from '../plan/types'
import { formatMinutes, SkillBars, TrendChart } from '../ui/Charts'
import { BackIcon, ChevronIcon } from '../ui/Icons'
import { Sheet } from '../ui/Sheet'
import { Tree, treeDataOf } from '../ui/Tree'
import { fieldsOf, formatValue } from './CheckpointForm'
import { formatDate, MarkBadge, MemoField, TaskRow } from './TodayScreen'

const WEEK_HEAD = ['月', '火', '水', '木', '金', '土', '日']

function monthOf(date: IsoDate) {
  return date.slice(0, 7)
}
function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(Date.UTC(y!, m! - 1 + delta, 1))
  return d.toISOString().slice(0, 7)
}

/** 過去の日のタスクをチェックし直す */
function DayEditor({ date }: { date: IsoDate }) {
  const { records } = useStore()
  const done = (records.days[date] ?? emptyDay()).done
  const tasks = tasksForDate(plan, date)
  const groups = [
    { label: null, tasks: tasks.filter((t) => !t.optional) },
    { label: 'おまけ', tasks: tasks.filter((t) => t.optional) },
    { label: '最低ライン', tasks: minimumTasks(plan) },
  ]
  const eligibleKinds = [
    ...new Set(
      completedTasks(plan, date, done)
        .map((t) => t.skill)
        .filter((s): s is Exclude<MemoKind, null> => s === 'fun' || s === 'policy'),
    ),
  ]
  return (
    <div className="stack">
      <h2>{formatDate(date)}</h2>
      <div>
        {groups.map(
          (g) =>
            g.tasks.length > 0 && (
              <div key={g.label ?? 'main'}>
                {g.label && <p className="section-label">{g.label}</p>}
                <ul className="task-list">
                  {g.tasks.map((t) => (
                    <TaskRow key={t.id} task={t} checked={done.includes(t.id)} onToggle={(c) => setTaskDone(date, t.id, c)} />
                  ))}
                </ul>
              </div>
            ),
        )}
      </div>
      <MarkBadge date={date} done={done} />
      <MemoField key={date} date={date} eligibleKinds={eligibleKinds} />
    </div>
  )
}

function Calendar({ today, onPick }: { today: IsoDate; onPick: (d: IsoDate) => void }) {
  const { records } = useStore()
  const first = monthOf(plan.period.start)
  const last = monthOf(plan.period.end > today ? plan.period.end : today)
  const initial = monthOf(today) < first ? first : monthOf(today) > last ? last : monthOf(today)
  const [month, setMonth] = useState(initial)

  const start = weekStart(`${month}-01`)
  const end = addDays(`${shiftMonth(month, 1)}-01`, -1)
  const cells: IsoDate[] = []
  for (let d = start; d <= end || cells.length % 7 !== 0; d = addDays(d, 1)) cells.push(d)
  const [y, m] = month.split('-').map(Number)

  return (
    <div className="calendar">
      <div className="calendar-nav">
        <button type="button" className="btn btn-quiet" onClick={() => setMonth(shiftMonth(month, -1))} disabled={month <= first} aria-label="前の月">
          <BackIcon />
        </button>
        <h3 aria-live="polite">
          {y}年{m}月
        </h3>
        <button type="button" className="btn btn-quiet" onClick={() => setMonth(shiftMonth(month, 1))} disabled={month >= last} aria-label="次の月">
          <ChevronIcon />
        </button>
      </div>
      <div className="calendar-grid" role="grid" aria-label={`${y}年${m}月の記録`}>
        {WEEK_HEAD.map((w) => (
          <span key={w} className="calendar-head" role="columnheader">
            {w}
          </span>
        ))}
        {cells.map((d) => {
          const inMonth = monthOf(d) === month
          if (!inMonth) return <span key={d} className="calendar-cell is-outside" aria-hidden="true" />
          const mark = dayMark(plan, d, records.days[d]?.done ?? [])
          const editable = isInPeriod(plan, d) && d <= today
          const hasCheckpoint = checkpointsOn(plan, d).length > 0
          const label = `${formatDate(d)}${mark === 'double' ? ' ◎' : mark === 'circle' ? ' ○' : ''}${hasCheckpoint ? ' 確認テスト' : ''}`
          return (
            <button
              key={d}
              type="button"
              className={`calendar-cell${mark ? ` mark-${mark}` : ''}${d === today ? ' is-today' : ''}`}
              disabled={!editable}
              onClick={() => onPick(d)}
              aria-label={label}
            >
              <span className="calendar-day">{Number(d.slice(8))}</span>
              <span className="calendar-mark" aria-hidden="true">
                {mark === 'double' ? '◎' : mark === 'circle' ? '○' : hasCheckpoint ? '·' : ''}
              </span>
            </button>
          )
        })}
      </div>
      <p className="small muted calendar-legend">
        <span className="legend-swatch mark-circle">○</span> 印のある日 <span className="legend-swatch mark-double">◎</span> 標準をすべて終えた日
        ・ 過去の日を押すとチェックし直せます
      </p>
    </div>
  )
}

export function RecordScreen({ today }: { today: IsoDate }) {
  const { records } = useStore()
  const { progress, glowKey } = useProgress()
  const [picked, setPicked] = useState<IsoDate | null>(null)

  const collections = plan.gamification.collections.map((c) => ({
    ...c,
    entries: COLLECTION_KINDS[c.id] ? collectionEntries(plan, records, COLLECTION_KINDS[c.id]!) : [],
  }))
  const recordings = plan.checkpoints
    .filter((c) => c.type === 'recording' && records.checkpoints[c.id])
    .sort((a, b) => (a.date < b.date ? -1 : 1))
  const monthLabel = (d: IsoDate) => `${Number(d.slice(5, 7))}月`
  const trend = (key: string) =>
    recordings
      .map((c) => ({ label: monthLabel(c.date), value: records.checkpoints[c.id]!.values[key] }))
      .filter((p): p is { label: string; value: number } => typeof p.value === 'number')
  const results = plan.checkpoints.filter((c) => c.type !== 'recording' && records.checkpoints[c.id])
  const earnedCount = progress.badges.filter((b) => b.earnedOn).length

  return (
    <div className="stack">
      <h1>記録</h1>

      <section className="card stack" aria-label="育つ木">
        <div className="tree-big">
          <Tree data={treeDataOf(progress)} size={360} glowKey={glowKey} minSpan={240} />
        </div>
        <div className="stats">
          <div>
            <span className="stat-label">レベル</span>
            <span className="stat-value">
              Lv.{progress.level} {progress.title}
            </span>
          </div>
          <div>
            <span className="stat-label">累計</span>
            <span className="stat-value">{progress.xp.toLocaleString()} XP</span>
          </div>
          <div>
            <span className="stat-label">葉・花・実</span>
            <span className="stat-value">
              {progress.completedCount}・{progress.doubleDays.length}・{progress.fruits}
            </span>
          </div>
          <div>
            <span className="stat-label">週5日の達成</span>
            <span className="stat-value">{progress.weeksMet.length} 週</span>
          </div>
        </div>
        <p className="small muted">葉はタスク1つ、花は ◎ の日、実は確認テストと診断の結果1つにつき増えます。</p>
      </section>

      <section className="card" aria-label="カレンダー">
        <Calendar today={today} onPick={setPicked} />
      </section>

      <section className="card stack" aria-labelledby="time-title">
        <div className="card-title" style={{ marginBottom: 0 }}>
          <h2 id="time-title">学習時間</h2>
          <span className="stat-value">{formatMinutes(progress.totalMinutes)}</span>
        </div>
        <SkillBars minutesBySkill={progress.minutesBySkill} />
        <p className="small muted">振り返りの時間は合計にだけ入ります。ボーナスの XP は含みません。</p>
      </section>

      <section className="card stack" aria-labelledby="badge-title">
        <div className="card-title" style={{ marginBottom: 0 }}>
          <h2 id="badge-title">バッジ</h2>
          <span className="small muted">
            {earnedCount} / {progress.badges.length}
          </span>
        </div>
        <ul className="badges">
          {progress.badges.map((b) => (
            <li key={b.id} className={b.earnedOn ? 'badge is-earned' : 'badge'}>
              <svg viewBox="0 0 40 40" width={40} height={40} aria-hidden="true" className="badge-icon">
                <path d="M13 26l-4 11 6-3 4 5 2-10M27 26l4 11-6-3-4 5-2-10" className="badge-ribbon" />
                <circle cx="20" cy="17" r="12" className="badge-medal" />
                {b.earnedOn && <path d="M14.5 17.5l3.5 3.5 7-7" className="badge-check" />}
              </svg>
              <span className="badge-text">
                <strong>{b.name}</strong>
                <span className="small muted">{b.earnedOn ? `${formatDate(b.earnedOn)} に獲得` : b.rule}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      {collections.map((c) => (
        <section key={c.id} className="card stack" aria-labelledby={`col-${c.id}`}>
          <div className="card-title" style={{ marginBottom: 0 }}>
            <h2 id={`col-${c.id}`}>{c.name}</h2>
            <span className="small muted">{c.entries.length} 件</span>
          </div>
          {c.entries.length === 0 ? (
            <p className="small muted">{c.source}がここに集まります。</p>
          ) : (
            <ul className="collection">
              {c.entries.map((e) => (
                <li key={e.date}>
                  <span className="small muted">{formatDate(e.date)}</span>
                  <span>{e.memo}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}

      <section className="card stack" aria-labelledby="result-title">
        <h2 id="result-title">確認テストの結果</h2>
        {results.length === 0 && recordings.length === 0 && (
          <p className="small muted">計画画面の「確認テスト」から結果を入力すると、ここに並びます。</p>
        )}
        {results.map((c) => (
          <div key={c.id} className="cp-item">
            <div className="cp-head">
              <span className="small muted">{formatDate(c.date)}</span>
              <strong>{c.title}</strong>
            </div>
            <dl className="cp-values">
              {fieldsOf(c).map((f) => (
                <div key={f.key}>
                  <dt>{f.label}</dt>
                  <dd>{formatValue(f, records.checkpoints[c.id]!.values[f.key])}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
        {recordings.length > 0 && (
          <div className="stack">
            <h3>月末の録音</h3>
            <div className="trends">
              <TrendChart title="60秒の語数" unit="3問の平均" points={trend('words')} />
              <TrendChart title="3秒以上の沈黙" unit="回・3問の平均" points={trend('pauses')} />
            </div>
            <p className="small muted">目標: {plan.recordingCheck.target}</p>
          </div>
        )}
      </section>

      {picked && (
        <Sheet label={`${formatDate(picked)}の記録`} onClose={() => setPicked(null)}>
          <DayEditor date={picked} />
        </Sheet>
      )}
    </div>
  )
}
