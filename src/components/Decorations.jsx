import { motion } from 'framer-motion'

/**
 * 화면 여백에 흩뿌리는 작은 장식들.
 *
 * 글자를 읽는 데 방해가 되면 안 되므로 옅게, 글자가 놓이는 자리를 피해서
 * 깔고, 움직임도 아주 느리게 준다. 시안보다 개수를 줄였다 — 작은 폰 화면에서는
 * 같은 밀도로 깔면 지저분해 보인다.
 */

export function Bubble({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" opacity="0.8" />
      <circle cx="8.6" cy="8.6" r="2.4" fill="currentColor" opacity="0.45" />
    </svg>
  )
}

export function MusicNote({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M20 4.2a1 1 0 0 0-1.2-1L9.5 5.4a1 1 0 0 0-.8 1v9.1a3.6 3.6 0 1 0 2 3.2V9.2l7.3-1.7v5.3a3.6 3.6 0 1 0 2 3.2V4.2Z" />
    </svg>
  )
}

export function Fish({ className = '' }) {
  return (
    <svg viewBox="0 0 32 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M20.5 12c0 3.6-4.1 6.5-9.2 6.5S2 15.6 2 12s4.1-6.5 9.2-6.5S20.5 8.4 20.5 12Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M20.5 12 29 6.5v11L20.5 12Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="8" cy="10.6" r="1.2" fill="currentColor" />
    </svg>
  )
}

export function Paw({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <ellipse cx="6.4" cy="9.6" rx="2.5" ry="3.2" />
      <ellipse cx="12" cy="7.2" rx="2.6" ry="3.4" />
      <ellipse cx="17.6" cy="9.6" rx="2.5" ry="3.2" />
      <path d="M12 12.4c3.4 0 5.8 2.2 5.8 4.6S15.4 21 12 21s-5.8-1.6-5.8-4S8.6 12.4 12 12.4Z" />
    </svg>
  )
}

export function Sparkle({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 2.6c.5 4.6 2.2 6.3 6.8 6.8-4.6.5-6.3 2.2-6.8 6.8-.5-4.6-2.2-6.3-6.8-6.8 4.6-.5 6.3-2.2 6.8-6.8Z" />
    </svg>
  )
}

// 자리·크기·색·떠오르는 속도를 미리 정해 둔다. 가운데(글자 자리)는 비워 둔다.
const PIECES = [
  { C: MusicNote, style: 'left-[6%] top-[10%] size-5 text-soda/45', delay: 0, drift: 10 },
  { C: Bubble, style: 'left-[13%] top-[46%] size-6 text-soda/35', delay: 1.4, drift: 14 },
  { C: Paw, style: 'left-[8%] top-[74%] size-5 text-mint/50', delay: 0.7, drift: 8 },
  { C: Fish, style: 'left-[4%] top-[30%] w-8 text-mint/45', delay: 2.1, drift: 12 },
  { C: MusicNote, style: 'right-[8%] top-[16%] size-6 text-mint/45', delay: 0.9, drift: 12 },
  { C: Bubble, style: 'right-[6%] top-[52%] size-5 text-soda/35', delay: 1.8, drift: 10 },
  { C: Fish, style: 'right-[5%] top-[76%] w-8 text-soda/40', delay: 0.4, drift: 14 },
  { C: Sparkle, style: 'right-[16%] top-[36%] size-4 text-coral/35', delay: 2.4, drift: 8 },
  { C: Sparkle, style: 'left-[20%] top-[20%] size-3.5 text-coral/30', delay: 1.2, drift: 6 },
]

/** 부모에 relative를 걸고 그 안에 깔면 된다. */
export default function FloatingDecor({ className = '' }) {
  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden="true">
      {PIECES.map(({ C, style, delay, drift }, i) => (
        <motion.span
          key={i}
          className={`absolute ${style}`}
          animate={{ y: [0, -drift, 0], opacity: [0.75, 1, 0.75] }}
          transition={{
            duration: 6 + (i % 4),
            repeat: Infinity,
            ease: 'easeInOut',
            delay,
          }}
        >
          <C className="size-full" />
        </motion.span>
      ))}
    </div>
  )
}
