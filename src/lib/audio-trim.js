/**
 * 곡에서 원하는 구간만 오려낸다.
 *
 * ── 왜 WAV로 만드나 ──
 *
 * mp3 같은 압축 파일은 가운데를 그냥 자를 수 없다. 소리가 시간 순서대로
 * 차곡차곡 들어 있는 게 아니라, 앞뒤가 서로를 참고하며 압축돼 있기 때문이다.
 *
 * 그래서 브라우저에게 곡을 통째로 풀어 달라고 한 뒤(decodeAudioData),
 * 필요한 구간의 소릿값만 떠내어 WAV로 새로 담는다. WAV는 소릿값을 있는 그대로
 * 늘어놓은 형식이라 우리가 직접 만들 수 있고, 안드로이드도 벨소리로 잘 받아 준다.
 *
 * 대신 압축이 없어 파일이 커진다. 그래서 소리는 한 줄(모노)로 합치고,
 * 구간 길이에도 선을 그어 둔다. 벨소리는 30초 안팎이면 충분하다.
 */

/** 벨소리로 쓸 수 있는 구간의 최대 길이(초). */
export const MAX_SEGMENT_SECONDS = 40

/** 구간이 너무 짧으면 소리가 되다 만다. */
export const MIN_SEGMENT_SECONDS = 1

/** 구간의 처음과 끝에 넣는 짧은 여닫이(초). 뚝 끊겨 '틱' 하는 소리를 막는다. */
const FADE_SECONDS = 0.04

/**
 * 고른 구간을 곡 길이와 최대 길이 안으로 다듬는다.
 * 화면과 실제 오려내기가 같은 규칙을 쓰도록 여기 한 곳에 모아 둔다.
 */
export function clampSegment(start, end, duration) {
  const total = Number.isFinite(duration) && duration > 0 ? duration : 0
  if (total <= 0) return { start: 0, end: 0 }

  let from = Math.min(Math.max(0, Number(start) || 0), total)
  let to = Math.min(Math.max(0, Number(end) || 0), total)
  if (to < from) [from, to] = [to, from]

  // 너무 길면 시작점을 그대로 두고 뒤를 자른다.
  if (to - from > MAX_SEGMENT_SECONDS) to = from + MAX_SEGMENT_SECONDS

  // 너무 짧으면 뒤로 늘리고, 뒤에 자리가 없으면 앞으로 당긴다.
  if (to - from < MIN_SEGMENT_SECONDS) {
    to = Math.min(total, from + MIN_SEGMENT_SECONDS)
    from = Math.max(0, to - MIN_SEGMENT_SECONDS)
  }
  return { start: from, end: to }
}

/** 곡을 열었을 때 기본으로 잡아 줄 구간. 처음 30초(짧은 곡이면 곡 전체). */
export function defaultSegment(duration) {
  return clampSegment(0, Math.min(duration || 0, 30), duration)
}

/**
 * 여러 줄(스테레오)로 된 소릿값을 한 줄(모노)로 합치면서 구간만 떠낸다.
 * 앞뒤에는 짧은 여닫이를 넣는다.
 *
 * channels: 줄마다의 Float32Array 배열
 */
export function mixToMono(channels, sampleRate, start, end) {
  const from = Math.max(0, Math.floor(start * sampleRate))
  const length = Math.max(0, Math.floor((end - start) * sampleRate))
  const out = new Float32Array(length)
  if (length === 0 || channels.length === 0) return out

  const lines = channels.length
  for (let i = 0; i < length; i += 1) {
    let sum = 0
    for (let c = 0; c < lines; c += 1) {
      sum += channels[c][from + i] ?? 0
    }
    out[i] = sum / lines
  }

  // 여닫이 — 구간이 여닫이 두 개보다 짧으면 넣지 않는다.
  const fade = Math.floor(FADE_SECONDS * sampleRate)
  if (fade > 0 && length > fade * 2) {
    for (let i = 0; i < fade; i += 1) {
      const g = i / fade
      out[i] *= g
      out[length - 1 - i] *= g
    }
  }
  return out
}

/**
 * 소릿값(모노)을 WAV 파일 내용으로 담는다.
 * 16비트 PCM — 가장 널리 통하는 형식이다.
 */
export function encodeWav(samples, sampleRate) {
  const bytesPerSample = 2
  const dataSize = samples.length * bytesPerSample
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)

  const putText = (offset, text) => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i))
  }

  putText(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true) // 이 뒤로 남은 바이트 수
  putText(8, 'WAVE')

  putText(12, 'fmt ')
  view.setUint32(16, 16, true) // 형식 설명의 길이
  view.setUint16(20, 1, true) // 1 = 압축하지 않은 PCM
  view.setUint16(22, 1, true) // 소리 줄 수 (모노)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * bytesPerSample, true) // 초당 바이트
  view.setUint16(32, bytesPerSample, true)
  view.setUint16(34, 16, true) // 한 값당 비트 수

  putText(36, 'data')
  view.setUint32(40, dataSize, true)

  let offset = 44
  for (let i = 0; i < samples.length; i += 1) {
    // -1~1 범위를 벗어난 값은 잘라 낸다. 그대로 두면 소리가 깨진다.
    const v = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(offset, v < 0 ? v * 0x8000 : v * 0x7fff, true)
    offset += 2
  }
  return buffer
}

// 곡을 푸는 데 이보다 오래 걸리면 뭔가 잘못된 것이다. 영영 기다리게 두지 않는다.
const DECODE_TIMEOUT_MS = 60 * 1000

// 오려낸 소리의 촘촘함. 벨소리에는 이 정도면 충분하고, 기기마다 값이 달라지는
// 것도 막아 준다.
const OUTPUT_SAMPLE_RATE = 44100

/** 약속이 정해진 시간 안에 끝나지 않으면 포기한다. */
function withTimeout(promise, ms, message) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms)
    promise.then(resolve, reject).finally(() => clearTimeout(timer))
  })
}

/**
 * 곡을 소릿값으로 푼다.
 *
 * ── 왜 OfflineAudioContext인가 ──
 *
 * 보통 쓰는 AudioContext는 폰에서 '멈춤' 상태로 시작한다. 사용자가 화면을
 * 건드려 소리를 낼 준비가 되기 전까지는 깨어나지 않는데, 그 상태에서 곡을
 * 풀어 달라고 하면 일이 시작되지도, 실패하지도 않은 채 영영 기다리게 된다.
 *
 * OfflineAudioContext는 소리를 내보내지 않고 계산만 하는 쪽이라 이 문제가 없다.
 * 우리는 소리를 들려줄 게 아니라 값만 필요하므로 이쪽이 맞다.
 */
function decodeAudio(bytes) {
  const Offline = globalThis.OfflineAudioContext ?? globalThis.webkitOfflineAudioContext
  if (Offline) {
    // 길이 1짜리 껍데기면 된다. 푸는 데에는 쓰이지 않는다.
    return new Offline(1, 1, OUTPUT_SAMPLE_RATE).decodeAudioData(bytes)
  }

  // 아주 오래된 기기를 위한 대비책. 깨워 놓고 푼다.
  const Ctx = globalThis.AudioContext ?? globalThis.webkitAudioContext
  if (!Ctx) return Promise.reject(new Error('이 기기에서는 구간을 잘라낼 수 없어요'))

  const context = new Ctx()
  return context
    .resume()
    .catch(() => {
      // 깨우지 못해도 일단 풀어 보게 둔다.
    })
    .then(() => context.decodeAudioData(bytes))
    .finally(() => context.close?.())
}

/**
 * 실제로 오려내어 WAV 파일을 만든다. 브라우저에서만 동작한다.
 * 결과: Blob (audio/wav)
 */
export async function cutSegment(file, start, end, onStage) {
  let decoded
  try {
    onStage?.('reading', '곡 파일 읽기')
    const bytes = await file.arrayBuffer()
    onStage?.('cutting', '소리로 풀기')
    decoded = await withTimeout(
      decodeAudio(bytes),
      DECODE_TIMEOUT_MS,
      '곡을 푸는 데 너무 오래 걸려요. 곡 전체로 설정해 보세요',
    )
  } catch (err) {
    // 긴 곡은 푸는 데 메모리가 많이 든다. 실패하면 다른 길을 알려 준다.
    throw new Error(err?.message || '이 곡은 구간을 잘라낼 수 없어요. 곡 전체로 설정해 보세요')
  }

  const { start: from, end: to } = clampSegment(start, end, decoded.duration)
  const channels = []
  for (let c = 0; c < decoded.numberOfChannels; c += 1) {
    channels.push(decoded.getChannelData(c))
  }

  const samples = mixToMono(channels, decoded.sampleRate, from, to)
  return new Blob([encodeWav(samples, decoded.sampleRate)], { type: 'audio/wav' })
}
