import { appVersion, isAndroidApp, ringtonePlugin, updaterPlugin } from './native.js'
import { withTimeout } from './timeout.js'
import { readNotes } from './log.js'

/**
 * 안드로이드 기능이 실제로 닿는지 하나씩 두드려 보고 결과를 모은다.
 *
 * 무언가 "반응이 없다"고 할 때, 화면만 보고는 어느 걸음에서 막혔는지 알 수 없다.
 * 폰을 컴퓨터에 연결해 기록을 봐야 하는데 그건 쉬운 일이 아니다.
 * 그래서 앱이 스스로 두드려 보고 말해 주도록 했다.
 *
 * 각 두드림에는 시간 제한이 있다. 답이 없으면 "답 없음"도 훌륭한 단서다.
 */

const KNOCK_TIMEOUT_MS = 8000

async function knock(label, run) {
  try {
    const value = await withTimeout(run(), KNOCK_TIMEOUT_MS, '답이 없어요 (시간 초과)')
    return { label, ok: true, detail: value ?? '됨' }
  } catch (err) {
    return { label, ok: false, detail: err?.message || '알 수 없는 문제' }
  }
}

export async function runDiagnostics() {
  const results = []

  if (!isAndroidApp()) {
    return [{ label: '실행 환경', ok: false, detail: '안드로이드 앱이 아니에요 (브라우저)' }]
  }

  results.push(
    await knock('앱 버전', async () => {
      const v = await appVersion()
      return v ? `${v.name} (번호 ${v.code})` : '알 수 없음'
    }),
  )

  // ── 벨소리 기능 ──
  let ringtone = null
  results.push(
    await knock('벨소리 기능 연결', async () => {
      ringtone = await ringtonePlugin()
      return '연결됨'
    }),
  )

  if (ringtone) {
    results.push(
      await knock('설정 변경 권한 확인', async () => {
        const { granted } = await ringtone.canWriteSettings()
        return granted ? '켜져 있음' : '꺼져 있음'
      }),
    )
    results.push(await knock('받을 준비 (beginTransfer)', async () => ringtone.beginTransfer({}).then(() => '됨')))
    results.push(
      await knock('조각 보내기 (appendChunk)', async () =>
        // 아주 작은 조각 하나만 보내 본다. "AAAA"는 3바이트짜리 값이다.
        ringtone.appendChunk({ data: 'AAAA' }).then(() => '됨'),
      ),
    )
    results.push(await knock('정리 (cancelTransfer)', async () => ringtone.cancelTransfer({}).then(() => '됨')))
  }

  // ── 업데이트 기능 ──
  let updater = null
  results.push(
    await knock('업데이트 기능 연결', async () => {
      updater = await updaterPlugin()
      return '연결됨'
    }),
  )

  if (updater) {
    results.push(
      await knock('설치 권한 확인', async () => {
        const { granted } = await updater.canInstall()
        return granted ? '켜져 있음' : '꺼져 있음'
      }),
    )
  }

  return results
}

/** 결과와 기록을 사람이 읽고 옮겨 적기 좋은 글자로 만든다. */
export function formatDiagnostics(results) {
  const checks = results.map((r) => `${r.ok ? 'O' : 'X'} ${r.label}: ${r.detail}`).join('\n')
  const notes = readNotes()
  if (notes.length === 0) return checks
  return `${checks}\n\n— 방금 있었던 일 —\n${notes.join('\n')}`
}
