import { useCallback, useEffect, useRef, useState } from 'react'
import { Pause, Play } from 'lucide-react'
import { formatTime } from '../lib/media.js'
import { MAX_SEGMENT_SECONDS } from '../lib/audio-trim.js'

/**
 * 곡에서 벨소리로 쓸 구간을 고르는 막대.
 *
 * 양 끝의 물방울을 끌어 시작과 끝을 정한다. 재생 바와 마찬가지로
 * 이 막대 위에서는 화면 스크롤을 쓰지 않는다(touch-action: none).
 * 그러지 않으면 폰에서 손가락으로 끌어도 반응하지 않는다.
 *
 * 미리 듣기는 이 화면만의 소리다. 뒤에서 듣던 곡과 섞이지 않도록
 * 창이 열릴 때 본 재생은 멈춰 둔다.
 */
export default function SegmentPicker({ url, duration, start, end, disabled, onChange }) {
  const barRef = useRef(null)
  const audioRef = useRef(null)
  const holding = useRef(null) // 'start' | 'end' | null
  const [previewing, setPreviewing] = useState(false)

  const total = duration > 0 ? duration : 0
  const pct = (t) => (total > 0 ? Math.min(100, Math.max(0, (t / total) * 100)) : 0)

  const timeAt = useCallback(
    (clientX) => {
      const el = barRef.current
      if (!el || total <= 0) return 0
      const rect = el.getBoundingClientRect()
      const ratio = (clientX - rect.left) / rect.width
      return Math.min(1, Math.max(0, ratio)) * total
    },
    [total],
  )

  const grab = (e) => {
    if (disabled || total <= 0) return
    e.preventDefault()
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // 붙잡기를 지원하지 않는 기기여도 아래 동작에는 지장이 없다.
    }
    const t = timeAt(e.clientX)
    // 손가락이 닿은 곳에서 더 가까운 쪽을 잡는다.
    holding.current = Math.abs(t - start) <= Math.abs(t - end) ? 'start' : 'end'
    move(e)
  }

  const move = (e) => {
    if (!holding.current) return
    e.preventDefault()
    const t = timeAt(e.clientX)
    if (holding.current === 'start') onChange(t, end)
    else onChange(start, t)
  }

  const release = () => {
    holding.current = null
  }

  /* ── 미리 듣기 ─────────────────────────────────────────── */

  // 구간을 다시 고르면 듣던 것을 멈춘다. 엉뚱한 데를 듣게 되기 때문이다.
  useEffect(() => {
    const el = audioRef.current
    if (!el) return
    el.pause()
    setPreviewing(false)
  }, [start, end])

  // 고른 끝까지 오면 저절로 멈춘다.
  useEffect(() => {
    const el = audioRef.current
    if (!el || !previewing) return undefined

    let frame = 0
    const watch = () => {
      if (el.currentTime >= end) {
        el.pause()
        setPreviewing(false)
        return
      }
      frame = requestAnimationFrame(watch)
    }
    frame = requestAnimationFrame(watch)
    return () => cancelAnimationFrame(frame)
  }, [previewing, end])

  const togglePreview = () => {
    const el = audioRef.current
    if (!el || total <= 0) return
    if (previewing) {
      el.pause()
      setPreviewing(false)
      return
    }
    el.currentTime = start
    el.play()
      .then(() => setPreviewing(true))
      .catch(() => setPreviewing(false))
  }

  useEffect(() => {
    // 창이 닫힐 때 소리가 남지 않게 한다.
    const el = audioRef.current
    return () => el?.pause()
  }, [])

  const length = Math.max(0, end - start)

  return (
    <div className={`flex flex-col gap-3 ${disabled ? 'opacity-50' : ''}`}>
      <audio ref={audioRef} src={url} preload="metadata" className="hidden" />

      <div className="flex items-center justify-between text-xs font-bold tabular-nums text-ink-soft">
        <span>
          {formatTime(start)} → {formatTime(end)}
        </span>
        <span className={length >= MAX_SEGMENT_SECONDS ? 'text-coral' : ''}>
          {Math.round(length)}초
        </span>
      </div>

      <div
        ref={barRef}
        onPointerDown={grab}
        onPointerMove={move}
        onPointerUp={release}
        onPointerCancel={release}
        // 이 막대 위에서는 화면 스크롤을 쓰지 않는다. 없으면 손가락에 반응하지 않는다.
        style={{ touchAction: 'none' }}
        className={`relative flex h-10 items-center ${disabled ? '' : 'cursor-pointer'}`}
        role="group"
        aria-label="벨소리로 쓸 구간"
      >
        {/* 곡 전체 */}
        <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-soda/15 ring-1 ring-inset ring-white/60">
          {/* 고른 구간 */}
          <div
            className="absolute inset-y-0 rounded-full bg-gradient-to-r from-mint via-soda to-soda-deep"
            style={{ left: `${pct(start)}%`, width: `${Math.max(0, pct(end) - pct(start))}%` }}
          />
        </div>

        {/* 양 끝 손잡이 */}
        {[
          { at: start, label: '시작 지점' },
          { at: end, label: '끝 지점' },
        ].map((handle) => (
          <div
            key={handle.label}
            aria-label={`${handle.label} ${formatTime(handle.at)}`}
            className="pointer-events-none absolute top-1/2 z-10 -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${pct(handle.at)}%` }}
          >
            <div className="droplet size-6 bg-gradient-to-br from-white to-soda/40 shadow-pastel ring-2 ring-white" />
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={togglePreview}
        disabled={disabled || total <= 0}
        className="mx-auto flex items-center gap-1.5 rounded-full bg-white/80 px-4 py-2 text-xs font-bold text-ink-soft shadow-pastel transition hover:text-soda-deep active:scale-95 disabled:opacity-40"
      >
        {previewing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
        {previewing ? '멈추기' : '미리 듣기'}
      </button>
    </div>
  )
}
