import { motion } from 'framer-motion'

// 그림은 네모난 JPEG이고 동그랗게 만드는 건 CSS가 한다 (투명 PNG보다 훨씬 가볍다).
const SRC = './mascot.jpg'

/**
 * Wavey의 강아지 마스코트. 파도 위에 떠 있듯 아주 천천히 오르내린다.
 * 그림 파일이 없거나 아직 안 받아졌을 때를 대비해, 실패하면 조용히 사라진다.
 */
export default function Mascot({ size = 'w-44', floating = true, className = '' }) {
  return (
    <motion.div
      className={`relative ${size} ${className}`}
      animate={floating ? { y: [0, -10, 0] } : undefined}
      transition={{ duration: 5.5, repeat: Infinity, ease: 'easeInOut' }}
    >
      {/* 발밑에 깔리는 옅은 물빛 그림자 */}
      <div className="absolute inset-x-4 bottom-1 h-6 rounded-full bg-soda/25 blur-xl" />
      <img
        src={SRC}
        alt="Wavey 마스코트"
        className="relative w-full select-none rounded-full shadow-pastel-lg ring-4 ring-white/70"
        draggable="false"
        onError={(e) => {
          e.currentTarget.style.display = 'none'
        }}
      />
    </motion.div>
  )
}

/** 목록이 비었을 때 쓰는, 파도 위에서 자는 장면. */
export function SleepingMascot() {
  return (
    <div className="relative flex w-full flex-col items-center">
      <div className="relative">
        <Mascot size="w-24" />

        {/* 새근새근 — 크기가 다른 z가 차례로 떠오른다 */}
        {['z', 'z', 'Z'].map((z, i) => (
          <motion.span
            key={i}
            className="absolute font-black text-soda-deep/60"
            style={{
              right: -6 - i * 9,
              top: 6 - i * 12,
              fontSize: `${11 + i * 4}px`,
            }}
            animate={{ y: [0, -8, 0], opacity: [0.2, 0.9, 0.2] }}
            transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut', delay: i * 0.5 }}
            aria-hidden="true"
          >
            {z}
          </motion.span>
        ))}
      </div>

      {/* 마스코트를 받치는 잔물결 */}
      <div className="-mt-5 h-10 w-full overflow-hidden">
        <svg
          className="animate-wave-slide h-full w-[200%] text-soda/30"
          viewBox="0 0 1200 60"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            d="M0 32 C 100 8, 200 8, 300 32 S 500 56, 600 32 S 800 8, 900 32 S 1100 56, 1200 32 L1200 60 L0 60 Z"
            fill="currentColor"
          />
        </svg>
      </div>
    </div>
  )
}
