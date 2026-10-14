// 今日の画面
import { useStore } from '../data/store'
import { navigate } from '../hooks/useHashRoute'
import { useProgress } from '../hooks/useProgress'
import { weekProgress } from '../logic/marks'
import { checkpointsOn, nextCheckpoint, phaseFor } from '../logic/schedule'
import { plan } from '../plan/plan'
import type { IsoDate } from '../plan/types'
import { Tree, treeDataOf } from '../ui/Tree'
import { DayLog, formatDate, MemoField } from './DayLog'

export function TodayScreen({ today }: { today: IsoDate }) {
  const { records } = useStore()
  const { progress, glowKey } = useProgress()

  const phase = phaseFor(plan, today)
  const unitsByDate = Object.fromEntries(Object.entries(records.days).map(([d, r]) => [d, r.units]))
  const week = weekProgress(plan, today, unitsByDate)
  const next = nextCheckpoint(plan, today)
  const todaysCheckpoints = checkpointsOn(plan, today)

  const levelSpan = progress.nextLevelXp - progress.levelStartXp
  const levelRatio = levelSpan > 0 ? (progress.xp - progress.levelStartXp) / levelSpan : 0

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
            {next && next.daysLeft > 0 && (
              <span className="small muted" style={{ display: 'block' }}>
                {next.checkpoint.title}
              </span>
            )}
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

      {phase.status === 'after' && (
        <section className="card">
          <h2>計画を完走しました</h2>
          <p>入省までの計画はここまでです。これからも記録を続けられます。</p>
        </section>
      )}

      <section className="card" aria-labelledby="log-title">
        <div className="card-title">
          <h2 id="log-title">今日の記録</h2>
          <span className="small muted">1つ {plan.logging.unitMinutes}分</span>
        </div>
        <DayLog date={today} />
      </section>

      <section className="card">
        <MemoField key={today} date={today} />
      </section>
    </div>
  )
}
