import { useEffect, useRef, useState } from 'react';
import './IdleWarning.css';

/**
 * 키오스크 자리비움 안내.
 *
 * 한동안 아무도 안 만지면 장바구니를 비우고 처음 화면으로 돌아가는데, 말없이 갑자기 비우면
 * 주문하던 손님은 담아 둔 것을 잃는다. 그래서 돌아가기 전에 이 안내를 띄우고,
 * 남은 시간을 보여 주다가 0 이 되면 처음 화면으로 보낸다. "연장하기"를 누르면 그대로 이어서 주문한다.
 */
export const IDLE_WARNING_SECONDS = 10;

const IdleWarning = ({ onExtend, onTimeout }) => {
    const [left, setLeft] = useState(IDLE_WARNING_SECONDS);

    // 부모가 렌더마다 새 함수를 넘겨도 타이머가 다시 시작되지 않게 ref 로 들고 있는다.
    const onTimeoutRef = useRef(onTimeout);
    useEffect(() => { onTimeoutRef.current = onTimeout; });

    useEffect(() => {
        const countdown = setInterval(() => {
            setLeft(prev => Math.max(0, prev - 1));
        }, 1000);
        const timeout = setTimeout(() => onTimeoutRef.current(), IDLE_WARNING_SECONDS * 1000);
        return () => {
            clearInterval(countdown);
            clearTimeout(timeout);
        };
    }, []);

    return (
        <div className="idle-warning" role="alertdialog" aria-modal="true" aria-labelledby="idle-warning-title">
            <div className="idle-warning-card">
                <h2 id="idle-warning-title" className="idle-warning-title">계속 주문하시겠어요?</h2>
                <p className="idle-warning-text">
                    한동안 화면을 만지지 않으셨어요.<br />
                    <b>{left}초</b> 뒤에 담아 둔 상품이 지워지고 처음 화면으로 돌아갑니다.
                </p>
                <button type="button" className="idle-warning-extend" onClick={onExtend} autoFocus>
                    연장하기
                </button>
            </div>
        </div>
    );
};

export default IdleWarning;
