import ConfirmDialog from './ConfirmDialog.jsx'
import { readNotes } from '../lib/log.js'

/**
 * 안드로이드 기능이 어디까지 닿는지 보여 주는 창.
 * 무언가 "반응이 없을" 때, 이 결과를 그대로 읽어 주면 원인을 짚을 수 있다.
 */
export default function DiagnosticsDialog({ open, results, running, onCopy, onClose }) {
  return (
    <ConfirmDialog
      open={open}
      title="문제 확인"
      description={running ? '안드로이드 기능을 하나씩 두드려 보는 중이에요…' : ''}
      confirmLabel="글자로 복사"
      cancelLabel="닫기"
      busy={running}
      onConfirm={onCopy}
      onCancel={onClose}
    >
      {!running && (
        <div className="flex flex-col gap-3">
        <ul className="flex flex-col gap-1.5">
          {results.map((r) => (
            <li
              key={r.label}
              className="flex items-start gap-2 rounded-2xl bg-white/70 px-3 py-2 text-xs font-semibold"
            >
              <span className={r.ok ? 'text-soda-deep' : 'text-coral'}>{r.ok ? '✓' : '✕'}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-ink">{r.label}</span>
                <span className={`block ${r.ok ? 'text-ink-soft' : 'text-coral'}`}>{r.detail}</span>
              </span>
            </li>
          ))}
        </ul>

        {/*
          방금 무슨 일이 있었는지. 알림은 금세 사라져 놓치기 쉬우므로
          여기 남겨 두고 통째로 읽을 수 있게 한다.
        */}
        {readNotes().length > 0 && (
          <div className="max-h-48 overflow-y-auto rounded-2xl bg-white/70 p-3">
            <p className="mb-1 text-[11px] font-black text-ink">방금 있었던 일</p>
            <pre className="whitespace-pre-wrap break-words font-mono text-[10px] leading-relaxed text-ink-soft">
              {readNotes().join('\n')}
            </pre>
          </div>
        )}
        </div>
      )}
    </ConfirmDialog>
  )
}
