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

/**
 * 실제로 오려내어 WAV 파일을 만든다. 브라우저에서만 동작한다.
 * 결과: Blob (audio/wav)
 */
export async function cutSegment(file, start, end) {
  const Ctx = globalThis.AudioContext ?? globalThis.webkitAudioContext
  if (!Ctx) throw new Error('이 기기에서는 구간을 잘라낼 수 없어요')

  const context = new Ctx()
  try {
    const bytes = await file.arrayBuffer()
    const decoded = await context.decodeAudioData(bytes)

    const { start: from, end: to } = clampSegment(start, end, decoded.duration)
    const channels = []
    for (let c = 0; c < decoded.numberOfChannels; c += 1) {
      channels.push(decoded.getChannelData(c))
    }

    const samples = mixToMono(channels, decoded.sampleRate, from, to)
    return new Blob([encodeWav(samples, decoded.sampleRate)], { type: 'audio/wav' })
  } finally {
    // 소리 장치를 붙잡고 있으면 재생에 방해가 된다. 반드시 놓아 준다.
    context.close?.()
  }
}
