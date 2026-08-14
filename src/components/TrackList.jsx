import { AnimatePresence, motion } from 'framer-motion'
import { Music, Trash2, Video } from 'lucide-react'
import { formatSize, formatTime, subPathOf } from '../lib/media.js'
import MiniEqualizer from './MiniEqualizer.jsx'

/**
 * 트랙 목록. 플레이리스트 탭과 폴더 탭이 같은 모양을 쓴다.
 * 지금 재생 중인 곡 옆에서는 미니 파도 음파가 둠칫거린다.
 */
export default function TrackList({
  tracks,
  currentId,
  isPlayingSource, // 이 목록이 실제로 재생 중인 큐인지
  playing,
  onSelect,
  onRemove, // 없으면 삭제 버튼을 숨긴다 (폴더 탭)
  emptyNode,
}) {
  if (tracks.length === 0) return emptyNode ?? null

  return (
    <ul className="-mr-2 flex flex-col gap-2 overflow-y-auto pr-2">
      <AnimatePresence initial={false}>
        {tracks.map((track) => {
          const isCurrent = isPlayingSource && track.id === currentId
          const Icon = track.kind === 'video' ? Video : Music
          const sub = subPathOf(track)

          return (
            <motion.li
              key={track.id}
              layout
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: 24, transition: { duration: 0.18 } }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            >
              <div
                role="button"
                tabIndex={0}
                onClick={() => onSelect(track.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onSelect(track.id)
                  }
                }}
                className={`group flex w-full cursor-pointer items-center gap-3 rounded-2xl px-3 py-3 text-left outline-none transition ${
                  isCurrent
                    ? 'bg-gradient-to-r from-soda/25 to-mint/20 ring-1 ring-soda/40'
                    : 'hover:bg-white/80 focus-visible:bg-white/80'
                }`}
              >
                <span
                  className={`grid size-11 shrink-0 place-items-center rounded-xl ${
                    isCurrent ? 'bg-white/80 shadow-pastel' : 'bg-soda/10'
                  }`}
                >
                  {isCurrent ? (
                    <MiniEqualizer playing={playing} />
                  ) : (
                    <Icon className="size-5 text-soda-deep" />
                  )}
                </span>

                <span className="min-w-0 flex-1">
                  <span
                    className={`block truncate text-[15px] ${
                      isCurrent ? 'font-bold text-ink' : 'font-semibold text-ink/85'
                    }`}
                  >
                    {track.title}
                  </span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-[11px] font-medium text-ink-soft">
                    <span className="rounded-md bg-white/70 px-1.5 py-px">
                      {track.kind === 'video' ? '영상' : '음악'}
                    </span>
                    {track.duration > 0 && <span>{formatTime(track.duration)}</span>}
                    {track.size > 0 && <span>· {formatSize(track.size)}</span>}
                    {sub && <span className="truncate">· 📁 {sub}</span>}
                  </span>
                </span>

                {onRemove && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onRemove(track.id)
                    }}
                    title="목록에서 빼기"
                    aria-label={`${track.title} 목록에서 빼기`}
                    className="grid size-9 shrink-0 place-items-center rounded-xl text-ink-soft/70 transition hover:bg-coral/10 hover:text-coral active:scale-90 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                  >
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>
            </motion.li>
          )
        })}
      </AnimatePresence>
    </ul>
  )
}
