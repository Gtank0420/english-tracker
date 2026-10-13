// 「コピーしました」などの短いお知らせ
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'

const ToastContext = createContext<(message: string) => void>(() => {})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ message: string; id: number } | null>(null)
  const timer = useRef<number | undefined>(undefined)

  const show = useCallback((message: string) => {
    window.clearTimeout(timer.current)
    setToast((t) => ({ message, id: (t?.id ?? 0) + 1 }))
    timer.current = window.setTimeout(() => setToast(null), message.length > 12 ? 3200 : 2000)
  }, [])

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="toast-area" role="status" aria-live="polite">
        {toast && (
          <div className="toast" key={toast.id}>
            {toast.message}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
