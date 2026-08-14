import { useCallback, useRef, useState } from 'react'
import { formatTime } from '../lib/media.js'
import WaveGlyph from './WaveGlyph.jsx'

/**
 * 재생 바. 조작점(Thumb)은 물방울 모양이고, 지나온 구간에는 파도가 넘실거린다.
 * 드래그하는 동안에는 화면에만 반영하고, 손을 뗄 때 실제로 탐색(seek)한다.
 */
export default function SeekBar({
  currentTime = 0,
  duration = 0,
  playing = false,
  disabled = false,
  onSeek,
  onScrubStart,
  onScrubEnd,
}) {
  const trackRef = useRef(null)
  const [scrubTime, setScrubTime] = useState(null)

  const shown = scrubTime ?? currentTime
  const ratio = duration > 0 ? Math.min(1, Math.max(0, shown / duration)) : 0
  const pct = ratio * 100

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
          {/* 지나온 구간 — 물결이 흐른다 */}
          <div
            className="absolute inset-y-0 left-0 overflow-hidden rounded-full bg-gradient-to-r from-mint via-soda to-soda-deep"
            style={{ width: `${pct}%` }}
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
        <div
          className="pointer-events-none absolute top-1/2 z-10"
          style={{ left: `${pct}%` }}
        >
          <div
            className={`relative -translate-x-1/2 -translate-y-1/2 transition-transform duration-200 ${
              scrubTime !== null ? 'scale-125' : 'group-hover:scale-110'
            }`}
          >
            <div
              className={`droplet size-7 bg-gradient-to-br from-white to-soda/40 ring-2 ring-white shadow-pastel ${
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
