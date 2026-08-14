import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Maximize2, Pause, Play } from 'lucide-react'
import { formatTime } from '../lib/media.js'
import RippleField from './RippleField.jsx'
import WaveDisc from './WaveDisc.jsx'

/**
 * 미디어가 실제로 보이는 무대.
 *
 * <video> 엘리먼트는 음악 모드에서도 트리에서 내려가지 않는다.
 * 모드가 바뀔 때마다 다시 마운트되면 재생 중이던 소리가 끊기기 때문에,
 * 위치는 그대로 두고 화면에 보이는 모습만 바꾼다.
 */
export default function Stage({
  videoRef,
  track,
  playing,
  currentTime,
  duration,
  onTogglePlay,
}) {
  const isVideo = track?.kind === 'video'
  const boxRef = useRef(null)
  const hideTimer = useRef(null)
  const [showControls, setShowControls] = useState(false)

  const progress = duration > 0 ? currentTime / duration : 0

  // 잠시 움직임이 없으면 컨트롤 바가 물방울처럼 다시 가라앉는다.
  const peekControls = () => {
    setShowControls(true)
    clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => setShowControls(false), 2600)
  }

  useEffect(() => () => clearTimeout(hideTimer.current), [])

  const goFullscreen = () => {
    const el = boxRef.current
    if (!el) return
    if (document.fullscreenElement) document.exitFullscreen?.()
    else el.requestFullscreen?.()
  }

  return (
    <div className={playing ? '' : 'waves-paused'}>
      <div
        ref={boxRef}
        onPointerEnter={isVideo ? peekControls : undefined}
        onPointerMove={isVideo ? peekControls : undefined}
        onPointerLeave={isVideo ? () => setShowControls(false) : undefined}
        className={`relative mx-auto transition-[max-width,aspect-ratio] duration-500 ${
          isVideo
            ? 'aspect-video w-full max-w-3xl overflow-hidden rounded-3xl bg-ink/90 shadow-pastel-lg ring-1 ring-white/60'
            : 'aspect-square w-full max-w-[19rem] sm:max-w-sm'
        }`}
      >
        {/* 음악 모드 — 앨범 아트 주변으로 번지는 물결 */}
        {!isVideo && <RippleField active={playing} />}

        {/* 오디오·영상 공용 엘리먼트 (음악 모드에서는 숨긴 채로 소리만 낸다) */}
        <video
          ref={videoRef}
          playsInline
          preload="metadata"
          onClick={isVideo ? onTogglePlay : undefined}
          className={
            isVideo
              ? 'size-full cursor-pointer bg-ink object-contain'
              : 'pointer-events-none absolute size-0 opacity-0'
          }
        />

        {!isVideo && (
          <div className="absolute inset-0 grid place-items-center">
            <WaveDisc title={track?.title ?? ''} progress={progress} playing={playing} />
          </div>
        )}

        {/* 비디오 모드 — 스르륵 올라오는 파스텔 컨트롤 바 */}
        {isVideo && (
          <AnimatePresence>
            {(showControls || !playing) && (
              <motion.div
                initial={{ y: 28, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 28, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 26 }}
                className="absolute inset-x-3 bottom-3 flex items-center gap-3 rounded-3xl border border-white/60 bg-white/70 px-4 py-3 shadow-pastel backdrop-blur-xl"
              >
                <button
                  type="button"
                  onClick={onTogglePlay}
                  aria-label={playing ? '일시정지' : '재생'}
                  className="grid size-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-soda to-mint text-white shadow-pastel transition active:scale-90"
                >
                  {playing ? (
                    <Pause className="size-4.5 fill-current" />
                  ) : (
                    <Play className="size-4.5 translate-x-px fill-current" />
                  )}
                </button>

                {/* 진행 상황을 담은 얇은 물결 띠 */}
                <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-soda/20">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-mint via-soda to-soda-deep transition-[width] duration-200"
                    style={{ width: `${progress * 100}%` }}
                  />
                </div>

                <span className="shrink-0 text-xs font-bold tabular-nums text-ink-soft">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>

                <button
                  type="button"
                  onClick={goFullscreen}
                  aria-label="전체 화면"
                  title="전체 화면"
                  className="grid size-9 shrink-0 place-items-center rounded-2xl text-ink-soft transition hover:bg-white/80 hover:text-soda-deep active:scale-90"
                >
                  <Maximize2 className="size-4" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    </div>
  )
}
