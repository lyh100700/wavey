import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Capacitor } from '@capacitor/core'
import { App as CapacitorApp } from '@capacitor/app'
import { ArrowDownToLine, Bell, FolderOpen, Music, Video } from 'lucide-react'
import ConfirmDialog from './components/ConfirmDialog.jsx'
import DiagnosticsDialog from './components/DiagnosticsDialog.jsx'
import Controls from './components/Controls.jsx'
import DropOverlay from './components/DropOverlay.jsx'
import EmptyState from './components/EmptyState.jsx'
import MediaPanel from './components/MediaPanel.jsx'
import RingtoneDialog from './components/RingtoneDialog.jsx'
import SeekBar from './components/SeekBar.jsx'
import Stage from './components/Stage.jsx'
import UpdateDialog from './components/UpdateDialog.jsx'
import WaveGlyph from './components/WaveGlyph.jsx'
import useBackButton, { exitApp } from './hooks/useBackButton.js'
import useMediaSession from './hooks/useMediaSession.js'
import useNowPlayingNotice from './hooks/useNowPlayingNotice.js'
import { filesToTracks, folderNameOf, nextOrder, supportsFolderPick } from './lib/media.js'
import { clampSegment, defaultSegment } from './lib/audio-trim.js'
import { formatDiagnostics, runDiagnostics } from './lib/diagnostics.js'
import { withTimeout } from './lib/timeout.js'
import {
  canBeRingtone,
  openSystemSoundSettings,
  RINGTONE_TYPES,
  ringtoneSupported,
  setAsRingtone,
} from './lib/ringtone.js'
import {
  canInstall,
  checkForUpdate,
  downloadAndInstall,
  openInstallSettings,
  openReleasePage,
} from './lib/update.js'
import {
  clearSource,
  deleteTrack,
  loadLibrary,
  saveMeta,
  saveTracks,
  updateTrack,
} from './lib/storage.js'

// 벨소리 설정이 통째로 끝나지 않으면 이만큼 기다렸다 포기한다.
// 갇힌 화면보다는 "안 됐다"는 말이 낫다.
const WHOLE_TIMEOUT_MS = 60 * 1000

const ACCEPT = 'audio/*,video/*,.mp3,.wav,.m4a,.aac,.flac,.ogg,.opus,.mp4,.webm,.mov,.m4v,.mkv'

export default function App() {
  // 오디오와 비디오를 각각 제 엘리먼트로 재생한다.
  // 음악까지 <video>로 틀면 안드로이드가 '영상'으로 보고 화면이 꺼질 때 멈춰 버린다.
  // 둘 다 계속 붙여 두기 때문에 모드를 오가도 다시 만들어지지 않는다.
  const audioRef = useRef(null)
  const videoRef = useRef(null)
  const fileInputRef = useRef(null)
  const folderInputRef = useRef(null)
  const scrubbing = useRef(false)
  // 다음 트랙이 로드됐을 때 이어서 재생할지 — 곡 넘김과 사용자의 직접 선택을 구분한다.
  const resumeOnLoad = useRef(false)

  // 재생 대상은 두 갈래다. 직접 담은 플레이리스트와, 폴더째로 불러온 목록.
  const [playlistTracks, setPlaylistTracks] = useState([])
  const [folderTracks, setFolderTracks] = useState([])
  const [folderName, setFolderName] = useState('')

  const [activeTab, setActiveTab] = useState('playlist') // 지금 보고 있는 탭
  const [playingSource, setPlayingSource] = useState('playlist') // 실제 재생 중인 큐
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

  // 뒤로가기로 부르는 종료 확인창
  const [askingExit, setAskingExit] = useState(false)

  // 안드로이드 앱으로 돌고 있는지. 벨소리와 업데이트 버튼이 이 값을 본다.
  const [isApp, setIsApp] = useState(false)
  const [ringtoneFor, setRingtoneFor] = useState(null) // 지정할 곡
  const [ringtoneType, setRingtoneType] = useState('ringtone')
  const [ringtoneBusy, setRingtoneBusy] = useState(false)
  // 곡 전체 대신 고른 구간만 쓸지, 그리고 그 구간
  const [useSegment, setUseSegment] = useState(false)
  const [segment, setSegment] = useState({ start: 0, end: 0 })
  const [ringtoneProgress, setRingtoneProgress] = useState(null)

  // 새 버전 안내 — progress가 null이 아니면 받는 중이다
  const [updateInfo, setUpdateInfo] = useState(null)
  const [updateProgress, setUpdateProgress] = useState(null)

  // 무언가 "반응이 없을" 때 어디가 막혔는지 두드려 보는 창
  const [diagnosing, setDiagnosing] = useState(false)
  const [diagnosis, setDiagnosis] = useState(null)

  // 저장소에서 되살리는 동안에는 화면을 잠깐 비워 둔다.
  const [restoring, setRestoring] = useState(true)
  // 되살리기가 끝나기 전에는 설정을 저장하지 않는다 (빈 값으로 덮어쓰는 사고 방지).
  const restored = useRef(false)

  const folderPickSupported = useMemo(() => supportsFolderPick(), [])

  // 지금 재생 중인 큐. 다음 곡·이전 곡은 모두 이 목록 안에서 움직인다.
  const queue = playingSource === 'playlist' ? playlistTracks : folderTracks
  const current = useMemo(
    () => queue.find((t) => t.id === currentId) ?? null,
    [queue, currentId],
  )

  // 지금 소리를 내고 있는 엘리먼트. 곡 종류에 따라 둘 중 하나가 쓰인다.
  const activeEl = useCallback(
    () => (current?.kind === 'video' ? videoRef.current : audioRef.current),
    [current?.kind],
  )

  const hasAnything = playlistTracks.length > 0 || folderTracks.length > 0

  const showToast = useCallback((message) => {
    setToast({ id: Math.random(), message })
  }, [])

  useEffect(() => {
    if (!toast) return undefined
    const timer = setTimeout(() => setToast(null), 2600)
    return () => clearTimeout(timer)
  }, [toast])

  /* ── 저장소에서 되살리기 ───────────────────────────────────── */

  useEffect(() => {
    let cancelled = false

    loadLibrary().then((saved) => {
      if (cancelled) {
        // 화면이 이미 사라졌다면 만들어 둔 주소를 도로 반납한다.
        ;[...saved.playlist, ...saved.folder].forEach((t) => URL.revokeObjectURL(t.url))
        return
      }

      setPlaylistTracks(saved.playlist)
      setFolderTracks(saved.folder)
      setFolderName(saved.meta.folderName ?? '')

      const prefs = saved.meta.playback ?? {}
      if (typeof prefs.volume === 'number') setVolume(prefs.volume)
      if (typeof prefs.muted === 'boolean') setMuted(prefs.muted)
      if (typeof prefs.shuffle === 'boolean') setShuffle(prefs.shuffle)
      if (prefs.repeat) setRepeat(prefs.repeat)
      if (prefs.activeTab) setActiveTab(prefs.activeTab)

      // 마지막에 듣던 곡을 그대로 올려 둔다. 재생은 사용자가 직접 시작한다.
      const lastSource = prefs.playingSource === 'folder' ? 'folder' : 'playlist'
      const lastQueue = lastSource === 'folder' ? saved.folder : saved.playlist
      if (prefs.currentId && lastQueue.some((t) => t.id === prefs.currentId)) {
        setPlayingSource(lastSource)
        setCurrentId(prefs.currentId)
      } else if (lastQueue.length > 0) {
        setPlayingSource(lastSource)
        setCurrentId(lastQueue[0].id)
      }

      resumeOnLoad.current = false
      restored.current = true
      setRestoring(false)

      const total = saved.playlist.length + saved.folder.length
      if (total > 0) {
        setToast({ id: Math.random(), message: `저장해 둔 ${total}개를 불러왔어요 🌊` })
      }
    })

    return () => {
      cancelled = true
    }
  }, [])

  // 재생 설정은 바뀔 때마다 조용히 저장해 둔다.
  useEffect(() => {
    if (!restored.current) return
    saveMeta('playback', {
      currentId,
      playingSource,
      activeTab,
      volume,
      muted,
      shuffle,
      repeat,
    })
  }, [currentId, playingSource, activeTab, volume, muted, shuffle, repeat])

  /* ── 파일 받기 ─────────────────────────────────────────────── */

  const addToPlaylist = useCallback(
    (fileList) => {
      const { accepted, rejected } = filesToTracks(fileList, nextOrder(playlistTracks))

      if (accepted.length > 0) {
        setPlaylistTracks((prev) => [...prev, ...accepted])
        setActiveTab('playlist')
        // 아직 아무것도 안 고른 상태라면 첫 곡을 올려 둔다 (재생은 사용자가 시작).
        setCurrentId((prev) => {
          if (prev) return prev
          setPlayingSource('playlist')
          return accepted[0].id
        })
        showToast(`${accepted.length}개를 파도에 띄웠어요 🌊`)

        // 다음에 앱을 열어도 남아 있도록 저장한다.
        saveTracks(accepted, 'playlist').then((res) => {
          if (!res.ok) {
            showToast(
              res.full
                ? '저장 공간이 가득 찼어요. 안 듣는 곡을 지워 주세요'
                : '이번 곡들은 저장하지 못했어요 (재생은 됩니다)',
            )
          }
        })
      }
      if (rejected.length > 0) {
        showToast(`재생할 수 없는 파일 ${rejected.length}개는 건너뛰었어요`)
      }
    },
    [playlistTracks, showToast],
  )

  const loadFolder = useCallback(
    (fileList) => {
      const { accepted, rejected } = filesToTracks(fileList)

      if (accepted.length === 0) {
        showToast('이 폴더에는 재생할 수 있는 파일이 없어요')
        return
      }

      // 이전 폴더의 주소를 정리하고 새 폴더로 갈아 끼운다.
      setFolderTracks((prev) => {
        prev.forEach((t) => URL.revokeObjectURL(t.url))
        return accepted
      })
      const name = folderNameOf(fileList)
      setFolderName(name)
      setActiveTab('folder')
      setQuery('')

      // 저장소에서도 이전 폴더를 비우고 새 폴더로 바꿔 둔다.
      clearSource('folder')
        .then(() => saveTracks(accepted, 'folder'))
        .then((res) => {
          if (!res.ok) {
            showToast(
              res.full
                ? '저장 공간이 가득 찼어요. 폴더가 너무 큰지 확인해 주세요'
                : '이 폴더는 저장하지 못했어요 (재생은 됩니다)',
            )
          }
        })
      saveMeta('folderName', name)

      // 폴더를 새로 골랐는데 그 폴더에서 재생 중이었다면 첫 곡으로 되돌린다.
      if (playingSource === 'folder') {
        resumeOnLoad.current = false
        setCurrentId(accepted[0].id)
      } else if (!currentId) {
        setPlayingSource('folder')
        setCurrentId(accepted[0].id)
      }

      showToast(
        rejected.length > 0
          ? `${accepted.length}개를 불러왔어요 (${rejected.length}개는 건너뜀)`
          : `${accepted.length}개를 불러왔어요 🌊`,
      )
    },
    [playingSource, currentId, showToast],
  )

  const openFilePicker = useCallback(() => fileInputRef.current?.click(), [])
  const openFolderPicker = useCallback(() => {
    // 폴더 고르기를 지원하지 않는 기기(대부분의 안드로이드)에서는
    // 여러 파일을 한꺼번에 고르는 쪽으로 대신 열어 준다.
    if (folderPickSupported) folderInputRef.current?.click()
    else fileInputRef.current?.click()
  }, [folderPickSupported])

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
      addToPlaylist(e.dataTransfer.files)
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
  }, [addToPlaylist])

  /* ── 트랙 이동 ─────────────────────────────────────────────── */

  const pickNeighbour = useCallback(
    (direction) => {
      if (queue.length === 0) return null
      if (shuffle && queue.length > 1) {
        let i = 0
        do {
          i = Math.floor(Math.random() * queue.length)
        } while (queue[i].id === currentId)
        return queue[i].id
      }
      const index = queue.findIndex((t) => t.id === currentId)
      if (index === -1) return queue[0].id
      const nextIndex = (index + direction + queue.length) % queue.length
      return queue[nextIndex].id
    },
    [queue, currentId, shuffle],
  )

  const selectTrack = useCallback((id, source) => {
    if (!id) return
    resumeOnLoad.current = true
    setPlayingSource(source)
    setCurrentId(id)
  }, [])

  const next = useCallback(() => {
    const id = pickNeighbour(1)
    if (!id) return
    resumeOnLoad.current = true
    setCurrentId(id)
  }, [pickNeighbour])

  const prev = useCallback(() => {
    const el = activeEl()
    // 3초 넘게 재생했으면 이전 곡 대신 처음으로 되감는다.
    if (el && el.currentTime > 3) {
      el.currentTime = 0
      return
    }
    const id = pickNeighbour(-1)
    if (!id) return
    resumeOnLoad.current = true
    setCurrentId(id)
  }, [pickNeighbour, activeEl])

  /* ── 재생 제어 ─────────────────────────────────────────────── */

  const play = useCallback(() => {
    const el = activeEl()
    if (!el || !current) return
    resumeOnLoad.current = true
    el.play().catch(() => showToast('재생을 시작하지 못했어요 😢'))
  }, [current, activeEl, showToast])

  const pause = useCallback(() => {
    activeEl()?.pause()
  }, [activeEl])

  const togglePlay = useCallback(() => {
    const el = activeEl()
    if (!el || !current) return
    if (el.paused) play()
    else pause()
  }, [current, activeEl, play, pause])

  const seek = useCallback(
    (time) => {
      const el = activeEl()
      if (!el || !Number.isFinite(time)) return
      el.currentTime = time
      setCurrentTime(time)
    },
    [activeEl],
  )

  // 지금 위치에서 초 단위로 감는다 (음수면 뒤로).
  // 화면에 그려진 시간은 조금 늦을 수 있어서, 엘리먼트가 실제로 가리키는
  // 위치를 기준으로 계산한다.
  const seekBy = useCallback(
    (delta) => {
      const el = activeEl()
      if (!el) return
      const total = Number.isFinite(el.duration) && el.duration > 0 ? el.duration : duration
      if (!(total > 0)) return
      seek(Math.min(total, Math.max(0, el.currentTime + delta)))
    },
    [activeEl, duration, seek],
  )

  const cycleRepeat = useCallback(() => {
    setRepeat((r) => (r === 'off' ? 'all' : r === 'all' ? 'one' : 'off'))
  }, [])

  /* ── 미디어 엘리먼트 연결 ──────────────────────────────────── */

  // 곡이 끝났을 때의 처리는 최신 상태를 봐야 해서 ref에 담아 둔다.
  const handleEndedRef = useRef(() => {})
  handleEndedRef.current = () => {
    const el = activeEl()
    if (!el) return

    if (repeat === 'one') {
      el.currentTime = 0
      el.play().catch(() => {})
      return
    }

    const index = queue.findIndex((t) => t.id === currentId)
    const isLast = index === queue.length - 1
    if (!shuffle && isLast && repeat === 'off') {
      setPlaying(false)
      setCurrentTime(el.duration || 0)
      return
    }
    next()
  }

  /** 쓰지 않는 쪽 엘리먼트는 완전히 비워 둔다. 두 곳에서 동시에 소리가 나면 안 된다. */
  const releaseElement = (el) => {
    if (!el) return
    el.pause()
    el.removeAttribute('src')
    el.load()
  }

  // 현재 곡의 소스를 물려 준다.
  useEffect(() => {
    if (!current) {
      setPlaying(false)
      setCurrentTime(0)
      setDuration(0)
      releaseElement(audioRef.current)
      releaseElement(videoRef.current)
      return
    }

    const isVideo = current.kind === 'video'
    const el = isVideo ? videoRef.current : audioRef.current
    // 음악에서 영상으로(또는 반대로) 넘어갈 때 이전 쪽을 확실히 놓아 준다.
    releaseElement(isVideo ? audioRef.current : videoRef.current)
    if (!el) return

    el.src = current.url
    el.load()
    setCurrentTime(0)
    setDuration(current.duration || 0)

    if (resumeOnLoad.current) {
      el.play().catch(() => setPlaying(false))
    }
  }, [current?.id, current?.url, current?.kind]) // eslint-disable-line react-hooks/exhaustive-deps

  // 볼륨은 엘리먼트가 새로 로드돼도 유지돼야 한다. 양쪽 모두에 걸어 둔다.
  useEffect(() => {
    for (const el of [audioRef.current, videoRef.current]) {
      if (!el) continue
      el.volume = volume
      el.muted = muted
    }
  }, [volume, muted, current?.id, current?.kind])

  useEffect(() => {
    const el = activeEl()
    if (!el) return undefined

    const onTimeUpdate = () => {
      if (!scrubbing.current) setCurrentTime(el.currentTime)
    }
    const onLoadedMetadata = () => {
      const d = Number.isFinite(el.duration) ? el.duration : 0
      setDuration(d)

      // 길이를 알아냈으면 목록과 저장소에도 적어 둔다.
      // 다음에 앱을 열 때 곡을 재생하기 전부터 길이가 보인다.
      const write = (list) =>
        list.map((t) => {
          if (t.id !== currentId || t.duration === d) return t
          const updated = { ...t, duration: d }
          updateTrack(updated, playingSource)
          return updated
        })
      if (playingSource === 'playlist') setPlaylistTracks(write)
      else setFolderTracks(write)
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
  }, [currentId, playingSource, activeEl, showToast])

  /* ── 잠금화면 · 알림창 · 이어폰 버튼 ───────────────────────── */

  const sourceLabel = playingSource === 'folder' ? folderName || '폴더' : '플레이리스트'

  useMediaSession({
    track: current,
    playing,
    currentTime,
    duration,
    sourceLabel,
    onPlay: play,
    onPause: pause,
    onNext: next,
    onPrev: prev,
    onSeek: seek,
  })

  // 안드로이드 앱일 때, 다른 화면으로 나가도 상태바에 Wavey를 남겨 둔다.
  useNowPlayingNotice({
    track: current,
    playing,
    sourceLabel,
    onTogglePlay: togglePlay,
    onNext: next,
    onPrev: prev,
    onProblem: showToast,
  })

  /* ── 뒤로가기와 종료 ───────────────────────────────────────── */

  // 뒤로가기는 "한 겹씩 닫기"로 동작한다. 열려 있는 창이 있으면 그것부터
  // 닫고, 더 닫을 게 없을 때 비로소 종료를 여쭤 본다.
  const handleBack = useCallback(() => {
    // 무언가 처리 중일 때는 창을 닫지 않는다. 중간에 끊기면 뒤가 지저분해진다.
    if (updateProgress !== null || ringtoneBusy) return
    if (updateInfo) {
      setUpdateInfo(null)
      return
    }
    if (ringtoneFor) {
      setRingtoneFor(null)
      return
    }
    if (askingExit) {
      setAskingExit(false)
      return
    }
    setAskingExit(true)
  }, [updateInfo, updateProgress, ringtoneBusy, ringtoneFor, askingExit])

  useBackButton(handleBack)

  const confirmExit = useCallback(() => {
    // 소리부터 끄고 나간다. 안 그러면 종료 직전에 한 박자 더 들린다.
    pause()
    exitApp()
  }, [pause])

  /* ── 문제 확인 ─────────────────────────────────────────────── */

  const openDiagnostics = useCallback(async () => {
    setDiagnosis([])
    setDiagnosing(true)
    const results = await runDiagnostics()
    setDiagnosis(results)
    setDiagnosing(false)
  }, [])

  const copyDiagnostics = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(formatDiagnostics(diagnosis ?? []))
      showToast('복사했어요. 붙여넣어 알려 주세요')
    } catch {
      showToast('복사하지 못했어요. 화면을 그대로 읽어 주세요')
    }
  }, [diagnosis, showToast])

  /* ── 벨소리로 설정 ─────────────────────────────────────────── */

  useEffect(() => {
    setIsApp(ringtoneSupported())
  }, [])

  /** 벨소리 창을 연다. 미리 듣기와 겹치지 않도록 본 재생은 멈춰 둔다. */
  const openRingtoneDialog = useCallback(() => {
    if (!current) return
    pause()
    setUseSegment(false)
    setSegment(defaultSegment(current.duration ?? 0))
    setRingtoneProgress(null)
    setRingtoneFor(current)
  }, [current, pause])

  // 손잡이를 끌 때마다 곡 길이와 최대 길이 안으로 다듬는다.
  const changeSegment = useCallback(
    (start, end) => {
      setSegment(clampSegment(start, end, ringtoneFor?.duration ?? 0))
    },
    [ringtoneFor?.duration],
  )

  /**
   * 벨소리로 지정한다.
   *
   * ── 순서가 중요하다 ──
   *
   * 예전에는 '시스템 설정 변경' 권한부터 받으려고 설정 화면을 열고 돌아오기를
   * 기다렸다. 그런데 안드로이드는 설정 화면에 다녀오는 사이 앱 화면을 통째로
   * 다시 만들 수 있고, 그러면 "돌아왔다"는 소식이 갈 곳을 잃어 그 기다림이
   * 영영 끝나지 않는다. 화면에는 엉뚱하게 "오려내는 중"만 계속 떠 있었다.
   *
   * 실은 자르고 옮기고 벨소리 폴더에 넣는 일에는 권한이 필요 없다. 권한은
   * 마지막 '기본 소리로 지정'에만 필요하고, 그건 안드로이드 쪽에서 권한이
   * 없으면 조용히 건너뛰고 알려 준다(applied: false).
   *
   * 그래서 할 일을 먼저 끝낸다. 기본 지정만 못 했으면 그때 설정 화면을
   * 안내하되, 돌아오기를 기다리지 않는다. 기다릴 이유가 없다.
   */
  const applyRingtone = useCallback(async () => {
    const track = ringtoneFor
    if (!track) return

    const cutting = useSegment && segment.end > segment.start
    setRingtoneBusy(true)
    setRingtoneProgress({ stage: cutting ? 'cutting' : 'sending', percent: 0, doing: '시작' })

    // 마지막으로 지나온 걸음. 통째로 멈췄을 때 어디였는지 알려 주기 위해 적어 둔다.
    let lastStep = '시작'
    const result = await withTimeout(
      setAsRingtone(track, {
        type: ringtoneType,
        // 길이를 모르는 곡이면 구간을 쓸 수 없다. 곡 전체로 넘어간다.
        segment: cutting ? segment : null,
        onStage: (stage, percent, doing) => {
          lastStep = doing ?? stage
          setRingtoneProgress({ stage, percent, doing })
        },
      }),
      WHOLE_TIMEOUT_MS,
      () => ({ ok: false, message: `"${lastStep}"에서 멈췄어요. 다시 해 보시겠어요?` }),
    )

    setRingtoneBusy(false)
    setRingtoneProgress(null)

    if (!result.ok) {
      showToast(result.message)
      // 무엇이 어디서 어긋났는지 바로 볼 수 있게 기록 창을 열어 준다.
      // 알림은 금세 사라져서, 그것만으로는 원인을 짚을 수가 없다.
      setRingtoneFor(null)
      openDiagnostics()
      return
    }

    setRingtoneFor(null)
    const label = RINGTONE_TYPES.find((t) => t.id === ringtoneType)?.label ?? '벨소리'

    if (result.applied) {
      showToast(`${label}(으)로 설정했어요 🔔`)
      return
    }

    // 파일은 들어갔다. 기본 지정만 권한이 없어 못 했다.
    showToast(`${label} 목록에 넣었어요. "시스템 설정 변경"을 켜 주세요`)
    // 기다리지 않는다. 여기서 막히면 아무 일도 못 하게 된다.
    openSystemSoundSettings()
  }, [ringtoneFor, ringtoneType, useSegment, segment, showToast])

  /* ── 새 버전 확인 ──────────────────────────────────────────── */

  // 앱으로 돌아올 때마다 다시 확인하되, 너무 자주 조르지 않도록 텀을 둔다.
  const RECHECK_MS = 10 * 60 * 1000
  const lastChecked = useRef(0)

  /**
   * 새 버전을 확인한다.
   *
   * 저절로 도는 확인은 조용하다 — 인터넷이 없다고 매번 알림이 뜨면 성가시다.
   * 사용자가 직접 누른 확인은 결과를 반드시 알려 준다. 그러지 않으면
   * "눌렀는데 아무 일도 안 일어난다"가 되어 버린다.
   */
  const runUpdateCheck = useCallback(
    async ({ manual = false } = {}) => {
      if (manual) showToast('새 버전을 확인하는 중…')
      const result = await checkForUpdate()
      lastChecked.current = Date.now()

      if (result.state === 'update') {
        setUpdateInfo(result.info)
        return
      }
      if (!manual) return

      if (result.state === 'current') showToast(`이미 최신이에요 (${result.info.versionName})`)
      else if (result.state === 'unsupported') showToast('앱으로 설치했을 때만 확인할 수 있어요')
      else showToast(`확인하지 못했어요 — ${result.reason}`)
    },
    [showToast],
  )

  // 앱을 켤 때 한 번.
  useEffect(() => {
    runUpdateCheck()
  }, [runUpdateCheck])

  // 그리고 다른 곳에 갔다 돌아올 때마다.
  // 안드로이드는 홈으로 나가도 앱을 살려 두기 때문에, 이게 없으면 앱을 완전히
  // 껐다 켜기 전까지 새 버전이 나온 줄을 영영 모른다.
  useEffect(() => {
    let cancelled = false
    let listener = null

    const setup = async () => {
      if (!Capacitor.isNativePlatform()) return
      const handle = await CapacitorApp.addListener('appStateChange', ({ isActive }) => {
        if (!isActive) return
        if (Date.now() - lastChecked.current < RECHECK_MS) return
        runUpdateCheck()
      })
      if (cancelled) handle.remove()
      else listener = handle
    }

    setup().catch(() => {
      // 확인을 못 걸어도 앱의 다른 기능에는 지장이 없다.
    })

    return () => {
      cancelled = true
      listener?.remove()
    }
  }, [runUpdateCheck, RECHECK_MS])

  /** 브라우저로 릴리스 페이지를 열어 준다. 앱에서 받는 길이 막혔을 때의 우회로. */
  const goToBrowser = useCallback(async () => {
    showToast('받는 곳을 열어 드릴게요')
    if (!(await openReleasePage())) {
      showToast('브라우저를 열지 못했어요. 릴리스 페이지에서 직접 받아 주세요')
    }
    setUpdateInfo(null)
  }, [showToast])

  /**
   * 업데이트를 시작한다.
   *
   * ── 설정 화면을 기다리지 않는다 ──
   *
   * 예전에는 '이 출처의 앱 설치' 권한 화면이 돌아오기를 기다렸다. 벨소리에서와
   * 똑같이, 안드로이드가 그 사이 앱 화면을 다시 만들면 그 기다림이 영영 끝나지
   * 않는다. 버튼을 눌러도 아무 일도 일어나지 않는 것처럼 보였던 이유다.
   *
   * 이제는 권한이 없으면 설정 화면만 띄워 두고 물러난다. 창은 열어 두므로
   * 스위치를 켜고 돌아와 다시 누르면 된다.
   */
  const startUpdate = useCallback(async () => {
    if (!updateInfo) return

    // 눌린 것 자체를 먼저 알린다. 이게 없으면 "버튼이 죽었는지, 그다음이
    // 막힌 것인지" 구분할 방법이 없다.
    showToast('업데이트를 시작할게요…')

    const permission = await canInstall()
    if (!permission.granted) {
      showToast(
        permission.reason
          ? `설치 권한을 확인하지 못했어요 (${permission.reason})`
          : '"이 출처의 앱 설치"를 켜고 다시 눌러 주세요',
      )
      // 기다리지 않는다. 여기서 막히면 아무 일도 못 하게 된다.
      openInstallSettings()
      if (permission.reason) {
        setUpdateInfo(null)
        openDiagnostics()
      }
      return
    }

    setUpdateProgress(0)
    const result = await downloadAndInstall(updateInfo, setUpdateProgress)
    setUpdateProgress(null)

    if (!result.ok) {
      showToast(`받지 못했어요 — ${result.message}`)
      setUpdateInfo(null)
      openDiagnostics()
      return
    }
    // 설치 화면이 떴다. 사용자가 거기서 마무리한다.
    setUpdateInfo(null)
  }, [updateInfo, showToast])

  /* ── 목록 편집 ─────────────────────────────────────────────── */

  const removeFromPlaylist = useCallback(
    (id) => {
      const target = playlistTracks.find((t) => t.id === id)
      if (!target) return

      // 지금 재생 중인 곡을 빼는 경우에만 다음 곡으로 넘긴다.
      if (playingSource === 'playlist' && id === currentId) {
        const neighbour = pickNeighbour(1)
        setCurrentId(neighbour && neighbour !== id ? neighbour : null)
        resumeOnLoad.current = false
      }

      setPlaylistTracks((prev) => prev.filter((t) => t.id !== id))
      URL.revokeObjectURL(target.url)
      deleteTrack(id)
    },
    [playlistTracks, playingSource, currentId, pickNeighbour],
  )

  const clearPlaylist = useCallback(() => {
    playlistTracks.forEach((t) => URL.revokeObjectURL(t.url))
    setPlaylistTracks([])
    setQuery('')
    if (playingSource === 'playlist') {
      setCurrentId(null)
      resumeOnLoad.current = false
    }
    clearSource('playlist')
  }, [playlistTracks, playingSource])

  const clearFolder = useCallback(() => {
    folderTracks.forEach((t) => URL.revokeObjectURL(t.url))
    setFolderTracks([])
    setFolderName('')
    setQuery('')
    if (playingSource === 'folder') {
      setCurrentId(null)
      resumeOnLoad.current = false
    }
    clearSource('folder')
    saveMeta('folderName', '')
  }, [folderTracks, playingSource])

  // 앱이 닫힐 때 남은 Object URL을 정리한다.
  const allTracksRef = useRef([])
  allTracksRef.current = [...playlistTracks, ...folderTracks]
  useEffect(
    () => () => {
      allTracksRef.current.forEach((t) => URL.revokeObjectURL(t.url))
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

  return (
    <div className="mx-auto flex min-h-full w-full max-w-xl flex-col gap-4 px-4 pb-6 safe-top safe-bottom">
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT}
        multiple
        onChange={(e) => {
          addToPlaylist(e.target.files)
          e.target.value = ''
        }}
        className="hidden"
      />
      {/* 폴더 통째로 고르기 (지원하는 브라우저에서만 쓰인다) */}
      <input
        ref={folderInputRef}
        type="file"
        multiple
        webkitdirectory=""
        directory=""
        onChange={(e) => {
          loadFolder(e.target.files)
          e.target.value = ''
        }}
        className="hidden"
      />

      {/*
        음악 전용 엘리먼트. 화면에 보이지 않지만 절대 트리에서 내리지 않는다.
        <video>가 아니라 <audio>로 틀어야 화면을 꺼도 안드로이드가 재생을 이어 간다.
      */}
      <audio ref={audioRef} preload="metadata" className="hidden" />

      <DropOverlay show={dragging} />

      {/* 머리말 */}
      <header className="flex items-center gap-2.5 pt-1">
        <div className="grid size-9 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-soda to-mint text-white shadow-pastel">
          <WaveGlyph className="size-5" />
        </div>
        <h1 className="text-lg font-black tracking-tight text-ink">
          Wavey <span className="text-xs font-bold text-ink-soft">웨이비</span>
        </h1>
        {/*
          지금 깔린 게 어느 빌드인지 — APK를 새로 설치했는지 확인할 때 쓴다.
          누르면 안드로이드 기능이 어디까지 닿는지 두드려 본다.
        */}
        <button
          type="button"
          onClick={openDiagnostics}
          title="문제 확인"
          className="ml-auto rounded-full bg-white/60 px-2 py-0.5 font-mono text-[10px] font-bold text-ink-soft transition active:scale-90"
        >
          {__BUILD_ID__}
        </button>

        {/* 손으로 새 버전 확인하기 */}
        {isApp && (
          <button
            type="button"
            onClick={() => runUpdateCheck({ manual: true })}
            title="새 버전 확인"
            aria-label="새 버전 확인"
            className="grid size-8 shrink-0 place-items-center rounded-xl text-ink-soft transition hover:bg-white/70 hover:text-soda-deep active:scale-90"
          >
            <ArrowDownToLine className="size-4" />
          </button>
        )}
      </header>

      {/* ── 메인: 플레이어 ───────────────────────────────────── */}
      <section className="flex flex-col gap-5 rounded-3xl border border-white/70 bg-white/55 p-5 shadow-pastel backdrop-blur-xl">
        {restoring ? (
          <div className="flex flex-col items-center gap-4 py-16">
            <motion.div
              className="droplet size-14 bg-gradient-to-br from-soda/40 to-mint/40"
              animate={{ y: [0, -10, 0], opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
            />
            <p className="text-sm font-bold text-ink-soft">저장해 둔 파도를 부르는 중…</p>
          </div>
        ) : hasAnything ? (
          <>
            <Stage
              videoRef={videoRef}
              track={current}
              playing={playing}
              currentTime={currentTime}
              duration={duration}
              onTogglePlay={togglePlay}
            />

            <div className="text-center">
              <AnimatePresence mode="wait">
                <motion.div
                  key={current?.id ?? 'none'}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.25 }}
                >
                  <h2 className="truncate text-lg font-bold text-ink">
                    {current?.title ?? '재생할 곡을 골라 주세요'}
                  </h2>
                  <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1 text-xs font-bold text-ink-soft">
                    {current?.kind === 'video' ? (
                      <>
                        <Video className="size-3.5" /> 비디오
                      </>
                    ) : (
                      <>
                        <Music className="size-3.5" /> 음악
                      </>
                    )}
                    <span className="text-ink-soft/50">·</span>
                    {playingSource === 'folder' ? (
                      <>
                        <FolderOpen className="size-3.5" />
                        {folderName || '폴더'}
                      </>
                    ) : (
                      '플레이리스트'
                    )}
                  </p>
                </motion.div>
              </AnimatePresence>

              {/* 벨소리로 설정 — 안드로이드 앱에서 음악을 틀고 있을 때만 보인다 */}
              {isApp && canBeRingtone(current) && (
                <button
                  type="button"
                  onClick={openRingtoneDialog}
                  className="mx-auto mt-3 flex items-center gap-1.5 rounded-full bg-white/70 px-4 py-2 text-xs font-bold text-ink-soft shadow-pastel transition hover:text-soda-deep active:scale-95"
                >
                  <Bell className="size-3.5" />
                  벨소리로 설정
                </button>
              )}
            </div>

            <SeekBar
              currentTime={currentTime}
              duration={duration}
              playing={playing}
              disabled={!current}
              getMedia={activeEl}
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
              onSeekBy={seekBy}
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
          <EmptyState onPick={openFilePicker} onPickFolder={openFolderPicker} />
        )}
      </section>

      {/* ── 아래: 무엇을 재생할지 고르는 곳 ──────────────────── */}
      <MediaPanel
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab)
          setQuery('')
        }}
        playlistTracks={playlistTracks}
        folderTracks={folderTracks}
        folderName={folderName}
        currentId={currentId}
        playingSource={playingSource}
        playing={playing}
        query={query}
        onQueryChange={setQuery}
        onSelect={selectTrack}
        onRemove={removeFromPlaylist}
        onPickFiles={openFilePicker}
        onPickFolder={openFolderPicker}
        onClearPlaylist={clearPlaylist}
        onClearFolder={clearFolder}
        folderPickSupported={folderPickSupported}
      />

      {/*
        알림. 안내창(z-50)보다 위에 있어야 한다. 아래에 두면 창이 떠 있는 동안
        뿌연 배경에 가려, 무엇이 잘못됐는지 알려 주는 말이 사용자에게 닿지 않는다.
      */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ type: 'spring', stiffness: 320, damping: 26 }}
            className="pointer-events-none fixed inset-x-0 bottom-6 z-[60] mx-auto w-fit max-w-[90vw] rounded-3xl border border-white/70 bg-white/85 px-5 py-3 text-sm font-bold text-ink shadow-pastel-lg backdrop-blur-xl"
          >
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 뒤로가기로 부르는 종료 확인 */}
      <ConfirmDialog
        open={askingExit}
        title="Wavey를 종료할까요?"
        description="재생 중인 곡도 함께 멈춰요"
        confirmLabel="종료"
        cancelLabel="계속 듣기"
        tone="coral"
        onConfirm={confirmExit}
        onCancel={() => setAskingExit(false)}
      />

      <RingtoneDialog
        open={Boolean(ringtoneFor)}
        track={ringtoneFor}
        type={ringtoneType}
        useSegment={useSegment}
        segment={segment}
        busy={ringtoneBusy}
        progress={ringtoneProgress}
        onTypeChange={setRingtoneType}
        onUseSegmentChange={setUseSegment}
        onSegmentChange={changeSegment}
        onConfirm={applyRingtone}
        onCancel={() => setRingtoneFor(null)}
      />

      <DiagnosticsDialog
        open={diagnosing || Boolean(diagnosis)}
        results={diagnosis ?? []}
        running={diagnosing}
        onCopy={copyDiagnostics}
        onClose={() => setDiagnosis(null)}
      />

      <UpdateDialog
        open={Boolean(updateInfo)}
        info={updateInfo}
        progress={updateProgress}
        onConfirm={startUpdate}
        onCancel={() => setUpdateInfo(null)}
        onUseBrowser={goToBrowser}
      />
    </div>
  )
}
