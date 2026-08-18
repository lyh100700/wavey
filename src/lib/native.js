/**
 * 안드로이드 앱 안에서만 쓸 수 있는 기능들을 부르는 창구.
 *
 * 브라우저(PC 크롬 등)에서는 이 기능들이 아예 없다. 그래서 부르기 전에
 * isAndroidApp()으로 먼저 확인하고, 아니면 화면에서 버튼 자체를 숨긴다.
 *
 * Capacitor는 무거운 편이라 앱이 처음 뜰 때 같이 읽어들이면 시작이 느려진다.
 * 필요해지는 순간에 불러오도록(동적 import) 해 뒀다.
 */

let cached = null

async function capacitor() {
  if (!cached) cached = await import('@capacitor/core')
  return cached
}

/** 지금 안드로이드 앱으로 돌고 있는지. 브라우저면 false. */
export async function isAndroidApp() {
  try {
    const { Capacitor } = await capacitor()
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'
  } catch {
    return false
  }
}

const plugins = {}

/** 자바 쪽에 만들어 둔 기능 묶음을 가져온다. */
async function plugin(name) {
  if (!plugins[name]) {
    const { registerPlugin } = await capacitor()
    plugins[name] = registerPlugin(name)
  }
  return plugins[name]
}

export const ringtonePlugin = () => plugin('WaveyRingtone')
export const updaterPlugin = () => plugin('WaveyUpdater')

/** 이 앱의 버전 번호. 새 버전이 나왔는지 견주는 기준이 된다. */
export async function appVersion() {
  try {
    const { Capacitor } = await capacitor()
    if (!Capacitor.isNativePlatform()) return null
    const { App } = await import('@capacitor/app')
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
