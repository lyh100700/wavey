import { isAndroidApp, ringtonePlugin } from './native.js'

/**
 * 곡을 전화 벨소리 · 알림음 · 알람음으로 지정한다.
 *
 * 곡 파일은 앱 안쪽에만 있어서 전화 앱이 볼 수 없다. 그래서 파일 내용을
 * 글자로 바꿔 안드로이드 쪽으로 넘기면, 거기서 공용 벨소리 폴더에 사본을
 * 만들고 기본 벨소리로 지정해 준다.
 */

export const RINGTONE_TYPES = [
  { id: 'ringtone', label: '전화 벨소리' },
  { id: 'notification', label: '알림음' },
  { id: 'alarm', label: '알람음' },
]

// 벨소리는 짧은 곡을 쓰는 게 보통이다. 파일 내용을 글자로 바꿔 넘기는 방식이라
// 너무 큰 파일은 폰이 버거워하므로, 넉넉하되 선은 그어 둔다.
const MAX_BYTES = 20 * 1024 * 1024

/** 벨소리 기능을 쓸 수 있는 환경인지 (안드로이드 앱일 때만). */
export const ringtoneSupported = isAndroidApp

/** 영상은 벨소리로 쓸 수 없다. */
export function canBeRingtone(track) {
  return Boolean(track) && track.kind !== 'video'
}

/** 파일 내용을 안드로이드로 넘길 수 있는 글자(base64)로 바꾼다. */
function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('곡 파일을 읽지 못했어요'))
    reader.onload = () => {
      // 결과는 "data:audio/mpeg;base64,XXXX" 꼴이라 쉼표 뒤만 쓴다.
      const text = String(reader.result ?? '')
      const comma = text.indexOf(',')
      if (comma === -1) reject(new Error('곡 파일을 읽지 못했어요'))
      else resolve(text.slice(comma + 1))
    }
    reader.readAsDataURL(file)
  })
}

/** 폴더에 넣을 수 있는 안전한 파일 이름으로 다듬는다. */
function safeFileName(track) {
  const raw = track.fileName || `${track.title}.mp3`
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
    return false
  }
}

/**
 * 실제로 지정한다.
 * 결과: { ok, applied, message }
 *  - applied가 false면 벨소리 폴더에는 넣었지만 기본 지정까지는 못 한 것이다.
 */
export async function setAsRingtone(track, type = 'ringtone') {
  if (!canBeRingtone(track)) {
    return { ok: false, message: '영상은 벨소리로 쓸 수 없어요' }
  }
  if (!track.file) {
    return { ok: false, message: '이 곡의 파일을 찾지 못했어요' }
  }
  if (track.file.size > MAX_BYTES) {
    return { ok: false, message: '파일이 너무 커요. 20MB 이하 곡을 골라 주세요' }
  }

  try {
    const data = await toBase64(track.file)
    const plugin = await ringtonePlugin()
    const result = await plugin.save({
      fileName: safeFileName(track),
      title: track.title,
      mimeType: track.file.type || 'audio/mpeg',
      type,
      data,
      setDefault: true,
    })
    return { ok: true, applied: Boolean(result?.applied) }
  } catch (err) {
    return { ok: false, message: err?.message || '벨소리를 설정하지 못했어요' }
  }
}
