/**
 * 저장 기능이 정말로 앱을 껐다 켠 것처럼 되살아나는지 확인한다.
 *
 * 실행: npm test
 */
import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import test from 'node:test'

// 브라우저에만 있는 것들을 흉내 낸다.
let urlSeq = 0
globalThis.URL.createObjectURL = () => `blob:fake-${(urlSeq += 1)}`
globalThis.URL.revokeObjectURL = () => {}

const {
  loadLibrary,
  saveTracks,
  updateTrack,
  deleteTrack,
  clearSource,
  saveMeta,
} = await import('./storage.js')

const makeTrack = (id, title, order, extra = {}) => ({
  id,
  order,
  kind: 'audio',
  title,
  fileName: `${title}.mp3`,
  size: 1234,
  duration: 0,
  path: '',
  file: new File([new Uint8Array([1, 2, 3])], `${title}.mp3`, { type: 'audio/mpeg' }),
  url: 'blob:temporary',
  ...extra,
})

test('저장한 곡이 그대로 되살아난다', async () => {
  await saveTracks([makeTrack('a', '밤바다', 0), makeTrack('b', '여름', 1)], 'playlist')

  const loaded = await loadLibrary()
  assert.equal(loaded.ok, true)
  assert.equal(loaded.playlist.length, 2)
  assert.deepEqual(
    loaded.playlist.map((t) => t.title),
    ['밤바다', '여름'],
  )
  // 파일 내용이 살아 있어야 새 주소를 만들 수 있다.
  assert.ok(loaded.playlist[0].file instanceof File)
  assert.match(loaded.playlist[0].url, /^blob:/)
})

test('자리 번호가 뒤섞여 저장돼도 순서대로 돌아온다', async () => {
  await clearSource('playlist')
  await saveTracks(
    [makeTrack('z', '셋째', 2), makeTrack('x', '첫째', 0), makeTrack('y', '둘째', 1)],
    'playlist',
  )

  const loaded = await loadLibrary()
  assert.deepEqual(
    loaded.playlist.map((t) => t.title),
    ['첫째', '둘째', '셋째'],
  )
})

test('플레이리스트와 폴더는 서로 섞이지 않는다', async () => {
  await clearSource('playlist')
  await clearSource('folder')
  await saveTracks([makeTrack('p1', '내가고른곡', 0)], 'playlist')
  await saveTracks([makeTrack('f1', '폴더곡', 0, { path: '앨범/폴더곡.mp3' })], 'folder')

  const loaded = await loadLibrary()
  assert.deepEqual(loaded.playlist.map((t) => t.title), ['내가고른곡'])
  assert.deepEqual(loaded.folder.map((t) => t.title), ['폴더곡'])
  assert.equal(loaded.folder[0].path, '앨범/폴더곡.mp3')
})

test('폴더만 비우면 플레이리스트는 남는다', async () => {
  await clearSource('folder')

  const loaded = await loadLibrary()
  assert.equal(loaded.folder.length, 0)
  assert.equal(loaded.playlist.length, 1, '플레이리스트가 함께 지워지면 안 된다')
})

test('곡 하나만 지우면 나머지는 남는다', async () => {
  await clearSource('playlist')
  await saveTracks([makeTrack('k1', '남을곡', 0), makeTrack('k2', '지울곡', 1)], 'playlist')

  await deleteTrack('k2')

  const loaded = await loadLibrary()
  assert.deepEqual(loaded.playlist.map((t) => t.title), ['남을곡'])
})

test('알아낸 재생 길이가 저장된다', async () => {
  await clearSource('playlist')
  const track = makeTrack('d1', '길이확인', 0)
  await saveTracks([track], 'playlist')

  await updateTrack({ ...track, duration: 187.5 }, 'playlist')

  const loaded = await loadLibrary()
  assert.equal(loaded.playlist[0].duration, 187.5)
})

test('재생 설정과 폴더 이름이 저장된다', async () => {
  await saveMeta('folderName', '여름앨범')
  await saveMeta('playback', { currentId: 'd1', playingSource: 'folder', volume: 0.4, repeat: 'one' })

  const loaded = await loadLibrary()
  assert.equal(loaded.meta.folderName, '여름앨범')
  assert.equal(loaded.meta.playback.volume, 0.4)
  assert.equal(loaded.meta.playback.repeat, 'one')
})

test('같은 곡을 다시 저장하면 덮어쓸 뿐 중복되지 않는다', async () => {
  await clearSource('playlist')
  const track = makeTrack('same', '한곡', 0)
  await saveTracks([track], 'playlist')
  await saveTracks([{ ...track, title: '이름바꿈' }], 'playlist')

  const loaded = await loadLibrary()
  assert.equal(loaded.playlist.length, 1)
  assert.equal(loaded.playlist[0].title, '이름바꿈')
})
