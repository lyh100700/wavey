/**
 * 새 버전 판단이 제대로 되는지 확인한다.
 *
 * 여기가 틀리면 두 가지 사고가 난다.
 *   - 새 버전이 나왔는데 안내가 안 뜬다.
 *   - 이미 최신인데 매번 업데이트하라고 조른다.
 *
 * 실행: npm test
 */
import assert from 'node:assert/strict'
import test from 'node:test'

const { parseVersionInfo, isNewer, FALLBACK_APK_URL } = await import('./update.js')

test('제대로 된 쪽지를 읽어 들인다', () => {
  const info = parseVersionInfo({
    versionCode: 42,
    versionName: '1.0.42 (abc1234)',
    apkUrl: 'https://example.com/wavey.apk',
    notes: '감기 기능 추가',
    sizeBytes: 10485760,
  })
  assert.equal(info.versionCode, 42)
  assert.equal(info.versionName, '1.0.42 (abc1234)')
  assert.equal(info.apkUrl, 'https://example.com/wavey.apk')
  assert.equal(info.notes, '감기 기능 추가')
  assert.equal(info.sizeBytes, 10485760)
})

test('글자로 온 쪽지도 읽는다', () => {
  const info = parseVersionInfo('{"versionCode": 7}')
  assert.equal(info.versionCode, 7)
})

test('망가진 쪽지는 버린다', () => {
  assert.equal(parseVersionInfo('이건 JSON이 아니다'), null)
  assert.equal(parseVersionInfo(null), null)
  assert.equal(parseVersionInfo({}), null)
  assert.equal(parseVersionInfo({ versionCode: 0 }), null)
  assert.equal(parseVersionInfo({ versionCode: -3 }), null)
  assert.equal(parseVersionInfo({ versionCode: '이상한 값' }), null)
})

test('APK 주소가 수상하면 기본 주소로 되돌린다', () => {
  // http나 엉뚱한 값이 오면 그대로 믿고 받아서는 안 된다.
  assert.equal(parseVersionInfo({ versionCode: 5, apkUrl: 'http://악성.example/x.apk' }).apkUrl, FALLBACK_APK_URL)
  assert.equal(parseVersionInfo({ versionCode: 5, apkUrl: 42 }).apkUrl, FALLBACK_APK_URL)
  assert.equal(parseVersionInfo({ versionCode: 5 }).apkUrl, FALLBACK_APK_URL)
})

test('번호가 더 클 때만 새 버전으로 본다', () => {
  const info = parseVersionInfo({ versionCode: 10 })
  assert.equal(isNewer(9, info), true)
  assert.equal(isNewer(10, info), false) // 같은 버전 — 조르지 않는다
  assert.equal(isNewer(11, info), false) // 내 쪽이 더 새것 (직접 빌드한 경우)
})

test('버전을 모르면 업데이트를 권하지 않는다', () => {
  const info = parseVersionInfo({ versionCode: 10 })
  assert.equal(isNewer(0, info), false)
  assert.equal(isNewer(NaN, info), false)
  assert.equal(isNewer(5, null), false)
})
