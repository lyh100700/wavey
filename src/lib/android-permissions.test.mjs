/**
 * 자바 코드가 쓰는 기능에 맞는 권한이 AndroidManifest.xml에 적혀 있는지 확인한다.
 *
 * 권한은 두 곳에 있어야 짝이 맞는다. 코드에서 부르는 것과, 매니페스트에
 * 적어 두는 것. 매니페스트에 빠지면 조용히 실패한다 — 오류도 안 나고,
 * 폰 설정의 권한 목록에 앱이 아예 나타나지도 않아서 사용자가 켜 줄 수도 없다.
 *
 * 실제로 벨소리 기능을 만들면서 WRITE_SETTINGS를 빠뜨렸고, 그 탓에 곡이
 * 벨소리 폴더에는 들어가도 기본 소리로는 지정되지 않았다. 원인을 찾는 데
 * 오래 걸렸다. 다시는 같은 일이 없도록 여기서 막는다.
 *
 * 실행: npm test
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const ANDROID = 'android/app/src/main'
const manifest = readFileSync(join(ANDROID, 'AndroidManifest.xml'), 'utf8')

const javaDir = join(ANDROID, 'java/com/wavey/player')
const java = readdirSync(javaDir)
  .filter((f) => f.endsWith('.java'))
  .map((f) => readFileSync(join(javaDir, f), 'utf8'))
  .join('\n')

const declares = (permission) =>
  manifest.includes(`android.permission.${permission}`)

/** 이 기능을 쓰면 저 권한이 반드시 있어야 한다. */
const NEEDS = [
  {
    when: 'Settings.System.canWrite',
    what: '기본 벨소리 지정',
    permission: 'WRITE_SETTINGS',
  },
  {
    when: 'canRequestPackageInstalls',
    what: '새 버전 설치',
    permission: 'REQUEST_INSTALL_PACKAGES',
  },
  {
    when: 'getExternalStoragePublicDirectory',
    what: '안드로이드 9 이하에서 벨소리 폴더에 쓰기',
    permission: 'WRITE_EXTERNAL_STORAGE',
  },
]

for (const need of NEEDS) {
  test(`${need.what}을(를) 쓰면 ${need.permission} 권한이 적혀 있다`, () => {
    if (!java.includes(need.when)) return // 그 기능을 안 쓰면 볼 것도 없다
    assert.ok(
      declares(need.permission),
      `자바에서 ${need.when} 을 쓰는데 AndroidManifest.xml에 ` +
        `${need.permission} 이 없습니다. 이러면 폰 설정 목록에 앱이 나타나지 않아 ` +
        `사용자가 권한을 켜 줄 방법이 없습니다.`,
    )
  })
}

test('직접 만든 안드로이드 기능이 앱에 등록돼 있다', () => {
  const main = readFileSync(join(javaDir, 'MainActivity.java'), 'utf8')
  for (const plugin of ['WaveyRingtonePlugin', 'WaveyUpdaterPlugin']) {
    assert.ok(
      main.includes(`registerPlugin(${plugin}.class)`),
      `${plugin} 이 MainActivity에 등록되지 않았습니다. 등록하지 않으면 ` +
        `웹 화면에서 불러도 "구현되지 않음"으로 되돌아옵니다.`,
    )
  }
})

test('설치 파일을 넘겨줄 통행증(FileProvider) 경로가 있다', () => {
  const paths = readFileSync(join(ANDROID, 'res/xml/file_paths.xml'), 'utf8')
  assert.ok(
    paths.includes('external-files-path'),
    'file_paths.xml에 external-files-path가 없으면 설치 화면이 APK를 읽지 못합니다.',
  )
})
