// 開発用: 木の成長過程を並べて確認する (#/dev/tree)
import { useState } from 'react'
import { plan } from '../plan/plan'
import { Tree, type TreeData } from '../ui/Tree'

// 計画をおよそ7割こなした場合の割合で、XP から木の材料を作る
const SKILL_SHARE: Record<string, number> = { vocab: 0.26, listening: 0.26, speaking: 0.2, policy: 0.1, fun: 0.12, toefl: 0.06 }

function sampleData(xp: number): TreeData {
  const minutes = xp * 0.85
  const minutesBySkill = Object.fromEntries(
    plan.skills.map((s) => {
      // TOEFL は仕上げ期 (5,000XP 以降) から
      const share = s.id === 'toefl' && xp < 5000 ? 0 : (SKILL_SHARE[s.id] ?? 0.1)
      return [s.id, Math.round(minutes * share)]
    }),
  )
  return {
    xp,
    minutesBySkill,
    leaves: Math.round(xp / 29),
    flowers: Math.round(xp / 150),
    fruits: xp === 0 ? 0 : Math.min(9, Math.round(xp / 1200) + 2),
  }
}

const STAGES = [0, 1000, 5000, 9500]

export function TreeDevScreen() {
  const [xp, setXp] = useState(3000)
  const [extraLeaves, setExtraLeaves] = useState(0)
  const [glow, setGlow] = useState(0)
  const custom = sampleData(xp)

  return (
    <div className="stack">
      <h1>木の成長過程 (開発用)</h1>
      <p className="small muted">葉は XP÷29、花は XP÷150、実は入力したテストの数の目安で作った見本です。</p>
      <div className="tree-stages">
        {STAGES.map((x) => {
          const d = sampleData(x)
          return (
            <figure key={x} className="card tree-stage">
              <Tree data={d} size={300} />
              <figcaption className="small">
                <strong>{x.toLocaleString()} XP</strong>
                <br />葉 {d.leaves}・花 {d.flowers}・実 {d.fruits}
              </figcaption>
            </figure>
          )
        })}
      </div>

      <section className="card stack">
        <h2>好きな XP で見る</h2>
        <label className="field">
          <span>
            {xp.toLocaleString()} XP (葉 {custom.leaves + extraLeaves})
          </span>
          <input type="range" min={0} max={16000} step={100} value={xp} onChange={(e) => setXp(Number(e.target.value))} />
        </label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="btn" onClick={() => setExtraLeaves((n) => n + 1)}>
            葉を1枚足す
          </button>
          <button type="button" className="btn" onClick={() => setGlow((g) => g + 1)}>
            レベルアップの演出
          </button>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <Tree data={{ ...custom, leaves: custom.leaves + extraLeaves }} size={360} glowKey={glow} />
        </div>
      </section>
    </div>
  )
}
