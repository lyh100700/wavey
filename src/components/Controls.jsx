import { motion } from 'framer-motion'
import {
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from 'lucide-react'

function RoundButton({ label, active = false, disabled = false, onClick, children }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active || undefined}
      disabled={disabled}
      onClick={onClick}
      className={`grid size-11 place-items-center rounded-2xl transition active:scale-90 disabled:opacity-35 ${
        active
          ? 'bg-coral/15 text-coral shadow-coral'
          : 'text-ink-soft hover:bg-white/70 hover:text-soda-deep'
      }`}
    >
      {children}
    </button>
  )
}

/** 하단 재생 컨트롤 묶음. */
export default function Controls({
  playing,
  disabled,
  shuffle,
  repeat, // 'off' | 'all' | 'one'
  volume,
  muted,
  onTogglePlay,
  onPrev,
  onNext,
  onToggleShuffle,
  onCycleRepeat,
  onToggleMute,
  onVolumeChange,
}) {
  const repeatLabel =
    repeat === 'one' ? '한 곡 반복' : repeat === 'all' ? '전체 반복' : '반복 꺼짐'

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-center gap-2 sm:gap-3">
        <RoundButton
          label={shuffle ? '셔플 켜짐' : '셔플 꺼짐'}
          active={shuffle}
          disabled={disabled}
          onClick={onToggleShuffle}
        >
          <Shuffle className="size-5" />
        </RoundButton>

        <RoundButton label="이전 곡" disabled={disabled} onClick={onPrev}>
          <SkipBack className="size-6 fill-current" />
        </RoundButton>

        {/* 재생 버튼 — 누르면 물방울이 톡 튀는 느낌 */}
        <motion.button
          type="button"
          aria-label={playing ? '일시정지' : '재생'}
          title={playing ? '일시정지' : '재생'}
          disabled={disabled}
          onClick={onTogglePlay}
          whileTap={{ scale: 0.9 }}
          whileHover={{ scale: 1.05 }}
          className="relative grid size-16 place-items-center rounded-3xl bg-gradient-to-br from-soda to-mint text-white shadow-pastel-lg transition disabled:opacity-40 sm:size-[4.5rem]"
        >
          {playing && (
            <motion.span
              className="absolute inset-0 rounded-3xl border-2 border-soda/50"
              animate={{ scale: [1, 1.35], opacity: [0.6, 0] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: 'easeOut' }}
            />
          )}
          {playing ? (
            <Pause className="size-7 fill-current" />
          ) : (
            <Play className="size-7 translate-x-0.5 fill-current" />
          )}
        </motion.button>

        <RoundButton label="다음 곡" disabled={disabled} onClick={onNext}>
          <SkipForward className="size-6 fill-current" />
        </RoundButton>

        <RoundButton
          label={repeatLabel}
          active={repeat !== 'off'}
          disabled={disabled}
          onClick={onCycleRepeat}
        >
          {repeat === 'one' ? <Repeat1 className="size-5" /> : <Repeat className="size-5" />}
        </RoundButton>
      </div>

      {/* 볼륨 */}
      <div className="mx-auto flex w-full max-w-xs items-center gap-3">
        <button
          type="button"
          onClick={onToggleMute}
          aria-label={muted ? '음소거 해제' : '음소거'}
          title={muted ? '음소거 해제' : '음소거'}
          className="text-ink-soft transition hover:text-soda-deep active:scale-90"
        >
          {muted || volume === 0 ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
        </button>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={muted ? 0 : volume}
          onChange={(e) => onVolumeChange(Number(e.target.value))}
          aria-label="볼륨"
          className="h-2 w-full cursor-pointer appearance-none rounded-full outline-none
            [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white
            [&::-webkit-slider-thumb]:shadow-pastel [&::-webkit-slider-thumb]:ring-2
            [&::-webkit-slider-thumb]:ring-soda
            [&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:rounded-full
            [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-soda
            [&::-moz-range-thumb]:bg-white"
          style={{
            background: `linear-gradient(to right, var(--color-soda) ${
              (muted ? 0 : volume) * 100
            }%, rgba(112,214,255,0.18) ${(muted ? 0 : volume) * 100}%)`,
          }}
        />
      </div>
    </div>
  )
}
