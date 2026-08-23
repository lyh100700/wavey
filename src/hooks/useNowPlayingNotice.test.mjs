/**
 * 재생 카드에 무엇을 실어 보내는지 확인한다.
 *
 * 폰의 알림창은 눈으로만 확인할 수 있어서, 자바 쪽에 넘기기 직전의 꾸러미를
 * 대신 들여다본다. 여기가 맞으면 알림에 잘못된 곡이 뜰 일은 없다.
 */
import assert from 'node:assert/strict'
import test from 'node:test'

import { nowPlayingPayload, driftedTooFar } from './useNowPlayingNotice.js'

const song = { id: 7, title: '바다', kind: 'audio' }

test('제목·출처·재생상태를 그대로 싣는다', () => {
  const payload = nowPlayingPayload({
    track: song,
    playing: true,
    position: 12.5,
    duration: 200,
    sourceLabel: '내 폴더',
    sentArtKey: null,
  })

  assert.equal(payload.title, '바다')
  assert.equal(payload.album, '내 폴더')
  assert.equal(payload.playing, true)
  assert.equal(payload.position, 12.5)
  assert.equal(payload.duration, 200)
})

test('영상과 음악을 구분해 적는다', () => {
  const audio = nowPlayingPayload({ track: song, sentArtKey: null })
  const video = nowPlayingPayload({ track: { ...song, kind: 'video' }, sentArtKey: null })

  assert.equal(audio.artist, '음악')
  assert.equal(video.artist, '영상')
})

test('출처가 비어 있어도 빈칸을 남기지 않는다', () => {
  const payload = nowPlayingPayload({ track: song, sourceLabel: '', sentArtKey: null })
  assert.equal(payload.album, 'Wavey')
})

test('길이를 아직 모르면 0으로 보낸다', () => {
  // 곡을 막 열었을 때는 길이가 NaN으로 들어온다. 그대로 보내면 잠금화면
  // 막대가 이상해지므로 0으로 눕혀 보낸다.
  const payload = nowPlayingPayload({
    track: song,
    position: Number.NaN,
    duration: undefined,
    sentArtKey: null,
  })

  assert.equal(payload.position, 0)
  assert.equal(payload.duration, 0)
})

test('곡이 바뀌면 앨범 그림을 함께 싣는다', () => {
  const payload = nowPlayingPayload({ track: song, sentArtKey: null })

  assert.equal(payload.artworkKey, '7')
  assert.ok('artwork' in payload, '새 곡이면 그림 자리가 있어야 한다')
})

test('같은 곡이면 앨범 그림을 다시 싣지 않는다', () => {
  // 그림은 글자로 바꾸면 꽤 큰 값이다. 일시정지 한 번에 매번 다시 보내면
  // 그만큼 느려지므로, 이름표만 보내고 자바 쪽이 그려 둔 것을 쓰게 한다.
  const payload = nowPlayingPayload({ track: song, sentArtKey: '7' })

  assert.equal(payload.artworkKey, '7')
  assert.ok(!('artwork' in payload), '같은 곡이면 그림을 빼야 한다')
})

test('재생 중 저절로 흘러간 만큼은 어긋난 것으로 보지 않는다', () => {
  // 10초라고 알린 뒤 30초가 지났으면 지금은 40초 언저리인 게 정상이다.
  const reported = { position: 10, playing: true }

  assert.equal(driftedTooFar({ position: 40, reported, elapsedSec: 30 }), false)
  assert.equal(driftedTooFar({ position: 41, reported, elapsedSec: 30 }), false)
})

test('막대를 끌어 옮기면 어긋난 것으로 본다', () => {
  const reported = { position: 10, playing: true }

  assert.equal(driftedTooFar({ position: 120, reported, elapsedSec: 3 }), true)
  assert.equal(driftedTooFar({ position: 0, reported, elapsedSec: 3 }), true)
})

test('멈춰 있었다면 시간이 흘러도 제자리여야 한다', () => {
  const reported = { position: 10, playing: false }

  assert.equal(driftedTooFar({ position: 10, reported, elapsedSec: 60 }), false)
  assert.equal(driftedTooFar({ position: 45, reported, elapsedSec: 60 }), true)
})
