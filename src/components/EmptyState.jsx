import { FolderOpen, Music } from 'lucide-react'
import FloatingDecor from './Decorations.jsx'
import Mascot from './Mascot.jsx'

/** 재생할 미디어가 하나도 없을 때 보여 주는 잔잔한 바다. */
export default function EmptyState({ onPick, onPickFolder }) {
  return (
    <div className="relative flex flex-col items-center gap-6 px-2 py-8 text-center">
      {/* 물방울·음표·물고기가 여백에 떠다닌다 */}
      <FloatingDecor />

      <Mascot size="w-40 sm:w-48" />

      {/* 글자는 장식 위로 올라와야 읽힌다 */}
      <div className="relative space-y-2">
        <p className="text-balance text-base font-bold leading-relaxed text-ink sm:text-lg">
          파도가 조용해요! 미디어 파일을 끌어다 놓아주세요 🌊
        </p>
        <p className="text-xs text-ink-soft">
          mp3 · wav · m4a · flac · mp4 · webm · mov 를 지원해요
        </p>
      </div>

      {/* 두 갈래 — 곡을 하나씩 담거나, 폴더를 통째로 열거나 */}
      <div className="relative flex w-full flex-col gap-2.5">
        <button
          type="button"
          onClick={onPick}
          className="flex items-center justify-center gap-2 rounded-3xl bg-gradient-to-r from-soda to-mint px-5 py-3.5 text-sm font-bold text-white shadow-pastel-lg transition hover:brightness-105 active:scale-[0.98]"
        >
          <Music className="size-4" />
          곡 고르기
        </button>
        <button
          type="button"
          onClick={onPickFolder}
          className="flex items-center justify-center gap-2 rounded-3xl bg-white/85 px-5 py-3.5 text-sm font-bold text-soda-deep shadow-pastel ring-1 ring-white transition hover:bg-white active:scale-[0.98]"
        >
          <FolderOpen className="size-4" />
          폴더 열기
        </button>
      </div>
    </div>
  )
}
