import { getImageUrl } from '../utils/imageUtils';
import './ProductDetailView.css';
import { useProductSelection } from '../hooks/useProductSelection';
import { formatPriceRange, formatWon } from '../utils/price';
import { getOptionPriceRange } from '../utils/productOptions';

const ProductDetailView = ({ product, cartItems = [], products = [], onConfirm, onCancel, onSelectProduct }) => {
    const {
        groups, selections, toggleOption, showProductPrompt,
        quantity, setQuantity, handleQuantityChange, handleBulkStep, startPress, stopPress,
        images, currentImageIndex, setCurrentImageIndex, hasMultipleImages,
        failedImages, setFailedImages, moveImage, handleImageTouchStart, handleImageTouchEnd,
        recommendedProducts, selectedTotalPrice, priceRange, optionSectionRef, handleConfirm,
    } = useProductSelection(product, { cartItems, products, onConfirm });

    if (!product) return null;

    return (
        <section className="product-detail-view order-focused-detail" aria-labelledby="option-product-title">
            <div className="option-scroll-body">
                <button type="button" className="option-back-btn" onClick={onCancel}>← 상품 목록</button>
                <div className="option-detail-layout">
                    <div className="option-image-area"
                        onTouchStart={hasMultipleImages ? handleImageTouchStart : undefined}
                        onTouchEnd={hasMultipleImages ? handleImageTouchEnd : undefined}>
                        {images.length === 0 || failedImages[currentImageIndex] ? (
                            <div className="no-image-placeholder">이미지 없음</div>
                        ) : (
                            <img src={getImageUrl(images[currentImageIndex])} alt={product.name}
                                onError={() => setFailedImages(prev => ({ ...prev, [currentImageIndex]: true }))} />
                        )}
                        {hasMultipleImages && <>
                            <span className="option-image-counter">{currentImageIndex + 1} / {images.length}</span>
                            <button type="button" className="option-image-arrow prev" onClick={() => moveImage(-1)} aria-label="이전 사진">‹</button>
                            <button type="button" className="option-image-arrow next" onClick={() => moveImage(1)} aria-label="다음 사진">›</button>
                            <div className="option-image-dots">{images.map((_, i) => (
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
        </section>
    );
};

export default ProductDetailView;
