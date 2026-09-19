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

  // 백엔드 CORS 허용 목록에는 http://localhost:5173 만 들어 있다.
  // 폰·태블릿에서 http://<내부망IP>:5173 으로 붙으면 브라우저가 그 IP 오리진을 붙여 보내
  // 로그인이 403 으로 막히고 화면에는 "로그인 정보가 올바르지 않습니다" 로 보인다.
  // dev 프록시에서만 Origin 을 localhost:5173 으로 바꿔 보낸다(운영 빌드와 무관).
  const forceLocalhostOrigin = {
    configure: (proxy) => {
      proxy.on('proxyReq', (proxyReq) => {
        if (proxyReq.getHeader('origin')) {
          proxyReq.setHeader('origin', 'http://localhost:5173')
        }
      })
    }
  }

  return {
    plugins: [react()],
    server: {
      // 내부망의 다른 기기(태블릿/키오스크)에서 붙을 수 있게 모든 인터페이스에 바인딩한다.
      // 포트는 백엔드 CORS 허용 목록과 맞춰 5173 으로 고정.
      host: true,
      port: 5173,
      strictPort: true,
      proxy: {
        '/api': {
          target,
          changeOrigin: true,
          ...forceLocalhostOrigin,
        },
        '/uploads': {
          target,
          changeOrigin: true,
          ...forceLocalhostOrigin,
        }
      }
    }
  }
})
