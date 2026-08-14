import { motion } from 'framer-motion'

// 막대마다 다른 리듬을 줘야 '둠칫'거리는 느낌이 난다.
const BARS = [
  { heights: [0.35, 1, 0.5], duration: 0.62 },
  { heights: [0.9, 0.3, 0.75], duration: 0.78 },
  { heights: [0.5, 0.95, 0.4], duration: 0.54 },
  { heights: [0.7, 0.35, 1], duration: 0.86 },
]

/** 재생 중인 곡 옆에서 둠칫거리는 미니 파도 음파. */
export default function MiniEqualizer({ playing = true, className = '' }) {
  return (
    <span
      className={`inline-flex h-4 items-end gap-[3px] ${className}`}
      aria-hidden="true"
    >
      {BARS.map((bar, i) => (
        <motion.span
          key={i}
          className="w-[3px] rounded-full bg-gradient-to-t from-soda-deep to-mint"
          initial={{ height: '30%' }}
          animate={
            playing
              ? { height: bar.heights.map((h) => `${h * 100}%`) }
              : { height: '22%' }
          }
          transition={
            playing
              ? {
                  duration: bar.duration,
                  repeat: Infinity,
                  repeatType: 'mirror',
                  ease: 'easeInOut',
                }
              : { duration: 0.3 }
          }
        />
      ))}
    </span>
  )
}
