import { useCallback, useEffect, useRef, useState } from 'react'
import { formatTime } from '../lib/media.js'
import WaveGlyph from './WaveGlyph.jsx'

/**
 * 재생 바. 조작점(Thumb)은 물방울 모양이고, 지나온 구간에는 파도가 넘실거린다.
 * 드래그하는 동안에는 화면에만 반영하고, 손을 뗄 때 실제로 탐색(seek)한다.
 *
 * ── 게이지가 떨리지 않게 하는 법 ──
 *
 * 미디어 엘리먼트는 재생 위치를 1초에 네 번쯤, 그것도 들쭉날쭉한 간격으로
 * 알려 준다. 그 값을 그대로 막대 길이에 넣으면 뚝뚝 끊겨 움직여 떨려 보인다.
 *
 * 그래서 막대와 물방울의 위치만은 화면 그리는 주기(초당 60번)에 맞춰
 * 엘리먼트에서 직접 읽어 갱신한다. React 상태를 거치지 않으므로 화면 전체를
 * 다시 그리지도 않는다. 시간 글자는 초 단위라 네 번이면 충분해서 그대로 둔다.
 */
export default function SeekBar({
  currentTime = 0,
  duration = 0,
  playing = false,
  disabled = false,
  getMedia,
  onSeek,
  onScrubStart,
  onScrubEnd,
}) {
  const trackRef = useRef(null)
  const fillRef = useRef(null)
  const thumbRef = useRef(null)
  const [scrubTime, setScrubTime] = useState(null)

  const shown = scrubTime ?? currentTime

  const paint = useCallback((ratio) => {
    const pct = `${Math.min(1, Math.max(0, ratio)) * 100}%`
    if (fillRef.current) fillRef.current.style.width = pct
    if (thumbRef.current) thumbRef.current.style.left = pct
  }, [])

  // 위치 갱신의 주인. 드래그 중에는 손을, 재생 중에는 엘리먼트를 따라간다.
  useEffect(() => {
    if (scrubTime !== null) {
      paint(duration > 0 ? scrubTime / duration : 0)
      return undefined
    }

    if (!playing) {
      paint(duration > 0 ? currentTime / duration : 0)
      return undefined
    }

    let frame = 0
    const tick = () => {
      const el = getMedia?.()
      if (el && Number.isFinite(el.duration) && el.duration > 0) {
        paint(el.currentTime / el.duration)
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [playing, scrubTime, currentTime, duration, getMedia, paint])

  const timeAt = useCallback(
    (clientX) => {
      const el = trackRef.current
      if (!el || duration <= 0) return 0
      const rect = el.getBoundingClientRect()
      const r = (clientX - rect.left) / rect.width
      return Math.min(1, Math.max(0, r)) * duration
    },
    [duration],
  )

  const handlePointerDown = (e) => {
    if (disabled || duration <= 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    setScrubTime(timeAt(e.clientX))
    onScrubStart?.()
  }

  const handlePointerMove = (e) => {
    if (scrubTime === null) return
    setScrubTime(timeAt(e.clientX))
  }

  const endScrub = (e) => {
    if (scrubTime === null) return
    onSeek?.(timeAt(e.clientX))
    setScrubTime(null)
    onScrubEnd?.()
  }

  const handleKeyDown = (e) => {
    if (disabled || duration <= 0) return
    const step = e.shiftKey ? 30 : 5
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      onSeek?.(Math.min(duration, currentTime + step))
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      onSeek?.(Math.max(0, currentTime - step))
    } else if (e.key === 'Home') {
      e.preventDefault()
      onSeek?.(0)
    } else if (e.key === 'End') {
      e.preventDefault()
      onSeek?.(duration)
    }
  }

  return (
    <div className={`no-select w-full ${disabled ? 'opacity-50' : ''}`}>
      <div
        ref={trackRef}
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label="재생 위치"
        aria-valuemin={0}
        aria-valuemax={Math.max(0, Math.floor(duration))}
        aria-valuenow={Math.floor(shown)}
        aria-valuetext={`${formatTime(shown)} / ${formatTime(duration)}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endScrub}
        onPointerCancel={endScrub}
        onKeyDown={handleKeyDown}
        className={`group relative flex h-9 items-center outline-none ${
          disabled ? 'cursor-default' : 'cursor-pointer'
        }`}
      >
        {/* 아직 지나지 않은 구간 */}
        <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-soda/15 ring-1 ring-inset ring-white/60">
          {/* 지나온 구간 — 물결이 흐른다. 너비는 위 효과가 직접 다룬다. */}
          <div
            ref={fillRef}
            className="absolute inset-y-0 left-0 w-0 overflow-hidden rounded-full bg-gradient-to-r from-mint via-soda to-soda-deep"
          >
            <svg
              className={`absolute left-0 top-0 h-full w-[200%] text-white/45 ${
                playing ? 'animate-wave-slide' : ''
              }`}
              viewBox="0 0 1200 40"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path
                d="M0 22 C 75 6, 150 6, 225 22 S 375 38, 450 22 S 600 6, 675 22 S 825 38, 900 22 S 1050 6, 1125 22 S 1200 30, 1200 22 L1200 40 L0 40 Z"
                fill="currentColor"
              />
            </svg>
          </div>
        </div>

        {/* 물방울 조작점 */}
        <div ref={thumbRef} className="pointer-events-none absolute left-0 top-1/2 z-10">
          <div
            className={`relative -translate-x-1/2 -translate-y-1/2 transition-transform duration-200 ${
              scrubTime !== null ? 'scale-125' : 'group-hover:scale-110'
            }`}
          >
            <div
              className={`droplet size-7 bg-gradient-to-br from-white to-soda/40 shadow-pastel ring-2 ring-white ${
                playing ? 'animate-droplet-pulse' : ''
              }`}
            />
            <WaveGlyph className="absolute inset-0 m-auto size-3.5 text-soda-deep" strokeWidth={2.6} />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between px-1 text-xs font-semibold tabular-nums text-ink-soft">
        <span>{formatTime(shown)}</span>
        <span>{duration > 0 ? formatTime(duration) : '--:--'}</span>
      </div>
    </div>
  )
}
