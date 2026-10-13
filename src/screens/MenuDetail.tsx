// メニューの詳細。メニュー画面と、今日の画面のシートで共通に使う
import type { ReactNode } from 'react'
import { plan } from '../plan/plan'
import type { Menu } from '../plan/types'
import { copyToClipboard } from '../ui/copy'
import { CopyIcon, ExternalIcon, MaterialIcon, materialTypeLabel } from '../ui/Icons'
import { SkillTag, skillStyle } from '../ui/SkillTag'
import { useToast } from '../ui/Toast'

function Note({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="note">
      <span className="note-label">{label}</span>
      {children}
    </div>
  )
}

export function MenuDetail({ menu, highlightRows = [] }: { menu: Menu; highlightRows?: number[] }) {
  const toast = useToast()
  const materials = menu.materialIds.flatMap((id) => plan.materials.filter((m) => m.id === id))
  const copyTexts = menu.copyTextIds.flatMap((id) => plan.copyTexts.filter((c) => c.id === id))
  const levelRows = plan.levelTable.map((row, i) => ({ row, i })).filter(({ row }) => row.skill === menu.skill)

  const copy = async (text: string) => {
    const ok = await copyToClipboard(text)
    toast(ok ? 'コピーしました' : 'コピーできませんでした')
  }

  return (
    <article className="detail" style={skillStyle(menu.skill)}>
      <header className="detail-head">
        <span className="menu-no">メニュー {menu.no}</span>
        <h2>{menu.name}</h2>
        <p className="task-meta">
          <SkillTag skill={menu.skill} />
          <span>{menu.defaultMinutes}分</span>
          <span>{menu.when}</span>
        </p>
      </header>

      <p>{menu.summary}</p>

      <section aria-labelledby={`${menu.id}-steps`}>
        <h3 id={`${menu.id}-steps`}>手順</h3>
        <ol className="steps">
          {menu.steps.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
      </section>

      {(menu.busyDay || menu.target || menu.tip || menu.materialNote || menu.evidence || menu.questionTypes || menu.topicsByPhase) && (
        <section>
          {menu.busyDay && <Note label="忙しい日は">{menu.busyDay}</Note>}
          {menu.target && <Note label="目安">{menu.target}</Note>}
          {menu.questionTypes && <Note label="質問の種類">{menu.questionTypes.join('、')}</Note>}
          {menu.topicsByPhase && (
            <Note label="時期ごとの話題">
              <dl className="topics">
                {plan.phases
                  .filter((p) => menu.topicsByPhase?.[p.id])
                  .map((p) => (
                    <div key={p.id} style={{ display: 'contents' }}>
                      <dt>{p.name}</dt>
                      <dd>{menu.topicsByPhase![p.id]}</dd>
                    </div>
                  ))}
              </dl>
            </Note>
          )}
          {menu.tip && <Note label="コツ">{menu.tip}</Note>}
          {menu.materialNote && <Note label="素材について">{menu.materialNote}</Note>}
          {menu.evidence && <Note label="根拠">{menu.evidence}</Note>}
        </section>
      )}

      {copyTexts.length > 0 && (
        <section aria-labelledby={`${menu.id}-copy`}>
          <h3 id={`${menu.id}-copy`}>コピーして使う文</h3>
          <ul className="copy-list">
            {copyTexts.map((c) => (
              <li key={c.id} className="copy-item">
                <strong>{c.label}</strong>
                <pre className="copy-text">{c.text}</pre>
                <button type="button" className="btn" onClick={() => copy(c.text)}>
                  <CopyIcon /> コピー
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {materials.length > 0 && (
        <section aria-labelledby={`${menu.id}-materials`}>
          <h3 id={`${menu.id}-materials`}>教材</h3>
          <ul className="materials">
            {materials.map((m) => (
              <li key={m.id} className="material" style={skillStyle(m.skill)}>
                <span className="material-icon">
                  <MaterialIcon type={m.type} />
                </span>
                <div className="material-body">
                  <span className="material-name">{m.name}</span>
                  <span className="small muted">
                    {materialTypeLabel(m.type)}
                    {m.publisher && `・${m.publisher}`}・{m.cost}
                  </span>
                  <span className="small">{m.purpose}</span>
                  {m.url && (
                    <a className="material-link small" href={m.url} target="_blank" rel="noopener noreferrer">
                      開く <ExternalIcon />
                      <span className="visually-hidden">(別タブで開きます)</span>
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {levelRows.length > 0 && (
        <section aria-labelledby={`${menu.id}-level`}>
          <h3 id={`${menu.id}-level`}>レベル表</h3>
          <table className="level-table">
            <thead>
              <tr>
                <th scope="col">こうなら</th>
                <th scope="col">こうする</th>
              </tr>
            </thead>
            <tbody>
              {levelRows.map(({ row, i }) => (
                <tr key={i} className={highlightRows.includes(i) ? 'is-match' : undefined}>
                  <td>
                    {highlightRows.includes(i) && <strong>いまここ: </strong>}
                    {row.condition}
                  </td>
                  <td>{row.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </article>
  )
}
