// 브라우저/웹뷰가 실제로 재생할 수 있는 확장자들.
// file.type이 비어 있는 경우(안드로이드 파일 선택기에서 흔하다)를 대비한 보조 판별용이다.
const AUDIO_EXT = ['mp3', 'wav', 'ogg', 'oga', 'm4a', 'aac', 'flac', 'opus', 'weba']
const VIDEO_EXT = ['mp4', 'webm', 'ogv', 'mov', 'm4v', 'mkv', '3gp']

export function extensionOf(name = '') {
  const i = name.lastIndexOf('.')
  return i === -1 ? '' : name.slice(i + 1).toLowerCase()
}

/** 파일이 오디오인지 비디오인지 판별한다. 둘 다 아니면 null. */
export function kindOf(file) {
  const ext = extensionOf(file.name)
  if (file.type?.startsWith('audio/') || AUDIO_EXT.includes(ext)) return 'audio'
  if (file.type?.startsWith('video/') || VIDEO_EXT.includes(ext)) return 'video'
  return null
}

/** "여름 바다.mp3" → "여름 바다" */
export function prettyName(name = '') {
  return name.replace(/\.[^.]+$/, '') || name
}

/** 초 → "3:07" / "1:02:33" */
export function formatTime(sec) {
  if (!Number.isFinite(sec) || sec < 0) return '0:00'
  const total = Math.floor(sec)
  const s = total % 60
  const m = Math.floor(total / 60) % 60
  const h = Math.floor(total / 3600)
  const mm = String(m).padStart(2, '0')
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`
}

/** 바이트 → "4.2 MB" */
export function formatSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return ''
  const units = ['B', 'KB', 'MB', 'GB']
  let v = bytes
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i += 1
  }
  return `${v < 10 && i > 0 ? v.toFixed(1) : Math.round(v)} ${units[i]}`
}

let seq = 0
export function makeId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  seq += 1
  return `track-${seq}-${Math.floor(performance.now())}`
}

/** File 객체들을 플레이리스트 트랙으로 변환한다. 재생 못 하는 파일은 걸러낸다. */
export function filesToTracks(fileList) {
  const accepted = []
  const rejected = []
  for (const file of Array.from(fileList ?? [])) {
    const kind = kindOf(file)
    if (!kind) {
      rejected.push(file.name)
      continue
    }
    accepted.push({
      id: makeId(),
      kind,
      title: prettyName(file.name),
      fileName: file.name,
      size: file.size,
      url: URL.createObjectURL(file),
      duration: 0,
    })
  }
  return { accepted, rejected }
}

/** 트랙마다 고정된 파스텔 색 한 쌍을 뽑아 준다 (제목 기반 해시). */
const PALETTES = [
  ['#70D6FF', '#A0E7E5'],
  ['#A0E7E5', '#B8F2E6'],
  ['#FF85A1', '#FFC2D1'],
  ['#8FD3F4', '#84FAB0'],
  ['#C3B1F5', '#A0E7E5'],
  ['#70D6FF', '#FF85A1'],
]

export function paletteFor(seed = '') {
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  }
  return PALETTES[hash % PALETTES.length]
}
