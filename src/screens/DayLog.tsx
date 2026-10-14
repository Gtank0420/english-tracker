// 1日の記録: 分類ごとに10分のチェックを並べる。今日の画面と、記録画面の過去の日で共通に使う
import { useRef, useState } from 'react'
import { emptyDay, setMemo, setUnits, useStore } from '../data/store'
import type { MemoKind } from '../data/types'
import { weekdayKey } from '../logic/date'
import { dayMark, dayMinutes } from '../logic/marks'
import { plan } from '../plan/plan'
import type { IsoDate, Skill } from '../plan/types'
import { formatMinutes } from '../ui/Charts'
import { BackIcon, CheckIcon, ChevronIcon } from '../ui/Icons'
import { Sheet } from '../ui/Sheet'
import { skillStyle } from '../ui/SkillTag'
import { MenuDetail } from './MenuDetail'
import { matchedLevelRows } from '../logic/progress'

const WEEKDAY_JA = { mon: '月', tue: '火', wed: '水', thu: '木', fri: '金', sat: '土', sun: '日' } as const

export function formatDate(date: IsoDate): string {
  const [, m, d] = date.split('-').map(Number)
  return `${m}月${d}日 (${WEEKDAY_JA[weekdayKey(date)]})`
}

function SkillRow({ date, skill, onOpen }: { date: IsoDate; skill: Skill; onOpen: () => void }) {
  const { records } = useStore()
  const { unitMinutes, initialBoxes } = plan.logging
  const count = records.days[date]?.units[skill.id] ?? 0
  const shown = Math.max(initialBoxes, count)

  // 空の箱を押すとそこまで、チェック済みの箱を押すとその箱から後ろを外す
  const tap = (k: number) => setUnits(date, skill.id, k <= count ? k - 1 : k)

  return (
    <li className="log-row" style={skillStyle(skill.id)}>
      <div className="log-head">
        <button type="button" className="log-name" onClick={onOpen}>
          <span className="log-swatch" aria-hidden="true" />
          {skill.name}
          <ChevronIcon />
          <span className="visually-hidden">のやり方を見る</span>
        </button>
        <span className="log-minutes" aria-live="polite">
          {count > 0 ? formatMinutes(count * unitMinutes) : ''}
        </span>
      </div>
      <div className="log-boxes" role="group" aria-label={`${skill.name}の記録 (1つ${unitMinutes}分)`}>
        {Array.from({ length: shown }, (_, i) => i + 1).map((k) => {
          const on = k <= count
          return (
            <button
              key={k}
              type="button"
              className="unit-box"
              aria-pressed={on}
              aria-label={on ? `${k * unitMinutes}分のチェックを外す` : `${k * unitMinutes}分にする`}
              onClick={() => tap(k)}
            >
              <CheckIcon />
            </button>
          )
        })}
        {count >= initialBoxes && (
          <button type="button" className="unit-add" aria-label={`${skill.name}に${unitMinutes}分足す`} onClick={() => tap(count + 1)}>
            ＋
          </button>
        )}
      </div>
    </li>
  )
}

/** 分類に関係するメニューの一覧と詳細 */
function SkillMenus({ skill }: { skill: Skill }) {
  const { records } = useStore()
  const menus = skill.menuIds.flatMap((id) => plan.menus.filter((m) => m.id === id))
  const [openId, setOpenId] = useState<string | null>(menus.length === 1 ? menus[0]!.id : null)
  const open = menus.find((m) => m.id === openId)

  if (open) {
    return (
      <div className="stack">
        {menus.length > 1 && (
          <button type="button" className="btn btn-quiet" style={{ alignSelf: 'flex-start', paddingLeft: 4 }} onClick={() => setOpenId(null)}>
            <BackIcon /> {skill.name}のメニュー
          </button>
        )}
        <MenuDetail menu={open} highlightRows={matchedLevelRows(plan, records.checkpoints)} />
      </div>
    )
  }
  return (
    <div className="stack">
      <h2>{skill.name}のメニュー</h2>
      {menus.length === 0 && <p className="muted">この分類のメニューはまだありません。</p>}
      <ul className="menu-grid">
        {menus.map((m) => (
          <li key={m.id}>
            <button type="button" className="card menu-card" style={skillStyle(m.skill)} onClick={() => setOpenId(m.id)}>
              <span className="band" aria-hidden="true" />
              <span className="inner">
                <span className="menu-no">メニュー {m.no}</span>
                <span className="menu-name">{m.name}</span>
                <span className="small muted">{m.summary}</span>
              </span>
              <span className="chevron" style={{ alignSelf: 'center', paddingRight: 8 }}>
                <ChevronIcon />
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function MarkBadge({ date }: { date: IsoDate }) {
  const { records } = useStore()
  const units = records.days[date]?.units ?? {}
  const mark = dayMark(plan, units)
  if (!mark) return null
  const { circleMinutes, doubleCircleMinutes } = plan.markRules
  return (
    <div className="day-mark">
      <span className={`mark-symbol ${mark}`}>{mark === 'double' ? '◎' : '○'}</span>
      <span>{mark === 'double' ? `合計${doubleCircleMinutes}分以上の日` : `合計${circleMinutes}分以上の日`}</span>
    </div>
  )
}

/** 分類ごとのチェックと、その日の合計・印 */
export function DayLog({ date }: { date: IsoDate }) {
  const { records } = useStore()
  const [openSkill, setOpenSkill] = useState<Skill | null>(null)
  const total = dayMinutes(plan, records.days[date]?.units ?? {})

  return (
    <div className="stack" style={{ gap: 12 }}>
      <ul className="log-list">
        {plan.skills.map((s) => (
          <SkillRow key={s.id} date={date} skill={s} onOpen={() => setOpenSkill(s)} />
        ))}
      </ul>
      <div className="log-total">
        <span>合計</span>
        <strong>{total > 0 ? formatMinutes(total) : '0分'}</strong>
      </div>
      <div aria-live="polite">
        <MarkBadge date={date} />
      </div>
      {openSkill && (
        <Sheet label={`${openSkill.name}のメニュー`} onClose={() => setOpenSkill(null)}>
          <SkillMenus skill={openSkill} />
        </Sheet>
      )}
    </div>
  )
}

/** 1行メモ。「見た作品」「読んだ政策記事」として残すとコレクションに入る */
export function MemoField({ date }: { date: IsoDate }) {
  const { records } = useStore()
  const day = records.days[date] ?? emptyDay()
  const [draft, setDraft] = useState(day.memo)
  const [kind, setKind] = useState<MemoKind>(day.memoKind)
  const timer = useRef<number | undefined>(undefined)

  const save = (memo: string, k: MemoKind) => {
    window.clearTimeout(timer.current)
    setMemo(date, memo, memo.trim() ? k : null)
  }
  const onChange = (memo: string) => {
    setDraft(memo)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => save(memo, kind), 800)
  }
  const placeholder = kind === 'fun' ? '例: The Diplomat シーズン1 第3話' : kind === 'policy' ? '例: 読んだ記事の見出し' : '今日のひとこと'
  const kindName = plan.gamification.collections.find((c) => c.kind === kind)?.name

  return (
    <div className="field">
      <label htmlFor={`memo-${date}`}>{kindName ? `${kindName}を1行で` : '1行メモ'}</label>
      <input
        id={`memo-${date}`}
        className="input"
        type="text"
        value={draft}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => save(draft, kind)}
        enterKeyHint="done"
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      />
      <fieldset className="seg">
        <legend>メモの残し方</legend>
        {[null, ...plan.gamification.collections.map((c) => c.kind)].map((k) => (
          <label key={k ?? 'plain'}>
            <input
              type="radio"
              name={`memo-kind-${date}`}
              checked={kind === k}
              onChange={() => {
                setKind(k)
                if (draft.trim()) save(draft, k)
              }}
            />
            <span>{k ? `${plan.gamification.collections.find((c) => c.kind === k)!.name}に残す` : 'ふつうのメモ'}</span>
          </label>
        ))}
      </fieldset>
    </div>
  )
}
