import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Music, Video } from 'lucide-react'
import Controls from './components/Controls.jsx'
import DropOverlay from './components/DropOverlay.jsx'
import EmptyState from './components/EmptyState.jsx'
import Playlist from './components/Playlist.jsx'
import SeekBar from './components/SeekBar.jsx'
import Stage from './components/Stage.jsx'
import WaveGlyph from './components/WaveGlyph.jsx'
import { filesToTracks } from './lib/media.js'

const ACCEPT = 'audio/*,video/*,.mp3,.wav,.m4a,.aac,.flac,.ogg,.opus,.mp4,.webm,.mov,.m4v,.mkv'

export default function App() {
  const mediaRef = useRef(null)
  const fileInputRef = useRef(null)
  const scrubbing = useRef(false)
  // 다음 트랙이 로드됐을 때 이어서 재생할지 — 곡 넘김과 사용자의 직접 선택을 구분한다.
  const resumeOnLoad = useRef(false)

  const [tracks, setTracks] = useState([])
  const [currentId, setCurrentId] = useState(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(0.85)
  const [muted, setMuted] = useState(false)
  const [query, setQuery] = useState('')
  const [shuffle, setShuffle] = useState(false)
  const [repeat, setRepeat] = useState('off') // off | all | one
  const [dragging, setDragging] = useState(false)
  const [toast, setToast] = useState(null)

  const current = useMemo(
    () => tracks.find((t) => t.id === currentId) ?? null,
    [tracks, currentId],
  )

  const visibleTracks = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return tracks
    return tracks.filter((t) => t.title.toLowerCase().includes(q))
  }, [tracks, query])

  const showToast = useCallback((message) => {
    setToast({ id: Math.random(), message })
  }, [])

  useEffect(() => {
    if (!toast) return undefined
    const timer = setTimeout(() => setToast(null), 2600)
    return () => clearTimeout(timer)
  }, [toast])

  /* ── 파일 받기 ─────────────────────────────────────────────── */

  const addFiles = useCallback(
    (fileList) => {
      const { accepted, rejected } = filesToTracks(fileList)

      if (accepted.length > 0) {
        setTracks((prev) => [...prev, ...accepted])
        setCurrentId((prev) => prev ?? accepted[0].id)
        showToast(`${accepted.length}개를 파도에 띄웠어요 🌊`)
      }
      if (rejected.length > 0) {
        showToast(`재생할 수 없는 파일 ${rejected.length}개는 건너뛰었어요`)
      }
    },
    [showToast],
  )

  const openPicker = useCallback(() => fileInputRef.current?.click(), [])

  const handleInputChange = (e) => {
    addFiles(e.target.files)
    // 같은 파일을 연달아 고를 수 있도록 값을 비워 둔다.
    e.target.value = ''
  }

  /* ── 화면 어디에 놓아도 받아 주는 드래그 앤 드롭 ──────────── */

  useEffect(() => {
    let depth = 0
    const hasFiles = (e) => Array.from(e.dataTransfer?.types ?? []).includes('Files')

    const onDragEnter = (e) => {
      if (!hasFiles(e)) return
      depth += 1
      setDragging(true)
    }
    const onDragOver = (e) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
    }
    const onDragLeave = () => {
      depth = Math.max(0, depth - 1)
      if (depth === 0) setDragging(false)
    }
    const onDrop = (e) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      depth = 0
      setDragging(false)
      addFiles(e.dataTransfer.files)
    }

    window.addEventListener('dragenter', onDragEnter)
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('dragleave', onDragLeave)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragenter', onDragEnter)
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('dragleave', onDragLeave)
      window.removeEventListener('drop', onDrop)
    }
  }, [addFiles])

  /* ── 트랙 이동 ─────────────────────────────────────────────── */

  const pickNeighbour = useCallback(
    (direction) => {
      if (tracks.length === 0) return null
      if (shuffle && tracks.length > 1) {
        let i = 0
        do {
          i = Math.floor(Math.random() * tracks.length)
        } while (tracks[i].id === currentId)
        return tracks[i].id
      }
      const index = tracks.findIndex((t) => t.id === currentId)
      if (index === -1) return tracks[0].id
      const next = (index + direction + tracks.length) % tracks.length
      return tracks[next].id
    },
    [tracks, currentId, shuffle],
  )

  const goTo = useCallback(
    (id, autoPlay = true) => {
      if (!id) return
      resumeOnLoad.current = autoPlay
      setCurrentId(id)
    },
    [],
  )

  const next = useCallback(() => goTo(pickNeighbour(1)), [goTo, pickNeighbour])

  const prev = useCallback(() => {
    const el = mediaRef.current
    // 3초 넘게 재생했으면 이전 곡 대신 처음으로 되감는다.
    if (el && el.currentTime > 3) {
      el.currentTime = 0
      return
    }
    goTo(pickNeighbour(-1))
  }, [goTo, pickNeighbour])

  /* ── 재생 제어 ─────────────────────────────────────────────── */

  const togglePlay = useCallback(() => {
    const el = mediaRef.current
    if (!el || !current) return
    if (el.paused) {
      resumeOnLoad.current = true
      el.play().catch(() => showToast('재생을 시작하지 못했어요 😢'))
    } else {
      el.pause()
    }
  }, [current, showToast])

  const seek = useCallback((time) => {
    const el = mediaRef.current
    if (!el || !Number.isFinite(time)) return
    el.currentTime = time
    setCurrentTime(time)
  }, [])

  const cycleRepeat = useCallback(() => {
    setRepeat((r) => (r === 'off' ? 'all' : r === 'all' ? 'one' : 'off'))
  }, [])

  /* ── 미디어 엘리먼트 연결 ──────────────────────────────────── */

  // 곡이 끝났을 때의 처리는 최신 상태를 봐야 해서 ref에 담아 둔다.
  const handleEndedRef = useRef(() => {})
  handleEndedRef.current = () => {
    const el = mediaRef.current
    if (!el) return

    if (repeat === 'one') {
      el.currentTime = 0
      el.play().catch(() => {})
      return
    }

    const index = tracks.findIndex((t) => t.id === currentId)
    const isLast = index === tracks.length - 1
    if (!shuffle && isLast && repeat === 'off') {
      setPlaying(false)
      setCurrentTime(el.duration || 0)
      return
    }
    next()
  }

  // 현재 곡의 소스를 물려 준다.
  useEffect(() => {
    // 목록이 비면 Stage가 통째로 사라져 엘리먼트도 없어진다.
    // 상태부터 되돌려야 다음에 파일을 넣었을 때 '재생 중'으로 잘못 보이지 않는다.
    if (!current) {
      setPlaying(false)
      setCurrentTime(0)
      setDuration(0)
      const gone = mediaRef.current
      if (gone) {
        gone.removeAttribute('src')
        gone.load()
      }
      return
    }

    const el = mediaRef.current
    if (!el) return

    el.src = current.url
    el.load()
    setCurrentTime(0)
    setDuration(current.duration || 0)

    if (resumeOnLoad.current) {
      el.play().catch(() => setPlaying(false))
    }
  }, [current?.id, current?.url]) // eslint-disable-line react-hooks/exhaustive-deps

  // 볼륨은 엘리먼트가 새로 로드돼도 유지돼야 한다.
  useEffect(() => {
    const el = mediaRef.current
    if (!el) return
    el.volume = volume
    el.muted = muted
  }, [volume, muted, current?.id])

  useEffect(() => {
    const el = mediaRef.current
    if (!el) return undefined

    const onTimeUpdate = () => {
      if (!scrubbing.current) setCurrentTime(el.currentTime)
    }
    const onLoadedMetadata = () => {
      const d = Number.isFinite(el.duration) ? el.duration : 0
      setDuration(d)
      // 길이를 알아냈으면 플레이리스트에도 적어 둔다.
      setTracks((prev) =>
        prev.map((t) => (t.id === currentId && t.duration !== d ? { ...t, duration: d } : t)),
      )
    }
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    const onEnded = () => handleEndedRef.current()
    const onError = () => {
      if (!el.src) return
      setPlaying(false)
      showToast('이 파일은 재생할 수 없어요 😢')
    }

    el.addEventListener('timeupdate', onTimeUpdate)
    el.addEventListener('loadedmetadata', onLoadedMetadata)
    el.addEventListener('durationchange', onLoadedMetadata)
    el.addEventListener('play', onPlay)
    el.addEventListener('pause', onPause)
    el.addEventListener('ended', onEnded)
    el.addEventListener('error', onError)
    return () => {
      el.removeEventListener('timeupdate', onTimeUpdate)
      el.removeEventListener('loadedmetadata', onLoadedMetadata)
      el.removeEventListener('durationchange', onLoadedMetadata)
      el.removeEventListener('play', onPlay)
      el.removeEventListener('pause', onPause)
      el.removeEventListener('ended', onEnded)
      el.removeEventListener('error', onError)
    }
  }, [currentId, showToast])

  /* ── 목록 편집 ─────────────────────────────────────────────── */

  const removeTrack = useCallback(
    (id) => {
      const target = tracks.find((t) => t.id === id)
      if (!target) return

      if (id === currentId) {
        const neighbour = pickNeighbour(1)
        // 마지막 한 곡이면 이웃이 자기 자신이므로 빈 상태로 돌아간다.
        setCurrentId(neighbour && neighbour !== id ? neighbour : null)
        resumeOnLoad.current = false
      }

      setTracks((prev) => prev.filter((t) => t.id !== id))
      URL.revokeObjectURL(target.url)
    },
    [tracks, currentId, pickNeighbour],
  )

  const clearAll = useCallback(() => {
    tracks.forEach((t) => URL.revokeObjectURL(t.url))
    setTracks([])
    setCurrentId(null)
    setQuery('')
    resumeOnLoad.current = false
  }, [tracks])

  // 앱이 닫힐 때 남은 Object URL을 정리한다.
  const tracksRef = useRef(tracks)
  tracksRef.current = tracks
  useEffect(
    () => () => {
      tracksRef.current.forEach((t) => URL.revokeObjectURL(t.url))
    },
    [],
  )

  /* ── 키보드 단축키 ─────────────────────────────────────────── */

  useEffect(() => {
    const onKeyDown = (e) => {
      const tag = e.target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable) return

      if (e.code === 'Space' || e.key === 'k') {
        e.preventDefault()
        togglePlay()
      } else if (e.key === 'ArrowRight' && e.shiftKey) {
        e.preventDefault()
        next()
      } else if (e.key === 'ArrowLeft' && e.shiftKey) {
        e.preventDefault()
        prev()
      } else if (e.key === 'm') {
        setMuted((m) => !m)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [togglePlay, next, prev])

  /* ── 화면 ──────────────────────────────────────────────────── */

  const hasTracks = tracks.length > 0

  return (
    <div className="mx-auto flex min-h-full w-full max-w-6xl flex-col gap-6 px-4 pb-6 safe-top safe-bottom sm:px-6">
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT}
        multiple
        onChange={handleInputChange}
        className="hidden"
      />

      <DropOverlay show={dragging} />

      {/* 머리말 */}
      <header className="flex items-center gap-3 pt-2">
        <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-soda to-mint text-white shadow-pastel">
          <WaveGlyph className="size-6" />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-black tracking-tight text-ink">
            Wavey <span className="text-sm font-bold text-ink-soft">웨이비</span>
          </h1>
          <p className="truncate text-xs font-medium text-ink-soft">
            소리의 파도를 따라 즐기는 나만의 미디어 플레이어
          </p>
        </div>
      </header>

      <main className="grid min-h-0 flex-1 gap-6 lg:grid-cols-[minmax(0,1fr)_23rem] lg:items-start">
        {/* 플레이어 */}
        <section className="flex flex-col gap-6 rounded-3xl border border-white/70 bg-white/55 p-5 shadow-pastel backdrop-blur-xl sm:p-7">
          {hasTracks ? (
            <>
              <Stage
                mediaRef={mediaRef}
                track={current}
                playing={playing}
                currentTime={currentTime}
                duration={duration}
                onTogglePlay={togglePlay}
              />

              {/* 지금 재생 중인 곡 */}
              <div className="text-center">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={current?.id ?? 'none'}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.25 }}
                  >
                    <h2 className="truncate text-lg font-bold text-ink sm:text-xl">
                      {current?.title ?? '재생할 곡을 골라 주세요'}
                    </h2>
                    <p className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1 text-xs font-bold text-ink-soft">
                      {current?.kind === 'video' ? (
                        <>
                          <Video className="size-3.5" /> 비디오 모드
                        </>
                      ) : (
                        <>
                          <Music className="size-3.5" /> 음악 모드
                        </>
                      )}
                    </p>
                  </motion.div>
                </AnimatePresence>
              </div>

              <SeekBar
                currentTime={currentTime}
                duration={duration}
                playing={playing}
                disabled={!current}
                onSeek={seek}
                onScrubStart={() => {
                  scrubbing.current = true
                }}
                onScrubEnd={() => {
                  scrubbing.current = false
                }}
              />

              <Controls
                playing={playing}
                disabled={!current}
                shuffle={shuffle}
                repeat={repeat}
                volume={volume}
                muted={muted}
                onTogglePlay={togglePlay}
                onPrev={prev}
                onNext={next}
                onToggleShuffle={() => setShuffle((s) => !s)}
                onCycleRepeat={cycleRepeat}
                onToggleMute={() => setMuted((m) => !m)}
                onVolumeChange={(v) => {
                  setVolume(v)
                  if (v > 0) setMuted(false)
                }}
              />
            </>
          ) : (
            <EmptyState onPick={openPicker} />
          )}
        </section>

        <Playlist
          tracks={tracks}
          visibleTracks={visibleTracks}
          currentId={currentId}
          playing={playing}
          query={query}
          onQueryChange={setQuery}
          onSelect={(id) => goTo(id, true)}
          onRemove={removeTrack}
          onPick={openPicker}
          onClearAll={clearAll}
        />
      </main>

      {/* 알림 */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ type: 'spring', stiffness: 320, damping: 26 }}
            className="pointer-events-none fixed inset-x-0 bottom-6 z-40 mx-auto w-fit max-w-[90vw] rounded-3xl border border-white/70 bg-white/85 px-5 py-3 text-sm font-bold text-ink shadow-pastel-lg backdrop-blur-xl"
          >
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
