/**
 * 앱 안에서 무슨 일이 있었는지 적어 두는 공책.
 *
 * 무언가 "반응이 없다"고 할 때, 알림(토스트)은 2.6초 뒤 사라져서 놓치기 쉽고
 * 옮겨 적기도 어렵다. 그래서 걸음마다 여기에 적어 두고, 문제 확인 창에서
 * 통째로 볼 수 있게 한다. 화면에 남아 있으면 읽어 주기만 하면 된다.
 *
 * 앱을 껐다 켜면 사라진다. 지금 벌어진 일을 보는 용도다.
 */

const MAX_LINES = 80
const lines = []
let start = 0

/** 한 줄 적는다. 앱을 켠 뒤 몇 초에 있었던 일인지 함께 남긴다. */
export function note(text) {
  if (start === 0) start = Date.now()
  const at = ((Date.now() - start) / 1000).toFixed(1)
  lines.push(`${at}s ${text}`)
  if (lines.length > MAX_LINES) lines.shift()
}

/** 지금까지 적힌 것을 모두 준다. */
export function readNotes() {
  return [...lines]
}

export function clearNotes() {
  lines.length = 0
  start = 0
}
