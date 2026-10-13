// 育つ木 (SVG)。形は固定シードの乱数で決めるので、同じ記録なら毎回同じ形になる。
import { useEffect, useRef } from 'react'
import { plan } from '../plan/plan'

export interface TreeData {
  xp: number
  /** 技能ごとの累計時間 (分) */
  minutesBySkill: Record<string, number>
  leaves: number
  flowers: number
  fruits: number
}

// 見た目の目安。約9,500XP (Lv20) で画面いっぱいの木になる
const FULL_XP = 9500
const FULL_SKILL_MINUTES = 2000
const MAX_LEAVES = 300
const MAX_FLOWERS = 120
const W = 400
const H = 400
const GROUND = 362

/** 固定シードの乱数 (mulberry32) */
function random(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
const clampTo = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))

interface Pt {
  x: number
  y: number
}

/** 2次ベジェ曲線上の点と接線 */
function onCurve(p0: Pt, c: Pt, p1: Pt, t: number): { p: Pt; angle: number } {
  const u = 1 - t
  const p = { x: u * u * p0.x + 2 * u * t * c.x + t * t * p1.x, y: u * u * p0.y + 2 * u * t * c.y + t * t * p1.y }
  const dx = 2 * u * (c.x - p0.x) + 2 * t * (p1.x - c.x)
  const dy = 2 * u * (c.y - p0.y) + 2 * t * (p1.y - c.y)
  return { p, angle: Math.atan2(dy, dx) }
}

interface Limb {
  p0: Pt
  c: Pt
  p1: Pt
  width: number
  color: string
  /** 葉をつける量の重み */
  weight: number
}

export function buildTree(data: TreeData) {
  const growth = clamp01(data.xp / FULL_XP)
  // 序盤の伸びが見えるよう、成長は平方根に近い曲線にする
  const s = Math.pow(growth, 0.6)
  const base: Pt = { x: W / 2, y: GROUND }
  const trunkH = 40 + 170 * s
  const trunkW = 3.5 + 22 * s
  const top: Pt = { x: base.x + 6 * s, y: GROUND - trunkH }
  const trunkCtrl: Pt = { x: base.x - 14 * s, y: GROUND - trunkH * 0.55 }

  const trunkPath = (() => {
    const half = trunkW / 2
    const topHalf = Math.max(1.2, half * 0.35)
    // 根元を少し広げた、先細りの幹
    return [
      `M ${base.x - half * 1.5} ${GROUND}`,
      `Q ${trunkCtrl.x - half * 0.8} ${trunkCtrl.y} ${top.x - topHalf} ${top.y}`,
      `L ${top.x + topHalf} ${top.y}`,
      `Q ${trunkCtrl.x + half * 0.8} ${trunkCtrl.y} ${base.x + half * 1.5} ${GROUND}`,
      'Z',
    ].join(' ')
  })()

  // 枝: 技能ごとに1本。幹の高いほうへ左右交互に出す
  const rnd = random(20261010)
  const limbs: Limb[] = []
  const branchInfo: { skill: string; color: string; length: number }[] = []
  const n = plan.skills.length
  plan.skills.forEach((skill, i) => {
    const side = i % 2 === 0 ? -1 : 1
    const along = 0.42 + (0.5 * i) / Math.max(1, n - 1) + (rnd() - 0.5) * 0.05
    const start = onCurve(base, trunkCtrl, top, Math.min(0.97, along)).p
    const minutes = data.minutesBySkill[skill.id] ?? 0
    const f = Math.sqrt(clamp01(minutes / FULL_SKILL_MINUTES))
    const length = (14 + 135 * s) * (minutes > 0 ? 0.18 + 0.82 * f : 0)
    // 上の枝ほど立ち上がる
    const angle = (-Math.PI / 2) + side * (1.25 - 0.75 * (i / Math.max(1, n - 1)) + (rnd() - 0.5) * 0.15)
    const end = { x: start.x + Math.cos(angle) * length, y: start.y + Math.sin(angle) * length }
    const bend = (rnd() - 0.3) * 0.35 * length
    const c = {
      x: (start.x + end.x) / 2 - Math.sin(angle) * bend * side,
      y: (start.y + end.y) / 2 - Math.abs(Math.cos(angle)) * bend * 0.6 - length * 0.12,
    }
    branchInfo.push({ skill: skill.id, color: skill.color, length })
    if (length <= 0) return
    const width = 1.3 + trunkW * 0.26 * (0.4 + 0.6 * f)
    limbs.push({ p0: start, c, p1: end, width, color: skill.color, weight: 1 + length / 40 })
    // 小枝 (技能の色のまま細く)
    const twigs = length > 40 ? 2 : length > 22 ? 1 : 0
    for (let k = 0; k < twigs; k++) {
      const t = 0.45 + 0.3 * k + rnd() * 0.1
      const { p, angle: a } = onCurve(start, c, end, t)
      const ta = a + (k % 2 === 0 ? -1 : 1) * (0.5 + rnd() * 0.3)
      const tl = length * (0.3 + rnd() * 0.15)
      const tp = { x: p.x + Math.cos(ta) * tl, y: p.y + Math.sin(ta) * tl }
      limbs.push({
        p0: p,
        c: { x: (p.x + tp.x) / 2, y: (p.y + tp.y) / 2 - tl * 0.15 },
        p1: tp,
        width: Math.max(1, width * 0.45),
        color: skill.color,
        weight: 0.6 + tl / 50,
      })
    }
  })
  // 幹の先端も葉をつける場所にする
  const crownTip: Pt = { x: top.x + 4, y: top.y - 10 - 40 * s }
  const crownLimb: Limb = { p0: onCurve(base, trunkCtrl, top, 0.85).p, c: top, p1: crownTip, width: 0, color: '', weight: 1.4 }
  const leafLimbs = [...limbs, crownLimb]
  const totalWeight = leafLimbs.reduce((sum, l) => sum + l.weight, 0)

  const pickLimb = (r: number) => {
    let acc = r * totalWeight
    for (const l of leafLimbs) {
      acc -= l.weight
      if (acc <= 0) return l
    }
    return leafLimbs[leafLimbs.length - 1]!
  }

  // 葉: 1枚ごとに番号から決めた乱数で置くので、増えても既存の葉は動かない
  const leafCount = Math.min(data.leaves, MAX_LEAVES)
  // 上限を超えたぶんは葉の大きさで表す
  const overflow = clamp01((data.leaves - MAX_LEAVES) / 900)
  const leafSize = (7 + 8 * s) * (1 + 0.45 * overflow)
  const spread = 6 + 26 * s
  const leaves = Array.from({ length: leafCount }, (_, i) => {
    const r = random(7919 * (i + 1))
    const limb = pickLimb(r())
    const t = 0.3 + 0.7 * Math.sqrt(r())
    const { p, angle } = onCurve(limb.p0, limb.c, limb.p1, t)
    const off = (r() - 0.5) * 2 * spread * (0.4 + 0.6 * t)
    const x = clampTo(p.x - Math.sin(angle) * off + (r() - 0.5) * 6, 14, W - 14)
    const y = clampTo(p.y + Math.cos(angle) * off + (r() - 0.5) * 6, 14, GROUND - 8)
    const rot = (angle * 180) / Math.PI + (r() - 0.5) * 120
    const size = leafSize * (0.75 + r() * 0.5)
    const tone = Math.floor(r() * 3)
    return { x, y, rot, size, tone }
  })

  const flowerCount = Math.min(data.flowers, MAX_FLOWERS)
  const flowers = Array.from({ length: flowerCount }, (_, i) => {
    const r = random(104729 * (i + 1))
    const limb = pickLimb(r())
    const { p, angle } = onCurve(limb.p0, limb.c, limb.p1, 0.55 + 0.45 * r())
    const off = (r() - 0.5) * 2 * spread * 0.8
    return { x: p.x - Math.sin(angle) * off, y: p.y + Math.cos(angle) * off, size: 3 + 1.6 * s, rot: r() * 72 }
  })

  const fruits = Array.from({ length: Math.min(data.fruits, 24) }, (_, i) => {
    const r = random(15485863 * (i + 1))
    const branchLimbs = limbs.length > 0 ? limbs : [crownLimb]
    const limb = branchLimbs[Math.floor(r() * branchLimbs.length)]!
    const { p } = onCurve(limb.p0, limb.c, limb.p1, 0.5 + 0.4 * r())
    return { x: p.x + (r() - 0.5) * 8, y: p.y + 4, size: 4.5 + 3.5 * s }
  })

  // 葉が多くなったら、葉の後ろに淡い茂みを描いて密度を表す
  const canopyOpacity = clamp01((data.leaves - 60) / 400) * 0.5
  const crand = random(31337)
  const canopy = [...limbs.filter((l) => l.weight > 1.2), crownLimb].map((l) => {
    const r = (18 + 46 * s) * (0.8 + crand() * 0.4)
    // 枠からはみ出さないように寄せる
    return { cx: clampTo((l.p1.x + l.c.x) / 2, r + 6, W - r - 6), cy: clampTo((l.p1.y + l.c.y) / 2, r + 6, GROUND - r), r }
  })

  return { s, trunkPath, top, limbs, leaves, flowers, fruits, canopy, canopyOpacity, branchInfo, crownTip }
}

const LEAF_PATH = 'M 0 0 C 0.35 -0.45 0.85 -0.35 1 0 C 0.85 0.35 0.35 0.45 0 0 Z'

export function Tree({
  data,
  size = 320,
  glowKey = 0,
  label,
  minSpan,
}: {
  data: TreeData
  size?: number
  /** 変わると木の周りが一瞬明るくなる (レベルアップ) */
  glowKey?: number
  label?: string
  /** 指定すると、木の大きさに合わせて寄って見せる (この幅より狭くはしない) */
  minSpan?: number
}) {
  const t = buildTree(data)
  // 前回より増えた葉だけ揺れて現れる
  const prevLeaves = useRef<number | null>(null)
  const firstNew = prevLeaves.current === null ? Infinity : prevLeaves.current
  useEffect(() => {
    prevLeaves.current = t.leaves.length
  })

  const sprout = t.s < 0.12
  const aria =
    label ?? `育つ木。葉 ${data.leaves} 枚、花 ${data.flowers} 輪、実 ${data.fruits} 個`

  // 若い木は寄って見せる。地面は常に下端近くに置く
  const span = minSpan ? Math.min(W, Math.max(minSpan, 120 + 300 * t.s)) : W
  const viewBox = minSpan ? `${(W - span) / 2} ${GROUND + 14 - span} ${span} ${span}` : `0 0 ${W} ${H}`

  return (
    <svg className="tree" viewBox={viewBox} width={size} height={size} role="img" aria-label={aria}>
      <defs>
        <radialGradient id="tree-glow">
          <stop offset="0%" stopColor="var(--tree-glow)" stopOpacity="0.9" />
          <stop offset="100%" stopColor="var(--tree-glow)" stopOpacity="0" />
        </radialGradient>
      </defs>
      {glowKey > 0 && (
        <ellipse
          key={glowKey}
          className="tree-glow"
          cx={t.top.x}
          cy={(t.top.y + GROUND) / 2}
          rx={70 + 150 * t.s}
          ry={(GROUND - t.top.y) / 2 + 70}
          fill="url(#tree-glow)"
        />
      )}

      {/* 地面 */}
      <path
        d={`M 40 ${GROUND} Q 120 ${GROUND - 4} 200 ${GROUND} T 360 ${GROUND}`}
        fill="none"
        stroke="var(--tree-ground)"
        strokeWidth={1.6}
        strokeLinecap="round"
      />
      {[70, 92, 300, 326, 345].map((x, i) => (
        <path
          key={x}
          d={`M ${x} ${GROUND} l ${i % 2 ? 2 : -2} -6 M ${x + 4} ${GROUND} l ${i % 2 ? -1 : 2} -8`}
          stroke="var(--tree-ground)"
          strokeWidth={1.2}
          strokeLinecap="round"
        />
      ))}

      {t.canopyOpacity > 0 && (
        <g opacity={t.canopyOpacity}>
          {t.canopy.map((c, i) => (
            <circle key={i} cx={c.cx} cy={c.cy} r={c.r} fill="var(--leaf-1)" />
          ))}
        </g>
      )}

      {/* 枝 (技能の色) */}
      {t.limbs.map((l, i) => (
        <path
          key={i}
          d={`M ${l.p0.x} ${l.p0.y} Q ${l.c.x} ${l.c.y} ${l.p1.x} ${l.p1.y}`}
          fill="none"
          stroke={l.color}
          strokeWidth={l.width}
          strokeLinecap="round"
        />
      ))}

      {/* 幹 */}
      <path d={t.trunkPath} fill="var(--trunk-fill)" stroke="var(--trunk-stroke)" strokeWidth={1.5} strokeLinejoin="round" />

      {/* 芽の時期は双葉を出す */}
      {sprout && (
        <g transform={`translate(${t.top.x} ${t.top.y})`}>
          <path d={LEAF_PATH} transform="rotate(-150) scale(22)" fill="var(--leaf-1)" stroke="var(--leaf-stroke)" strokeWidth={1.4 / 22} />
          <path d={LEAF_PATH} transform="rotate(-30) scale(22)" fill="var(--leaf-2)" stroke="var(--leaf-stroke)" strokeWidth={1.4 / 22} />
        </g>
      )}

      {/* 葉 */}
      {t.leaves.map((l, i) => (
        <g key={i} transform={`translate(${l.x.toFixed(1)} ${l.y.toFixed(1)}) rotate(${l.rot.toFixed(0)})`}>
          <g className={i >= firstNew ? 'leaf is-new' : 'leaf'}>
            <path
              d={LEAF_PATH}
              transform={`scale(${l.size.toFixed(2)})`}
              fill={`var(--leaf-${l.tone + 1})`}
              stroke="var(--leaf-stroke)"
              strokeWidth={1 / l.size}
            />
          </g>
        </g>
      ))}

      {/* 花 (◎ の日) */}
      {t.flowers.map((f, i) => (
        <g key={i} transform={`translate(${f.x.toFixed(1)} ${f.y.toFixed(1)}) rotate(${f.rot.toFixed(0)})`}>
          {[0, 72, 144, 216, 288].map((a) => (
            <circle
              key={a}
              cx={Math.cos((a * Math.PI) / 180) * f.size * 0.6}
              cy={Math.sin((a * Math.PI) / 180) * f.size * 0.6}
              r={f.size * 0.5}
              fill="var(--flower)"
              stroke="var(--flower-stroke)"
              strokeWidth={0.7}
            />
          ))}
          <circle r={f.size * 0.32} fill="var(--flower-center)" />
        </g>
      ))}

      {/* 実 (確認テストと診断) */}
      {t.fruits.map((f, i) => (
        <g key={i}>
          <path d={`M ${f.x} ${f.y - f.size - 4} q 1 3 0 ${4}`} stroke="var(--trunk-stroke)" strokeWidth={1.2} fill="none" />
          <circle cx={f.x} cy={f.y} r={f.size} fill="var(--fruit)" stroke="var(--fruit-stroke)" strokeWidth={1.2} />
          <circle cx={f.x - f.size * 0.35} cy={f.y - f.size * 0.35} r={f.size * 0.25} fill="#fff" opacity={0.45} />
        </g>
      ))}
    </svg>
  )
}

/** 記録の集計から木の材料を作る */
export function treeDataOf(p: {
  xp: number
  minutesBySkill: Record<string, number>
  completedCount: number
  doubleDays: unknown[]
  fruits: number
}): TreeData {
  return { xp: p.xp, minutesBySkill: p.minutesBySkill, leaves: p.completedCount, flowers: p.doubleDays.length, fruits: p.fruits }
}
