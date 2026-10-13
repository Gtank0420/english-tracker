// 設定画面: ログインと同期、記録の書き出し・読み込み、日の切り替え時刻、テーマ
import { useRef, useState } from 'react'
import { exportJson, importRecords, login, logout, updateSettings, useStore, type SyncStatus } from '../data/store'
import { parseExport } from '../data/merge'
import type { Records, Settings, Theme } from '../data/types'
import { logicalDate } from '../logic/date'
import { plan } from '../plan/plan'
import { Sheet } from '../ui/Sheet'
import { useToast } from '../ui/Toast'

const THEMES: { value: Theme; label: string }[] = [
  { value: 'system', label: '端末に合わせる' },
  { value: 'light', label: 'ライト' },
  { value: 'dark', label: 'ダーク (夜の手帳)' },
]

const SYNC_LABEL: Record<SyncStatus, string> = {
  local: 'この端末に保存しています',
  synced: '同期済み',
  pending: '同期待ち (送信中)',
  offline: 'オフライン (つながったら送ります)',
}

function Account() {
  const { user, authReady, sync } = useStore()
  const [busy, setBusy] = useState(false)
  const run = async (f: () => Promise<void>) => {
    setBusy(true)
    try {
      await f()
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card stack" aria-labelledby="account-title">
      <h2 id="account-title">同期</h2>
      <p className="sync-status" role="status">
        <span className={`sync-dot sync-${sync}`} aria-hidden="true" />
        {SYNC_LABEL[sync]}
      </p>
      {!authReady ? (
        <p className="small muted">ログイン状態を確かめています…</p>
      ) : user ? (
        <>
          <p>
            <span className="stat-label">ログイン中</span>
            {user.name && <strong style={{ display: 'block' }}>{user.name}</strong>}
            <span className="small">{user.email}</span>
          </p>
          <p className="small muted">記録はクラウドに保存され、PC とスマホで同じ記録を使えます。通信がないときも記録でき、つながったら送ります。</p>
          <button type="button" className="btn" disabled={busy} onClick={() => run(logout)}>
            ログアウト
          </button>
        </>
      ) : (
        <>
          <p className="small muted">
            Google でログインすると、PC とスマホで記録を同期します。この端末の記録は、ログインしたときにクラウドの記録とまとめます。
          </p>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => run(login)}>
            Google でログイン
          </button>
        </>
      )}
    </section>
  )
}

function Backup() {
  const toast = useToast()
  const { records } = useStore()
  const fileRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<{ records: Records; settings: Partial<Settings>; name: string } | null>(null)

  const download = () => {
    const blob = new Blob([exportJson()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `english-tracker-${logicalDate(new Date(), 0, plan.timezone)}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    toast('書き出しました')
  }

  const onFile = async (file: File | undefined) => {
    if (!file) return
    setError(null)
    const result = parseExport(await file.text())
    if (fileRef.current) fileRef.current.value = ''
    if (!result.ok) {
      setError(`読み込めませんでした: ${result.error}。記録は変更していません。`)
      return
    }
    setPending({ records: result.records, settings: result.settings, name: file.name })
  }

  const apply = (how: 'merge' | 'replace') => {
    if (!pending) return
    importRecords(pending.records, pending.settings, how)
    setPending(null)
    toast(how === 'merge' ? '記録を統合しました' : '記録を置き換えました')
  }

  return (
    <section className="card stack" aria-labelledby="backup-title">
      <h2 id="backup-title">記録の書き出しと読み込み</h2>
      <p className="small muted">
        いまの記録: {Object.keys(records.days).length} 日分・確認テスト {Object.keys(records.checkpoints).length} 件。月末の振り返りのついでに書き出しておくと安心です。
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className="btn" onClick={download}>
          書き出す (JSON)
        </button>
        <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
          読み込む
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="visually-hidden"
          tabIndex={-1}
          onChange={(e) => void onFile(e.target.files?.[0])}
        />
      </div>
      {error && (
        <p className="banner" role="alert">
          {error}
        </p>
      )}
      {pending && (
        <Sheet label="読み込み方を選ぶ" onClose={() => setPending(null)}>
          <div className="stack">
            <h2>読み込み方を選ぶ</h2>
            <p>
              {pending.name}: {Object.keys(pending.records.days).length} 日分・確認テスト{' '}
              {Object.keys(pending.records.checkpoints).length} 件
            </p>
            <button type="button" className="btn btn-primary" onClick={() => apply('merge')}>
              今の記録と統合する
            </button>
            <p className="small muted">日ごとにチェックを合わせ、メモは新しいほうを残します。今の記録は消えません。</p>
            <button type="button" className="btn" onClick={() => apply('replace')}>
              ファイルの内容に置き換える
            </button>
            <p className="small muted">今の記録を消して、ファイルの内容だけにします。設定もファイルのものになります。</p>
            <button type="button" className="btn btn-quiet" onClick={() => setPending(null)}>
              やめる
            </button>
          </div>
        </Sheet>
      )}
    </section>
  )
}

export function SettingsScreen() {
  const { settings } = useStore()
  return (
    <div className="stack">
      <h1>設定</h1>
      <Account />
      <section className="card stack" aria-labelledby="display-title">
        <h2 id="display-title">日付と表示</h2>
        <div className="field">
          <label htmlFor="boundary">日の切り替え時刻</label>
          <select
            id="boundary"
            className="input"
            value={settings.dayBoundaryHour}
            onChange={(e) => updateSettings({ dayBoundaryHour: Number(e.target.value) })}
          >
            {[0, 1, 2, 3, 4, 5].map((h) => (
              <option key={h} value={h}>
                {h}時{h === plan.dayBoundaryHour ? ' (既定)' : ''}
              </option>
            ))}
          </select>
          <p className="small muted">この時刻より前に記録した分は、前の日として扱います。</p>
        </div>
        <fieldset className="seg">
          <legend>表示テーマ</legend>
          {THEMES.map((t) => (
            <label key={t.value}>
              <input
                type="radio"
                name="theme"
                checked={settings.theme === t.value}
                onChange={() => updateSettings({ theme: t.value })}
              />
              <span>{t.label}</span>
            </label>
          ))}
        </fieldset>
      </section>
      <Backup />
      <p className="small">
        <a href="#/dev/tree">開発用: 木の成長過程を見る</a>
      </p>
    </div>
  )
}
