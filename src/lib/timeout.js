/**
 * 정해진 시간 안에 끝나지 않는 약속을 포기한다.
 *
 * 안드로이드 기능을 부르는 일 중에는 답이 영영 돌아오지 않을 수 있는 것이 있다.
 * 특히 시스템 설정 화면처럼 앱 밖으로 나갔다 오는 종류가 그렇다. 안드로이드가
 * 그 사이 앱 화면을 다시 만들면 "돌아왔다"는 소식이 갈 곳을 잃기 때문이다.
 *
 * 그런 자리에 이걸 씌워 두면, 최악의 경우에도 앱이 통째로 묶이지 않는다.
 * 화면이 아무 말 없이 멈춰 있는 것보다는 "안 됐다"고 말해 주는 편이 낫다.
 */
export function withTimeout(promise, ms, onTimeout) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      if (typeof onTimeout === 'function') resolve(onTimeout())
      else reject(new Error(onTimeout ?? '시간이 너무 오래 걸려요'))
    }, ms)
    promise.then(resolve, reject).finally(() => clearTimeout(timer))
  })
}
