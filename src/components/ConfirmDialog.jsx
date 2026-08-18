import { AnimatePresence, motion } from 'framer-motion'

/**
 * 가운데 뜨는 확인창. 종료 확인, 벨소리 설정, 업데이트 안내가 모두 이걸 쓴다.
 *
 * 안드로이드가 기본으로 주는 창(window.confirm)은 웹뷰에서 모양이 제각각이고
 * 앱 분위기와도 맞지 않아서, 앱 안에서 직접 그린다.
 */
export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = '확인',
  cancelLabel = '취소',
  tone = 'soda', // 'soda' | 'coral' — 확인 버튼 색
  busy = false, // 처리 중이면 버튼을 잠근다
  onConfirm,
  onCancel,
  children, // 본문에 더 넣고 싶은 것 (선택지 등)
}) {
  const confirmClass =
    tone === 'coral'
      ? 'bg-gradient-to-br from-coral to-coral/80 shadow-coral'
      : 'bg-gradient-to-br from-soda to-mint shadow-pastel-lg'

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={busy ? undefined : onCancel}
          className="fixed inset-0 z-50 grid place-items-center bg-ink/25 px-6 backdrop-blur-sm"
          role="presentation"
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ opacity: 0, y: 24, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 340, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xs rounded-3xl border border-white/70 bg-white/90 p-6 shadow-pastel-lg backdrop-blur-xl"
          >
            <h2 className="text-center text-base font-black text-ink">{title}</h2>
            {description && (
              <p className="mt-2 whitespace-pre-line text-center text-sm font-semibold leading-relaxed text-ink-soft">
                {description}
              </p>
            )}

            {children && <div className="mt-4">{children}</div>}

            <div className="mt-6 flex gap-2">
              {cancelLabel && (
                // 처리 중에도 누를 수 있어야 한다. 무언가 잘못돼 끝나지 않을 때
                // 빠져나올 길이 없으면 앱이 고장 난 것처럼 느껴진다.
                <button
                  type="button"
                  onClick={onCancel}
                  className="flex-1 rounded-2xl bg-white/80 py-3 text-sm font-bold text-ink-soft shadow-pastel transition active:scale-95"
                >
                  {cancelLabel}
                </button>
              )}
              <button
                type="button"
                onClick={onConfirm}
                disabled={busy}
                className={`flex-1 rounded-2xl py-3 text-sm font-bold text-white transition active:scale-95 disabled:opacity-50 ${confirmClass}`}
              >
                {busy ? '잠시만요…' : confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
