import { useCallback, useEffect, useRef, useState } from 'react'
import { isAndroidApp, nowPlayingPlugin } from '../lib/native.js'
import { artworkFor } from '../lib/artwork.js'

/**
 * 앱을 벗어나도 상단·잠금화면에 재생 카드를 남겨 둔다.
 *
 * 안드로이드는 화면에 보이지 않는 앱을 언제든 재워 버린다. 음악이 끊기지
 * 않으려면 "지금 일하는 중"이라고 알림을 하나 띄워 둬야 하는데(포그라운드
 * 서비스), 그 알림이 곧 사용자가 보게 되는 재생 카드가 된다.
 *
 * 예전에는 남이 만든 플러그인을 썼고, 그 플러그인의 갱신 기능이 서비스를
 * 죽여 버려서 "앱이 뒤에 있는 동안에는 알림에 손대지 않는다"는 규칙으로
 * 피해 다녔다. 그래서 곡이 바뀌어도 제목이 옛것으로 남아 있었다.
 *
 * 이제는 자바 쪽 서비스를 직접 만들었고(WaveyPlaybackService), 서비스가
 * 자기 알림을 조용히 갈아끼운다. 그래서 앱이 어디에 있든 그냥 알려 주면 된다.
 *
 * 안드로이드 APK로 실행할 때만 동작한다. 브라우저에서는 아무 일도 하지 않는다.
 */

// 잠금화면 위치 막대는 안드로이드가 알아서 굴려 주므로 매초 알릴 필요가 없다.
// 다만 사용자가 막대를 끌어 옮기면 실제 위치가 훌쩍 뛴다. 그 차이가 이 초를
// 넘으면 그때만 다시 알려 준다.
const DRIFT_TOLERANCE_SEC = 2

/**
 * 자바 쪽에 넘길 꾸러미를 만든다.
 *
 * 앨범 그림은 글자로 바꾸면 꽤 큰 값이라 곡마다 새로 보내면 느려진다.
 * 곡이 바뀌었을 때만 싣고, 같은 곡이면 이름표만 보내 이미 그려 둔 것을 쓰게 한다.
 */
export function nowPlayingPayload({ track, playing, position, duration, sourceLabel, sentArtKey }) {
  const key = String(track.id)
  const payload = {
    title: track.title,
    artist: track.kind === 'video' ? '영상' : '음악',
    album: sourceLabel || 'Wavey',
    playing,
    position: Number.isFinite(position) ? position : 0,
    duration: Number.isFinite(duration) ? duration : 0,
    artworkKey: key,
  }
  if (key !== sentArtKey) payload.artwork = artworkFor(track.title) ?? null
  return payload
}

/**
 * 알려 준 위치와 실제 위치가 너무 벌어졌는지.
 *
 * 재생 중이라면 알려 준 뒤 흐른 시간만큼은 저절로 나아갔을 테니, 그만큼을
 * 더한 값과 견준다. 멈춰 있었다면 그 자리에 그대로 있었어야 한다.
 */
export function driftedTooFar({ position, reported, elapsedSec }) {
  const expected = reported.position + (reported.playing ? elapsedSec : 0)
  return Math.abs(position - expected) > DRIFT_TOLERANCE_SEC
}

export default function useNowPlayingNotice({
  track,
  playing,
  currentTime,
  duration,
  sourceLabel,
  onPlay,
  onPause,
  onTogglePlay,
  onNext,
  onPrev,
  onSeek,
  onProblem,
}) {
  const pluginRef = useRef(null)
  const [ready, setReady] = useState(false)

  // 재생 카드의 버튼은 오래 살아 있으므로, 항상 최신 값을 보도록 ref에 담아 둔다.
  const actions = useRef({})
  actions.current = { onPlay, onPause, onTogglePlay, onNext, onPrev, onSeek, onProblem }

  const state = useRef({})
  state.current = { track, playing, currentTime, duration, sourceLabel }

  // 마지막으로 자바 쪽에 알려 준 내용. 같은 그림을 두 번 보내지 않고,
  // 위치가 얼마나 벌어졌는지 재는 기준이 된다.
  const sent = useRef({ artKey: null, position: 0, playing: false, at: 0 })

  /* ── 준비 ─────────────────────────────────────────────── */

  useEffect(() => {
    if (!isAndroidApp()) return undefined

    let cancelled = false
    let handle = null

    const setup = async () => {
      const plugin = nowPlayingPlugin()

      const { granted } = await plugin.requestNotify()
      if (!granted) {
        actions.current.onProblem?.(
          '알림 권한이 꺼져 있어요. 설정 → 앱 → Wavey → 알림에서 켜 주세요',
        )
        return
      }

      handle = await plugin.addListener('action', ({ action, position }) => {
        const a = actions.current
        if (action === 'play') a.onPlay?.()
        else if (action === 'pause') a.onPause?.()
        else if (action === 'toggle') a.onTogglePlay?.()
        else if (action === 'next') a.onNext?.()
        else if (action === 'prev') a.onPrev?.()
        else if (action === 'seek' && Number.isFinite(position)) a.onSeek?.(position)
      })

      if (cancelled) {
        handle?.remove?.()
        return
      }
      pluginRef.current = plugin
      setReady(true)
    }

    setup().catch((err) => {
      if (cancelled) return
      actions.current.onProblem?.(`재생 카드 준비 실패: ${err?.message ?? err}`)
    })

    return () => {
      cancelled = true
      handle?.remove?.()
      pluginRef.current?.hide?.().catch(() => {})
      pluginRef.current = null
    }
  }, [])

  /* ── 알리기 ───────────────────────────────────────────── */

  const push = useCallback(() => {
    const plugin = pluginRef.current
    const { track: t, playing: p, currentTime: c, duration: d, sourceLabel: s } = state.current
    if (!plugin || !t) return

    const payload = nowPlayingPayload({
      track: t,
      playing: p,
      position: c,
      duration: d,
      sourceLabel: s,
      sentArtKey: sent.current.artKey,
    })

    sent.current = {
      artKey: payload.artworkKey,
      position: payload.position,
      playing: p,
      at: Date.now(),
    }

    plugin.show(payload).catch((err) => {
      actions.current.onProblem?.(`재생 카드 실패: ${err?.message ?? err}`)
    })
  }, [])

  // 곡·재생상태·출처가 바뀌면 곧바로 알린다. 앱이 뒤에 있어도 상관없다.
  useEffect(() => {
    const plugin = pluginRef.current
    if (!plugin || !ready) return

    if (!track) {
      plugin.hide().catch(() => {})
      sent.current = { artKey: null, position: 0, playing: false, at: 0 }
      return
    }
    push()
  }, [ready, track?.id, track?.title, playing, sourceLabel, push]) // eslint-disable-line react-hooks/exhaustive-deps

  // 위치를 끌어 옮겼을 때만 따로 알린다. 그냥 흘러가는 동안에는 알리지 않는다.
  useEffect(() => {
    if (!ready || !track) return
    const elapsedSec = (Date.now() - sent.current.at) / 1000
    if (driftedTooFar({ position: currentTime, reported: sent.current, elapsedSec })) push()
  }, [ready, currentTime, track?.id, push]) // eslint-disable-line react-hooks/exhaustive-deps
}
