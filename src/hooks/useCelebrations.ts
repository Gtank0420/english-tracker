// レベルアップとバッジ獲得を見つけて、その場で短く知らせる
import { useEffect, useRef, useState } from 'react'
import type { Progress } from '../logic/progress'

// 知らせ済みのバッジは端末にだけ覚える (計算結果ではなく「もう見せたか」の印)
const SEEN_KEY = 'seenBadges'

function readSeen(): Set<string> | null {
  try {
    const raw = localStorage.getItem(SEEN_KEY)
    return raw ? new Set(JSON.parse(raw) as string[]) : null
  } catch {
    return null
  }
}
function writeSeen(ids: Set<string>) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify([...ids]))
  } catch {
    // 保存できなくても動作には困らない
  }
}

/** 戻り値の glowKey が増えたら木を一瞬明るくする */
export function useCelebrations(progress: Progress | null, epoch: number, notify: (message: string) => void): number {
  const prevLevel = useRef<number | null>(null)
  const prevEpoch = useRef(epoch)
  const [glowKey, setGlowKey] = useState(0)

  useEffect(() => {
    if (!progress) return
    const messages: string[] = []
    const earned = progress.badges.filter((b) => b.earnedOn)

    // ログインや読み込みで記録が入れ替わったときは、知らせずに今の状態を基準にする
    if (epoch !== prevEpoch.current) {
      prevEpoch.current = epoch
      prevLevel.current = progress.level
      const seen = readSeen() ?? new Set<string>()
      earned.forEach((b) => seen.add(b.id))
      writeSeen(seen)
      return
    }

    if (prevLevel.current !== null && progress.level > prevLevel.current) {
      messages.push(`Lv.${progress.level} になりました`)
      setGlowKey((k) => k + 1)
    }
    prevLevel.current = progress.level

    const seen = readSeen()
    if (seen === null) {
      // 初めて開いたときは、これまでの分をまとめて知らせない
      writeSeen(new Set(earned.map((b) => b.id)))
    } else {
      const fresh = earned.filter((b) => !seen.has(b.id))
      if (fresh.length > 0) {
        messages.push(fresh.length === 1 ? `バッジ「${fresh[0]!.name}」を獲得しました` : `バッジを${fresh.length}個獲得しました`)
        fresh.forEach((b) => seen.add(b.id))
        writeSeen(seen)
      }
    }

    if (messages.length > 0) notify(messages.join('・'))
  }, [progress, epoch, notify])

  return glowKey
}
