import { useEffect, useRef } from 'react'

/**
 * 앱을 벗어나도 상태바에 Wavey를 남겨 둔다.
 *
 * 안드로이드는 화면에 보이지 않는 앱을 언제든 재워 버린다. 음악이 끊기지 않으려면
 * "지금 일하는 중"이라고 알림을 하나 띄워 둬야 하는데(포그라운드 서비스),
 * 그 알림이 곧 사용자가 보게 되는 상단 아이콘과 재생 버튼이 된다.
 *
 * 안드로이드 APK로 실행할 때만 동작한다. 브라우저에서는 아무 일도 하지 않는다.
 */

const CHANNEL_ID = 'wavey-playback'
const NOTIFICATION_ID = 1

// 알림의 버튼들. 순서가 곧 화면에 보이는 순서다.
const BUTTON_PREV = 1
const BUTTON_TOGGLE = 2
const BUTTON_NEXT = 3

// 안드로이드의 '미디어 재생' 서비스 종류 번호.
// 플러그인의 타입 목록에는 없지만 값 자체는 그대로 전달되므로 직접 넘긴다.
const SERVICE_TYPE_MEDIA_PLAYBACK = 2

/** 안드로이드 앱으로 실행 중일 때만 플러그인을 불러온다. */
async function loadPlugin() {
  try {
    const { Capacitor } = await import('@capacitor/core')
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') return null
    const { ForegroundService } = await import(
      '@capawesome-team/capacitor-android-foreground-service'
    )
    return ForegroundService
  } catch {
    return null
  }
}

export default function useNowPlayingNotice({
  track,
  playing,
  sourceLabel,
  onTogglePlay,
  onNext,
  onPrev,
}) {
  const pluginRef = useRef(null)
  const readyRef = useRef(false)
  const runningRef = useRef(false)
  // 알림 버튼은 앱이 뒤에 있을 때 눌리므로, 늘 최신 동작을 보도록 담아 둔다.
  const actions = useRef({})
  actions.current = { onTogglePlay, onNext, onPrev }

  // 준비: 알림 채널을 만들고, 버튼 눌림을 받아 둔다.
  useEffect(() => {
    let cancelled = false
    let handle = null

    loadPlugin().then(async (plugin) => {
      if (!plugin || cancelled) return
      pluginRef.current = plugin

      try {
        await plugin.createNotificationChannel({
          id: CHANNEL_ID,
          name: '재생 중',
          description: 'Wavey가 재생 중일 때 상단에 남는 알림이에요',
          importance: 2, // 낮음 — 소리도 진동도 없이 조용히 뜬다
        })

        // 안드로이드 13부터는 알림을 띄우려면 허락을 받아야 한다.
        const status = await plugin.checkPermissions()
        if (status?.display !== 'granted') await plugin.requestPermissions()

        handle = await plugin.addListener('buttonClicked', ({ buttonId }) => {
          if (buttonId === BUTTON_PREV) actions.current.onPrev?.()
          else if (buttonId === BUTTON_TOGGLE) actions.current.onTogglePlay?.()
          else if (buttonId === BUTTON_NEXT) actions.current.onNext?.()
        })

        if (cancelled) {
          handle?.remove?.()
          return
        }
        readyRef.current = true
      } catch {
        // 알림을 못 띄워도 앱 자체는 멀쩡히 돌아가야 한다.
      }
    })

    return () => {
      cancelled = true
      handle?.remove?.()
      // 앱을 닫을 때 알림도 함께 걷어낸다.
      if (runningRef.current) pluginRef.current?.stopForegroundService?.().catch(() => {})
      runningRef.current = false
    }
  }, [])

  // 곡이나 재생 상태가 바뀔 때마다 알림 내용을 갈아 끼운다.
  useEffect(() => {
    const plugin = pluginRef.current
    if (!plugin || !readyRef.current) return

    // 틀 것이 없으면 알림도 치운다.
    if (!track) {
      if (runningRef.current) {
        plugin.stopForegroundService().catch(() => {})
        runningRef.current = false
      }
      return
    }

    const options = {
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
    }

    const call = runningRef.current
      ? plugin.updateForegroundService(options)
      : plugin.startForegroundService(options)

    call.then(() => {
      runningRef.current = true
    }).catch(() => {
      // 권한을 거부했거나 서비스를 못 띄운 경우 — 재생은 그대로 이어 간다.
    })
  }, [track?.id, track?.title, playing, sourceLabel])
}
