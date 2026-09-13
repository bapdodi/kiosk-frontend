import { useEffect, useRef } from 'react';

/**
 * 폰에서 화면을 덮는 것들(상품 페이지·장바구니·주문확인·상호 입력)을
 * 뒤로가기로 한 단계씩 닫히게 한다.
 *
 * 폰 사용자는 전체 화면을 덮는 것이 나오면 뒤로가기로 닫으려 한다.
 * 아무것도 해두지 않으면 뒤로가기가 사이트를 통째로 떠나 장바구니가 날아간다.
 *
 * 키오스크·데스크톱에는 걸지 않는다. 뒤로가기 제스처가 없고,
 * 키오스크에서 히스토리를 건드리면 화면이 튄다.
 *
 * ── 왜 "열린 개수(깊이)" 로 다루는가
 * 화면별로 각각 pushState / back() 을 걸면, 장바구니를 닫으면서 주문확인을 여는
 * 것처럼 한 번에 하나가 닫히고 하나가 열릴 때 back() 과 pushState 가 같은 tick 에
 * 겹쳐 서로를 덮어쓴다(주문확인 항목이 곧바로 pop 돼 사라진다).
 * 그래서 개별로 다루지 않고, "지금 몇 겹 열려 있는가" 만 히스토리 깊이와 맞춘다.
 * 장바구니→주문확인 같은 교체는 깊이가 1 그대로라 히스토리를 아예 건드리지 않는다.
 *
 * @param {Array<{open: boolean, close: () => void}>} layers
 *        쌓이는 순서대로. 뒤로가기는 그중 가장 나중에 열린 것을 닫는다.
 */
export function useMobileBackClose(layers) {
    // 우리가 쌓아 둔 히스토리 항목 수
    const pushedDepth = useRef(0);
    // 우리가 직접 부른 back() 때문에 생기는 popstate 는 무시해야 한다
    // (이미 닫힌 화면을 또 닫으면 한 번에 두 겹이 닫힌다).
    const ignorePops = useRef(0);
    const layersRef = useRef(layers);

    useEffect(() => {
        layersRef.current = layers;
    });

    const isPhone = () => window.matchMedia('(max-width: 600px)').matches;
    const depth = layers.filter(l => l.open).length;

    useEffect(() => {
        if (!isPhone()) return;

        if (depth > pushedDepth.current) {
            for (let i = pushedDepth.current; i < depth; i += 1) {
                window.history.pushState({ kioskOverlay: true }, '');
            }
            pushedDepth.current = depth;
        } else if (depth < pushedDepth.current) {
            // 화면 안 버튼으로 닫힌 경우. 쌓아 둔 항목을 걷어내지 않으면
            // 다음 뒤로가기 한 번이 아무 일도 안 하는 것처럼 보인다.
            const diff = pushedDepth.current - depth;
            pushedDepth.current = depth;
            ignorePops.current += diff;
            window.history.go(-diff);
        }
    }, [depth]);

    useEffect(() => {
        if (!isPhone()) return;

        const onPop = () => {
            if (ignorePops.current > 0) {
                ignorePops.current -= 1;
                return;
            }
            if (pushedDepth.current === 0) return;

            pushedDepth.current -= 1;
            // 가장 나중에 열린 것부터 닫는다.
            const open = layersRef.current.filter(l => l.open);
            const top = open[open.length - 1];
            if (top) top.close();
        };

        window.addEventListener('popstate', onPop);
        return () => window.removeEventListener('popstate', onPop);
    }, []);
}
