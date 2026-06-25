import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // 기본 백엔드 포트는 8080. 로컬에서 다른 포트로 띄우면 .env 의 VITE_BACKEND_PORT 로 override.
  const backendPort = env.VITE_BACKEND_PORT || '8080'
  const target = `http://localhost:${backendPort}`

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
