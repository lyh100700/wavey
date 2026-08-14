import { motion } from 'framer-motion'

/**
 * 파도 위에서 몸을 웅크리고 자는 강아지.
 *
 * 위쪽 마스코트(사진)와 같은 그림을 또 쓰면 화면이 단조로워지므로 따로 그렸다.
 * 선으로 그린 덕에 작게 줄여도 뭉개지지 않고 파일도 들지 않는다.
 */
export default function SleepingDog({ className = '' }) {
  return (
    <svg
      viewBox="0 0 176 134"
      fill="none"
      className={className}
      role="img"
      aria-label="파도 위에서 자고 있는 강아지"
    >
      {/* 몸통 — 웅크린 덩어리 */}
      <ellipse cx="100" cy="88" rx="46" ry="24" fill="#FFFFFF" stroke="#9AC4D8" strokeWidth="2.4" />

      {/* 꼬리 — 몸을 감싸듯 말려 있다 */}
      <path
        d="M144 82 C 162 74, 168 94, 150 98"
        stroke="#9AC4D8"
        strokeWidth="2.4"
        strokeLinecap="round"
        fill="#FFFFFF"
      />

      {/* 뒷발 */}
      <ellipse cx="92" cy="108" rx="15" ry="7" fill="#FFFFFF" stroke="#9AC4D8" strokeWidth="2.2" />

      {/* 머리 */}
      <circle cx="52" cy="78" r="25" fill="#FFFFFF" stroke="#9AC4D8" strokeWidth="2.4" />

      {/* 늘어진 귀 — 머리 위로 덮이게 그려야 귀처럼 읽힌다 */}
      <path
        d="M60 58 C 80 52, 94 68, 85 84 C 78 94, 62 89, 59 74 Z"
        fill="#EAF4FA"
        stroke="#9AC4D8"
        strokeWidth="2.4"
        strokeLinejoin="round"
      />

      {/* 주둥이와 코 */}
      <ellipse cx="28" cy="87" rx="14" ry="10.5" fill="#FFFFFF" stroke="#9AC4D8" strokeWidth="2.2" />
      <ellipse cx="17" cy="84" rx="4.6" ry="3.6" fill="#2B4A5B" />
      <ellipse cx="15.6" cy="82.8" rx="1.5" ry="1.1" fill="#FFFFFF" opacity="0.75" />

      {/* 감은 눈 — 아래로 휘어진 선 하나면 자는 얼굴이 된다 */}
      <path
        d="M42 74 C 46 79, 53 79, 57 74"
        stroke="#2B4A5B"
        strokeWidth="2.6"
        strokeLinecap="round"
      />

      {/* 발그레한 볼 */}
      <ellipse cx="46" cy="90" rx="6" ry="4" fill="#FF85A1" opacity="0.35" />

      {/* 앞발 */}
      <ellipse cx="56" cy="108" rx="13" ry="7" fill="#FFFFFF" stroke="#9AC4D8" strokeWidth="2.2" />

      {/* 파란 반다나 — 삼각형으로 늘어뜨리면 몸에서 떠 보여서 목을 감싸는 모양으로 뒀다 */}
      <path
        d="M56 90 C 64 101, 78 100, 86 87"
        stroke="#8FC3E8"
        strokeWidth="8"
        strokeLinecap="round"
        fill="none"
      />
      <path d="M56 90 C 64 101, 78 100, 86 87" stroke="#5E9BC7" strokeWidth="1.6" fill="none" />
      <circle cx="70" cy="99" r="4.2" fill="#B7DBF2" stroke="#5E9BC7" strokeWidth="2" />

      {/* 새근새근 — 크기가 다른 z가 차례로 떠오른다 */}
      {[
        { z: 'z', x: 86, y: 46, size: 13, delay: 0 },
        { z: 'z', x: 100, y: 32, size: 17, delay: 0.55 },
        { z: 'Z', x: 117, y: 20, size: 22, delay: 1.1 },
      ].map(({ z, x, y, size, delay }) => (
        <motion.text
          key={z + x}
          x={x}
          y={y}
          fontSize={size}
          fontWeight="900"
          fill="#3AB7EE"
          animate={{ opacity: [0.15, 0.95, 0.15], y: [0, -7, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay }}
        >
          {z}
        </motion.text>
      ))}
    </svg>
  )
}
