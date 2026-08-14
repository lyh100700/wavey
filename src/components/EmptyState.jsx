import { motion } from 'framer-motion'
import { FolderOpen } from 'lucide-react'
import WaveGlyph from './WaveGlyph.jsx'

/** 재생할 미디어가 하나도 없을 때 보여 주는 잔잔한 바다. */
export default function EmptyState({ onPick }) {
  return (
    <div className="flex flex-col items-center justify-center gap-6 px-6 py-14 text-center">
      {/* 잠든 물방울 마스코트 */}
      <motion.div
        className="relative grid size-32 place-items-center"
        animate={{ y: [0, -10, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
      >
        <div className="absolute inset-0 rounded-full bg-mint/25 blur-2xl" />
        <div className="droplet grid size-24 place-items-center bg-gradient-to-br from-soda/35 to-mint/35 ring-4 ring-white/70 shadow-pastel">
          <WaveGlyph className="size-10 -rotate-45 text-soda-deep" />
        </div>
      </motion.div>

      <div className="space-y-2">
        <p className="text-lg font-bold text-ink">파도가 조용해요! 미디어 파일을 끌어다 놓아주세요 🌊</p>
        <p className="text-sm text-ink-soft">
          mp3 · wav · m4a · flac · mp4 · webm · mov 를 지원해요
        </p>
      </div>

      <button
        type="button"
        onClick={onPick}
        className="inline-flex items-center gap-2 rounded-3xl bg-gradient-to-br from-soda to-mint px-6 py-3 text-sm font-bold text-white shadow-pastel-lg transition hover:brightness-105 active:scale-95"
      >
        <FolderOpen className="size-4" />
        파일 고르기
      </button>
    </div>
  )
}
