// 記録から計算した進み具合を、画面全体で1回だけ計算して配る
import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { useStore } from '../data/store'
import { computeProgress, type Progress } from '../logic/progress'
import { plan } from '../plan/plan'
import { useToast } from '../ui/Toast'
import { useCelebrations } from './useCelebrations'

interface ProgressValue {
  progress: Progress
  /** 増えたら木の周りを一瞬明るくする */
  glowKey: number
}

const ProgressContext = createContext<ProgressValue | null>(null)

export function ProgressProvider({ children }: { children: ReactNode }) {
  const { ready, records, epoch } = useStore()
  const toast = useToast()
  const progress = useMemo(() => computeProgress(plan, records), [records])
  const glowKey = useCelebrations(ready ? progress : null, epoch, toast)
  return <ProgressContext.Provider value={{ progress, glowKey }}>{children}</ProgressContext.Provider>
}

export function useProgress(): ProgressValue {
  const v = useContext(ProgressContext)
  if (!v) throw new Error('ProgressProvider の外で useProgress は使えません')
  return v
}
