import { getImageUrl } from '../utils/imageUtils';

// 결제하기를 누른 직후, 상호 선택으로 넘어가기 전에 한 번 더 확인시키는 큰 팝업.
// 장바구니(CartBar)와 달리 상품 사진을 크게 보여주기 때문에 담은 물건이 맞는지 눈으로 바로 확인할 수 있다.
// 여기서 수량 변경/삭제까지 가능하게 해서 "다시 장바구니로 돌아가는" 왕복을 없앴다.
const OrderReviewModal = ({ items, onRemove, onQuantityChange, onClose, onConfirm }) => {
    const totalCount = items.reduce((sum, item) => sum + (item.quantity || 1), 0);

    // 같은 상품(id)끼리 묶어서 사진 한 장 아래 옵션별 줄로 표시 (장바구니와 동일한 규칙)
    const groups = [];
    const indexByProduct = {};
    items.forEach((item) => {
        const pid = item.id;
        if (indexByProduct[pid] === undefined) {
            indexByProduct[pid] = groups.length;
            groups.push({ id: pid, name: item.name, images: item.images, items: [] });
        }
        groups[indexByProduct[pid]].items.push(item);
    });

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div
                className="modal-content review-modal"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="review-head">
                    <h3 className="review-title">주문 내역 확인</h3>
                    <p className="review-sub">담으신 상품이 맞는지 확인해주세요. 총 <b>{totalCount}개</b></p>
                    <button className="review-close" onClick={onClose} aria-label="닫기">×</button>
                </div>

                <div className="review-body">
                    {groups.length === 0 ? (
                        <div className="review-empty">장바구니가 비어있습니다.</div>
                    ) : (
                        groups.map((group) => (
                            <div key={group.id} className="review-row">
                                <div className="review-thumb">
                                    {(!group.images || group.images.length === 0) ? (
                                        <div className="review-thumb-empty">이미지 준비 중</div>
                                    ) : (
                                        <img
                                            src={getImageUrl(group.images[0])}
                                            alt={group.name}
                                            onError={(e) => {
                                                e.target.style.display = 'none';
                                                const parent = e.target.parentNode;
                                                const placeholder = document.createElement('div');
                                                placeholder.className = 'review-thumb-empty';
                                                placeholder.innerText = '이미지 준비 중';
                                                parent.appendChild(placeholder);
                                            }}
                                        />
                                    )}
                                </div>

                                <div className="review-detail">
                                    <div className="review-name">{group.name}</div>
                                    <div className="review-lines">
                                        {group.items.map((item) => {
                                            const quantity = item.quantity || 1;
                                            return (
                                                <div key={item.cartId} className="review-line">
                                                    <span className="review-opt">
                                                        {item.selectedOption || '기본'}
                                                    </span>
                                                    <div className="review-step">
                                                        <button
                                                            onClick={() => onQuantityChange(item.cartId, -1)}
                                                            disabled={quantity <= 1}
                                                            aria-label="수량 줄이기"
                                                        >
                                                            −
                                                        </button>
                                                        <span className="review-qty">{quantity}</span>
                                                        <button
                                                            onClick={() => onQuantityChange(item.cartId, 1)}
                                                            aria-label="수량 늘리기"
                                                        >
                                                            +
                                                        </button>
                                                    </div>
                                                    <button
                                                        className="review-remove"
                                                        onClick={() => onRemove(item.cartId)}
                                                        aria-label="삭제"
                                                    >
                                                        삭제
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="review-foot">
                    <button className="review-back" onClick={onClose}>더 담기</button>
                    <button
                        className="review-confirm"
                        onClick={onConfirm}
                        disabled={items.length === 0}
                    >
                        이대로 주문하기
                    </button>
                </div>
            </div>
        </div>
    );
};

export default OrderReviewModal;
