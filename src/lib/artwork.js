import { paletteFor } from './media.js'

/**
 * 잠금화면과 알림창에 띄울 앨범 그림을 그린다.
 *
 * 아직 음악 파일 안의 진짜 커버를 읽지 않으므로, 곡 이름에서 뽑은 파스텔 색으로
 * Wavey다운 물결 그림을 직접 그려 준다. 같은 곡은 늘 같은 색이 나온다.
 */

const cache = new Map()
const SIZE = 512

/** 캔버스에 물결 한 겹을 그린다. */
function drawWave(ctx, { baseY, amplitude, wavelength, color, alpha }) {
  ctx.beginPath()
  ctx.moveTo(0, baseY)
  for (let x = 0; x <= SIZE; x += 4) {
    const y = baseY + Math.sin((x / wavelength) * Math.PI * 2) * amplitude
    ctx.lineTo(x, y)
  }
  ctx.lineTo(SIZE, SIZE)
  ctx.lineTo(0, SIZE)
  ctx.closePath()

  ctx.globalAlpha = alpha
  ctx.fillStyle = color
  ctx.fill()
  ctx.globalAlpha = 1
}

/**
 * 곡 이름에 어울리는 앨범 그림을 만들어 data 주소로 돌려준다.
 * 캔버스를 못 쓰는 환경이면 null을 준다 — 그림 없이도 재생은 문제없다.
 */
export function artworkFor(title = '') {
  if (typeof document === 'undefined') return null
  if (cache.has(title)) return cache.get(title)

  try {
    const canvas = document.createElement('canvas')
    canvas.width = SIZE
    canvas.height = SIZE
    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    const [from, to] = paletteFor(title)

    // 바탕 — 왼쪽 위에서 오른쪽 아래로 흐르는 그라데이션
    const bg = ctx.createLinearGradient(0, 0, SIZE, SIZE)
    bg.addColorStop(0, from)
    bg.addColorStop(1, to)
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, SIZE, SIZE)

    // 물결 세 겹 — 뒤로 갈수록 옅게
    drawWave(ctx, { baseY: SIZE * 0.58, amplitude: 26, wavelength: 380, color: '#FFFFFF', alpha: 0.22 })
    drawWave(ctx, { baseY: SIZE * 0.66, amplitude: 20, wavelength: 300, color: '#FFFFFF', alpha: 0.28 })
    drawWave(ctx, { baseY: SIZE * 0.74, amplitude: 15, wavelength: 240, color: '#FFFFFF', alpha: 0.35 })

    // 가운데 물방울 하나
    ctx.globalAlpha = 0.9
    ctx.fillStyle = '#FFFFFF'
    ctx.beginPath()
    ctx.arc(SIZE / 2, SIZE * 0.4, 46, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1

    const url = canvas.toDataURL('image/png')
    cache.set(title, url)
    return url
  } catch {
    return null
  }
}
