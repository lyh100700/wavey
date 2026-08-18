import { ExternalLink, Search } from 'lucide-react'
import ConfirmDialog from './ConfirmDialog.jsx'

/**
 * 폰 설정에서 직접 켜 줘야 하는 권한을 안내하는 창.
 *
 * 안드로이드에는 팝업으로 물어볼 수 없는 종류의 권한이 있다. 사용자가 설정
 * 앱에 들어가 목록에서 이 앱을 찾아 스위치를 켜야 한다. 그런데 그 메뉴는
 * 폰 제조사마다 이름과 위치가 달라서, "설정에서 켜 주세요"라는 말 한 줄로는
 * 어디로 가야 할지 알 수가 없다.
 *
 * 그래서 찾아가는 길을 단계로 보여 주고, 바로 그 화면으로 데려다주는 버튼도
 * 함께 둔다. 버튼이 안 먹는 기기도 있어서 손으로 찾는 길을 함께 적어 둔다.
 */
export default function PermissionGuideDialog({ open, guide, onOpenSettings, onClose }) {
  if (!guide) return null

  return (
    <ConfirmDialog
      open={open}
      title={guide.title}
      description={guide.why}
      confirmLabel="설정 열기"
      cancelLabel="나중에"
      onConfirm={onOpenSettings}
      onCancel={onClose}
    >
      <div className="flex flex-col gap-3">
        {/* 검색어 — 제조사마다 메뉴 위치가 달라서 이게 가장 확실하다 */}
        <div className="flex items-center gap-2 rounded-2xl bg-soda/15 px-3 py-2.5">
          <Search className="size-4 shrink-0 text-soda-deep" />
          <span className="text-xs font-bold text-ink">
            설정에서 <span className="text-soda-deep">"{guide.search}"</span> 검색
          </span>
        </div>

        {/* 찾아가는 길 */}
        <ol className="flex flex-col gap-1.5">
          {guide.steps.map((stepText, i) => (
            <li key={stepText} className="flex items-start gap-2 text-xs font-semibold text-ink-soft">
              <span className="grid size-4 shrink-0 place-items-center rounded-full bg-white/80 text-[9px] font-black text-soda-deep">
                {i + 1}
              </span>
              <span className="min-w-0 flex-1">{stepText}</span>
            </li>
          ))}
        </ol>

        <p className="flex items-center justify-center gap-1 text-[11px] font-semibold text-ink-soft/80">
          <ExternalLink className="size-3" />
          아래 버튼을 누르면 그 화면으로 바로 갑니다
        </p>
      </div>
    </ConfirmDialog>
  )
}
