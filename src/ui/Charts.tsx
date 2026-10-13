// 記録画面のグラフ。技能は色だけでなく名前を必ず添える
import { useState } from 'react'
import { plan } from '../plan/plan'

export function formatMinutes(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `${m}分`
  return m === 0 ? `${h}時間` : `${h}時間${m}分`
}

/** 技能ごとの累計時間 (横棒)。棒ごとに技能名と値を直接書く */
export function SkillBars({ minutesBySkill }: { minutesBySkill: Record<string, number> }) {
  const max = Math.max(1, ...Object.values(minutesBySkill))
  return (
    <ul className="skill-bars">
      {plan.skills.map((s) => {
        const min = minutesBySkill[s.id] ?? 0
        return (
          <li key={s.id} title={`${s.name}: ${formatMinutes(min)}`}>
            <span className="skill-bars-label">{s.name}</span>
            <span className="skill-bars-track" aria-hidden="true">
              {min > 0 && <span style={{ width: `${(min / max) * 100}%`, background: s.color }} />}
            </span>
            <span className="skill-bars-value">{formatMinutes(min)}</span>
          </li>
        )
      })}
    </ul>
  )
}

export interface TrendPoint {
  label: string
  value: number
}

/** 1つの量の推移 (折れ線)。2つの量を1つの軸に重ねない */
export function TrendChart({ title, unit, points }: { title: string; unit: string; points: TrendPoint[] }) {
  const [hover, setHover] = useState<number | null>(null)
  const W = 320
  const H = 150
  const pad = { l: 34, r: 16, t: 16, b: 28 }
  const max = Math.max(1, ...points.map((p) => p.value))
  // 目盛りは切りのよい数に
  const step = max <= 5 ? 1 : max <= 20 ? 5 : max <= 60 ? 10 : max <= 150 ? 25 : 50
  const top = Math.ceil(max / step) * step
  const ticks = Array.from({ length: Math.floor(top / step) + 1 }, (_, i) => i * step)
  const x = (i: number) => (points.length <= 1 ? (pad.l + W - pad.r) / 2 : pad.l + (i * (W - pad.l - pad.r)) / (points.length - 1))
  const y = (v: number) => H - pad.b - (v / top) * (H - pad.t - pad.b)
  const last = points.length - 1

  return (
    <figure className="trend">
      <figcaption>
        {title}
        <span className="muted small">（{unit}）</span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}の推移: ${points.map((p) => `${p.label} ${p.value}`).join('、')}`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--rule)" strokeWidth={1} />
            <text x={pad.l - 6} y={y(t) + 4} textAnchor="end" className="axis-text">
              {t}
            </text>
          </g>
        ))}
        {points.map((p, i) => (
          <text key={p.label} x={x(i)} y={H - 8} textAnchor="middle" className="axis-text">
            {p.label}
          </text>
        ))}
        {points.length > 1 && (
          <polyline
            points={points.map((p, i) => `${x(i)},${y(p.value)}`).join(' ')}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}
        {points.map((p, i) => (
          <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onClick={() => setHover(i)}>
            {/* 当たり判定は点より大きく */}
            <circle cx={x(i)} cy={y(p.value)} r={16} fill="transparent" />
            <circle cx={x(i)} cy={y(p.value)} r={hover === i ? 6 : 4.5} fill="var(--accent)" stroke="var(--surface)" strokeWidth={2} />
            {(i === last || hover === i) && (
              <text x={x(i)} y={y(p.value) - 10} textAnchor="middle" className="value-text">
                {p.value}
              </text>
            )}
          </g>
        ))}
      </svg>
    </figure>
  )
}
