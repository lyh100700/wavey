import { useEffect, useRef } from 'react'
import { artworkFor } from '../lib/artwork.js'

const SUPPORTED = typeof navigator !== 'undefined' && 'mediaSession' in navigator

/** 지원하지 않는 브라우저에서 조용히 넘어가도록 감싼다. */
function setHandler(action, handler) {
  try {
    navigator.mediaSession.setActionHandler(action, handler)
  } catch {
    // 이 동작을 모르는 브라우저 — 무시해도 된다.
  }
}

/**
 * 잠금화면 · 알림창 · 이어폰 버튼과 앱을 연결한다.
 *
 * 이걸 붙이면 화면을 꺼도 곡 제목과 ⏮ ▶ ⏭ 가 잠금화면에 뜨고,
 * 거기서 누른 버튼이 앱으로 그대로 전달된다.
 */
export default function useMediaSession({
  track,
  playing,
  currentTime,
  duration,
  sourceLabel,
  onPlay,
  onPause,
  onNext,
  onPrev,
  onSeek,
}) {
  // 잠금화면 버튼은 오래 살아 있으므로, 항상 최신 값을 보도록 ref에 담아 둔다.
  const latest = useRef({})
  latest.current = { currentTime, duration, onPlay, onPause, onNext, onPrev, onSeek }

  // 곡 정보 — 제목, 출처, 앨범 그림
  useEffect(() => {
    if (!SUPPORTED) return

    if (!track) {
      navigator.mediaSession.metadata = null
      return
    }

    const artwork = artworkFor(track.title)
    navigator.mediaSession.metadata = new window.MediaMetadata({
      title: track.title,
      artist: track.kind === 'video' ? '영상' : '음악',
      album: sourceLabel || 'Wavey',
      artwork: artwork ? [{ src: artwork, sizes: '512x512', type: 'image/png' }] : [],
    })
  }, [track?.id, track?.title, track?.kind, sourceLabel]) // eslint-disable-line react-hooks/exhaustive-deps

  // 재생 중인지 여부 — 잠금화면 버튼 모양이 이걸 따라간다
  useEffect(() => {
    if (!SUPPORTED) return
    navigator.mediaSession.playbackState = playing ? 'playing' : 'paused'
  }, [playing])

  // 잠금화면에서 누른 버튼을 앱으로 넘긴다
  useEffect(() => {
    if (!SUPPORTED) return undefined

    setHandler('play', () => latest.current.onPlay?.())
    setHandler('pause', () => latest.current.onPause?.())
    setHandler('previoustrack', () => latest.current.onPrev?.())
    setHandler('nexttrack', () => latest.current.onNext?.())
    setHandler('stop', () => latest.current.onPause?.())

    setHandler('seekbackward', (details) => {
      const step = details?.seekOffset || 10
      latest.current.onSeek?.(Math.max(0, latest.current.currentTime - step))
    })
    setHandler('seekforward', (details) => {
      const step = details?.seekOffset || 10
      const max = latest.current.duration || 0
      latest.current.onSeek?.(Math.min(max, latest.current.currentTime + step))
    })
    setHandler('seekto', (details) => {
      if (typeof details?.seekTime !== 'number') return
      latest.current.onSeek?.(details.seekTime)
    })

    return () => {
      for (const action of [
        'play',
        'pause',
        'previoustrack',
        'nexttrack',
        'stop',
        'seekbackward',
        'seekforward',
        'seekto',
      ]) {
        setHandler(action, null)
      }
    }
  }, [])

  // 잠금화면의 재생 위치 막대
  useEffect(() => {
    if (!SUPPORTED || !navigator.mediaSession.setPositionState) return
    if (!Number.isFinite(duration) || duration <= 0) return
    try {
      navigator.mediaSession.setPositionState({
        duration,
        playbackRate: 1,
        position: Math.min(Math.max(0, currentTime), duration),
      })
    } catch {
      // 위치를 못 알려도 재생에는 지장이 없다.
    }
  }, [currentTime, duration])
}
