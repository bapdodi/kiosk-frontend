
const Cart = ({ items, onRemove, onQuantityChange, onCheckout }) => {
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

    const stepBtnStyle = (disabled) => ({
        width: '32px',
        height: '32px',
        borderRadius: '8px',
        border: '1px solid #e2e8f0',
        background: 'white',
        color: '#334155',
        fontSize: '1.1rem',
        fontWeight: 'bold',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        lineHeight: 1
    });

    return (
        <section className="kiosk-cart">
            <div className="cart-header">장바구니 ({totalCount})</div>
            <div className="cart-items">
                {items.length === 0 ? (
                    <div className="empty-cart-message">상품을 선택해주세요.</div>
                ) : (
                    groups.map((group) => (
                        <div key={group.id} className="cart-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '10px' }}>
                            <div className="cart-item-name">{group.name}</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingLeft: '10px', borderLeft: '2px solid #f1f5f9' }}>
                                {group.items.map((item) => {
                                    const quantity = item.quantity || 1;
                                    return (
                                        <div key={item.cartId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                                            <div style={{ minWidth: 0 }}>
                                                {item.selectedOption
                                                    ? <div className="cart-item-opt">{item.selectedOption}</div>
                                                    : <div className="cart-item-opt" style={{ color: '#94a3b8' }}>기본</div>}
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                                                    <button
                                                        onClick={() => onQuantityChange(item.cartId, -1)}
                                                        disabled={quantity <= 1}
                                                        style={stepBtnStyle(quantity <= 1)}
                                                        aria-label="수량 줄이기"
                                                    >
                                                        −
                                                    </button>
                                                    <span style={{ minWidth: '24px', textAlign: 'center', fontWeight: 'bold' }}>{quantity}</span>
                                                    <button
                                                        onClick={() => onQuantityChange(item.cartId, 1)}
                                                        style={stepBtnStyle(false)}
                                                        aria-label="수량 늘리기"
                                                    >
                                                        +
                                                    </button>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => onRemove(item.cartId)}
                                                style={{ background: 'none', border: 'none', color: '#ff4444', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}
                                            >
                                                삭제
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))
                )}
            </div>
            <div className="cart-footer">
                <button
                    className="checkout-btn"
                    onClick={onCheckout}
                    disabled={items.length === 0}
                >
                    결제하기
                </button>
            </div>
        </section>
    );
};

export default Cart;
