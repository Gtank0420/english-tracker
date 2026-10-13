// Firebase (Google ログインと Firestore)。store.ts からだけ使う。起動を軽くするため動的に読み込む。
import { initializeApp } from 'firebase/app'
import { GoogleAuthProvider, getAuth, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth'
import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  initializeFirestore,
  onSnapshot,
  persistentLocalCache,
  persistentMultipleTabManager,
  setDoc,
  writeBatch,
  type DocumentReference,
} from 'firebase/firestore'
import { firebaseConfig } from '../firebase-config'
import type { IsoDate } from '../plan/types'
import { parseCheckpoint, parseDay, parseSettings } from './merge'
import type { CheckpointRecord, DayRecord, Records, Settings } from './types'

const app = initializeApp(firebaseConfig)
const auth = getAuth(app)
// 端末にも控えを持ち、オフラインで書いた分はつながったら送る
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
})

export interface UserInfo {
  uid: string
  email: string | null
  name: string | null
}

export function watchAuth(cb: (user: UserInfo | null) => void): () => void {
  return onAuthStateChanged(auth, (u) => cb(u ? { uid: u.uid, email: u.email, name: u.displayName } : null))
}

export async function login(): Promise<void> {
  await signInWithPopup(auth, new GoogleAuthProvider())
}

export async function logout(): Promise<void> {
  await signOut(auth)
}

const userDoc = (uid: string) => doc(db, 'users', uid)
const dayDoc = (uid: string, date: IsoDate) => doc(db, 'users', uid, 'days', date)
const cpDoc = (uid: string, id: string) => doc(db, 'users', uid, 'checkpoints', id)

export interface CloudHandlers {
  onDays: (days: Records['days']) => void
  onCheckpoints: (checkpoints: Records['checkpoints']) => void
  onSettings: (settings: Partial<Settings>) => void
  /** どれかの監視で未送信の書き込みがあるか */
  onPending: (source: 'days' | 'checkpoints' | 'user', pending: boolean) => void
  onError: (e: unknown) => void
}

/** 記録の変化を監視する。戻り値で監視をやめる */
export function subscribe(uid: string, h: CloudHandlers): () => void {
  const opts = { includeMetadataChanges: true }
  const unsubs = [
    onSnapshot(
      collection(db, 'users', uid, 'days'),
      opts,
      (snap) => {
        const days: Records['days'] = {}
        snap.forEach((d) => {
          const day = parseDay(d.data())
          if (day) days[d.id] = day
        })
        h.onDays(days)
        h.onPending('days', snap.metadata.hasPendingWrites)
      },
      h.onError,
    ),
    onSnapshot(
      collection(db, 'users', uid, 'checkpoints'),
      opts,
      (snap) => {
        const cps: Records['checkpoints'] = {}
        snap.forEach((d) => {
          const cp = parseCheckpoint(d.data())
          if (cp) cps[d.id] = cp
        })
        h.onCheckpoints(cps)
        h.onPending('checkpoints', snap.metadata.hasPendingWrites)
      },
      h.onError,
    ),
    onSnapshot(
      userDoc(uid),
      opts,
      (snap) => {
        h.onSettings(parseSettings(snap.data()?.settings) ?? {})
        h.onPending('user', snap.metadata.hasPendingWrites)
      },
      h.onError,
    ),
  ]
  return () => unsubs.forEach((u) => u())
}

/** クラウドの記録をすべて読む (ログイン時の統合用) */
export async function fetchAll(uid: string): Promise<{ records: Records; settings: Partial<Settings> | null }> {
  const [daySnap, cpSnap, userSnap] = await Promise.all([
    getDocs(collection(db, 'users', uid, 'days')),
    getDocs(collection(db, 'users', uid, 'checkpoints')),
    getDoc(userDoc(uid)),
  ])
  const records: Records = { days: {}, checkpoints: {} }
  daySnap.forEach((d) => {
    const day = parseDay(d.data())
    if (day) records.days[d.id] = day
  })
  cpSnap.forEach((d) => {
    const cp = parseCheckpoint(d.data())
    if (cp) records.checkpoints[d.id] = cp
  })
  const raw = userSnap.data()?.settings
  return { records, settings: raw === undefined ? null : parseSettings(raw) }
}

// ---- 書き込み ----
// オフラインのときは端末の控えに書き、つながったら Firestore が送る。

/** 完了の付け外しは1件ずつ足し引きして、別の端末の同時の変更を消さない */
export function setDone(uid: string, date: IsoDate, taskId: string, isDone: boolean, updatedAt: number) {
  return setDoc(dayDoc(uid, date), { done: isDone ? arrayUnion(taskId) : arrayRemove(taskId), updatedAt }, { merge: true })
}

export function setMemo(uid: string, date: IsoDate, day: DayRecord) {
  return setDoc(dayDoc(uid, date), { memo: day.memo, memoKind: day.memoKind, updatedAt: day.updatedAt }, { merge: true })
}

export function putCheckpoint(uid: string, id: string, rec: CheckpointRecord) {
  return setDoc(cpDoc(uid, id), rec)
}

export function removeCheckpoint(uid: string, id: string) {
  return deleteDoc(cpDoc(uid, id))
}

export function putSettings(uid: string, settings: Settings) {
  return setDoc(userDoc(uid), { settings }, { merge: true })
}

type Op = { ref: DocumentReference; data: object | null }

async function commitInChunks(ops: Op[]) {
  // 1回の一括書き込みは500件まで
  for (let i = 0; i < ops.length; i += 400) {
    const batch = writeBatch(db)
    for (const op of ops.slice(i, i + 400)) {
      if (op.data) batch.set(op.ref, op.data)
      else batch.delete(op.ref)
    }
    await batch.commit()
  }
}

/** 記録をまとめて書く。previous を渡すと、records にないものを消す (置き換え) */
export async function putMany(uid: string, records: Records, settings: Settings | null, previous?: Records) {
  const ops: Op[] = [
    ...Object.entries(records.days).map(([d, day]) => ({ ref: dayDoc(uid, d), data: day })),
    ...Object.entries(records.checkpoints).map(([id, cp]) => ({ ref: cpDoc(uid, id), data: cp })),
  ]
  if (previous) {
    for (const d of Object.keys(previous.days)) if (!records.days[d]) ops.push({ ref: dayDoc(uid, d), data: null })
    for (const id of Object.keys(previous.checkpoints)) if (!records.checkpoints[id]) ops.push({ ref: cpDoc(uid, id), data: null })
  }
  await commitInChunks(ops)
  if (settings) await putSettings(uid, settings)
}
