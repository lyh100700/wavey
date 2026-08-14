import { motion } from 'framer-motion'
import { FolderOpen, Music } from 'lucide-react'
import WaveGlyph from './WaveGlyph.jsx'

/** 재생할 미디어가 하나도 없을 때 보여 주는 잔잔한 바다. */
export default function EmptyState({ onPick, onPickFolder }) {
  return (
    <div className="flex flex-col items-center justify-center gap-6 px-2 py-10 text-center">
      {/* 잠든 물방울 마스코트 */}
      <motion.div
        className="relative grid size-28 place-items-center"
        animate={{ y: [0, -10, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
      >
        <div className="absolute inset-0 rounded-full bg-mint/25 blur-2xl" />
        <div className="droplet grid size-20 place-items-center bg-gradient-to-br from-soda/35 to-mint/35 shadow-pastel ring-4 ring-white/70">
          <WaveGlyph className="size-9 -rotate-45 text-soda-deep" />
        </div>
      </motion.div>

      <div className="space-y-2">
        <p className="text-base font-bold text-ink">
          파도가 조용해요! 미디어 파일을 끌어다 놓아주세요 🌊
        </p>
        <p className="text-xs text-ink-soft">
          mp3 · wav · m4a · flac · mp4 · webm · mov 를 지원해요
        </p>
      </div>

      {/* 두 갈래 — 곡을 하나씩 담거나, 폴더를 통째로 열거나 */}
      <div className="flex w-full flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={onPick}
          className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-soda to-mint px-5 py-3 text-sm font-bold text-white shadow-pastel-lg transition hover:brightness-105 active:scale-95"
        >
          <Music className="size-4" />
          곡 고르기
        </button>
        <button
          type="button"
          onClick={onPickFolder}
          className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-white/80 px-5 py-3 text-sm font-bold text-soda-deep shadow-pastel transition hover:bg-white active:scale-95"
        >
          <FolderOpen className="size-4" />
          폴더 열기
        </button>
      </div>
    </div>
  )
}
