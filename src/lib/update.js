import { appVersion, isAndroidApp, updaterPlugin } from './native.js'

/**
 * 앱을 켤 때 새 버전이 나왔는지 확인하고, 있으면 받아서 설치까지 이어 준다.
 *
 * ── 어디를 보고 새 버전인지 아나 ──
 *
 * 빌드가 끝날 때마다 GitHub 릴리스에 APK와 함께 version.json이라는 작은 쪽지를
 * 같이 올려 둔다. 앱은 그 쪽지만 읽어 보고 "지금 깔린 것보다 번호가 크면 새 것"
 * 이라고 판단한다. 별도 서버를 둘 필요가 없다.
 *
 * ── 왜 보통 fetch를 안 쓰나 ──
 *
 * 앱 안의 웹 화면은 https://localhost 라는 주소로 돌아간다. 브라우저는 다른
 * 사이트의 파일을 함부로 읽지 못하게 막는데(CORS), GitHub 릴리스 파일에는
 * 읽어도 좋다는 표시가 붙어 있지 않아 그냥 fetch하면 막힌다.
 * 그래서 앱일 때는 안드로이드가 직접 받아 오는 통신 기능을 쓴다.
 */

// 릴리스 태그 이름이 'latest'로 고정돼 있어서 주소도 늘 같다.
// (GitHub의 '최신 릴리스' 자동 주소는 미리보기 릴리스를 건너뛰기 때문에 쓸 수 없다.)
const BASE = 'https://github.com/lyh100700/wavey/releases/download/latest'
export const VERSION_URL = `${BASE}/version.json`
export const FALLBACK_APK_URL = `${BASE}/wavey.apk`

/**
 * 받아 온 쪽지가 쓸 만한지 확인하고 정리한다.
 * 인터넷 중간에서 엉뚱한 내용이 올 수도 있어 형태를 꼭 확인한다.
 */
export function parseVersionInfo(raw) {
  const data = typeof raw === 'string' ? safeJson(raw) : raw
  if (!data || typeof data !== 'object') return null

  const code = Number(data.versionCode)
  if (!Number.isFinite(code) || code <= 0) return null

  const url = typeof data.apkUrl === 'string' && data.apkUrl.startsWith('https://')
    ? data.apkUrl
    : FALLBACK_APK_URL

  return {
    versionCode: Math.floor(code),
    versionName: typeof data.versionName === 'string' ? data.versionName : `빌드 ${code}`,
    apkUrl: url,
    notes: typeof data.notes === 'string' ? data.notes : '',
    sizeBytes: Number.isFinite(Number(data.sizeBytes)) ? Number(data.sizeBytes) : 0,
  }
}

function safeJson(text) {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

/** 지금 깔린 것보다 새 버전인지. 같거나 낮으면 false. */
export function isNewer(currentCode, info) {
  if (!info) return false
  if (!Number.isFinite(currentCode) || currentCode <= 0) return false
  return info.versionCode > currentCode
}

/** 버전 쪽지를 받아 온다. 못 받으면 null (인터넷이 없을 수도 있으니 조용히 넘어간다). */
export async function fetchVersionInfo() {
  // 중간에 남아 있는 옛 사본을 읽지 않도록 주소 뒤에 무의미한 값을 붙인다.
  const url = `${VERSION_URL}?t=${Date.now()}`
  try {
    if (await isAndroidApp()) {
      const { CapacitorHttp } = await import('@capacitor/core')
      const response = await CapacitorHttp.get({ url, readTimeout: 15000, connectTimeout: 15000 })
      if (response.status < 200 || response.status >= 300) return null
      return parseVersionInfo(response.data)
    }
    const response = await fetch(url, { cache: 'no-store' })
    if (!response.ok) return null
    return parseVersionInfo(await response.text())
  } catch {
    return null
  }
}

/**
 * 새 버전이 있는지 확인한다.
 * 결과: null(새 것 없음/확인 실패) 또는 { versionCode, versionName, apkUrl, ... }
 */
export async function checkForUpdate() {
  const current = await appVersion()
  if (!current) return null // 브라우저에서는 업데이트할 것이 없다
  const info = await fetchVersionInfo()
  return isNewer(current.code, info) ? info : null
}

/* ── 받기와 설치 ───────────────────────────────────────────── */

/** 이 앱이 앱을 설치해도 되는 상태인지. */
export async function canInstall() {
  try {
    const plugin = await updaterPlugin()
    const { granted } = await plugin.canInstall()
    return Boolean(granted)
  } catch {
    return false
  }
}

/** 설치를 허용하는 설정 화면을 연다. 돌아온 뒤의 상태를 알려 준다. */
export async function openInstallSettings() {
  try {
    const plugin = await updaterPlugin()
    const { granted } = await plugin.openInstallSettings()
    return Boolean(granted)
  } catch {
    return false
  }
}

/**
 * APK를 받아서 설치 화면까지 띄운다.
 * onProgress(percent)로 진행률을 알려 준다 (총 크기를 모르면 -1).
 */
export async function downloadAndInstall(info, onProgress) {
  const plugin = await updaterPlugin()
  let handle = null

  try {
    handle = await plugin.addListener('downloadProgress', ({ percent }) => {
      onProgress?.(typeof percent === 'number' ? percent : -1)
    })

    const { path } = await plugin.download({
      url: info.apkUrl,
      fileName: `wavey-${info.versionCode}.apk`,
    })
    await plugin.install({ path })
    return { ok: true }
  } catch (err) {
    return { ok: false, message: err?.message || '업데이트에 실패했어요' }
  } finally {
    handle?.remove?.()
  }
}
