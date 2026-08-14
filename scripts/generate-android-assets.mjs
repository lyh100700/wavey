/**
 * assets/ 의 원본 그림 두 장으로 안드로이드 앱 아이콘과 스플래시를 만든다.
 *
 *   node scripts/generate-android-assets.mjs
 *
 * 안드로이드는 화면 해상도마다 다른 크기의 그림을 요구한다. 손으로 만들면
 * 원본을 고칠 때마다 스무 장을 다시 뽑아야 하므로 스크립트로 남겨 둔다.
 *
 * 크기 조절은 macOS에 기본으로 있는 sips가 하고, 투명 여백을 넣거나 둥글게
 * 오려내는 합성만 pngjs로 처리한다.
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PNG } from 'pngjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const res = join(root, 'android/app/src/main/res')
const tmp = join(root, '.asset-tmp')

const ICON_SRC = join(root, 'assets/icon-source.png')
const SPLASH_SRC = join(root, 'assets/splash-source.png')

// 런처 아이콘의 해상도별 크기 (dp 기준 48 × 배율)
const LAUNCHER_SIZES = {
  mdpi: 48,
  hdpi: 72,
  xhdpi: 96,
  xxhdpi: 144,
  xxxhdpi: 192,
}

// 적응형 아이콘은 108dp 캔버스에 그리고, 실제로 보이는 건 가운데 72dp뿐이다.
// 바깥 18dp는 런처가 모양대로 오려내며 잘려 나간다.
const ADAPTIVE_CANVAS = 432 // 108dp × 4 (xxxhdpi)
const ADAPTIVE_SAFE = 288 // 72dp × 4

// 스플래시는 세로 화면 기준으로만 넣는다. 가로로 돌려도 가운데 정렬이라 무너지지 않는다.
const SPLASH_WIDTHS = {
  mdpi: 320,
  hdpi: 480,
  xhdpi: 640,
  xxhdpi: 960,
  xxxhdpi: 1280,
}

function sh(cmd, args) {
  execFileSync(cmd, args, { stdio: 'pipe' })
}

function readPng(path) {
  return PNG.sync.read(readFileSync(path))
}

function writePng(png, path) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, PNG.sync.write(png))
}

/** sips로 크기를 줄여 임시 파일에 쓰고 그 경로를 준다. */
function resized(src, width, height, name) {
  const out = join(tmp, name)
  mkdirSync(tmp, { recursive: true })
  sh('sips', ['-z', String(height), String(width), src, '--out', out])
  return out
}

/** 그림을 투명한 캔버스 한가운데에 얹는다. */
function centerOnTransparent(srcPath, canvasSize) {
  const src = readPng(srcPath)
  const out = new PNG({ width: canvasSize, height: canvasSize, fill: true })
  const offsetX = Math.round((canvasSize - src.width) / 2)
  const offsetY = Math.round((canvasSize - src.height) / 2)

  for (let y = 0; y < src.height; y += 1) {
    for (let x = 0; x < src.width; x += 1) {
      const from = (src.width * y + x) << 2
      const tx = x + offsetX
      const ty = y + offsetY
      if (tx < 0 || ty < 0 || tx >= canvasSize || ty >= canvasSize) continue
      const to = (canvasSize * ty + tx) << 2
      out.data[to] = src.data[from]
      out.data[to + 1] = src.data[from + 1]
      out.data[to + 2] = src.data[from + 2]
      out.data[to + 3] = src.data[from + 3]
    }
  }
  return out
}

/** 정사각형 그림을 동그랗게 오려낸다 (둥근 런처 아이콘용). */
function circleMask(png) {
  const { width, height } = png
  const cx = (width - 1) / 2
  const cy = (height - 1) / 2
  const radius = Math.min(width, height) / 2

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (width * y + x) << 2
      const distance = Math.hypot(x - cx, y - cy)
      // 가장자리 1px은 반투명으로 남겨 톱니처럼 보이지 않게 한다.
      const alpha = distance <= radius - 1 ? 255 : distance >= radius ? 0 : Math.round((radius - distance) * 255)
      png.data[i + 3] = Math.min(png.data[i + 3], alpha)
    }
  }
  return png
}

/** 그림 네 귀퉁이의 평균 색 — 배경으로 깔기에 가장 자연스러운 색이다. */
function cornerColor(path) {
  const png = readPng(path)
  const spots = [
    [2, 2],
    [png.width - 3, 2],
    [2, png.height - 3],
    [png.width - 3, png.height - 3],
  ]
  let r = 0
  let g = 0
  let b = 0
  for (const [x, y] of spots) {
    const i = (png.width * y + x) << 2
    r += png.data[i]
    g += png.data[i + 1]
    b += png.data[i + 2]
  }
  const hex = (v) => Math.round(v / spots.length).toString(16).padStart(2, '0').toUpperCase()
  return `#${hex(r)}${hex(g)}${hex(b)}`
}

/** 가운데 원 안쪽 색 — 스플래시 배경으로 쓸 대표색. */
function centerColor(path) {
  const png = readPng(path)
  const x = Math.floor(png.width / 2)
  const y = Math.floor(png.height * 0.08)
  const i = (png.width * y + x) << 2
  const hex = (v) => v.toString(16).padStart(2, '0').toUpperCase()
  return `#${hex(png.data[i])}${hex(png.data[i + 1])}${hex(png.data[i + 2])}`
}

/* ── 만들기 ─────────────────────────────────────────────────── */

rmSync(tmp, { recursive: true, force: true })

console.log('앱 아이콘 만드는 중…')
for (const [density, size] of Object.entries(LAUNCHER_SIZES)) {
  const square = resized(ICON_SRC, size, size, `icon-${size}.png`)
  const dir = join(res, `mipmap-${density}`)

  // 네모난 기본 아이콘
  writePng(readPng(square), join(dir, 'ic_launcher.png'))
  // 동그란 아이콘을 쓰는 런처용
  writePng(circleMask(readPng(square)), join(dir, 'ic_launcher_round.png'))
  console.log(`  ${density.padEnd(8)} ${size}×${size}`)
}

console.log('적응형 아이콘(안드로이드 8 이상) 만드는 중…')
const safeIcon = resized(ICON_SRC, ADAPTIVE_SAFE, ADAPTIVE_SAFE, 'icon-safe.png')
writePng(
  centerOnTransparent(safeIcon, ADAPTIVE_CANVAS),
  join(res, 'drawable/ic_launcher_foreground.png'),
)
// 벡터로 만들어 뒀던 예전 앞면은 이제 쓰지 않는다.
rmSync(join(res, 'drawable/ic_launcher_foreground.xml'), { force: true })
rmSync(join(res, 'drawable/ic_launcher_background.xml'), { force: true })
console.log(`  ${ADAPTIVE_CANVAS}×${ADAPTIVE_CANVAS} (가운데 ${ADAPTIVE_SAFE} 안에 그림)`)

console.log('스플래시 만드는 중…')
const splash = readPng(SPLASH_SRC)
const ratio = splash.height / splash.width
// splash.xml(배경색 + 가운데 그림)이 이 그림을 가져다 쓴다. 이름이 겹치면
// 안드로이드가 어느 쪽을 쓸지 알 수 없으므로 그림은 splash_image로 둔다.
for (const [density, width] of Object.entries(SPLASH_WIDTHS)) {
  const height = Math.round(width * ratio)
  const out = resized(SPLASH_SRC, width, height, `splash-${width}.png`)
  writePng(readPng(out), join(res, `drawable-port-${density}/splash_image.png`))
  console.log(`  ${density.padEnd(8)} ${width}×${height}`)
}
// 세로가 아닌 화면(가로 등)을 위한 기본값
writePng(
  readPng(resized(SPLASH_SRC, 640, Math.round(640 * ratio), 'splash-default.png')),
  join(res, 'drawable/splash_image.png'),
)
// 예전 이름으로 남아 있던 그림은 치운다.
rmSync(join(res, 'drawable/splash.png'), { force: true })
for (const density of Object.keys(SPLASH_WIDTHS)) {
  rmSync(join(res, `drawable-port-${density}/splash.png`), { force: true })
}

const iconEdge = cornerColor(ICON_SRC)
const splashTop = centerColor(SPLASH_SRC)
console.log('\n뽑아낸 색')
console.log('  아이콘 가장자리:', iconEdge)
console.log('  스플래시 배경  :', splashTop)

rmSync(tmp, { recursive: true, force: true })
console.log('\n완료. android/app/src/main/res 아래에 넣었다.')
