/**
 * 구간 오려내기가 제대로 계산되는지 확인한다.
 *
 * 여기가 틀리면 벨소리가 엉뚱한 데서 시작하거나, 파일이 지나치게 커지거나,
 * 안드로이드가 못 읽는 WAV가 만들어진다.
 *
 * 실행: npm test
 */
import assert from 'node:assert/strict'
import test from 'node:test'

const {
  clampSegment,
  defaultSegment,
  mixToMono,
  encodeWav,
  MAX_SEGMENT_SECONDS,
  MIN_SEGMENT_SECONDS,
} = await import('./audio-trim.js')

/* ── 구간 다듬기 ─────────────────────────────────────────── */

test('평범한 구간은 그대로 둔다', () => {
  assert.deepEqual(clampSegment(10, 40, 180), { start: 10, end: 40 })
})

test('곡 밖으로 나간 구간은 곡 안으로 끌어당긴다', () => {
  assert.deepEqual(clampSegment(-5, 200, 180), { start: 0, end: MAX_SEGMENT_SECONDS })
})

test('시작과 끝이 뒤바뀌어 들어와도 바로잡는다', () => {
  assert.deepEqual(clampSegment(50, 20, 180), { start: 20, end: 50 })
})

test('너무 긴 구간은 시작점을 두고 뒤를 자른다', () => {
  const { start, end } = clampSegment(30, 170, 180)
  assert.equal(start, 30)
  assert.equal(end - start, MAX_SEGMENT_SECONDS)
})

test('너무 짧은 구간은 최소 길이만큼 늘린다', () => {
  const { start, end } = clampSegment(10, 10.2, 180)
  assert.equal(end - start, MIN_SEGMENT_SECONDS)
})

test('곡 끝에서 짧게 잡으면 앞으로 당겨서 길이를 맞춘다', () => {
  const { start, end } = clampSegment(179.9, 180, 180)
  assert.equal(end, 180)
  assert.equal(end - start, MIN_SEGMENT_SECONDS)
})

test('길이를 모르는 곡은 빈 구간이 된다', () => {
  assert.deepEqual(clampSegment(0, 30, 0), { start: 0, end: 0 })
  assert.deepEqual(clampSegment(0, 30, NaN), { start: 0, end: 0 })
})

test('기본 구간은 처음 30초, 짧은 곡이면 곡 전체', () => {
  assert.deepEqual(defaultSegment(180), { start: 0, end: 30 })
  assert.deepEqual(defaultSegment(12), { start: 0, end: 12 })
})

/* ── 소릿값 합치기 ───────────────────────────────────────── */

test('두 줄을 한 줄로 평균 내어 합친다', () => {
  const left = new Float32Array([1, 1, 1, 1])
  const right = new Float32Array([0, 0, 0, 0])
  // 여닫이가 끼어들지 않도록 구간 전체를 쓴다 (4개는 여닫이 최소 길이보다 짧다)
  const out = mixToMono([left, right], 4, 0, 1)
  assert.equal(out.length, 4)
  for (const v of out) assert.equal(v, 0.5)
})

test('고른 구간만 떠낸다', () => {
  const one = new Float32Array([0, 1, 2, 3, 4, 5, 6, 7])
  const out = mixToMono([one], 8, 0.25, 0.5) // 8Hz에서 2~4번째
  assert.deepEqual(Array.from(out), [2, 3])
})

test('구간이 비면 빈 결과를 준다', () => {
  assert.equal(mixToMono([new Float32Array([1, 2])], 8, 0, 0).length, 0)
  assert.equal(mixToMono([], 8, 0, 1).length, 8)
})

test('긴 구간은 앞뒤가 서서히 커지고 잦아든다', () => {
  const sampleRate = 8000
  const one = new Float32Array(sampleRate).fill(1) // 1초
  const out = mixToMono([one], sampleRate, 0, 1)
  assert.ok(out[0] < 0.01, '맨 앞은 거의 들리지 않아야 한다')
  assert.ok(out[out.length - 1] < 0.01, '맨 뒤도 잦아들어야 한다')
  assert.equal(out[Math.floor(sampleRate / 2)], 1, '가운데는 그대로여야 한다')
})

/* ── WAV 담기 ────────────────────────────────────────────── */

test('WAV 머리말이 규격대로 담긴다', () => {
  const samples = new Float32Array([0, 0.5, -0.5, 1])
  const view = new DataView(encodeWav(samples, 44100))
  const text = (at, len) =>
    String.fromCharCode(...Array.from({ length: len }, (_, i) => view.getUint8(at + i)))

  assert.equal(text(0, 4), 'RIFF')
  assert.equal(text(8, 4), 'WAVE')
  assert.equal(text(12, 4), 'fmt ')
  assert.equal(text(36, 4), 'data')
  assert.equal(view.getUint16(20, true), 1, '압축하지 않은 PCM')
  assert.equal(view.getUint16(22, true), 1, '모노 한 줄')
  assert.equal(view.getUint32(24, true), 44100)
  assert.equal(view.getUint32(28, true), 44100 * 2, '초당 바이트')
  assert.equal(view.getUint16(34, true), 16, '16비트')
  assert.equal(view.getUint32(40, true), samples.length * 2, '소릿값 길이')
  assert.equal(view.getUint32(4, true), 36 + samples.length * 2, '남은 바이트 수')
})

test('소릿값이 16비트 정수로 옮겨진다', () => {
  const view = new DataView(encodeWav(new Float32Array([0, 1, -1]), 8000))
  assert.equal(view.getInt16(44, true), 0)
  assert.equal(view.getInt16(46, true), 32767)
  assert.equal(view.getInt16(48, true), -32768)
})

test('범위를 벗어난 값은 잘라 내어 소리가 깨지지 않게 한다', () => {
  const view = new DataView(encodeWav(new Float32Array([5, -5]), 8000))
  assert.equal(view.getInt16(44, true), 32767)
  assert.equal(view.getInt16(46, true), -32768)
})
