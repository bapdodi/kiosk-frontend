/**
 * prerender.mjs
 * 빌드 후 실행되는 커스텀 prerender 스크립트
 * - Puppeteer 최신 버전으로 React 앱을 렌더링
 * - 렌더링된 HTML을 dist/index.html에 덮어씀
 * - 네이버/구글 봇이 JS 없이도 내용을 읽을 수 있게 됨
 */

import puppeteer from 'puppeteer'
import { createServer } from 'node:http'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const distDir = join(__dirname, '..', 'dist')

// MIME 타입 맵
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.ico':  'image/x-icon',
  '.json': 'application/json; charset=utf-8',
  '.txt':  'text/plain; charset=utf-8',
  '.xml':  'application/xml; charset=utf-8',
}

// 간단한 정적 파일 서버
function startServer(port = 5050) {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      // URL에서 쿼리스트링 제거
      const urlPath = req.url.split('?')[0]
      let filePath = join(distDir, urlPath === '/' ? 'index.html' : urlPath)

      // API 요청: 빈 응답 반환
      if (urlPath.startsWith('/api/') || urlPath.startsWith('/uploads/')) {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end('[]')
        return
      }

      // SPA fallback: 파일이 없거나 확장자가 없으면 index.html 반환
      if (!existsSync(filePath) || !extname(filePath)) {
        filePath = join(distDir, 'index.html')
      }

      try {
        const content = readFileSync(filePath)
        const ext = extname(filePath)
        res.writeHead(200, { 'Content-Type': MIME[ext] || 'text/plain; charset=utf-8' })
        res.end(content)
      } catch {
        res.writeHead(404)
        res.end('Not found')
      }
    })

    server.listen(port, () => {
      console.log(`✅ 정적 서버 시작: http://localhost:${port}`)
      resolve({ server, port })
    })
  })
}

async function prerender() {
  if (process.env.VERCEL) {
    console.log('⚡ Vercel 빌드 환경 감지: 프리렌더링을 스킵합니다.');
    return;
  }
  
  console.log('\n🚀 prerender 시작...\n')

  const { server, port } = await startServer()

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })

  const page = await browser.newPage()

  // 한글 등 인코딩 설정
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'ko-KR,ko;q=0.9' })

  const targetUrl = `http://localhost:${port}`
  console.log(`📸 렌더링 중: ${targetUrl}`)

  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })

  // React가 렌더링될 때까지 대기 (로딩 상태 탈출 확인)
  console.log('⏳ React 렌더링 대기 중...')
  try {
    await page.waitForFunction(
      () => {
        const root = document.getElementById('root')
        if (!root) return false
        const text = root.textContent || ''
        // 로딩 중 상태가 아니고, 실제 내용이 있으면 완료
        return !text.includes('로딩 중') && root.children.length > 0 && root.innerHTML.length > 200
      },
      { timeout: 15000, polling: 500 }
    )
    console.log('✅ React 렌더링 완료 감지')
  } catch {
    console.log('⚠️ 렌더링 타임아웃 - 현재 상태로 스냅샷 진행')
  }

  // 추가 대기 (스타일 등 안정화)
  await new Promise(r => setTimeout(r, 1000))

  const html = await page.content()

  // dist/index.html 덮어쓰기 (UTF-8 명시)
  const outPath = join(distDir, 'index.html')
  writeFileSync(outPath, html, 'utf-8')

  const sizeKB = (Buffer.byteLength(html, 'utf-8') / 1024).toFixed(1)
  console.log(`✅ prerender 완료: ${outPath}`)
  console.log(`   HTML 크기: ${sizeKB} KB`)

  // 렌더링 결과 미리보기
  const rootContent = await page.evaluate(() => {
    const root = document.getElementById('root')
    return root ? root.textContent.substring(0, 200) : '(root 없음)'
  })
  console.log(`   내용 미리보기: ${rootContent.substring(0, 100)}...`)

  await browser.close()
  server.close()

  if (sizeKB < 5) {
    console.warn('\n⚠️ 경고: HTML이 너무 작습니다. React 렌더링이 제대로 안 됐을 수 있습니다.')
  } else {
    console.log('\n🎉 prerender 성공! 네이버/구글 봇이 내용을 읽을 수 있습니다.\n')
  }
}

prerender().catch((err) => {
  console.error('❌ prerender 실패:', err)
  process.exit(1)
})
