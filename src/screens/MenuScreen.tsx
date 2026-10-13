// メニュー画面: 9メニューのカード一覧と詳細
import { useStore } from '../data/store'
import { navigate } from '../hooks/useHashRoute'
import { matchedLevelRows } from '../logic/progress'
import { plan } from '../plan/plan'
import { BackIcon, ChevronIcon } from '../ui/Icons'
import { SkillTag, skillStyle } from '../ui/SkillTag'
import { MenuDetail } from './MenuDetail'

export function MenuScreen({ menuId }: { menuId?: string }) {
  const { records } = useStore()
  const menu = plan.menus.find((m) => m.id === menuId)

  if (menu) {
    return (
      <div className="stack">
        <a className="btn btn-quiet" href="#/menu" style={{ alignSelf: 'flex-start', paddingLeft: 4 }}>
          <BackIcon /> メニュー一覧
        </a>
        <MenuDetail menu={menu} highlightRows={matchedLevelRows(plan, records.checkpoints)} />
      </div>
    )
  }

  return (
    <div className="stack">
      <h1>メニュー</h1>
      <ul className="menu-grid">
        {plan.menus.map((m) => (
          <li key={m.id}>
            <a
              className="card menu-card"
              href={`#/menu/${m.id}`}
              style={skillStyle(m.skill)}
              onClick={(e) => {
                e.preventDefault()
                navigate(`menu/${m.id}`)
                window.scrollTo(0, 0)
              }}
            >
              <span className="band" aria-hidden="true" />
              <span className="inner">
                <span className="menu-no">メニュー {m.no}</span>
                <span className="menu-name">{m.name}</span>
                <span className="task-meta">
                  <SkillTag skill={m.skill} />
                  <span>{m.defaultMinutes}分</span>
                </span>
                <span className="small muted">{m.when}</span>
              </span>
              <span className="chevron" style={{ alignSelf: 'center', paddingRight: 8 }}>
                <ChevronIcon />
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}
