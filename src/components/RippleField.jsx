import { AnimatePresence, motion } from 'framer-motion'

const RINGS = [0, 1, 2, 3]

/**
 * 앨범 아트 주변으로 잔잔하게 퍼져 나가는 물결(Rippling) 애니메이션.
 * 재생 중일 때만 링이 번져 나가고, 멈추면 부드럽게 사라진다.
 */
export default function RippleField({ active }) {
  return (
    <div className="pointer-events-none absolute inset-0 grid place-items-center">
      <AnimatePresence>
        {active &&
          RINGS.map((i) => (
            <motion.span
              key={i}
              className="absolute aspect-square w-full rounded-full border-2 border-soda/45"
              initial={{ scale: 0.88, opacity: 0 }}
              animate={{
                scale: [0.88, 1.45],
                opacity: [0, 0.55, 0],
              }}
              exit={{ opacity: 0, transition: { duration: 0.5 } }}
              transition={{
                duration: 3.6,
                repeat: Infinity,
                delay: i * 0.9,
                ease: 'easeOut',
              }}
            />
          ))}
      </AnimatePresence>

      {/* 안쪽에서 은은하게 숨 쉬는 민트빛 후광 */}
      <motion.span
        className="absolute aspect-square w-[92%] rounded-full bg-mint/25 blur-2xl"
        animate={active ? { scale: [1, 1.12, 1], opacity: [0.5, 0.8, 0.5] } : { scale: 1, opacity: 0.35 }}
        transition={{ duration: 4.5, repeat: active ? Infinity : 0, ease: 'easeInOut' }}
      />
    </div>
  )
}
