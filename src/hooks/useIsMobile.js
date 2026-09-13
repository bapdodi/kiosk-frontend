import { useSyncExternalStore } from 'react';

// 폰과 키오스크/PC 를 가르는 기준. CSS 의 @media (max-width: 600px) 와 같은 값이라
// 한쪽만 바꾸면 화면과 컴포넌트 선택이 어긋난다. 바꿀 때는 양쪽을 같이 본다.
export const MOBILE_QUERY = '(max-width: 600px)';

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
