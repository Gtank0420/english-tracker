// 端末内保存 (IndexedDB) の最小限のラッパー
const DB_NAME = 'english-tracker'
const VERSION = 1
export type StoreName = 'days' | 'checkpoints' | 'meta'

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      for (const name of ['days', 'checkpoints', 'meta']) {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

/** ストアの中身をすべて { key: value } で読む */
export async function readAll<T>(store: StoreName): Promise<Record<string, T>> {
  const db = await openDb()
  const tx = db.transaction(store, 'readonly')
  const os = tx.objectStore(store)
  const [keys, values] = await Promise.all([
    new Promise<IDBValidKey[]>((res, rej) => {
      const r = os.getAllKeys()
      r.onsuccess = () => res(r.result)
      r.onerror = () => rej(r.error)
    }),
    new Promise<T[]>((res, rej) => {
      const r = os.getAll()
      r.onsuccess = () => res(r.result as T[])
      r.onerror = () => rej(r.error)
    }),
  ])
  await done(tx)
  return Object.fromEntries(keys.map((k, i) => [String(k), values[i]!]))
}

export async function put(store: StoreName, key: string, value: unknown): Promise<void> {
  const db = await openDb()
  const tx = db.transaction(store, 'readwrite')
  tx.objectStore(store).put(value, key)
  await done(tx)
}

export async function remove(store: StoreName, key: string): Promise<void> {
  const db = await openDb()
  const tx = db.transaction(store, 'readwrite')
  tx.objectStore(store).delete(key)
  await done(tx)
}

export async function clearAll(): Promise<void> {
  const db = await openDb()
  const tx = db.transaction(['days', 'checkpoints', 'meta'], 'readwrite')
  for (const name of ['days', 'checkpoints', 'meta'] as const) tx.objectStore(name).clear()
  await done(tx)
}
