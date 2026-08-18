import { useEffect, useRef } from 'react'
import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'

/**
 * 안드로이드의 뒤로가기 버튼(또는 화면 가장자리 쓸어넘기기)을 가로챈다.
 *
 * Wavey는 화면이 하나뿐이라 뒤로 갈 곳이 없다. 그대로 두면 안드로이드가
 * 그냥 앱을 화면에서 치워 버릴 뿐 종료는 되지 않아서, 사용자 입장에서는
 * "뒤로가기를 눌러도 아무 일도 안 일어나는" 것처럼 보인다.
 *
 * 그래서 뒤로가기를 우리가 받아서, 정말 끄실 건지 먼저 여쭤 본다.
 *
 * 안드로이드 앱일 때만 동작한다. 브라우저에서는 아무 일도 하지 않는다.
 */
export default function useBackButton(onBack) {
  // 뒤로가기 수신기는 앱이 살아 있는 내내 붙어 있으므로,
  // 항상 최신 처리 함수를 보도록 ref에 담아 둔다.
  const handler = useRef(onBack)
  handler.current = onBack

  useEffect(() => {
    let cancelled = false
    let listener = null

    const setup = async () => {
      if (!Capacitor.isNativePlatform()) return
      const handle = await App.addListener('backButton', () => {
        handler.current?.()
      })
      if (cancelled) handle.remove()
      else listener = handle
    }

    setup().catch(() => {
      // 뒤로가기를 못 가로채도 앱의 다른 기능에는 지장이 없다.
    })

    return () => {
      cancelled = true
      listener?.remove()
    }
  }, [])
}

/** 앱을 완전히 종료한다. 브라우저에서는 할 수 있는 게 없어 조용히 넘어간다. */
export async function exitApp() {
  try {
    if (!Capacitor.isNativePlatform()) return
    await App.exitApp()
  } catch {
    // 종료에 실패해도 사용자가 직접 앱을 내리면 된다.
  }
}
