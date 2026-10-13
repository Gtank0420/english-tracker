import { useEffect, useState } from 'react'
import { logicalDate } from '../logic/date'
import { plan } from '../plan/plan'
import type { IsoDate } from '../plan/types'

/** 開発中だけ ?date=2027-02-13 で今日の日付を差し替えられる */
function devOverride(): IsoDate | null {
  if (!import.meta.env.DEV) return null
  const d = new URLSearchParams(location.search).get('date')
  return d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null
}

/** 今日の学習日。開きっぱなしでも切り替え時刻を過ぎたら変わる */
export function useToday(boundaryHour: number): IsoDate {
  const compute = () => devOverride() ?? logicalDate(new Date(), boundaryHour, plan.timezone)
  const [today, setToday] = useState(compute)

  useEffect(() => {
    const update = () => setToday(compute())
    update()
    const timer = window.setInterval(update, 60_000)
    document.addEventListener('visibilitychange', update)
    window.addEventListener('focus', update)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', update)
      window.removeEventListener('focus', update)
    }
  }, [boundaryHour])

  return today
}
