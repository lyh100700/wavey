/**
 * 브라우저 안의 저장소(IndexedDB)에 미디어 파일과 목록을 보관한다.
 *
 * blob: 주소는 앱을 닫는 순간 사라지기 때문에, 주소가 아니라 **파일 자체**를 넣어 둔다.
 * 다음에 앱을 열면 파일을 꺼내 새 주소를 만들어 준다.
 *
 * 외부 라이브러리 없이 IndexedDB를 직접 쓴다 — 앱이 작아서 이 정도면 충분하다.
 */

const DB_NAME = 'wavey'
const DB_VERSION = 1
const TRACKS = 'tracks'
const META = 'meta'

let dbPromise = null

function openDB() {
  if (dbPromise) return dbPromise

  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('이 브라우저는 저장 기능을 지원하지 않아요'))
      return
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(TRACKS)) {
        const store = db.createObjectStore(TRACKS, { keyPath: 'id' })
        store.createIndex('source', 'source', { unique: false })
      }
      if (!db.objectStoreNames.contains(META)) {
        db.createObjectStore(META, { keyPath: 'key' })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })

  // 한 번 실패하면 다음 호출에서 다시 시도할 수 있게 캐시를 비운다.
  dbPromise.catch(() => {
    dbPromise = null
  })

  return dbPromise
}

/**
 * 트랜잭션 하나를 열어 work를 실행하고, 트랜잭션이 완전히 끝난 뒤에 결과를 준다.
 * work가 요청(IDBRequest)을 돌려주면 그 요청의 결과를 꺼내 준다.
 */
function runTx(storeName, mode, work) {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, mode)
        const store = tx.objectStore(storeName)

        let handle
        try {
          handle = work(store)
        } catch (err) {
          reject(err)
          return
        }

        tx.oncomplete = () => resolve(handle instanceof IDBRequest ? handle.result : handle)
        tx.onerror = () => reject(tx.error)
        tx.onabort = () => reject(tx.error)
      }),
  )
}

/** 화면에서 쓰는 트랙을 저장용 기록으로 바꾼다. blob 주소는 버린다. */
function toRecord(track, source) {
  return {
    id: track.id,
    source,
    order: track.order ?? 0,
    kind: track.kind,
    title: track.title,
    fileName: track.fileName,
    size: track.size,
    duration: track.duration ?? 0,
    path: track.path ?? '',
    file: track.file, // File 객체 자체를 넣는다 — 브라우저가 내용을 복사해 보관한다
  }
}

/** 저장된 기록을 화면에서 쓸 트랙으로 되돌린다. 새 blob 주소를 만들어 붙인다. */
function fromRecord(record) {
  return {
    id: record.id,
    order: record.order ?? 0,
    kind: record.kind,
    title: record.title,
    fileName: record.fileName,
    size: record.size,
    duration: record.duration ?? 0,
    path: record.path ?? '',
    file: record.file,
    url: URL.createObjectURL(record.file),
  }
}

/**
 * 저장된 모든 것을 불러온다.
 * 저장소를 못 열더라도 앱은 계속 돌아가야 하므로, 실패하면 빈 결과를 준다.
 */
export async function loadLibrary() {
  const empty = { playlist: [], folder: [], meta: {}, ok: false }
  try {
    const rows = await runTx(TRACKS, 'readonly', (store) => store.getAll())
    const metaRows = await runTx(META, 'readonly', (store) => store.getAll())

    const meta = {}
    for (const row of metaRows ?? []) meta[row.key] = row.value

    const playlist = []
    const folder = []
    for (const record of rows ?? []) {
      // 파일이 깨졌으면 조용히 건너뛴다.
      if (!record?.file) continue
      const track = fromRecord(record)
      if (record.source === 'folder') folder.push(track)
      else playlist.push(track)
    }

    const byOrder = (a, b) => a.order - b.order
    playlist.sort(byOrder)
    folder.sort(byOrder)

    return { playlist, folder, meta, ok: true }
  } catch {
    return empty
  }
}

/** 트랙 여러 개를 저장하거나 갱신한다. */
export async function saveTracks(tracks, source) {
  if (!tracks?.length) return { ok: true }
  try {
    await runTx(TRACKS, 'readwrite', (store) => {
      for (const track of tracks) store.put(toRecord(track, source))
    })
    return { ok: true }
  } catch (err) {
    // 저장 공간이 꽉 찬 경우를 따로 알려 준다.
    const full = err?.name === 'QuotaExceededError'
    return { ok: false, full, error: err }
  }
}

/** 트랙 하나의 바뀐 정보를 덮어쓴다 (재생 길이를 알아냈을 때 등). */
export async function updateTrack(track, source) {
  return saveTracks([track], source)
}

export async function deleteTrack(id) {
  try {
    await runTx(TRACKS, 'readwrite', (store) => store.delete(id))
    return { ok: true }
  } catch {
    return { ok: false }
  }
}

/** 플레이리스트 또는 폴더 쪽을 통째로 비운다. */
export async function clearSource(source) {
  try {
    await runTx(TRACKS, 'readwrite', (store) => {
      const index = store.index('source')
      const cursorRequest = index.openCursor(IDBKeyRange.only(source))
      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result
        if (!cursor) return
        cursor.delete()
        cursor.continue()
      }
    })
    return { ok: true }
  } catch {
    return { ok: false }
  }
}

export async function saveMeta(key, value) {
  try {
    await runTx(META, 'readwrite', (store) => store.put({ key, value }))
    return { ok: true }
  } catch {
    return { ok: false }
  }
}

/** 지금 얼마나 쓰고 있는지 (표시용). 못 재면 null. */
export async function storageUsage() {
  try {
    if (!navigator.storage?.estimate) return null
    const { usage, quota } = await navigator.storage.estimate()
    return { usage: usage ?? 0, quota: quota ?? 0 }
  } catch {
    return null
  }
}
