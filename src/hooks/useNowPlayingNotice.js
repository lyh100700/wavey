import { useEffect, useRef, useState } from 'react'

/**
 * 앱을 벗어나도 상태바에 Wavey를 남겨 둔다.
 *
 * 안드로이드는 화면에 보이지 않는 앱을 언제든 재워 버린다. 음악이 끊기지 않으려면
 * "지금 일하는 중"이라고 알림을 하나 띄워 둬야 하는데(포그라운드 서비스),
 * 그 알림이 곧 사용자가 보게 되는 상단 아이콘과 재생 버튼이 된다.
 *
 * ── 알림을 함부로 갱신하면 안 되는 이유 ──
 *
 * 쓰고 있는 플러그인의 updateForegroundService는 안드로이드와의 약속을 어긴다.
 * startForegroundService()를 부르면 "곧 startForeground()를 부르겠다"는 약속이
 * 성립하고, 5초 안에 지키지 않으면 시스템이 서비스를 죽인다. 그런데 갱신 경로는
 * 알림만 다시 그리고 startForeground()를 부르지 않는다.
 *
 * 그래서 곡이 바뀔 때마다 갱신하면 두어 곡 만에 서비스가 죽고, 앱이 평범한
 * 백그라운드 앱으로 강등돼 재생이 멈춘다.
 *
 * 대신 이렇게 한다.
 *   - 갱신 경로는 아예 쓰지 않는다. 시작 경로만 쓴다 (이쪽은 약속을 지킨다).
 *   - 시작은 앱이 화면에 보일 때만 한다. 안드로이드 12부터는 백그라운드에서
 *     포그라운드 서비스를 새로 띄우는 것 자체가 막혀 있다.
 *   - 앱이 뒤에 있는 동안에는 알림에 손대지 않는다. 곡 제목은 잠시 옛것으로
 *     남지만, 재생이 끊기지 않는 쪽이 훨씬 중요하다.
 *   - 앱으로 돌아오면 그때 최신 곡으로 새로 고친다.
 *
 * 안드로이드 APK로 실행할 때만 동작한다. 브라우저에서는 아무 일도 하지 않는다.
 */

const CHANNEL_ID = 'wavey-playback'
const NOTIFICATION_ID = 1

const BUTTON_PREV = 1
const BUTTON_TOGGLE = 2
const BUTTON_NEXT = 3

const IMPORTANCE_LOW = 2 // 조용히 뜨되 상태바에는 남는다
const SERVICE_TYPE_MEDIA_PLAYBACK = 2 // 안드로이드의 '미디어 재생' 종류 번호

// 곡이 넘어가는 순간 재생 상태가 잠깐 멈춤으로 튄다. 그대로 반영하면 알림이
// 깜빡이고 서비스를 두 번 건드리게 되므로, 잠시 기다렸다 확정된 상태만 그린다.
const SETTLE_MS = 600

async function loadPlugins() {
  const { Capacitor } = await import('@capacitor/core')
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') return null
  const [{ ForegroundService }, { App }] = await Promise.all([
    import('@capawesome-team/capacitor-android-foreground-service'),
    import('@capacitor/app'),
  ])
  return { ForegroundService, App }
}

export default function useNowPlayingNotice({
  track,
  playing,
  sourceLabel,
  onTogglePlay,
  onNext,
  onPrev,
  onProblem,
}) {
  const serviceRef = useRef(null)
  const runningRef = useRef(false)
  const timerRef = useRef(null)
  const [ready, setReady] = useState(false)
  // 앱이 화면에 보이는 중인지. 뒤에 있는 동안에는 알림에 손대지 않는다.
  const [appActive, setAppActive] = useState(true)

  const actions = useRef({})
  actions.current = { onTogglePlay, onNext, onPrev, onProblem }

  useEffect(() => {
    let cancelled = false
    const handles = []

    const setup = async () => {
      const plugins = await loadPlugins()
      if (!plugins || cancelled) return
      const { ForegroundService, App } = plugins
      serviceRef.current = ForegroundService

      await ForegroundService.createNotificationChannel({
        id: CHANNEL_ID,
        name: '재생 중',
        description: 'Wavey가 재생 중일 때 상단에 남는 알림이에요',
        importance: IMPORTANCE_LOW,
      })

      let status = await ForegroundService.checkPermissions()
      if (status?.display !== 'granted') status = await ForegroundService.requestPermissions()
      if (status?.display !== 'granted') {
        actions.current.onProblem?.(
          '알림 권한이 꺼져 있어요. 설정 → 앱 → Wavey → 알림에서 켜 주세요',
        )
        return
      }

      handles.push(
        await ForegroundService.addListener('buttonClicked', ({ buttonId }) => {
          if (buttonId === BUTTON_PREV) actions.current.onPrev?.()
          else if (buttonId === BUTTON_TOGGLE) actions.current.onTogglePlay?.()
          else if (buttonId === BUTTON_NEXT) actions.current.onNext?.()
        }),
      )
      handles.push(
        await App.addListener('appStateChange', ({ isActive }) => setAppActive(isActive)),
      )

      if (cancelled) {
        handles.forEach((h) => h?.remove?.())
        return
      }
      setReady(true)
    }

    setup().catch((err) => {
      if (cancelled) return
      actions.current.onProblem?.(`상단 알림 준비 실패: ${err?.message ?? err}`)
    })

    return () => {
      cancelled = true
      handles.forEach((h) => h?.remove?.())
      clearTimeout(timerRef.current)
      if (runningRef.current) serviceRef.current?.stopForegroundService?.().catch(() => {})
      runningRef.current = false
    }
  }, [])

  useEffect(() => {
    const service = serviceRef.current
    if (!service || !ready) return undefined

    // 틀 것이 없으면 알림을 치운다. 멈추는 건 뒤에 있어도 허용된다.
    if (!track) {
      if (runningRef.current) {
        service.stopForegroundService().catch(() => {})
        runningRef.current = false
      }
      return undefined
    }

    // 앱이 뒤에 있으면 그대로 둔다. 여기서 건드리면 서비스가 죽어 재생이 끊긴다.
    if (!appActive) return undefined

    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      service
        .startForegroundService({
          id: NOTIFICATION_ID,
          title: track.title,
          body: `${playing ? '재생 중' : '일시정지'} · ${sourceLabel}`,
          smallIcon: 'ic_stat_wavey',
          silent: true,
          notificationChannelId: CHANNEL_ID,
          serviceType: SERVICE_TYPE_MEDIA_PLAYBACK,
          buttons: [
            { id: BUTTON_PREV, title: '이전' },
            { id: BUTTON_TOGGLE, title: playing ? '일시정지' : '재생' },
            { id: BUTTON_NEXT, title: '다음' },
          ],
        })
        .then(() => {
          runningRef.current = true
        })
        .catch((err) => {
          actions.current.onProblem?.(`상단 알림 실패: ${err?.message ?? err}`)
        })
    }, SETTLE_MS)

    return () => clearTimeout(timerRef.current)
  }, [ready, appActive, track?.id, track?.title, playing, sourceLabel])
}
