/**
 * Wavey의 상징인 잔물결 글리프.
 * lucide 아이콘 대신 직접 그려서 로고·물방울 썸·빈 상태에 일관되게 쓴다.
 */
export default function WaveGlyph({ className = '', strokeWidth = 2.2 }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M2 8.5c2.2-2.4 4.4-2.4 6.6 0s4.4 2.4 6.6 0 4.4-2.4 6.6 0" />
      <path d="M2 14c2.2-2.4 4.4-2.4 6.6 0s4.4 2.4 6.6 0 4.4-2.4 6.6 0" opacity=".7" />
      <path d="M2 19.5c2.2-2.4 4.4-2.4 6.6 0s4.4 2.4 6.6 0 4.4-2.4 6.6 0" opacity=".4" />
    </svg>
  )
}
