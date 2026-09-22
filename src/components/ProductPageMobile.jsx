import { useEffect, useRef } from 'react';
import { getImageUrl } from '../utils/imageUtils';
import { useProductSelection } from '../hooks/useProductSelection';
import './ProductPageMobile.css';

const FALLBACK_IMAGE = '/no-image.png';

const formatQuantity = (n) => (n || 0).toLocaleString('ko-KR');

/**
 * 폰 전용 상품 화면.
 *
 * 팝업이 아니라 한 장의 페이지다. 뒤로가기로 닫히고(App 의 useMobileBackClose),
 * 하단에 주문 바가 고정된다. 키오스크용 OptionModal 과 화면은 완전히 별개고,
 * 규격·수량·가격 규칙만 useProductSelection 으로 공유한다.
 */
const ProductPageMobile = ({ product, cartItems = [], products = [], onConfirm, onCancel, onSelectProduct, onOpenCart }) => {
    const {
        groups,
        selections, setSelections,
        allOptionsSelected,
        showProductPrompt,
        quantity, setQuantity, safeQuantity,
        handleBulkStep, startPress, stopPress,
        images, currentImageIndex, setCurrentImageIndex, hasMultipleImages,
        failedImages, setFailedImages,
        handleImageTouchStart, handleImageTouchEnd,
        recommendedProducts,
        addedLines, addedTotalQuantity,
        optionSectionRef, handleConfirm,
    } = useProductSelection(product, { cartItems, products, onConfirm });

    const quantityRef = useRef(null);
    // 규격을 다 고른 "순간"에만 수량으로 내려준다. 매 렌더마다 움직이면 손가락을 방해한다.
    const wasComplete = useRef(false);

    useEffect(() => {
        const justCompleted = allOptionsSelected && !wasComplete.current;
        wasComplete.current = allOptionsSelected;
        if (!justCompleted || groups.length === 0) return;

        const el = quantityRef.current;
        if (!el) return;
        // 선택 표시가 다시 그려진 뒤에 움직여야 최종 위치로 정확히 간다.
        const id = requestAnimationFrame(() => {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
        return () => cancelAnimationFrame(id);
    }, [allOptionsSelected, groups.length]);

    if (!product) return null;

    const currentImage = images[currentImageIndex];
    const imageSrc = (!currentImage || failedImages[currentImage])
        ? FALLBACK_IMAGE
        : getImageUrl(currentImage);
    const cartQuantity = cartItems.reduce((sum, item) => sum + (item.quantity || 1), 0);

    return (
        <div className="mp-page" role="dialog" aria-modal="true" aria-labelledby="mp-title">
            <header className="mp-appbar">
                <button type="button" className="mp-back" onClick={onCancel} aria-label="뒤로 가기">←</button>
                <span className="mp-appbar-title">{product.name}</span>
                <button
                    type="button"
                    className="mp-cart"
                    onClick={onOpenCart}
                    aria-label={`장바구니 열기, 총 ${cartQuantity}개`}
                >
                    <span aria-hidden="true">🛒</span>
                    <span className="mp-cart-count">{cartQuantity}</span>
                </button>
            </header>

            <div className="mp-scroll">
                <div
                    className="mp-image"
                    onTouchStart={hasMultipleImages ? handleImageTouchStart : undefined}
                    onTouchEnd={hasMultipleImages ? handleImageTouchEnd : undefined}
                >
                    <img
                        src={imageSrc}
                        alt={product.name}
                        onError={() => currentImage && setFailedImages(prev => ({ ...prev, [currentImage]: true }))}
                    />
                    {hasMultipleImages && (
                        <div className="mp-dots">
                            {images.map((_, i) => (
                                <button
                                    key={i}
                                    type="button"
                                    className={i === currentImageIndex ? 'is-on' : ''}
                                    onClick={() => setCurrentImageIndex(i)}
                                    aria-label={`${i + 1}번째 사진`}
                                />
                            ))}
                        </div>
                    )}
                </div>

                <div className="mp-summary">
                    <h1 id="mp-title" className="mp-name">{product.name}</h1>
                    {product.gyu && <div className="mp-gyu">규격 {product.gyu}</div>}
                </div>

                {product.description && (
                    <section className="mp-block">
                        <h2 className="mp-block-title">상품 설명</h2>
                        <p className="mp-desc">{product.description}</p>
                    </section>
                )}

                <section className="mp-block" ref={optionSectionRef}>
                    {groups.length > 0 ? groups.map(group => {
                        const chosen = selections[group.name];
                        const missing = showProductPrompt && chosen == null;
                        return (
                            <div
                                key={group.name}
                                className={`mp-group${missing ? ' is-missing' : ''}`}
                                data-option-missing={chosen == null ? 'true' : undefined}
                            >
                                <h2 className="mp-block-title">
                                    {group.displayLabel}
                                    <span className={`mp-badge${chosen ? ' is-done' : ''}`}>
                                        {chosen ? '선택 완료' : '선택 필수'}
                                    </span>
                                </h2>
                                <div className="mp-options">
                                    {group.values.map(value => (
                                        <button
                                            key={value}
                                            type="button"
                                            className="mp-option"
                                            aria-pressed={chosen === value}
                                            onClick={() => setSelections(prev => ({ ...prev, [group.name]: value }))}
                                        >
                                            <span className="mp-check" aria-hidden="true">{chosen === value ? '✓' : ''}</span>
                                            {value}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        );
                    }) : (
                        <p className="mp-desc">
                            {product.gyu ? `규격 ${product.gyu} · 이 규격으로 담습니다.` : '선택할 규격이 없어 기본 제품으로 담습니다.'}
                        </p>
                    )}

                    <div className="mp-qty" ref={quantityRef}>
                        <h2 className="mp-block-title">수량</h2>
                        <div className="mp-stepper">
                            <button type="button" onClick={() => handleBulkStep(-10)} aria-label="10개 줄이기">−10</button>
                            <button
                                type="button"
                                onPointerDown={() => startPress(-1)}
                                onPointerUp={stopPress}
                                onPointerLeave={stopPress}
                                aria-label="1개 줄이기"
                            >−</button>
                            <input
                                className="mp-qty-num"
                                type="number"
                                inputMode="numeric"
                                value={quantity}
                                aria-label="수량"
                                onChange={(e) => {
                                    const raw = e.target.value;
                                    if (raw === '') return setQuantity('');
                                    const n = parseInt(raw, 10);
                                    if (!Number.isNaN(n)) setQuantity(Math.max(1, Math.min(n, 9999)));
                                }}
                                onBlur={() => { if (!safeQuantity || safeQuantity < 1) setQuantity(1); }}
                            />
                            <span className="mp-unit">개</span>
                            <button
                                type="button"
                                onPointerDown={() => startPress(1)}
                                onPointerUp={stopPress}
                                onPointerLeave={stopPress}
                                aria-label="1개 늘리기"
                            >+</button>
                            <button type="button" onClick={() => handleBulkStep(10)} aria-label="10개 늘리기">+10</button>
                            <button type="button" onClick={() => handleBulkStep(50)} aria-label="50개 늘리기">+50</button>
                        </div>
                    </div>
                </section>

                {addedLines.length > 0 && (
                    <section className="mp-added">
                        <div className="mp-added-head">
                            <span>장바구니에 담긴 이 상품 {addedLines.length}종</span>
                            <strong>{addedTotalQuantity}개</strong>
                        </div>
                        <ul>
                            {addedLines.map((line, i) => (
                                <li key={line.lineId || i}>
                                    <span>{line.selectedOption || line.name}</span>
                                    <strong>{line.quantity || 1}개</strong>
                                </li>
                            ))}
                        </ul>
                    </section>
                )}

                {recommendedProducts.length > 0 && (
                    <section className="mp-block mp-reco">
                        <h2 className="mp-block-title">연관 있는 상품</h2>
                        <div className="mp-reco-list">
                            {recommendedProducts.map(item => (
                                <button
                                    key={item.id}
                                    type="button"
                                    className="mp-reco-card"
                                    onClick={() => onSelectProduct && onSelectProduct(item)}
                                >
                                    <span className="mp-reco-thumb">
                                        {item.images && item.images.length > 0
                                            ? <img src={getImageUrl(item.images[0])} alt={item.name} />
                                            : <span className="mp-reco-empty">이미지 준비 중</span>}
                                    </span>
                                    <span className="mp-reco-name">{item.name}</span>
                                </button>
                            ))}
                        </div>
                    </section>
                )}
            </div>

            {/* 주문 바는 화면 맨 아래에 고정한다. 주소창이 오르내려도 가려지지 않도록
                페이지 전체 높이를 100dvh 로 잡고 그 안에서 배치한다. */}
            <footer className="mp-bar">
                <div className="mp-bar-total">
                    <span>수량</span>
                    <strong>{formatQuantity(safeQuantity || 1)}개</strong>
                </div>
                <button type="button" className="mp-order" onClick={() => handleConfirm(true)}>
                    {allOptionsSelected ? '장바구니 담기' : '규격 선택'}
                </button>
            </footer>
        </div>
    );
};

export default ProductPageMobile;
