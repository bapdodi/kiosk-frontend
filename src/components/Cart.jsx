
const Cart = ({ items, onRemove, onCheckout }) => {
    const totalPrice = items.reduce((sum, item) => sum + item.finalPrice, 0);

    return (
        <section className="kiosk-cart">
            <div className="cart-header">장바구니 ({items.length})</div>
            <div className="cart-items">
                {items.length === 0 ? (
                    <div className="empty-cart-message">상품을 선택해주세요.</div>
                ) : (
                    items.map((item) => (
                        <div key={item.cartId} className="cart-item">
                            <div>
                                <div className="cart-item-name">{item.name}</div>
                                {item.selectedOption && <div className="cart-item-opt">{item.selectedOption}</div>}
                                <div className="cart-item-price">₩{item.finalPrice.toLocaleString()}</div>
                            </div>
                            <button
                                onClick={() => onRemove(item.cartId)}
                                style={{ background: 'none', border: 'none', color: '#ff4444', fontWeight: 'bold' }}
                            >
                                삭제
                            </button>
                        </div>
                    ))
                )}
            </div>
            <div className="cart-footer">
                <div className="total-row">
                    <span>합계</span>
                    <span>₩{totalPrice.toLocaleString()}</span>
                </div>
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
