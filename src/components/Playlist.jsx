import { AnimatePresence, motion } from 'framer-motion'
import { ListMusic, Music, Plus, Search, Trash2, Video, X } from 'lucide-react'
import { formatSize, formatTime } from '../lib/media.js'
import MiniEqualizer from './MiniEqualizer.jsx'

/** 미디어 목록 — 추가·삭제·검색. 재생 중인 곡 옆에는 미니 음파가 둠칫거린다. */
export default function Playlist({
  tracks,
  visibleTracks,
  currentId,
  playing,
  query,
  onQueryChange,
  onSelect,
  onRemove,
  onPick,
  onClearAll,
}) {
  const isFiltering = query.trim().length > 0

  return (
    <section className="flex min-h-0 flex-col gap-4 rounded-3xl border border-white/70 bg-white/60 p-5 shadow-pastel backdrop-blur-xl">
      <header className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-bold text-ink">
          <ListMusic className="size-5 text-soda-deep" />
          플레이리스트
          <span className="rounded-full bg-soda/15 px-2.5 py-0.5 text-xs font-bold text-soda-deep">
            {tracks.length}
          </span>
        </h2>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onPick}
            title="파일 추가"
            aria-label="파일 추가"
            className="grid size-9 place-items-center rounded-2xl bg-gradient-to-br from-soda to-mint text-white shadow-pastel transition hover:brightness-105 active:scale-90"
          >
            <Plus className="size-5" />
          </button>
          {tracks.length > 0 && (
            <button
              type="button"
              onClick={onClearAll}
              title="목록 비우기"
              aria-label="목록 비우기"
              className="grid size-9 place-items-center rounded-2xl text-ink-soft transition hover:bg-coral/10 hover:text-coral active:scale-90"
            >
              <Trash2 className="size-4.5" />
            </button>
          )}
        </div>
      </header>

      {/* 검색 */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-soft" />
        <input
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="곡 이름으로 찾기"
          aria-label="플레이리스트 검색"
          className="w-full rounded-2xl border border-white/80 bg-white/80 py-2.5 pl-10 pr-9 text-sm text-ink outline-none transition placeholder:text-ink-soft/70 focus:border-soda focus:ring-4 focus:ring-soda/20"
        />
        {isFiltering && (
          <button
            type="button"
            onClick={() => onQueryChange('')}
            aria-label="검색어 지우기"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-soft transition hover:text-coral"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {/* 목록 */}
      <ul className="-mr-2 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-2 lg:max-h-[26rem]">
        <AnimatePresence initial={false}>
          {visibleTracks.map((track) => {
            const isCurrent = track.id === currentId
            const Icon = track.kind === 'video' ? Video : Music

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
                  className={`group flex w-full cursor-pointer items-center gap-3 rounded-2xl px-3 py-2.5 text-left outline-none transition ${
                    isCurrent
                      ? 'bg-gradient-to-r from-soda/25 to-mint/20 ring-1 ring-soda/40'
                      : 'hover:bg-white/80 focus-visible:bg-white/80'
                  }`}
                >
                  {/* 아이콘 자리 — 재생 중이면 음파로 바뀐다 */}
                  <span
                    className={`grid size-10 shrink-0 place-items-center rounded-xl ${
                      isCurrent ? 'bg-white/80 shadow-pastel' : 'bg-soda/10'
                    }`}
                  >
                    {isCurrent ? (
                      <MiniEqualizer playing={playing} />
                    ) : (
                      <Icon className="size-4.5 text-soda-deep" />
                    )}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span
                      className={`block truncate text-sm ${
                        isCurrent ? 'font-bold text-ink' : 'font-semibold text-ink/85'
                      }`}
                    >
                      {track.title}
                    </span>
                    <span className="mt-0.5 flex items-center gap-1.5 text-[11px] font-medium text-ink-soft">
                      <span className="rounded-md bg-white/70 px-1.5 py-px uppercase tracking-wide">
                        {track.kind === 'video' ? '영상' : '음악'}
                      </span>
                      {track.duration > 0 && <span>{formatTime(track.duration)}</span>}
                      {track.size > 0 && <span>· {formatSize(track.size)}</span>}
                    </span>
                  </span>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onRemove(track.id)
                    }}
                    title="목록에서 빼기"
                    aria-label={`${track.title} 목록에서 빼기`}
                    className="grid size-8 shrink-0 place-items-center rounded-xl text-ink-soft/70 opacity-0 transition hover:bg-coral/10 hover:text-coral focus-visible:opacity-100 group-hover:opacity-100 active:scale-90"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </motion.li>
            )
          })}
        </AnimatePresence>

        {/* 검색 결과가 없을 때 */}
        {visibleTracks.length === 0 && (
          <li className="grid place-items-center gap-1 py-10 text-center">
            <p className="text-sm font-semibold text-ink-soft">
              {isFiltering ? '이 이름의 파도는 없네요 🫧' : '아직 목록이 비어 있어요'}
            </p>
            {isFiltering && (
              <button
                type="button"
                onClick={() => onQueryChange('')}
                className="text-xs font-bold text-soda-deep underline-offset-4 hover:underline"
              >
                검색어 지우기
              </button>
            )}
          </li>
        )}
      </ul>
    </section>
  )
}
