import { useEffect, useRef, useState } from 'react';
import { getImageUrl } from '../utils/imageUtils';
import { countOptionValues, needsOptionChoice } from '../utils/productOptions';

/**
 * 목록의 상품 카드.
 *
 * 단골은 아는 물건을 빠르게 여러 건 집고, 처음 온 손님은 사진·설명을 확인하고 싶어 한다.
 * 그래서 카드 하나가 두 갈래를 모두 연다.
 *   - 사진/이름을 누르면 → 상세 화면 (천천히 보기)
 *   - 규격이 없는 상품은 카드에서 수량만 정해 바로 담기 (클릭 1번)
 *   - 규격을 골라야 하는 상품은 상세로 보낸다. 카드에서 규격까지 고르게 하면
 *     카드가 작은 팝업이 돼 버려서, 지금 없애려는 혼잡이 그대로 돌아온다.
 */
const ProductCard = ({ product, onOpenDetail, onQuickAdd }) => {
    const [qty, setQty] = useState(1);
    // 담은 직후 짧게 표시. 오른쪽 장바구니가 멀리 있어서, 눌린 자리에서 바로 확인이 보여야 한다.
    const [justAdded, setJustAdded] = useState(false);
    const addedTimer = useRef(null);

    useEffect(() => () => clearTimeout(addedTimer.current), []);

    const mustChoose = needsOptionChoice(product);
    const optionCount = countOptionValues(product);
    const price = product.priceC || 0;

    // 카드 안의 담기/수량 조작이 상세 화면 열기로 번지지 않게 막는다.
    const stop = (e) => e.stopPropagation();

    const step = (e, delta) => {
        stop(e);
        setQty(prev => Math.max(1, Math.min(prev + delta, 9999)));
    };

    const quickAdd = (e) => {
        stop(e);
        onQuickAdd(product, qty);
        setQty(1);
        setJustAdded(true);
        clearTimeout(addedTimer.current);
        addedTimer.current = setTimeout(() => setJustAdded(false), 1200);
    };

    return (
        <div className="product-card" onClick={() => onOpenDetail(product)}>
            <div className="product-card-thumb">
                {(!product.images || product.images.length === 0) ? (
                    <div className="no-image-placeholder">이미지 준비 중</div>
                ) : (
                    <img
                        src={getImageUrl(product.images[0])}
                        alt={product.name}
                        className="product-image"
                        loading="lazy"
                        decoding="async"
                        onError={(e) => {
                            e.target.style.display = 'none';
                            const parent = e.target.parentNode;
                            const placeholder = document.createElement('div');
                            placeholder.className = 'no-image-placeholder';
                            placeholder.innerText = '이미지 준비 중';
                            parent.appendChild(placeholder);
                        }}
                    />
                )}
            </div>

            <div className="product-info">
                <h3 className="product-name">{product.name}</h3>
                {price > 0 && (
                    <div className="product-price">
                        {price.toLocaleString()}
                        <span className="product-price-unit">원{mustChoose ? '~' : ''}</span>
                    </div>
                )}
            </div>

            {mustChoose ? (
                <button
                    type="button"
                    className="card-choose-btn"
                    onClick={(e) => { stop(e); onOpenDetail(product); }}
                >
                    규격 {optionCount}종 선택 →
                </button>
            ) : (
                <div className="card-add-row" onClick={stop}>
                    <div className="card-step">
                        <button type="button" onClick={(e) => step(e, -1)} disabled={qty <= 1} aria-label="수량 줄이기">−</button>
                        <span className="card-step-qty">{qty}</span>
                        <button type="button" onClick={(e) => step(e, 1)} aria-label="수량 늘리기">+</button>
                    </div>
                    <button
                        type="button"
                        className={`card-add-btn${justAdded ? ' is-added' : ''}`}
                        onClick={quickAdd}
                    >
                        {justAdded ? '담김 ✓' : '담기'}
                    </button>
                </div>
            )}
        </div>
    );
};

export default ProductCard;
