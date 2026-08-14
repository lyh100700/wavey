import { motion } from 'framer-motion'
import { FolderOpen, ListMusic, Plus, RefreshCw, Search, Trash2, X } from 'lucide-react'
import { SleepingMascot } from './Mascot.jsx'
import TrackList from './TrackList.jsx'

const TABS = [
  { key: 'playlist', label: '플레이리스트', icon: ListMusic },
  { key: 'folder', label: '폴더', icon: FolderOpen },
]

function TabButton({ tab, active, count, onClick }) {
  const Icon = tab.icon
  return (
    <button
      type="button"
      onClick={onClick}
      role="tab"
      aria-selected={active}
      className={`relative flex flex-1 items-center justify-center gap-2 rounded-2xl px-3 py-2.5 text-sm font-bold transition ${
        active ? 'text-ink' : 'text-ink-soft hover:text-soda-deep'
      }`}
    >
      {/* 선택된 탭 뒤로 물방울이 미끄러져 따라온다 */}
      {active && (
        <motion.span
          layoutId="tab-bubble"
          className="absolute inset-0 rounded-2xl bg-white/90 shadow-pastel"
          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
        />
      )}
      <span className="relative flex items-center gap-1.5">
        <Icon className="size-4" />
        {tab.label}
        {count > 0 && (
          <span
            className={`rounded-full px-1.5 py-px text-[11px] ${
              active ? 'bg-soda/20 text-soda-deep' : 'bg-white/60 text-ink-soft'
            }`}
          >
            {count}
          </span>
        )}
      </span>
    </button>
  )
}

function EmptyHint({ title, body, actionLabel, onAction, secondary }) {
  return (
    <div className="flex flex-col items-center gap-3 pb-6 pt-2 text-center">
      {/* 목록이 비었으니 마스코트도 파도 위에서 한숨 자고 있다 */}
      <SleepingMascot />
      <div className="px-4">
        <p className="text-sm font-bold text-ink">{title}</p>
        <p className="mt-1 text-xs text-ink-soft">{body}</p>
      </div>
      <button
        type="button"
        onClick={onAction}
        className="rounded-2xl bg-gradient-to-r from-soda to-mint px-5 py-2.5 text-sm font-bold text-white shadow-pastel transition hover:brightness-105 active:scale-95"
      >
        {actionLabel}
      </button>
      {secondary}
    </div>
  )
}

/**
 * 재생할 것을 고르는 아래쪽 패널.
 * '플레이리스트'(내가 직접 담은 곡)와 '폴더'(폴더째로 불러온 곡) 두 갈래로 나뉜다.
 */
export default function MediaPanel({
  activeTab,
  onTabChange,
  playlistTracks,
  folderTracks,
  folderName,
  currentId,
  playingSource,
  playing,
  query,
  onQueryChange,
  onSelect,
  onRemove,
  onPickFiles,
  onPickFolder,
  onClearPlaylist,
  onClearFolder,
  folderPickSupported,
}) {
  const isPlaylist = activeTab === 'playlist'
  const source = isPlaylist ? playlistTracks : folderTracks

  const q = query.trim().toLowerCase()
  const shown = q ? source.filter((t) => t.title.toLowerCase().includes(q)) : source

  return (
    <section className="flex flex-col gap-4 rounded-3xl border border-white/70 bg-white/60 p-4 shadow-pastel backdrop-blur-xl sm:p-5">
      {/* 탭 */}
      <div role="tablist" className="flex gap-1 rounded-3xl bg-soda/10 p-1">
        {TABS.map((tab) => (
          <TabButton
            key={tab.key}
            tab={tab}
            active={activeTab === tab.key}
            count={tab.key === 'playlist' ? playlistTracks.length : folderTracks.length}
            onClick={() => onTabChange(tab.key)}
          />
        ))}
      </div>

      {/* 폴더 탭 머리말 — 어느 폴더를 보고 있는지 */}
      {!isPlaylist && folderTracks.length > 0 && (
        <div className="flex items-center gap-2 rounded-2xl bg-white/70 px-3 py-2">
          <FolderOpen className="size-4 shrink-0 text-soda-deep" />
          <span className="min-w-0 flex-1 truncate text-sm font-bold text-ink">
            {folderName || '고른 파일들'}
          </span>
          <button
            type="button"
            onClick={onPickFolder}
            title="다른 폴더 고르기"
            aria-label="다른 폴더 고르기"
            className="grid size-8 shrink-0 place-items-center rounded-xl text-ink-soft transition hover:bg-soda/10 hover:text-soda-deep active:scale-90"
          >
            <RefreshCw className="size-4" />
          </button>
          <button
            type="button"
            onClick={onClearFolder}
            title="폴더 비우기"
            aria-label="폴더 비우기"
            className="grid size-8 shrink-0 place-items-center rounded-xl text-ink-soft transition hover:bg-coral/10 hover:text-coral active:scale-90"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      )}

      {/* 플레이리스트 탭 버튼들 */}
      {isPlaylist && playlistTracks.length > 0 && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onPickFiles}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-gradient-to-br from-soda to-mint py-2.5 text-sm font-bold text-white shadow-pastel transition hover:brightness-105 active:scale-95"
          >
            <Plus className="size-4" />
            곡 추가
          </button>
          <button
            type="button"
            onClick={onClearPlaylist}
            title="목록 비우기"
            aria-label="목록 비우기"
            className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white/70 text-ink-soft transition hover:bg-coral/10 hover:text-coral active:scale-90"
          >
            <Trash2 className="size-4.5" />
          </button>
        </div>
      )}

      {/* 검색 — 목록이 있을 때만 */}
      {source.length > 0 && (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-soft" />
          <input
            type="search"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="곡 이름으로 찾기"
            aria-label="목록 검색"
            className="w-full rounded-2xl border border-white/80 bg-white/80 py-2.5 pl-10 pr-9 text-sm text-ink outline-none transition placeholder:text-ink-soft/70 focus:border-soda focus:ring-4 focus:ring-soda/20"
          />
          {q && (
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
      )}

      {/* 목록 */}
      <div className="max-h-[24rem] min-h-0 overflow-y-auto">
        <TrackList
          tracks={shown}
          currentId={currentId}
          isPlayingSource={playingSource === activeTab}
          playing={playing}
          onSelect={(id) => onSelect(id, activeTab)}
          onRemove={isPlaylist ? onRemove : undefined}
          emptyNode={
            q ? (
              <div className="grid place-items-center gap-1 py-10 text-center">
                <p className="text-sm font-semibold text-ink-soft">
                  이 이름의 파도는 없네요 🫧
                </p>
                <button
                  type="button"
                  onClick={() => onQueryChange('')}
                  className="text-xs font-bold text-soda-deep underline-offset-4 hover:underline"
                >
                  검색어 지우기
                </button>
              </div>
            ) : isPlaylist ? (
              <EmptyHint
                title="플레이리스트가 비어 있어요"
                body="듣고 싶은 곡을 하나씩 담아 보세요"
                actionLabel="곡 고르기"
                onAction={onPickFiles}
              />
            ) : (
              <EmptyHint
                title="아직 폴더를 고르지 않았어요"
                body={
                  folderPickSupported
                    ? '폴더를 고르면 그 안의 음악과 영상을 한 번에 불러와요'
                    : '이 기기에서는 파일을 여러 개 골라 담아 주세요'
                }
                actionLabel={folderPickSupported ? '폴더 고르기' : '파일 여러 개 고르기'}
                onAction={onPickFolder}
                secondary={
                  folderPickSupported ? (
                    <button
                      type="button"
                      onClick={onPickFiles}
                      className="text-xs font-bold text-ink-soft underline-offset-4 hover:text-soda-deep hover:underline"
                    >
                      폴더 대신 파일로 고르기
                    </button>
                  ) : null
                }
              />
            )
          }
        />
      </div>
    </section>
  )
}
