import { motion } from 'framer-motion'
import { Check } from 'lucide-react'
import ConfirmDialog from './ConfirmDialog.jsx'
import SegmentPicker from './SegmentPicker.jsx'
import { RINGTONE_TYPES } from '../lib/ringtone.js'

/**
 * 이 곡을 어떤 소리로, 어느 구간으로 쓸지 고르는 창.
 *
 * 구간은 기본으로 꺼 둔다. 켜면 고른 부분만 오려내는데, 그러려면 곡을 통째로
 * 풀었다가 다시 담아야 해서 곡 전체를 쓰는 것보다 시간이 걸린다.
 */
export default function RingtoneDialog({
  open,
  track,
  type,
  useSegment,
  segment,
  busy,
  progress, // { stage, percent } 또는 null
  onTypeChange,
  onUseSegmentChange,
  onSegmentChange,
  onConfirm,
  onCancel,
}) {
  // 곡 길이를 모르면 어디를 자를지 정할 수 없다.
  const knowsLength = Number.isFinite(track?.duration) && track.duration > 0

  // 지금 무슨 일을 하고 있는지 정확히 알려 준다.
  //
  // 문구가 실제와 다르면, 멈췄을 때 어디서 멈췄는지 알 수가 없다. 이것 때문에
  // 엉뚱한 곳을 여러 번 고쳤다. 그래서 지금은 걸음의 이름을 그대로 보여 준다.
  // 화면이 멈추면 멈춘 자리의 이름이 화면에 남는다.
  const NOTES = {
    reading: '곡을 읽는 중',
    cutting: '구간을 오려내는 중',
    sending: '폰으로 옮기는 중',
  }
  const note = !busy
    ? ''
    : `${NOTES[progress?.stage] ?? '준비 중'}\n${progress?.doing ?? ''}`

  return (
    <ConfirmDialog
      open={open}
      title="벨소리로 설정"
      description={busy ? note : track ? `"${track.title}"을(를) 어디에 쓸까요?` : ''}
      confirmLabel="설정하기"
      cancelLabel={busy ? '' : '취소'}
      busy={busy}
      onConfirm={onConfirm}
      onCancel={onCancel}
    >
      {busy ? (
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-soda/15">
          {progress?.stage === 'sending' ? (
            <div
              className="h-full rounded-full bg-gradient-to-r from-mint via-soda to-soda-deep transition-[width] duration-200"
              style={{ width: `${progress.percent ?? 0}%` }}
            />
          ) : (
            // 오려내는 동안에는 얼마나 남았는지 알 수 없다. 멈춘 것처럼 보이지
            // 않도록 물결이 오가게 둔다.
            <motion.div
              className="h-full w-1/3 rounded-full bg-gradient-to-r from-mint via-soda to-soda-deep"
              animate={{ x: ['-100%', '300%'] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
            />
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            {RINGTONE_TYPES.map((option) => {
              const selected = option.id === type
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => onTypeChange(option.id)}
                  aria-pressed={selected}
                  className={`flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-bold transition active:scale-95 ${
                    selected
                      ? 'bg-gradient-to-r from-soda/25 to-mint/20 text-ink ring-1 ring-soda/40'
                      : 'bg-white/70 text-ink-soft'
                  }`}
                >
                  {option.label}
                  {selected && <Check className="size-4 text-soda-deep" />}
                </button>
              )
            })}
          </div>

          {/* 구간 고르기 — 곡 길이를 알아야 자를 수 있다 */}
          <div className="rounded-2xl bg-white/70 p-3">
            <label
              className={`flex items-center justify-between text-sm font-bold text-ink ${
                knowsLength ? 'cursor-pointer' : 'opacity-50'
              }`}
            >
              구간만 쓰기
              <input
                type="checkbox"
                checked={useSegment && knowsLength}
                disabled={!knowsLength}
                onChange={(e) => onUseSegmentChange(e.target.checked)}
                className="size-5 accent-[var(--color-soda-deep)]"
              />
            </label>

            {!knowsLength ? (
              <p className="mt-1 text-xs font-semibold text-ink-soft">
                곡을 한 번 재생하면 구간을 고를 수 있어요
              </p>
            ) : useSegment ? (
              <div className="mt-3">
                <SegmentPicker
                  url={track?.url}
                  duration={track?.duration ?? 0}
                  start={segment.start}
                  end={segment.end}
                  onChange={onSegmentChange}
                />
              </div>
            ) : (
              <p className="mt-1 text-xs font-semibold text-ink-soft">
                곡 전체를 그대로 씁니다
              </p>
            )}
          </div>
        </div>
      )}
    </ConfirmDialog>
  )
}
