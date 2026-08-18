import { cutSegment } from './audio-trim.js'
import { isAndroidApp, ringtonePlugin } from './native.js'

/**
 * 곡을 전화 벨소리 · 알림음 · 알람음으로 지정한다.
 *
 * ── 왜 조각내어 보내나 ──
 *
 * 곡 파일은 앱 안쪽에만 있어서 전화 앱이 볼 수 없다. 그래서 안드로이드 쪽으로
 * 파일을 넘겨야 하는데, 웹과 안드로이드 사이의 통로는 값을 글자 하나로 붙여서
 * 넘긴다. 5MB 곡을 한 번에 보내면 7MB짜리 글자 덩어리가 되고, 그걸 만들고
 * 붙이고 다시 푸는 동안 화면이 통째로 멈춘다.
 *
 * 그래서 곡을 작은 조각으로 나눠 여러 번에 걸쳐 보낸다. 진행률도 함께 알려 줘서
 * 기다리는 동안 멈춘 것처럼 보이지 않게 한다.
 */

export const RINGTONE_TYPES = [
  { id: 'ringtone', label: '전화 벨소리' },
  { id: 'notification', label: '알림음' },
  { id: 'alarm', label: '알람음' },
]

// 한 번에 보낼 조각의 크기. 이 정도면 통로가 버거워하지 않는다.
const CHUNK_BYTES = 256 * 1024

// 원본을 통째로 벨소리로 쓸 때의 크기 제한.
const MAX_BYTES = 20 * 1024 * 1024

// 구간을 오려낼 때는 곡 전체를 메모리에 풀어야 해서 더 조심스럽게 잡는다.
const MAX_BYTES_FOR_CUT = 30 * 1024 * 1024

/** 벨소리 기능을 쓸 수 있는 환경인지 (안드로이드 앱일 때만). */
export const ringtoneSupported = isAndroidApp

/** 영상은 벨소리로 쓸 수 없다. */
export function canBeRingtone(track) {
  return Boolean(track) && track.kind !== 'video'
}

/** 조각 하나를 통로로 넘길 수 있는 글자(base64)로 바꾼다. */
function chunkToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('곡 파일을 읽지 못했어요'))
    reader.onload = () => {
      // 결과는 "data:...;base64,XXXX" 꼴이라 쉼표 뒤만 쓴다.
      const text = String(reader.result ?? '')
      const comma = text.indexOf(',')
      if (comma === -1) reject(new Error('곡 파일을 읽지 못했어요'))
      else resolve(text.slice(comma + 1))
    }
    reader.readAsDataURL(blob)
  })
}

/** 폴더에 넣을 수 있는 안전한 파일 이름으로 다듬는다. */
function safeFileName(track, extension) {
  const base = (track.title || 'wavey').replace(/[\\/:*?"<>|]/g, '_').trim()
  if (extension) return `${base || 'wavey'}.${extension}`

  const raw = track.fileName || `${base}.mp3`
  const cleaned = raw.replace(/[\\/:*?"<>|]/g, '_').trim()
  return cleaned || 'wavey-ringtone.mp3'
}

/** 기본 벨소리를 바꿀 수 있는 권한이 켜져 있는지. */
export async function canChangeSystemSound() {
  try {
    const plugin = await ringtonePlugin()
    const { granted } = await plugin.canWriteSettings()
    return Boolean(granted)
  } catch {
    return false
  }
}

/** 권한을 켜는 설정 화면을 연다. 돌아온 뒤의 상태를 알려 준다. */
export async function openSystemSoundSettings() {
  try {
    const plugin = await ringtonePlugin()
    const { granted } = await plugin.openWriteSettings()
    return Boolean(granted)
  } catch {
    // 이 화면이 없는 기기도 있다. 못 열어도 아래 저장은 계속 시도한다.
    return false
  }
}

/**
 * 실제로 지정한다.
 *
 * options
 *   type      — 'ringtone' | 'notification' | 'alarm'
 *   segment   — { start, end } 를 주면 그 구간만 오려낸다. 없으면 곡 전체.
 *   onStage   — 진행 상황을 알려 준다. ('cutting' | 'sending', 0~100)
 *
 * 결과: { ok, applied, message }
 *  - applied가 false면 벨소리 폴더에는 넣었지만 기본 지정까지는 못 한 것이다.
 */
export async function setAsRingtone(track, { type = 'ringtone', segment = null, onStage } = {}) {
  if (!canBeRingtone(track)) {
    return { ok: false, message: '영상은 벨소리로 쓸 수 없어요' }
  }
  if (!track.file) {
    return { ok: false, message: '이 곡의 파일을 찾지 못했어요' }
  }

  const limit = segment ? MAX_BYTES_FOR_CUT : MAX_BYTES
  if (track.file.size > limit) {
    return {
      ok: false,
      message: `파일이 너무 커요. ${Math.floor(limit / (1024 * 1024))}MB 이하 곡을 골라 주세요`,
    }
  }

  // 구간을 골랐으면 그 부분만 오려낸다. 오려낸 결과는 WAV가 된다.
  let payload = track.file
  let fileName = safeFileName(track)
  let mimeType = track.file.type || 'audio/mpeg'

  if (segment) {
    try {
      onStage?.('cutting', 0)
      payload = await cutSegment(track.file, segment.start, segment.end)
      fileName = safeFileName(track, 'wav')
      mimeType = 'audio/wav'
    } catch (err) {
      return { ok: false, message: err?.message || '구간을 잘라내지 못했어요' }
    }
  }

  if (payload.size === 0) {
    return { ok: false, message: '잘라낸 소리가 비어 있어요' }
  }

  let plugin
  try {
    plugin = await ringtonePlugin()
  } catch {
    return { ok: false, message: '이 기기에서는 벨소리를 설정할 수 없어요' }
  }

  try {
    await plugin.beginTransfer()

    let sent = 0
    while (sent < payload.size) {
      const upTo = Math.min(payload.size, sent + CHUNK_BYTES)
      const data = await chunkToBase64(payload.slice(sent, upTo))
      await plugin.appendChunk({ data })
      sent = upTo
      onStage?.('sending', Math.round((sent / payload.size) * 100))
    }

    const result = await plugin.commitTransfer({
      fileName,
      title: track.title,
      mimeType,
      type,
      setDefault: true,
    })
    return { ok: true, applied: Boolean(result?.applied) }
  } catch (err) {
    // 중간에 어긋났으면 안드로이드 쪽에 남은 임시 파일을 치운다.
    try {
      await plugin.cancelTransfer()
    } catch {
      // 치우기에 실패해도 다음 시도가 어차피 새로 시작한다.
    }
    return { ok: false, message: err?.message || '벨소리를 설정하지 못했어요' }
  }
}
