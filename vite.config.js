import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// 어느 빌드가 폰에 깔려 있는지 화면에서 바로 확인하기 위한 표식.
// APK는 자동으로 갱신되지 않기 때문에, 이게 없으면 "새 버전을 설치했는지"를
// 알 방법이 없어 문제를 찾을 때 헤매게 된다.
const buildId = process.env.GITHUB_SHA ? process.env.GITHUB_SHA.slice(0, 7) : 'dev'

export default defineConfig({
  // 상대 경로 — Capacitor 안드로이드 웹뷰에서 에셋을 찾으려면 필요하다.
  base: './',
  define: {
    __BUILD_ID__: JSON.stringify(buildId),
  },
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    port: 5173,
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
})
