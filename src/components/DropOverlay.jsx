import { AnimatePresence, motion } from 'framer-motion'
import WaveGlyph from './WaveGlyph.jsx'

/** 파일을 끌고 오는 동안 화면 전체를 덮는 물결 안내. */
export default function DropOverlay({ show }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="pointer-events-none fixed inset-0 z-50 grid place-items-center bg-soda/35 p-6"
        >
          <motion.div
            initial={{ scale: 0.94, y: 12 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.94, y: 12 }}
            transition={{ type: 'spring', stiffness: 260, damping: 22 }}
            className="flex w-full max-w-md flex-col items-center gap-4 rounded-3xl border-4 border-dashed border-white/90 bg-white/95 px-8 py-12 text-center shadow-pastel-lg"
          >
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
              className="droplet grid size-20 place-items-center bg-gradient-to-br from-soda to-mint shadow-pastel"
            >
              <WaveGlyph className="size-9 -rotate-45 text-white" />
            </motion.div>
            <p className="text-lg font-bold text-ink">여기에 풍덩 놓아주세요!</p>
            <p className="text-sm text-ink-soft">음악과 영상 파일을 파도에 띄울게요 🌊</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
