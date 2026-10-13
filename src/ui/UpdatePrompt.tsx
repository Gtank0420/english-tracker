// 新しい版 (plan.json の変更など) が公開されたら知らせる
import { useEffect, useState } from 'react'
import { registerSW } from 'virtual:pwa-register'

let updateSW: ((reload?: boolean) => Promise<void>) | null = null

export function UpdatePrompt() {
  const [needRefresh, setNeedRefresh] = useState(false)

  useEffect(() => {
    if (updateSW) return
    updateSW = registerSW({
      onNeedRefresh: () => setNeedRefresh(true),
      onRegisteredSW: (_url, reg) => {
        if (!reg) return
        // 開き直したときにも新しい版を確かめる
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible' && navigator.onLine) void reg.update()
        })
      },
    })
  }, [])

  if (!needRefresh) return null
  return (
    <div className="banner update-banner" role="status">
      <span>新しい版があります</span>
      <button type="button" className="btn btn-primary" onClick={() => void updateSW?.(true)}>
        更新する
      </button>
    </div>
  )
}
