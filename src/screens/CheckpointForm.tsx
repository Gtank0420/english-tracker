// 確認テストの結果の入力。resultFields からフォームを作る
import { useState } from 'react'
import { deleteCheckpoint, saveCheckpoint, useStore } from '../data/store'
import { matchedLevelRows } from '../logic/progress'
import { plan } from '../plan/plan'
import type { Checkpoint, ResultField } from '../plan/types'
import { SkillTag } from '../ui/SkillTag'
import { useToast } from '../ui/Toast'

const BANDS = Array.from({ length: 11 }, (_, i) => (1 + i * 0.5).toFixed(1))

export function fieldsOf(c: Checkpoint): ResultField[] {
  return c.type === 'recording' ? plan.recordingCheck.resultFields : (c.resultFields ?? [])
}

export function formatValue(field: ResultField, v: number | string | undefined): string {
  if (v === undefined || v === '') return '—'
  if (field.kind === 'band' && typeof v === 'number') return v.toFixed(1)
  if (field.kind === 'percent') return `${v}%`
  return String(v)
}

/** このテストの結果で判定できるレベル表の行 */
function relatedRows(c: Checkpoint): number[] {
  return plan.levelTable
    .map((row, i) => ({ row, i }))
    .filter(({ row }) => row.match?.some((m) => m.checkpoint === c.id || m.checkpointType === c.type))
    .map(({ i }) => i)
}

export function CheckpointForm({ checkpoint: c }: { checkpoint: Checkpoint }) {
  const { records } = useStore()
  const toast = useToast()
  const saved = records.checkpoints[c.id]
  const fields = fieldsOf(c)
  const [draft, setDraft] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      fields.map((f) => {
        const v = saved?.values[f.key]
        if (v === undefined) return [f.key, '']
        return [f.key, f.kind === 'band' && typeof v === 'number' ? v.toFixed(1) : String(v)]
      }),
    ),
  )
  const [error, setError] = useState<string | null>(null)

  const submit = () => {
    const values: Record<string, number | string> = {}
    for (const f of fields) {
      const raw = (draft[f.key] ?? '').trim()
      if (!raw) continue
      if (f.kind === 'text') {
        values[f.key] = raw
        continue
      }
      const n = Number(raw)
      const bad =
        !Number.isFinite(n) ||
        n < (f.kind === 'band' ? 1 : 0) ||
        (f.kind === 'band' && n > 6) ||
        (f.kind === 'percent' && n > 100)
      if (bad) {
        setError(`「${f.label}」の値を確かめてください`)
        return
      }
      values[f.key] = n
    }
    if (Object.keys(values).length === 0) {
      setError('少なくとも1つ入力してください')
      return
    }
    setError(null)
    saveCheckpoint(c.id, values)
    toast('結果を保存しました')
  }

  // 保存済みの結果でレベル表を判定する
  const related = relatedRows(c)
  const matched = matchedLevelRows(plan, records.checkpoints).filter((i) => related.includes(i))

  return (
    <div className="stack">
      <header>
        <span className="stat-label">{c.date.replace(/^\d{4}-0?(\d+)-0?(\d+)$/, '$1月$2日')}</span>
        <h2>{c.title}</h2>
      </header>
      <p>{c.type === 'recording' ? plan.recordingCheck.howTo : c.howTo}</p>
      {(c.target || c.type === 'recording') && <p className="small muted">目標: {c.target ?? plan.recordingCheck.target}</p>}

      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        {fields.map((f) => {
          const id = `cp-${c.id}-${f.key}`
          const set = (v: string) => setDraft((d) => ({ ...d, [f.key]: v }))
          return (
            <div className="field" key={f.key}>
              <label htmlFor={id}>{f.label}</label>
              {f.kind === 'band' ? (
                <select id={id} className="input" value={draft[f.key]} onChange={(e) => set(e.target.value)}>
                  <option value="">未入力</option>
                  {BANDS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              ) : f.kind === 'text' ? (
                <input id={id} className="input" type="text" value={draft[f.key]} onChange={(e) => set(e.target.value)} />
              ) : (
                <input
                  id={id}
                  className="input"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={f.kind === 'percent' ? 100 : undefined}
                  step={f.kind === 'percent' ? 1 : 0.1}
                  value={draft[f.key]}
                  onChange={(e) => set(e.target.value)}
                />
              )}
            </div>
          )
        })}
        {error && (
          <p role="alert" className="banner">
            {error}
          </p>
        )}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="submit" className="btn btn-primary">
            {saved ? '結果を直す' : '結果を保存'}
          </button>
          {saved && (
            <button
              type="button"
              className="btn btn-quiet"
              onClick={() => {
                if (window.confirm('この結果を消しますか?')) {
                  deleteCheckpoint(c.id)
                  setDraft(Object.fromEntries(fields.map((f) => [f.key, ''])))
                }
              }}
            >
              結果を消す
            </button>
          )}
        </div>
      </form>

      {saved && (
        <section className="card stack" aria-label="結果に応じてやること">
          {c.onResult && (
            <div className="note">
              <span className="note-label">結果に応じてやること</span>
              {c.onResult}
            </div>
          )}
          {matched.length > 0 && (
            <div className="stack" style={{ gap: 8 }}>
              <h3>次はこの素材・この型</h3>
              {matched.map((i) => {
                const row = plan.levelTable[i]!
                return (
                  <div key={i} className="note is-match">
                    <SkillTag skill={row.skill} />
                    <span className="note-label">{row.condition}</span>
                    <strong>{row.action}</strong>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
