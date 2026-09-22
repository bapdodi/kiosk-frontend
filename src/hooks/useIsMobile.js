import { useSyncExternalStore } from 'react';

// 폰과 키오스크/PC 를 가르는 기준. 7인치 이하 태블릿과 폰 가로 화면도
// 모바일 주문 화면을 쓴다. CSS 기준과 함께 바꿔야 한다.
export const MOBILE_QUERY = '(max-width: 767.98px)';

const subscribe = (onChange) => {
    const mq = window.matchMedia(MOBILE_QUERY);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
};

const getSnapshot = () => window.matchMedia(MOBILE_QUERY).matches;
// prerender(빌드 시 SSR) 에는 window 가 없다. 키오스크 기준으로 본다.
const getServerSnapshot = () => false;

/**
 * 폰 화면인지 알려준다. 창 크기가 바뀌면 따라 바뀐다.
 *
 * useState + useEffect 대신 useSyncExternalStore 를 쓴다.
 * 첫 렌더부터 올바른 값이 나와서, 키오스크 화면이 한 번 그려졌다가
 * 폰 화면으로 바뀌며 깜빡이는 일이 없다.
 */
export function useIsMobile() {
    return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
