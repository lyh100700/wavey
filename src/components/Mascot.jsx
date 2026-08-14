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

/**
 * 목록이 비었을 때 쓰는, 파도 위에서 자는 장면.
 * 위쪽 마스코트(동그란 사진)와 다른 그림이라 화면이 단조로워지지 않는다.
 */
export function SleepingMascot() {
  return (
    <motion.div
      className="w-full overflow-hidden rounded-2xl"
      animate={{ y: [0, -4, 0] }}
      transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
    >
      <img
        src="./sleeping-dog.png"
        alt="파도 위에서 자고 있는 강아지"
        className="w-full select-none"
        draggable="false"
        onError={(e) => {
          e.currentTarget.style.display = 'none'
        }}
      />
    </motion.div>
  )
}
