import { motion } from 'framer-motion'
import { Music } from 'lucide-react'
import { paletteFor } from '../lib/media.js'

/**
 * 음악 모드의 앨범 아트.
 * LP 대신 '물이 차오르는 유리병' 컨셉 — 재생이 진행될수록 물결이 위로 차오른다.
 */
export default function WaveDisc({ title = '', progress = 0, playing = false }) {
  const [from, to] = paletteFor(title)
  // 완전히 비거나 차면 물결이 잘려 보여서 위아래로 여유를 조금 둔다.
  const level = 8 + Math.min(1, Math.max(0, progress)) * 84

  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-full bg-white/70 shadow-pastel-lg ring-8 ring-white/70 backdrop-blur-xl">
      {/* 물이 차기 전의 옅은 바탕 */}
      <div
        className="absolute inset-0 opacity-25"
        style={{ background: `linear-gradient(140deg, ${from}, ${to})` }}
      />

      {/* 차오르는 물 — 높이가 곧 재생 진행률이다 */}
      <motion.div
        className="absolute inset-x-0 bottom-0"
        animate={{ height: `${level}%` }}
        transition={{ type: 'spring', stiffness: 60, damping: 20 }}
      >
        {/* 수면 위로 겹쳐 흐르는 두 겹의 물결 */}
        <div className="absolute inset-x-0 -top-5 h-10 overflow-hidden">
          <svg
            className="animate-wave-slide-slow absolute left-0 h-full w-[200%]"
            viewBox="0 0 1200 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path
              d="M0 55 C 100 20, 200 20, 300 55 S 500 90, 600 55 S 800 20, 900 55 S 1100 90, 1200 55 L1200 100 L0 100 Z"
              fill={to}
              opacity="0.55"
            />
          </svg>
          <svg
            className="animate-wave-slide absolute left-0 h-full w-[200%]"
            viewBox="0 0 1200 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path
              d="M0 60 C 100 30, 200 30, 300 60 S 500 95, 600 60 S 800 25, 900 60 S 1100 95, 1200 60 L1200 100 L0 100 Z"
              fill={from}
              opacity="0.75"
            />
          </svg>
        </div>

        <div
          className="h-full w-full"
          style={{ background: `linear-gradient(180deg, ${from}, ${to})`, opacity: 0.8 }}
        />
      </motion.div>

      {/* 물 위로 떠오르는 음표 */}
      <div className="absolute inset-0 grid place-items-center">
        <motion.div
          className="grid size-20 place-items-center rounded-full bg-white/70 text-soda-deep shadow-pastel backdrop-blur-md sm:size-24"
          animate={playing ? { y: [0, -8, 0] } : { y: 0 }}
          transition={{ duration: 4.5, repeat: playing ? Infinity : 0, ease: 'easeInOut' }}
        >
          <Music className="size-9 sm:size-10" strokeWidth={2.2} />
        </motion.div>
      </div>

      {/* 유리 재질감 하이라이트 */}
      <div className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-br from-white/60 via-transparent to-transparent" />
    </div>
  )
}
