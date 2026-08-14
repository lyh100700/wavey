# 🌊 Wavey (웨이비)

> 소리의 파도를 따라 즐기는 나만의 미디어 플레이어

로컬에 있는 음악과 영상을 파스텔 물결 위에 띄워 재생하는 미디어 플레이어입니다.
웹으로도 돌아가고, 안드로이드 APK로도 설치할 수 있습니다.

## 브랜드

| 역할 | 색 | 값 |
| --- | --- | --- |
| Primary | 소다 블루 | `#70D6FF` |
| Secondary | 파스텔 민트 | `#A0E7E5` |
| Accent | 코랄 핑크 | `#FF85A1` |
| Background | 크림 아이스 | `#F4F9FC` |

전체적으로 둥근 모서리(`rounded-3xl`), 부드러운 파스텔 그림자, 유리질감(Glassmorphism)으로 맞췄습니다.

## 기능

**음악 모드**
- 재생 중이면 앨범 아트 주변으로 물결이 잔잔하게 번져 나갑니다.
- 앨범 아트는 LP 대신 *물이 차오르는 유리병* — 재생이 진행될수록 물결이 위로 차오릅니다.
- 재생 바의 조작점은 물방울 모양이고, 지나온 구간에는 파도가 흐릅니다.

**비디오 모드**
- `rounded-3xl`로 감싼 뷰어.
- 마우스를 올리면 파스텔 컨트롤 바가 물방울처럼 스르륵 올라오고, 잠시 두면 다시 가라앉습니다.
- 전체 화면 지원.

**플레이리스트**
- 추가 · 삭제 · 검색.
- 재생 중인 곡 옆에는 둠칫거리는 미니 파도 음파.
- 비어 있을 때: *"파도가 조용해요! 미디어 파일을 끌어다 놓아주세요 🌊"*

**파일 넣기**
- 화면 아무 곳에나 드래그 앤 드롭 (웹).
- 파일 고르기 버튼 (웹 · 안드로이드 공통).
- 지원 형식: `mp3` `wav` `m4a` `aac` `flac` `ogg` `opus` `mp4` `webm` `mov` `m4v` `mkv`

**단축키**

| 키 | 동작 |
| --- | --- |
| `Space` 또는 `K` | 재생 / 일시정지 |
| `←` `→` | 5초 이동 (`Shift` 함께 누르면 30초) |
| `Shift` + `←` `→` | 이전 / 다음 곡 |
| `M` | 음소거 |

## 기술 스택

React 19 · Vite 8 · Tailwind CSS 4 · Framer Motion 13 · lucide-react · Capacitor 8

## 개발

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # dist/ 에 빌드
```

## APK 받기

`main` 브랜치에 푸시하면 GitHub Actions가 자동으로 APK를 빌드합니다.

1. 저장소의 **Releases** → **Wavey 최신 빌드** 로 들어갑니다.
2. `wavey.apk` 를 폰으로 내려받습니다.
3. 설치할 때 *"출처를 알 수 없는 앱"* 허용이 필요합니다.
   (서명되지 않은 디버그 빌드라서 그렇습니다.)

**Actions 탭**에서 `Wavey APK 빌드` 워크플로를 손으로 실행할 수도 있습니다.

## 직접 APK 빌드하기

Android Studio(JDK 21 포함)가 설치되어 있다면:

```bash
npm run build
npx cap sync android
cd android && ./gradlew assembleDebug
# → android/app/build/outputs/apk/debug/app-debug.apk
```
