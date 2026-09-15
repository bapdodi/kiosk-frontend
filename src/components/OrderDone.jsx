import { useEffect, useRef, useState } from 'react';
import CheckoutShell from './CheckoutShell';

/**
 * 주문 마무리 3단계: 완료.
 *
 * 예전에는 브라우저 기본 alert() 한 줄로 끝나고 바로 목록으로 튕겼다.
 * 키오스크에서 OS 대화상자는 터치 타깃이 작고 화면과 따로 놀며,
 * 무엇보다 "내가 넣은 게 맞나" 를 확인할 방법이 남지 않았다.
 * 주문번호와 넣은 내역을 남겨서 기사님이 눈으로 확인하고 나가게 한다.
 *
 * 키오스크는 다음 손님이 바로 쓰는 화면이라, 아무도 안 누르면 10초 뒤 목록으로 돌아간다.
 * 남은 시간을 버튼에 같이 보여줘서 갑자기 화면이 바뀐 것처럼 느껴지지 않게 한다.
 */
const AUTO_HOME_SECONDS = 10;

const OrderDone = ({ variant, order, customerName, items, onHome }) => {
    const totalCount = items.reduce((sum, item) => sum + (item.quantity || 1), 0);
    const [left, setLeft] = useState(AUTO_HOME_SECONDS);

    // onHome 은 렌더마다 새로 만들어지는 함수라, 그대로 의존성에 넣으면 타이머가 매번 다시 시작된다.
    const onHomeRef = useRef(onHome);
    useEffect(() => { onHomeRef.current = onHome; });

    useEffect(() => {
        const timer = setInterval(() => {
            setLeft(prev => {
                if (prev <= 1) {
                    clearInterval(timer);
                    onHomeRef.current();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    return (
        <CheckoutShell variant={variant}>
            <div className="order-done-head">
                <div className="order-done-check" aria-hidden="true">✓</div>
                <h3 className="order-done-title">주문이 들어갔습니다</h3>
                <p className="order-done-sub">
                    <b>{customerName}</b>님, 총 <b>{totalCount}개</b>를 주문했습니다.
                </p>
                {order?.id != null && (
                    <div className="order-done-no">주문번호 <b>{order.id}</b></div>
                )}
            </div>

            <div className="order-done-body">
                {items.map((item) => (
                    <div key={item.cartId} className="order-done-line">
                        <span className="order-done-name">
                            {item.name}
                            {item.selectedOption ? <em> · {item.selectedOption}</em> : null}
                        </span>
                        <span className="order-done-qty">{item.quantity || 1}개</span>
                    </div>
                ))}
            </div>

            <div className="order-done-foot">
                <button className="order-done-home" onClick={onHome}>
                    처음으로 <span className="order-done-count">{left}</span>
                </button>
                <p className="order-done-auto">{left}초 뒤 처음 화면으로 돌아갑니다.</p>
            </div>
        </CheckoutShell>
    );
};

export default OrderDone;
