import { useEffect, type ReactNode } from 'react'
import { dismissError, useStore } from './data/store'
import { useHashRoute } from './hooks/useHashRoute'
import { useToday } from './hooks/useToday'
import { MenuScreen } from './screens/MenuScreen'
import { PlanScreen } from './screens/PlanScreen'
import { RecordScreen } from './screens/RecordScreen'
import { TreeDevScreen } from './screens/TreeDevScreen'
import { ProgressProvider } from './hooks/useProgress'
import { SettingsScreen } from './screens/SettingsScreen'
import { TodayScreen } from './screens/TodayScreen'
import { MenuIcon, PlanIcon, RecordIcon, SettingsIcon, TodayIcon } from './ui/Icons'
import { ToastProvider } from './ui/Toast'
import { UpdatePrompt } from './ui/UpdatePrompt'

const TABS: { id: string; label: string; icon: ReactNode }[] = [
  { id: 'today', label: '今日', icon: <TodayIcon /> },
  { id: 'record', label: '記録', icon: <RecordIcon /> },
  { id: 'menu', label: 'メニュー', icon: <MenuIcon /> },
  { id: 'plan', label: '計画', icon: <PlanIcon /> },
  { id: 'settings', label: '設定', icon: <SettingsIcon /> },
]

export default function App() {
  const { ready, settings, error } = useStore()
  const today = useToday(settings.dayBoundaryHour)
  const route = useHashRoute()
  const [tab = 'today', sub] = route

  useEffect(() => {
    const root = document.documentElement
    if (settings.theme === 'system') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', settings.theme)
  }, [settings.theme])

  let screen: ReactNode
  if (!ready) screen = null
  else if (tab === 'menu') screen = <MenuScreen menuId={sub} />
  else if (tab === 'record') screen = <RecordScreen today={today} />
  else if (tab === 'plan') screen = <PlanScreen today={today} checkpointId={sub === 'cp' ? route[2] : undefined} />
  else if (tab === 'dev' && sub === 'tree') screen = <TreeDevScreen />
  else if (tab === 'settings') screen = <SettingsScreen />
  else screen = <TodayScreen today={today} />

  const current = TABS.some((t) => t.id === tab) ? tab : 'today'

  return (
    <ToastProvider>
      <ProgressProvider>
      <main className="app">
        {error && (
          <div className="banner" role="alert" style={{ marginBottom: 16 }}>
            <span>{error}</span>
            <button type="button" className="btn btn-quiet" onClick={dismissError}>
              閉じる
            </button>
          </div>
        )}
        <UpdatePrompt />
        {screen}
      </main>
      <nav className="tabbar" aria-label="画面の切り替え">
        <ul>
          {TABS.map((t) => (
            <li key={t.id}>
              <a href={`#/${t.id}`} aria-current={current === t.id ? 'page' : undefined}>
                {t.icon}
                {t.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      </ProgressProvider>
    </ToastProvider>
  )
}
