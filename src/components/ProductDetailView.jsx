import { useState, useEffect } from 'react';
import { getImageUrl } from '../utils/imageUtils';
import './ProductDetailView.css';
import { useProductSelection } from '../hooks/useProductSelection';
import { formatPriceRange, formatWon } from '../utils/price';
import { getOptionPriceRange } from '../utils/productOptions';

const ProductDetailView = ({ product, cartItems = [], products = [], onConfirm, onCancel, onSelectProduct, voiceSelection, voiceImageRequest, onSelectionChange }) => {
    const [isZoomOpen, setIsZoomOpen] = useState(false);

    const {
        groups, selections, toggleOption, showProductPrompt,
        quantity, setQuantity, handleQuantityChange, handleBulkStep, startPress, stopPress,
        images, currentImageIndex, setCurrentImageIndex, hasMultipleImages,
        failedImages, setFailedImages, moveImage, handleImageTouchStart, handleImageTouchEnd,
        recommendedProducts, selectedTotalPrice, priceRange, optionSectionRef, handleConfirm,
    } = useProductSelection(product, { cartItems, products, onConfirm, voiceSelection, voiceImageRequest, onSelectionChange });

    useEffect(() => {
        if (!isZoomOpen) return;
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') setIsZoomOpen(false);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isZoomOpen]);

    if (!product) return null;

    const currentImage = images[currentImageIndex];
    const hasValidImage = Boolean(currentImage && !failedImages[currentImageIndex]);

    return (
        <section className="product-detail-view order-focused-detail" aria-labelledby="option-product-title">
            <div className="option-scroll-body">
                <button type="button" className="option-back-btn" onClick={onCancel}>← 상품 목록</button>
                <div className="option-detail-layout">
                    <div
                        className={`option-image-area${hasValidImage ? ' clickable' : ''}`}
                        onClick={hasValidImage ? () => setIsZoomOpen(true) : undefined}
                        onTouchStart={hasMultipleImages ? handleImageTouchStart : undefined}
                        onTouchEnd={hasMultipleImages ? handleImageTouchEnd : undefined}
                        role={hasValidImage ? 'button' : undefined}
                        tabIndex={hasValidImage ? 0 : undefined}
                        onKeyDown={hasValidImage ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setIsZoomOpen(true); } } : undefined}
                        aria-label={hasValidImage ? `${product.name} 사진 크게 보기` : undefined}
                    >
                        {!hasValidImage ? (
                            <div className="no-image-placeholder">이미지 없음</div>
                        ) : (
                            <>
                                <img
                                    src={getImageUrl(currentImage)}
                                    alt={product.name}
                                    onError={() => setFailedImages(prev => ({ ...prev, [currentImageIndex]: true }))}
                                />
                                <button
                                    type="button"
                                    className="option-image-zoom-trigger"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setIsZoomOpen(true);
                                    }}
                                    aria-label="사진 크게 보기"
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                        <circle cx="11" cy="11" r="8" />
                                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                                        <line x1="11" y1="8" x2="11" y2="14" />
                                        <line x1="8" y1="11" x2="14" y2="11" />
                                    </svg>
                                    <span>크게 보기</span>
                                </button>
                            </>
                        )}
                        {hasMultipleImages && <>
                            <span className="option-image-counter" onClick={e => e.stopPropagation()}>{currentImageIndex + 1} / {images.length}</span>
                            <button type="button" className="option-image-arrow prev" onClick={(e) => { e.stopPropagation(); moveImage(-1); }} aria-label="이전 사진">‹</button>
                            <button type="button" className="option-image-arrow next" onClick={(e) => { e.stopPropagation(); moveImage(1); }} aria-label="다음 사진">›</button>
                            <div className="option-image-dots" onClick={e => e.stopPropagation()}>{images.map((_, i) => (
                                <button type="button" key={i} onClick={() => setCurrentImageIndex(i)}
                                    aria-label={`${i + 1}번째 사진`} aria-pressed={i === currentImageIndex} />
                            ))}</div>
                        </>}
                    </div>
                    <div className="option-product-info">
                        <h2 id="option-product-title" className="option-header-title">{product.name}</h2>
                        {product.gyu && <div className="option-product-spec">{product.gyu}</div>}
                        {priceRange && <div className="option-price" aria-label="가격">{formatPriceRange(priceRange)}</div>}
                    </div>
                </div>
                <div ref={optionSectionRef} className={`option-choice-section${showProductPrompt ? ' needs-product-selection' : ''}`}>
                    {groups.map(group => (
                        <div className="option-group" key={group.name} data-option-missing={(selections[group.name] || []).length === 0}>
                            <h3>{group.displayLabel}</h3>
                            <div className="option-choice-grid">
                                {group.values.map(value => {
                                    const selected = (selections[group.name] || []).includes(value);
                                    const optionPrice = getOptionPriceRange(product, groups, group.name, value, selections);
                                    return (
                                        <button type="button" key={value} className="option-choice-button" aria-pressed={selected}
                                            onClick={() => toggleOption(group.name, value)}>
                                            <span className="option-choice-value">{group.valueLabels?.[value] ?? value}</span>
                                            <span className="option-choice-meta">
                                                {optionPrice && <span className="option-choice-price">{formatPriceRange(optionPrice)}</span>}
                                                {selected && <span className="option-choice-check" aria-hidden="true">✓</span>}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                    <div className="option-quantity-block">
                        <label className="option-quantity-label" htmlFor="option-quantity">수량</label>
                        <div className="qty-controls">
                            <button type="button" className="qty-btn qty-bulk" aria-label="10개 줄이기" onClick={() => handleQuantityChange(-10)}>−10</button>
                            <button type="button" className="qty-btn" aria-label="1개 줄이기"
                                onClick={e => { if (e.detail === 0) handleQuantityChange(-1); }}
                                onPointerDown={e => { e.preventDefault(); startPress(-1); }}
                                onPointerUp={stopPress} onPointerLeave={stopPress} onPointerCancel={stopPress}>−</button>
                            <input id="option-quantity" type="number" inputMode="numeric" min="1" max="9999" className="qty-num" value={quantity}
                                onChange={e => {
                                    const val = e.target.value;
                                    if (val === '') setQuantity('');
                                    else {
                                        const parsed = parseInt(val, 10);
                                        if (!isNaN(parsed)) setQuantity(Math.max(1, Math.min(parsed, 9999)));
                                    }
                                }}
                                onBlur={() => { if (quantity === '' || quantity < 1) setQuantity(1); }} />
                            <span className="option-quantity-unit">개</span>
                            <button type="button" className="qty-btn" aria-label="1개 늘리기"
                                onClick={e => { if (e.detail === 0) handleQuantityChange(1); }}
                                onPointerDown={e => { e.preventDefault(); startPress(1); }}
                                onPointerUp={stopPress} onPointerLeave={stopPress} onPointerCancel={stopPress}>+</button>
                            <button type="button" className="qty-btn qty-bulk" aria-label="10개 늘리기" onClick={() => handleBulkStep(10)}>+10</button>
                            <button type="button" className="qty-btn qty-bulk" aria-label="50개 늘리기" onClick={() => handleBulkStep(50)}>+50</button>
                        </div>
                    </div>
                    <div className="option-action-row">
                        <div className="option-total-price" role="status">
                            <span>합계</span>
                            <strong>{selectedTotalPrice != null ? formatWon(selectedTotalPrice) : '—'}</strong>
                        </div>
                        <button type="button" className="option-browse-btn" onClick={onCancel}>다른 상품 보기</button>
                        <button type="button" className="option-order-btn" onClick={() => handleConfirm(true)}>장바구니 담기</button>
                    </div>
                </div>
                {recommendedProducts.length > 0 && (
                    <div className="option-reco">
                        <h3 className="option-reco-head">많이 찾는 상품</h3>
                        <div className="option-reco-list">
                            {recommendedProducts.map(item => (
                                <button key={item.id} type="button" className="option-reco-card" onClick={() => onSelectProduct?.(item)}>
                                    <div className="option-reco-thumb">
                                        <img src={item.images?.length ? getImageUrl(item.images[0]) : '/no-image.png'} alt={item.name}
                                            onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = '/no-image.png'; }} />
                                    </div>
                                    <div className="option-reco-name">{item.name}</div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
            {isZoomOpen && hasValidImage && (
                <div
                    className="image-zoom-backdrop"
                    onClick={() => setIsZoomOpen(false)}
                    role="dialog"
                    aria-modal="true"
                    aria-label={`${product.name} 사진 크게 보기`}
                >
                    <div className="image-zoom-modal" onClick={e => e.stopPropagation()}>
                        <div className="image-zoom-header">
                            <div className="image-zoom-title-wrap">
                                <span className="image-zoom-badge">사진 확대</span>
                                <h3 className="image-zoom-title">{product.name}</h3>
                            </div>
                            <button
                                type="button"
                                className="image-zoom-close-btn"
                                onClick={() => setIsZoomOpen(false)}
                                aria-label="닫기"
                            >✕</button>
                        </div>
                        <div
                            className="image-zoom-body"
                            onClick={() => setIsZoomOpen(false)}
                            onTouchStart={hasMultipleImages ? handleImageTouchStart : undefined}
                            onTouchEnd={hasMultipleImages ? handleImageTouchEnd : undefined}
                        >
                            <img
                                src={getImageUrl(currentImage)}
                                alt={product.name}
                                className="image-zoom-img"
                            />
                            {hasMultipleImages && (
                                <>
                                    <button
                                        type="button"
                                        className="image-zoom-arrow prev"
                                        onClick={(e) => { e.stopPropagation(); moveImage(-1); }}
                                        aria-label="이전 사진"
                                    >‹</button>
                                    <button
                                        type="button"
                                        className="image-zoom-arrow next"
                                        onClick={(e) => { e.stopPropagation(); moveImage(1); }}
                                        aria-label="다음 사진"
                                    >›</button>
                                    <div className="image-zoom-counter" onClick={e => e.stopPropagation()}>
                                        {currentImageIndex + 1} / {images.length}
                                    </div>
                                </>
                            )}
                        </div>
                        <div className="image-zoom-footer">
                            <span>화면 아무 곳이나 ✕ 버튼을 누르면 닫힙니다</span>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
};

export default ProductDetailView;
