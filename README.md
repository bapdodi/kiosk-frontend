# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

### 손님용 AI 음성 주문

백엔드의 `/api/order-voice/status`가 `available: true`이면 대기 화면과 모바일 첫 화면,
기존 장바구니·상호 선택·주문 확인 화면의 **AI 통화** 버튼에서 바로 통화를 시작한다.
다시 누르면 종료한다. 별도 대화창 없이 AI가 기존 상호 선택·검색 목록·상품 상세의
규격/수량·장바구니·주문 확인 화면을 조작한다. 직접 터치도 계속 사용할 수 있다.

AI가 주문 내역을 읽고 접수 여부를 물은 뒤, 손님의 새로운 명확한 확답을 받으면
`confirm_order`가 기존 주문 API를 호출한다. 확인 ID는 2분간 유효하며, 상호/상품/규격/수량이
바뀌거나 불명확한 응답·부분 인식이면 접수를 막고 다시 확인한다. 실제 서버 성공 후에만
완료 화면과 주문번호를 안내하고 통화를 종료한다. 기존 **이대로 주문하기** 버튼도 사용할 수 있다.
오류 후 재시도는 같은 요청 키/내용을 사용해 중복 접수를 막는다.
HTTPS 또는 localhost와 마이크 권한이 필요하다. 장기 키는 서버에만 설정한다.
백엔드 설정은 `backend/README.md`의 손님용 AI 음성 주문 항목을 참고한다.

검증: `node --test src/utils/*.test.js`, `npx eslint src/components/VoiceOrder.jsx src/utils/voiceOrder.js src/utils/liveOrderSession.js`.
브라우저 검증: 빌드 후 `node scripts/voice-order-e2e.cjs`.
Chrome 경로는 `CHROME_PATH`로 지정할 수 있다. 가짜 마이크와 모의 API/Live 응답으로
연속 담기·중복 도구 호출·규격 검증·수량 변경·새로운 음성 확답 검사·오류 재시도·중복 접수 방지·완료 안내와 마이크 해제를 검사한다.


통화 중에는 버튼 아래에서 실제 마이크 입력량과 인식된 말을 확인할 수 있다. 입력이 없거나
중단되면 안내가 표시된다. 마이크 목록에서 장치를 선택하거나 **입력 다시 연결**을 누를 수
있으며 선택한 장치는 이 브라우저에 기억한다. 말이 끝났는데 응답이 없으면 **말 끝내기**로
음성 입력 종료를 명시한다. 모바일 상단에서는 **마이크 확인**을 펼친다.

실제 음성 입력 검증: `node scripts/voice-input-live-smoke.cjs`.
기본 대상은 운영 사이트이며 `KIOSK_TEST_URL`로 변경할 수 있다. 합성 한국어 테스트 음성을
마이크 스트림 → AudioWorklet → 실제 Live API로 보내고, 비회원 인식·음성 응답·마이크 재연결을
검사한다. 실 주문 요청은 차단한다. 테스트 음성은 `scripts/fixtures/voice-order-input.mp3`이며
실제 고객의 녹음이 아니다.
