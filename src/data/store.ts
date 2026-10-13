// 記録の読み書きはすべてこのモジュールを通す。画面から保存先 (IndexedDB / Firestore) を直接呼ばない。
// ログイン前は端末内 (IndexedDB)、ログイン中は Firestore (端末にも控えを持つ) に保存する。
import { useSyncExternalStore } from 'react'
import { plan } from '../plan/plan'
import type { IsoDate } from '../plan/types'
import * as idb from './idb'
import { buildExport, isEmptyRecords, mergeRecords } from './merge'
import type { CheckpointRecord, DayRecord, MemoKind, Records, Settings } from './types'

type Cloud = typeof import('./cloud')

export type SyncStatus = 'local' | 'synced' | 'pending' | 'offline'

export interface UserInfo {
  uid: string
  email: string | null
  name: string | null
}

export interface StoreState {
  ready: boolean
  records: Records
  settings: Settings
  /** ログイン中のアカウント */
  user: UserInfo | null
  /** ログイン状態を確かめ終えたか */
  authReady: boolean
  sync: SyncStatus
  /** 保存先が切り替わったり読み込んだりすると増える (お祝いの表示を出し直さないため) */
  epoch: number
  error: string | null
}

export const defaultSettings: Settings = { dayBoundaryHour: plan.dayBoundaryHour, theme: 'system' }

let state: StoreState = {
  ready: false,
  records: { days: {}, checkpoints: {} },
  settings: defaultSettings,
  user: null,
  authReady: false,
  sync: 'local',
  epoch: 0,
  error: null,
}
const listeners = new Set<() => void>()

function setState(next: Partial<StoreState>) {
  state = { ...state, ...next }
  listeners.forEach((l) => l())
}

export function useStore(): StoreState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => state,
  )
}

// ---- 保存先 ----

let cloud: Cloud | null = null
/** ログイン中の uid。null なら端末内に保存する */
let uid: string | null = null
let localAvailable = true
let unsubscribe: (() => void) | null = null
const pending = { days: false, checkpoints: false, user: false }

function updateSync() {
  let sync: SyncStatus = 'local'
  if (uid) {
    const hasPending = pending.days || pending.checkpoints || pending.user
    sync = !navigator.onLine ? 'offline' : hasPending ? 'pending' : 'synced'
  }
  if (sync !== state.sync) setState({ sync })
}
window.addEventListener('online', updateSync)
window.addEventListener('offline', updateSync)

function fail(message: string) {
  return (e: unknown) => {
    console.error(e)
    setState({ error: message })
  }
}
const saveFailed = fail('記録を保存できませんでした。もう一度お試しください。')

function persist(local: () => Promise<void>, remote: (c: Cloud, uid: string) => Promise<void>) {
  if (uid && cloud) remote(cloud, uid).catch(fail('記録を同期できませんでした。ログインし直すと直ることがあります。'))
  else if (localAvailable) local().catch(saveFailed)
}

// ---- 起動 ----

async function loadLocal(): Promise<{ records: Records; settings: Partial<Settings> }> {
  const [days, checkpoints, meta] = await Promise.all([
    idb.readAll<DayRecord>('days'),
    idb.readAll<CheckpointRecord>('checkpoints'),
    idb.readAll<Partial<Settings>>('meta'),
  ])
  return { records: { days, checkpoints }, settings: meta.settings ?? {} }
}

async function writeLocal(records: Records, settings: Settings) {
  await idb.clearAll()
  await Promise.all([
    ...Object.entries(records.days).map(([d, day]) => idb.put('days', d, day)),
    ...Object.entries(records.checkpoints).map(([id, cp]) => idb.put('checkpoints', id, cp)),
    idb.put('meta', 'settings', settings),
  ])
}

// ログイン中だったかの目印。ログインしていなければ、ログイン状態の確認を待たずに画面を出す
const SIGNED_IN_KEY = 'signedIn'
function signedInHint(v?: boolean): boolean {
  try {
    if (v === true) localStorage.setItem(SIGNED_IN_KEY, '1')
    else if (v === false) localStorage.removeItem(SIGNED_IN_KEY)
    return localStorage.getItem(SIGNED_IN_KEY) === '1'
  } catch {
    return false
  }
}

export async function initStore(): Promise<void> {
  try {
    const { records, settings } = await loadLocal()
    setState({ records, settings: { ...defaultSettings, ...settings }, ready: !signedInHint() })
  } catch (e) {
    console.error(e)
    localAvailable = false
    setState({ error: 'この端末では記録を保存できません。ログインするとクラウドに保存できます。' })
  }

  try {
    cloud = await import('./cloud')
  } catch (e) {
    // オフラインで初めて開いたときなど。端末内の記録だけで使う
    console.error(e)
    setState({ ready: true, authReady: true })
    return
  }

  cloud.watchAuth((user) => {
    if (user && user.uid !== uid) void enterCloud(user)
    else if (!user && uid) void leaveCloud()
    else if (!user) setState({ ready: true, authReady: true })
  })
}

/** ログインしたら、端末内の記録をクラウドに統合してから、クラウドの記録を使う */
async function enterCloud(user: UserInfo) {
  const c = cloud!
  unsubscribe?.()
  signedInHint(true)
  setState({ user, authReady: true })
  const local = state.records
  const localSettings = state.settings

  if (localAvailable && !isEmptyRecords(local)) {
    try {
      const remote = await c.fetchAll(user.uid)
      const merged = mergeRecords(remote.records, local)
      // 端末にあった日と確認テストだけを書く
      const toWrite: Records = {
        days: Object.fromEntries(Object.keys(local.days).map((d) => [d, merged.days[d]!])),
        checkpoints: Object.fromEntries(
          Object.keys(local.checkpoints)
            .filter((id) => !remote.records.checkpoints[id])
            .map((id) => [id, local.checkpoints[id]!]),
        ),
      }
      await c.putMany(user.uid, toWrite, remote.settings ? null : localSettings)
      // 統合の間に端末で記録が変わっていたら消さずに残し、次に開いたときにもう一度統合する
      if (state.records === local) await idb.clearAll()
    } catch (e) {
      // 端末の記録は消さずに残し、次に開いたときにもう一度統合する
      fail('端末の記録をクラウドにまとめられませんでした。通信を確かめてから開き直してください。')(e)
    }
  }

  uid = user.uid
  // 最初の読み込みは日と確認テストがそろってから一度に反映する (途中の値でお祝いを出さないため)
  let firstDays: Records['days'] | null = null
  let firstCps: Records['checkpoints'] | null = null
  let started = false
  const startIfReady = () => {
    if (started || !firstDays || !firstCps) return
    started = true
    setState({ records: { days: firstDays, checkpoints: firstCps }, ready: true, epoch: state.epoch + 1 })
  }
  unsubscribe = c.subscribe(user.uid, {
    onDays: (days) => {
      if (!started) {
        firstDays = days
        startIfReady()
      } else setState({ records: { ...state.records, days } })
    },
    onCheckpoints: (checkpoints) => {
      if (!started) {
        firstCps = checkpoints
        startIfReady()
      } else setState({ records: { ...state.records, checkpoints } })
    },
    onSettings: (s) => setState({ settings: { ...defaultSettings, ...s } }),
    onPending: (source, p) => {
      pending[source] = p
      updateSync()
    },
    onError: fail('クラウドの記録を読めませんでした。ログインし直してください。'),
  })
  updateSync()
  // 万一読み込みが遅くても、画面は出す
  window.setTimeout(() => !state.ready && setState({ ready: true }), 4000)
}

/** ログアウトしたら、その時点の記録の写しを端末に残して、端末内保存に戻る */
async function leaveCloud() {
  unsubscribe?.()
  unsubscribe = null
  uid = null
  signedInHint(false)
  pending.days = pending.checkpoints = pending.user = false
  if (localAvailable) await writeLocal(state.records, state.settings).catch(saveFailed)
  setState({ user: null, ready: true, authReady: true, epoch: state.epoch + 1 })
  updateSync()
}

// ---- ログイン ----

export async function login(): Promise<void> {
  if (!cloud) {
    setState({ error: 'ログイン機能を読み込めませんでした。通信を確かめてから開き直してください。' })
    return
  }
  try {
    await cloud.login()
  } catch (e) {
    const code = (e as { code?: string }).code
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return
    if (code === 'auth/popup-blocked') setState({ error: 'ログイン画面が開けませんでした。ポップアップを許可してください。' })
    else if (code === 'auth/network-request-failed') setState({ error: 'ログインには通信が必要です。' })
    else fail('ログインできませんでした。')(e)
  }
}

export async function logout(): Promise<void> {
  if (!cloud || !uid) return
  // 先に写しを端末に残してからログアウトする (watchAuth からの呼び出しは uid がもう null なので重ならない)
  await leaveCloud()
  await cloud.logout().catch(fail('ログアウトできませんでした。'))
}

// ---- 記録の変更 ----

export function emptyDay(): DayRecord {
  return { done: [], memo: '', memoKind: null, updatedAt: 0 }
}

function updateDay(date: IsoDate, change: (day: DayRecord) => DayRecord): DayRecord {
  const day = { ...change(state.records.days[date] ?? emptyDay()), updatedAt: Date.now() }
  setState({ records: { ...state.records, days: { ...state.records.days, [date]: day } } })
  return day
}

export function setTaskDone(date: IsoDate, taskId: string, isDone: boolean) {
  const day = updateDay(date, (d) => ({
    ...d,
    done: isDone ? [...new Set([...d.done, taskId])] : d.done.filter((id) => id !== taskId),
  }))
  persist(
    () => idb.put('days', date, day),
    (c, u) => c.setDone(u, date, taskId, isDone, day.updatedAt),
  )
}

export function setMemo(date: IsoDate, memo: string, memoKind: MemoKind) {
  const cur = state.records.days[date]
  if (cur && cur.memo === memo && cur.memoKind === memoKind) return
  if (!cur && !memo) return
  const day = updateDay(date, (d) => ({ ...d, memo, memoKind }))
  persist(
    () => idb.put('days', date, day),
    (c, u) => c.setMemo(u, date, day),
  )
}

export function saveCheckpoint(id: string, values: CheckpointRecord['values']) {
  const prev = state.records.checkpoints[id]
  // 入力し直しても入力日は最初のまま (バッジの獲得日が動かないように)
  const rec: CheckpointRecord = { values, enteredAt: prev?.enteredAt ?? Date.now() }
  setState({ records: { ...state.records, checkpoints: { ...state.records.checkpoints, [id]: rec } } })
  persist(
    () => idb.put('checkpoints', id, rec),
    (c, u) => c.putCheckpoint(u, id, rec),
  )
}

export function deleteCheckpoint(id: string) {
  const { [id]: _removed, ...rest } = state.records.checkpoints
  setState({ records: { ...state.records, checkpoints: rest } })
  persist(
    () => idb.remove('checkpoints', id),
    (c, u) => c.removeCheckpoint(u, id),
  )
}

export function updateSettings(change: Partial<Settings>) {
  const settings = { ...state.settings, ...change }
  setState({ settings })
  persist(
    () => idb.put('meta', 'settings', settings),
    (c, u) => c.putSettings(u, settings),
  )
}

export function dismissError() {
  setState({ error: null })
}

// ---- 書き出しと読み込み ----

export function exportJson(): string {
  return JSON.stringify(buildExport(state.records, state.settings), null, 2)
}

/** 読み込んだ記録を、今の記録と統合する (merge) か、置き換える (replace) */
export function importRecords(incoming: Records, incomingSettings: Partial<Settings>, how: 'merge' | 'replace') {
  const previous = state.records
  const records = how === 'merge' ? mergeRecords(previous, incoming) : incoming
  const settings = how === 'merge' ? state.settings : { ...defaultSettings, ...incomingSettings }
  setState({ records, settings, epoch: state.epoch + 1 })
  persist(
    () => writeLocal(records, settings),
    (c, u) => c.putMany(u, records, settings, how === 'replace' ? previous : undefined),
  )
}
