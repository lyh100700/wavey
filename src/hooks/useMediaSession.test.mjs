/**
 * 잠금화면 연동이 실제로 동작하는지 확인한다.
 *
 * 잠금화면은 눈으로 확인하기 어렵고 폰에서만 보이기 때문에,
 * 브라우저를 흉내 낸 환경에서 "무엇이 등록됐는지"를 직접 들여다본다.
 */
import assert from 'node:assert/strict'
import test, { before } from 'node:test'
import { JSDOM } from 'jsdom'

let React
let createRoot
let act
let useMediaSession
let session
let container

/** navigator.mediaSession을 흉내 낸다. 등록된 버튼과 정보를 기록해 둔다. */
function makeFakeSession() {
  return {
    metadata: null,
    playbackState: 'none',
    handlers: {},
    positionState: null,
    setActionHandler(action, handler) {
      if (handler === null) delete this.handlers[action]
      else this.handlers[action] = handler
    },
    setPositionState(state) {
      this.positionState = state
    },
  }
}

before(async () => {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    url: 'https://localhost/',
    pretendToBeVisual: true,
  })

  globalThis.window = dom.window
  globalThis.document = dom.window.document
  // Node 24의 globalThis.navigator는 읽기 전용이라 대입 대신 다시 정의해야 한다.
  Object.defineProperty(globalThis, 'navigator', {
    value: dom.window.navigator,
    configurable: true,
    writable: true,
  })
  globalThis.HTMLElement = dom.window.HTMLElement
  globalThis.Element = dom.window.Element
  globalThis.Node = dom.window.Node
  globalThis.IS_REACT_ACT_ENVIRONMENT = true

  session = makeFakeSession()
  Object.defineProperty(dom.window.navigator, 'mediaSession', {
    value: session,
    configurable: true,
  })
  dom.window.MediaMetadata = class MediaMetadata {
    constructor(init) {
      Object.assign(this, init)
    }
  }

  React = (await import('react')).default
  ;({ createRoot } = await import('react-dom/client'))
  ;({ act } = await import('react'))
  useMediaSession = (await import('./useMediaSession.js')).default

  container = document.getElementById('root')
})

/** 훅만 실행하는 껍데기 컴포넌트를 그린다. */
async function renderHook(props) {
  const Probe = () => {
    useMediaSession(props)
    return null
  }
  const root = createRoot(container)
  await act(async () => {
    root.render(React.createElement(Probe))
  })
  return root
}

const track = { id: 't1', title: '밤바다', kind: 'audio' }
const noop = () => {}
const baseProps = {
  track,
  playing: true,
  currentTime: 30,
  duration: 180,
  sourceLabel: '여름앨범',
  onPlay: noop,
  onPause: noop,
  onNext: noop,
  onPrev: noop,
  onSeek: noop,
}

test('잠금화면에 곡 제목과 출처가 올라간다', async () => {
  const root = await renderHook(baseProps)

  assert.equal(session.metadata.title, '밤바다')
  assert.equal(session.metadata.artist, '음악')
  assert.equal(session.metadata.album, '여름앨범')

  await act(async () => root.unmount())
})

test('재생 중이면 상태가 playing으로 표시된다', async () => {
  const root = await renderHook({ ...baseProps, playing: true })
  assert.equal(session.playbackState, 'playing')
  await act(async () => root.unmount())

  const root2 = await renderHook({ ...baseProps, playing: false })
  assert.equal(session.playbackState, 'paused')
  await act(async () => root2.unmount())
})

test('잠금화면 버튼이 모두 등록된다', async () => {
  const root = await renderHook(baseProps)

  const expected = ['play', 'pause', 'previoustrack', 'nexttrack', 'stop', 'seekbackward', 'seekforward', 'seekto']
  for (const action of expected) {
    assert.equal(typeof session.handlers[action], 'function', `${action} 버튼이 없다`)
  }

  await act(async () => root.unmount())
})

test('잠금화면 버튼을 누르면 앱의 동작이 불린다', async () => {
  const calls = []
  const root = await renderHook({
    ...baseProps,
    onPlay: () => calls.push('play'),
    onPause: () => calls.push('pause'),
    onNext: () => calls.push('next'),
    onPrev: () => calls.push('prev'),
  })

  session.handlers.play()
  session.handlers.nexttrack()
  session.handlers.previoustrack()
  session.handlers.pause()

  assert.deepEqual(calls, ['play', 'next', 'prev', 'pause'])
  await act(async () => root.unmount())
})

test('되감기·빨리감기가 현재 위치를 기준으로 움직인다', async () => {
  const seeks = []
  const root = await renderHook({
    ...baseProps,
    currentTime: 30,
    duration: 180,
    onSeek: (t) => seeks.push(t),
  })

  session.handlers.seekbackward({ seekOffset: 10 })
  session.handlers.seekforward({ seekOffset: 15 })
  session.handlers.seekto({ seekTime: 99 })

  assert.deepEqual(seeks, [20, 45, 99])
  await act(async () => root.unmount())
})

test('곡 처음에서 되감아도 0초 아래로 내려가지 않는다', async () => {
  const seeks = []
  const root = await renderHook({ ...baseProps, currentTime: 3, onSeek: (t) => seeks.push(t) })

  session.handlers.seekbackward({ seekOffset: 10 })

  assert.deepEqual(seeks, [0])
  await act(async () => root.unmount())
})

test('곡 끝에서 빨리감아도 길이를 넘지 않는다', async () => {
  const seeks = []
  const root = await renderHook({
    ...baseProps,
    currentTime: 175,
    duration: 180,
    onSeek: (t) => seeks.push(t),
  })

  session.handlers.seekforward({ seekOffset: 30 })

  assert.deepEqual(seeks, [180])
  await act(async () => root.unmount())
})

test('잠금화면 재생 위치 막대에 현재 위치가 전달된다', async () => {
  const root = await renderHook({ ...baseProps, currentTime: 42, duration: 180 })

  assert.equal(session.positionState.position, 42)
  assert.equal(session.positionState.duration, 180)

  await act(async () => root.unmount())
})

test('재생할 곡이 없으면 잠금화면 정보를 지운다', async () => {
  const root = await renderHook({ ...baseProps, track: null })
  assert.equal(session.metadata, null)
  await act(async () => root.unmount())
})

test('화면을 떠나면 버튼 등록을 해제한다', async () => {
  const root = await renderHook(baseProps)
  assert.ok(Object.keys(session.handlers).length > 0)

  await act(async () => root.unmount())

  assert.deepEqual(session.handlers, {}, '해제하지 않으면 다른 화면에서 오작동한다')
})
