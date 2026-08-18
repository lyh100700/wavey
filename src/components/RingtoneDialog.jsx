import { Check } from 'lucide-react'
import ConfirmDialog from './ConfirmDialog.jsx'
import { RINGTONE_TYPES } from '../lib/ringtone.js'

/**
 * 이 곡을 어떤 소리로 쓸지 고르는 창.
 * 전화 벨소리 · 알림음 · 알람음 중 하나를 고르면 바로 지정된다.
 */
export default function RingtoneDialog({ open, track, type, busy, onTypeChange, onConfirm, onCancel }) {
  return (
    <ConfirmDialog
      open={open}
      title="벨소리로 설정"
      description={track ? `"${track.title}"을(를) 어디에 쓸까요?` : ''}
      confirmLabel="설정하기"
      busy={busy}
      onConfirm={onConfirm}
      onCancel={onCancel}
    >
      <div className="flex flex-col gap-2">
        {RINGTONE_TYPES.map((option) => {
          const selected = option.id === type
          return (
            <button
              key={option.id}
              type="button"
              disabled={busy}
              onClick={() => onTypeChange(option.id)}
              aria-pressed={selected}
              className={`flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-bold transition active:scale-95 disabled:opacity-50 ${
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
    </ConfirmDialog>
  )
}
