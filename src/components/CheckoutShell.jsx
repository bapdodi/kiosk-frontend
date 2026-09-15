/**
 * 주문 마무리 단계(내역 확인 → 상호 선택 → 완료)의 공용 껍데기.
 *
 * 키오스크·PC 는 목록 자리를 차지하는 화면(screen)으로, 폰은 기존처럼 팝업(modal)으로 띄운다.
 * 안쪽 내용은 두 경우가 완전히 같아서, 달라지는 껍데기만 여기서 가른다.
 * (폰 화면은 이번 개편 범위 밖이라 기존 동작을 그대로 둔다.)
 */
const CheckoutShell = ({ variant, children, maxWidth = 600 }) => {
    if (variant === 'modal') {
        return (
            <div className="modal-overlay">
                <div className="modal-content" style={{ maxWidth: `${maxWidth}px`, width: '90%' }}>
                    {children}
                </div>
            </div>
        );
    }

    // 화면 변형의 폭은 CSS(.checkout-card)가 정한다. 팝업보다 넓게 쓸 수 있다.
    return (
        <section className="checkout-view">
            <div className="checkout-card">{children}</div>
        </section>
    );
};

export default CheckoutShell;
