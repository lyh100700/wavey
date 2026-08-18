import { motion } from 'framer-motion'
import ConfirmDialog from './ConfirmDialog.jsx'
import { formatSize } from '../lib/media.js'

/**
 * 새 버전이 나왔을 때 뜨는 창.
 *
 * 받는 동안에는 버튼 대신 진행 막대를 보여 준다. 10MB쯤 되는 파일이라
 * 아무 표시가 없으면 멈춘 줄 알고 앱을 꺼 버리게 된다.
 */
export default function UpdateDialog({ open, info, progress, onConfirm, onCancel, onUseBrowser }) {
  const downloading = progress !== null
  const size = info?.sizeBytes ? formatSize(info.sizeBytes) : ''

  return (
    <ConfirmDialog
      open={open}
      title="새 버전이 나왔어요 🌊"
      description={
        downloading
          ? '받는 중이에요. 잠시만 기다려 주세요'
          : `${info?.versionName ?? ''}${size ? ` · ${size}` : ''}\n업데이트 하시겠습니까?`
      }
      confirmLabel="업데이트"
      cancelLabel={downloading ? '' : '나중에'}
      busy={downloading}
      onConfirm={onConfirm}
      onCancel={onCancel}
    >
      {!downloading && (
        <div className="flex flex-col gap-3">
          {info?.notes && (
            <p className="rounded-2xl bg-white/70 px-4 py-3 text-xs font-semibold leading-relaxed text-ink-soft">
              {info.notes}
            </p>
          )}

          {/*
            앱에서 받는 길이 막혀도 사용자가 스스로 빠져나갈 수 있어야 한다.
            이 버튼은 어떤 경우에도 동작한다.
          */}
          <button
            type="button"
            onClick={onUseBrowser}
            className="mx-auto text-xs font-bold text-ink-soft underline decoration-soda decoration-2 underline-offset-4 transition active:scale-95"
          >
            잘 안 되면 · 브라우저로 받기
          </button>
        </div>
      )}

      {downloading && (
        <div className="flex flex-col gap-2">
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-soda/15">
            {progress >= 0 ? (
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-mint via-soda to-soda-deep"
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.2 }}
              />
            ) : (
              // 총 크기를 모를 때 — 진행률 대신 물결이 오간다.
              <motion.div
                className="h-full w-1/3 rounded-full bg-gradient-to-r from-mint via-soda to-soda-deep"
                animate={{ x: ['-100%', '300%'] }}
                transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
              />
            )}
          </div>
          <p className="text-center text-xs font-bold tabular-nums text-ink-soft">
            {progress >= 0 ? `${progress}%` : '받는 중…'}
          </p>
        </div>
      )}
    </ConfirmDialog>
  )
}
