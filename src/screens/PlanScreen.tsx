// 計画画面: ロードマップ、週間スケジュール、レベル表、確認テスト
import { useEffect, useState } from 'react'
import { useStore } from '../data/store'
import { replaceRoute } from '../hooks/useHashRoute'
import { diffDays } from '../logic/date'
import { matchedLevelRows } from '../logic/progress'
import { phaseFor } from '../logic/schedule'
import { plan } from '../plan/plan'
import type { IsoDate, WeekdayKey } from '../plan/types'
import { Sheet } from '../ui/Sheet'
import { SkillTag } from '../ui/SkillTag'
import { CheckpointForm, fieldsOf, formatValue } from './CheckpointForm'

const WEEKDAYS: [WeekdayKey, string][] = [
  ['mon', '月'],
  ['tue', '火'],
  ['wed', '水'],
  ['thu', '木'],
  ['fri', '金'],
  ['sat', '土'],
  ['sun', '日'],
]
const TYPE_LABEL = { diagnosis: '診断', test: '確認テスト', recording: '録音' } as const

const shortDate = (d: IsoDate) => d.replace(/^\d{4}-0?(\d+)-0?(\d+)$/, '$1/$2')

function Roadmap({ today }: { today: IsoDate }) {
  const total = diffDays(plan.period.start, plan.period.end) + 1
  const pos = (d: IsoDate) => Math.min(100, Math.max(0, (diffDays(plan.period.start, d) / total) * 100))
  const todayIn = today >= plan.period.start && today <= plan.period.end
  const dates = [...new Set(plan.checkpoints.map((c) => c.date))].sort()

  return (
    <div className="roadmap">
      <div className="roadmap-band">
        {plan.phases.map((p, i) => (
          <div
            key={p.id}
            className={`roadmap-phase tone-${i % 3}`}
            style={{ width: `${((diffDays(p.start, p.end) + 1) / total) * 100}%` }}
          >
            <strong>{p.name}</strong>
            <span className="small">{shortDate(p.start)}〜</span>
            <span className="small">{shortDate(p.end)}</span>
          </div>
        ))}
        {todayIn && (
          <div className="roadmap-today" style={{ left: `${pos(today)}%` }}>
            <span>今日</span>
          </div>
        )}
      </div>
      <div className="roadmap-ticks" aria-hidden="true">
        {dates.map((d) => (
          <span key={d} style={{ left: `${pos(d)}%` }} />
        ))}
      </div>
      <ul className="roadmap-dates">
        {dates.map((d) => (
          <li key={d} className={d < today ? 'muted' : undefined}>
            <strong>{shortDate(d)}</strong>{' '}
            {plan.checkpoints
              .filter((c) => c.date === d)
              .map((c) => TYPE_LABEL[c.type])
              .join('・')}
          </li>
        ))}
      </ul>
    </div>
  )
}

function WeekTable({ phaseId }: { phaseId: string }) {
  const week = plan.schedule[phaseId]
  if (!week) return null
  return (
    <table className="week-table">
      <thead>
        <tr>
          <th scope="col">曜日</th>
          <th scope="col">タスクと時間</th>
          <th scope="col" className="num">
            合計
          </th>
        </tr>
      </thead>
      <tbody>
        {WEEKDAYS.map(([key, ja]) => {
          const tasks = week[key] ?? []
          const sum = tasks.filter((t) => !t.optional).reduce((s, t) => s + t.minutes, 0)
          return (
            <tr key={key}>
              <th scope="row">{ja}</th>
              <td>
                <ul>
                  {tasks.map((t) => (
                    <li key={t.id} className={t.optional ? 'muted' : undefined}>
                      {t.optional && 'おまけ: '}
                      {t.label} <span className="nowrap">{t.minutes}分</span>
                    </li>
                  ))}
                </ul>
              </td>
              <td className="num">{sum}分</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

export function PlanScreen({ today, checkpointId }: { today: IsoDate; checkpointId?: string }) {
  const { records } = useStore()
  const current = phaseFor(plan, today)
  const [phaseId, setPhaseId] = useState(current.phase?.id ?? plan.phases[0]!.id)
  const [openId, setOpenId] = useState<string | null>(null)
  const matched = matchedLevelRows(plan, records.checkpoints)

  // #/plan/cp/{id} で開かれたら、その確認テストの入力を開く
  useEffect(() => {
    if (checkpointId) {
      setOpenId(checkpointId)
      replaceRoute('plan')
    }
  }, [checkpointId])

  const open = plan.checkpoints.find((c) => c.id === openId)
  const sorted = [...plan.checkpoints].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))

  return (
    <div className="stack">
      <h1>計画</h1>
      <section className="card stack" aria-labelledby="roadmap-title">
        <h2 id="roadmap-title">{plan.title}</h2>
        <Roadmap today={today} />
        {current.phase && (
          <p className="small">
            いまは<strong>{current.phase.name}</strong>: {current.phase.description}
          </p>
        )}
      </section>

      <section className="card stack" aria-labelledby="week-title">
        <h2 id="week-title">週間スケジュール</h2>
        <fieldset className="seg">
          <legend>時期</legend>
          {plan.phases.map((p) => (
            <label key={p.id}>
              <input type="radio" name="week-phase" checked={phaseId === p.id} onChange={() => setPhaseId(p.id)} />
              <span>{p.name}</span>
            </label>
          ))}
        </fieldset>
        <WeekTable phaseId={phaseId} />
        <p className="small muted">合計はおまけを除いた時間です。</p>
      </section>

      <section className="card stack" aria-labelledby="cp-title">
        <h2 id="cp-title">確認テスト</h2>
        <ul className="cp-list">
          {sorted.map((c) => {
            const saved = records.checkpoints[c.id]
            const days = diffDays(today, c.date)
            return (
              <li key={c.id} className="cp-item">
                <div className="cp-head">
                  <span className="small muted">
                    {shortDate(c.date)}・{TYPE_LABEL[c.type]}
                    {!saved && days > 0 && `・あと${days}日`}
                    {!saved && days === 0 && '・今日'}
                  </span>
                  <strong>{c.title}</strong>
                </div>
                <p className="small">{c.type === 'recording' ? plan.recordingCheck.howTo : c.howTo}</p>
                {(c.target || c.type === 'recording') && (
                  <p className="small muted">目標: {c.target ?? plan.recordingCheck.target}</p>
                )}
                {c.onResult && <p className="small muted">結果に応じて: {c.onResult}</p>}
                {saved && (
                  <dl className="cp-values">
                    {fieldsOf(c).map((f) => (
                      <div key={f.key}>
                        <dt>{f.label}</dt>
                        <dd>{formatValue(f, saved.values[f.key])}</dd>
                      </div>
                    ))}
                  </dl>
                )}
                <button type="button" className={saved ? 'btn' : 'btn btn-primary'} onClick={() => setOpenId(c.id)}>
                  {saved ? '結果を見る・直す' : '結果を入力'}
                </button>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="card stack" aria-labelledby="level-title">
        <h2 id="level-title">レベル表</h2>
        <p className="small muted">確認テストの結果を入れると、当てはまる行に「いまここ」と印がつきます。</p>
        {plan.skills
          .filter((s) => plan.levelTable.some((r) => r.skill === s.id))
          .map((s) => (
            <div key={s.id} className="stack" style={{ gap: 4 }}>
              <SkillTag skill={s.id} />
              <table className="level-table">
                <thead>
                  <tr>
                    <th scope="col">こうなら</th>
                    <th scope="col">こうする</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.levelTable.map((row, i) =>
                    row.skill !== s.id ? null : (
                      <tr key={i} className={matched.includes(i) ? 'is-match' : undefined}>
                        <td>
                          {matched.includes(i) && <strong>いまここ: </strong>}
                          {row.condition}
                        </td>
                        <td>{row.action}</td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          ))}
      </section>

      {open && (
        <Sheet label={`${open.title}の結果`} onClose={() => setOpenId(null)}>
          <CheckpointForm checkpoint={open} />
        </Sheet>
      )}
    </div>
  )
}
