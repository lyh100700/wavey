/**
 * 안드로이드 앱 안에서만 쓸 수 있는 기능들을 부르는 창구.
 *
 * 브라우저(PC 크롬 등)에서는 이 기능들이 아예 없다. 그래서 부르기 전에
 * isAndroidApp()으로 먼저 확인하고, 아니면 화면에서 버튼 자체를 숨긴다.
 *
 * ── 왜 위에서 바로 불러오나 ──
 *
 * 처음에는 앱 시작을 빠르게 하려고 필요해질 때 불러오도록(동적 import) 해 뒀다.
 * 그런데 그 불러오기가 폰에서 끝나지 않는 일이 생겼다. 실패도 성공도 아닌 채로
 * 기다리게 되니, 벨소리를 누르면 "시작"에서 아무 일도 일어나지 않았다.
 *
 * Capacitor는 어차피 앱에 들어 있고 크지도 않다. 아껴서 얻는 것보다 잃는 것이
 * 훨씬 크므로 위에서 바로 불러온다. 기다릴 일이 없으면 멈출 일도 없다.
 */
import { Capacitor, registerPlugin } from '@capacitor/core'
import { App } from '@capacitor/app'

/** 지금 안드로이드 앱으로 돌고 있는지. 브라우저면 false. */
export function isAndroidApp() {
  try {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'
  } catch {
    return false
  }
}

const plugins = {}

/** 자바 쪽에 만들어 둔 기능 묶음을 가져온다. 기다릴 것이 없다. */
function plugin(name) {
  if (!plugins[name]) plugins[name] = registerPlugin(name)
  return plugins[name]
}

export const ringtonePlugin = () => plugin('WaveyRingtone')
export const updaterPlugin = () => plugin('WaveyUpdater')

/** 이 앱의 버전 번호. 새 버전이 나왔는지 견주는 기준이 된다. */
export async function appVersion() {
  try {
    if (!Capacitor.isNativePlatform()) return null
    const info = await App.getInfo()
    return {
      // build는 빌드할 때마다 1씩 오르는 숫자다 (versionCode).
      code: Number(info.build) || 0,
      name: info.version ?? '',
    }
  } catch {
    return null
  }
}
