import { useCallback, useEffect, useRef, useState } from 'react';

// SSE 가 끊겼을 때만 쓰는 예비 폴링 주기. 서버 푸시가 정상이면 굳이 자주 돌 필요가 없다.
const FALLBACK_POLL_MS = 15000;
// SSE 가 살아있을 때의 안전망 폴링 주기. 이벤트 유실이나 다른 관리자의 상태 변경을 따라잡는다.
const IDLE_POLL_MS = 60000;
// 하트비트(15초)가 이 시간 안에 한 번도 안 오면 연결이 죽은 것으로 본다.
const STALE_AFTER_MS = 45000;

/**
 * 관리자 화면 전체에서 새 주문을 감지한다.
 *
 * 알림 경로는 두 겹이다.
 *  1) /api/orders/admin/stream (SSE) — 서버가 밀어주므로 백그라운드 탭에서도 즉시 도착한다.
 *  2) 폴링 — SSE 가 막히는 환경(프록시 버퍼링 등)을 위한 예비 경로.
 *
 * AdminLayout 에서 한 번만 호출한다. 주문 관리 탭이 아니어도 계속 동작해야 하기 때문이다.
 */
const useOrderNotifications = ({ orders, setOrders }) => {
    const [isSoundEnabled, setIsSoundEnabled] = useState(false);
    const [soundError, setSoundError] = useState('');
    const [isStreamConnected, setIsStreamConnected] = useState(false);
    const [newOrderAlert, setNewOrderAlert] = useState(null);
    const [fetchError, setFetchError] = useState('');

    const ordersRef = useRef(orders);
    const orderSoundRef = useRef(null);
    // 목록 길이가 아니라 "첫 조회를 끝냈는지"로 판단한다. 주문이 0건인 상태에서
    // 들어온 첫 주문도 알림이 울려야 한다.
    const hasLoadedOnceRef = useRef(false);
    const streamConnectedRef = useRef(false);
    const lastStreamSignalRef = useRef(0);

    useEffect(() => {
        ordersRef.current = orders;
    }, [orders]);

    useEffect(() => {
        const audio = new Audio('/99F0804A5F72109B0D-3x.mp3');
        audio.preload = 'auto';
        orderSoundRef.current = audio;
        audio.load();

        return () => {
            audio.pause();
            orderSoundRef.current = null;
        };
    }, []);

    const playOrderSound = useCallback(async () => {
        const audio = orderSoundRef.current;
        if (!audio) return false;

        try {
            audio.pause();
            audio.currentTime = 0;
            await audio.play();
            setIsSoundEnabled(true);
            setSoundError('');
            return true;
        } catch (err) {
            setIsSoundEnabled(false);
            setSoundError('브라우저가 소리 재생을 막았습니다. 알림음 켜기를 눌러주세요.');
            console.warn('Order notification sound was blocked by the browser.', err);
            return false;
        }
    }, []);

    const announce = useCallback((count, customerName) => {
        if (count <= 0) return;
        playOrderSound();
        // alert 은 창을 막아 폴링까지 멈추고, 백그라운드 탭에서는 탭을 누를 때까지 뜨지도 않는다.
        // 화면 위 배너로 대신한다.
        setNewOrderAlert({
            count,
            customerName: customerName || '',
            at: Date.now(),
        });
    }, [playOrderSound]);

    const fetchOrders = useCallback(async ({ notify = true } = {}) => {
        try {
            const res = await fetch('/api/orders/admin');
            if (!res.ok) {
                setFetchError(`주문 목록을 불러오지 못했습니다 (HTTP ${res.status})`);
                return;
            }

            const fetchedOrders = await res.json();
            if (!Array.isArray(fetchedOrders)) return;
            setFetchError('');

            const currentOrders = ordersRef.current;
            const knownIds = new Set(currentOrders.map(o => o.id));
            const newOrders = fetchedOrders.filter(fo => !knownIds.has(fo.id));

            if (notify && hasLoadedOnceRef.current && newOrders.length > 0) {
                announce(newOrders.length, newOrders[newOrders.length - 1]?.customerName);
            }

            hasLoadedOnceRef.current = true;

            if (JSON.stringify(currentOrders) !== JSON.stringify(fetchedOrders)) {
                ordersRef.current = fetchedOrders;
                setOrders(fetchedOrders);
            }
        } catch (err) {
            setFetchError('주문 목록 조회에 실패했습니다. 네트워크를 확인해 주세요.');
            console.error('Failed to fetch orders', err);
        }
    }, [announce, setOrders]);

    // 1) SSE 구독
    useEffect(() => {
        let source = null;
        let retryTimer = null;
        let closed = false;

        const markSignal = () => {
            lastStreamSignalRef.current = Date.now();
        };

        const connect = () => {
            if (closed) return;
            source = new EventSource('/api/orders/admin/stream');

            source.addEventListener('connected', () => {
                markSignal();
                streamConnectedRef.current = true;
                setIsStreamConnected(true);
                // 연결이 끊겼던 동안 들어온 주문을 따라잡는다.
                fetchOrders();
            });

            source.addEventListener('ping', markSignal);

            source.addEventListener('order-created', (event) => {
                markSignal();
                let customerName = '';
                try {
                    customerName = JSON.parse(event.data)?.customerName || '';
                } catch {
                    // 파싱에 실패해도 알림 자체는 띄운다.
                }
                announce(1, customerName);
                // 목록 자체는 서버 기준으로 다시 맞춘다.
                fetchOrders({ notify: false });
            });

            source.onerror = () => {
                streamConnectedRef.current = false;
                setIsStreamConnected(false);
                source.close();
                // EventSource 자체 재연결에만 맡기지 않는다. 프록시가 즉시 끊는 환경에서
                // 재연결 폭주를 막기 위해 직접 간격을 둔다.
                if (!closed) retryTimer = window.setTimeout(connect, 5000);
            };
        };

        connect();

        return () => {
            closed = true;
            streamConnectedRef.current = false;
            if (retryTimer) window.clearTimeout(retryTimer);
            if (source) source.close();
        };
    }, [announce, fetchOrders]);

    // 2) 폴링 — SSE 가 살아있으면 느리게, 죽었으면 촘촘하게
    useEffect(() => {
        let isFetching = false;
        let timer = null;

        const isStreamHealthy = () => streamConnectedRef.current
            && Date.now() - lastStreamSignalRef.current < STALE_AFTER_MS;

        const tick = async () => {
            if (!isFetching) {
                isFetching = true;
                try {
                    await fetchOrders();
                } finally {
                    isFetching = false;
                }
            }
            timer = window.setTimeout(tick, isStreamHealthy() ? IDLE_POLL_MS : FALLBACK_POLL_MS);
        };

        fetchOrders({ notify: false });
        timer = window.setTimeout(tick, FALLBACK_POLL_MS);

        return () => {
            if (timer) window.clearTimeout(timer);
        };
    }, [fetchOrders]);

    // 3) 탭이 다시 보이는 순간 즉시 따라잡기 — 백그라운드에서 타이머가 늦춰졌을 수 있다.
    useEffect(() => {
        const onVisible = () => {
            if (document.visibilityState === 'visible') fetchOrders();
        };
        document.addEventListener('visibilitychange', onVisible);
        window.addEventListener('focus', onVisible);
        return () => {
            document.removeEventListener('visibilitychange', onVisible);
            window.removeEventListener('focus', onVisible);
        };
    }, [fetchOrders]);

    const dismissAlert = useCallback(() => setNewOrderAlert(null), []);

    return {
        isSoundEnabled,
        soundError,
        playOrderSound,
        isStreamConnected,
        newOrderAlert,
        dismissAlert,
        fetchError,
        refreshOrders: fetchOrders,
    };
};

export default useOrderNotifications;
