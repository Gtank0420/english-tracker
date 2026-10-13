// 下から開くシート。Android の戻るボタンでも閉じる
import { useEffect, useRef, type ReactNode } from 'react'
import { CloseIcon } from './Icons'

// popstate はここで1つだけ受ける。自分で history.back() した分は無視する
let ignorePops = 0
let activePop: (() => void) | null = null
window.addEventListener('popstate', () => {
  if (ignorePops > 0) {
    ignorePops--
    return
  }
  activePop?.()
})

export function Sheet({ label, onClose, children }: { label: string; onClose: () => void; children: ReactNode }) {
  const panelRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    panelRef.current?.focus()
    // 戻るボタンで閉じられるよう履歴を1つ積む
    history.pushState({ sheet: true }, '')
    let closedByBack = false
    const onPop = () => {
      closedByBack = true
      onCloseRef.current()
    }
    activePop = onPop
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current()
    }
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      if (activePop === onPop) activePop = null
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      if (!closedByBack && history.state?.sheet) {
        ignorePops++
        history.back()
      }
      previous?.focus()
    }
  }, [])

  return (
    <div className="sheet-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} ref={panelRef}>
        <div className="sheet-bar">
          <button type="button" className="btn btn-quiet" onClick={onClose} aria-label="閉じる">
            <CloseIcon />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
