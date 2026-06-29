import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // 기본 백엔드 포트는 8080. 로컬에서 다른 포트로 띄우면 .env 의 VITE_BACKEND_PORT 로 override.
  const backendPort = env.VITE_BACKEND_PORT || '8080'
  // 프록시 대상 백엔드 주소. .env 의 VITE_BACKEND_URL 로 지정하고,
  // 없으면 로컬 기본값(http://localhost:<VITE_BACKEND_PORT>)을 사용한다.
  const target = env.VITE_BACKEND_URL || `http://localhost:${backendPort}`

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': {
          target,
          changeOrigin: true,
        },
        '/uploads': {
          target,
          changeOrigin: true,
        }
      }
    }
  }
})
