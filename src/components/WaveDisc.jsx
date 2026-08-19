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

  // 배경흐림(backdrop-blur)을 걸지 않는다. 이 원반은 제 배경과 물로 이미 덮여
  // 있어 흐림이 눈에 띄지도 않는데, 안에서 물과 음표가 쉬지 않고 움직이므로
  // 브라우저가 매 프레임 뒤쪽 화면을 다시 흐리게 만들어야 한다.
  // 안드로이드 웹뷰에서 이것이 화면 깜빡임으로 나타난다.
  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-full bg-white/80 shadow-pastel-lg ring-8 ring-white/70">
      {/* 물이 차기 전의 옅은 바탕 */}
      <div
        className="absolute inset-0 opacity-25"
        style={{ background: `linear-gradient(140deg, ${from}, ${to})` }}
      />

      {/* 차오르는 물 — 높이가 곧 재생 진행률이다 */}
      {/*
        물높이는 용수철(spring)로 움직이면 안 된다. 재생 위치가 1초에 네 번
        새로 들어오는데, 용수철이 멎기 전에 다음 목표가 주어지면 출렁이며
        떨린다. 재생은 일정한 속도로 흐르므로 일정한 속도로 따라가게 둔다.
      */}
      <motion.div
        className="absolute inset-x-0 bottom-0"
        animate={{ height: `${level}%` }}
        transition={{ ease: 'linear', duration: 1 }}
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
          className="grid size-20 place-items-center rounded-full bg-white/85 text-soda-deep shadow-pastel sm:size-24"
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
