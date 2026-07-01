// 큰 화면(키오스크)용 하단 고정 주문내역 바.
// 동일 상품(id)은 하나로 묶고 규격(옵션)별로 하위 줄에 표시한다. (기존 장바구니 모달과 동일)
// 상품은 한 줄씩 세로로 쌓이고, 넘치면 세로 스크롤한다.
// 작은 화면(폰)에서는 CSS(min-width:601px)로 숨겨지고, 기존 floating 버튼 + 모달을 사용한다.
const CartBar = ({ items, onRemove, onQuantityChange, onCheckout }) => {
    const totalCount = items.reduce((sum, item) => sum + (item.quantity || 1), 0);

    // 같은 상품(id)끼리 묶어서 하나의 헤더 아래 옵션별 서브항목으로 표시
    const groups = [];
    const indexByProduct = {};
    items.forEach((item) => {
        const pid = item.id;
        if (indexByProduct[pid] === undefined) {
            indexByProduct[pid] = groups.length;
            groups.push({ id: pid, name: item.name, items: [] });
        }
        groups[indexByProduct[pid]].items.push(item);
    });

    return (
        <section className="kiosk-cart-bar">
            <div className="cart-bar-head">장바구니 ({totalCount})</div>
            <div className="cart-bar-items">
                {items.length === 0 ? (
                    <div className="cart-bar-empty">상품을 선택하면 여기에 표시됩니다.</div>
                ) : (
                    groups.map((group) => (
                        <div key={group.id} className="cart-bar-chip">
                            <div className="cart-bar-chip-name">{group.name}</div>
                            <div className="cart-bar-group-lines">
                                {group.items.map((item) => {
                                    const quantity = item.quantity || 1;
                                    return (
                                        <div key={item.cartId} className="cart-bar-line">
                                            <span className="cart-bar-line-opt">
                                                {item.selectedOption || '기본'}
                                            </span>
                                            <div className="cart-bar-step">
                                                <button
                                                    onClick={() => onQuantityChange(item.cartId, -1)}
                                                    disabled={quantity <= 1}
                                                    aria-label="수량 줄이기"
                                                >
                                                    −
                                                </button>
                                                <span className="cart-bar-qty">{quantity}</span>
                                                <button
                                                    onClick={() => onQuantityChange(item.cartId, 1)}
                                                    aria-label="수량 늘리기"
                                                >
                                                    +
                                                </button>
                                            </div>
                                            <button
                                                className="cart-bar-remove"
                                                onClick={() => onRemove(item.cartId)}
                                                aria-label="삭제"
                                            >
                                                ×
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))
                )}
            </div>

            <div className="cart-bar-summary">
                <div className="cart-bar-total">
                    <span className="cart-bar-total-count">총 {totalCount}개</span>
                </div>
                <button
                    className="cart-bar-checkout"
                    onClick={onCheckout}
                    disabled={items.length === 0}
                >
                    결제하기
                </button>
            </div>
        </section>
    );
};

export default CartBar;
