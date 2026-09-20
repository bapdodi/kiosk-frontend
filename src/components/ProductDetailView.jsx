import { getImageUrl } from '../utils/imageUtils';
import './ProductDetailView.css';
import { useProductSelection } from '../hooks/useProductSelection';

/**
 * 키오스크·PC 용 상품 상세(규격·수량 선택) 화면.
 *
 * 팝업이 아니라 목록 자리를 대신 차지하는 한 단계다. 팝업이던 시절에는 뒤 화면을
 * 덮어 버려서 오른쪽 장바구니를 못 쓰게 됐고, 그래서 팝업 안에 장바구니를 하나 더
 * 두어야 했다. 화면 전환으로 바꾸면서 장바구니는 레일 하나로 돌아갔다.
 *
 * 폰은 이 화면을 쓰지 않는다 (components/ProductPageMobile.jsx 가 담당).
 * 덕분에 여기 배치는 1080x1920 세로 키오스크 기준만 생각하면 된다.
 */
const ProductDetailView = ({ product, cartItems = [], products = [], onConfirm, onCancel, onSelectProduct }) => {
    const {
        groups,
        selections, setSelections,
        allOptionsSelected,
        showProductPrompt, setShowProductPrompt,
        quantity, setQuantity,
        handleQuantityChange, handleBulkStep, startPress, stopPress,
        images, currentImageIndex, setCurrentImageIndex, hasMultipleImages,
        failedImages, setFailedImages,
        moveImage, handleImageTouchStart, handleImageTouchEnd,
        recommendedProducts,
        optionSectionRef, handleConfirm,
    } = useProductSelection(product, { cartItems, products, onConfirm });

    // 훅이 위에서 모두 선언됐으므로 여기서 안전하게 빠져나갈 수 있다.
    if (!product) return null;

    const FALLBACK_IMAGE = '/no-image.png';

    // 규격이 전부 한 가지뿐이면 고를 것이 없다. 그래도 무엇인지는 보여 주고 자동 선택해 둔다.
    const autoSelectedOnly = groups.length > 0 && groups.every(g => g.values.length === 1);

    return (
        <section className="product-detail-view guided-option-modal" aria-labelledby="option-product-title">
                <button type="button" className="option-back-btn" onClick={onCancel}>
                    <span aria-hidden="true">←</span> 돌아가기
                </button>
                <div className="option-scroll-body">
                <div className="option-detail-layout">
                    {/* Top Section: Info & Image */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'inherit', background: '#fff' }}>
                        {/* Left: Image carousel */}
                        <div
                            className="option-image-area"
                            style={{ position: 'relative', height: '100%', minHeight: '300px', display: 'flex', overflow: 'hidden' }}
                            onTouchStart={hasMultipleImages ? handleImageTouchStart : undefined}
                            onTouchEnd={hasMultipleImages ? handleImageTouchEnd : undefined}
                        >
                            {(images.length === 0 || failedImages[currentImageIndex]) ? (
                                <div className="no-image-placeholder">이미지 준비 중</div>
                            ) : (
                                <img
                                    key={currentImageIndex}
                                    src={getImageUrl(images[currentImageIndex])}
                                    alt={product.name}
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                    onError={() => setFailedImages(prev => ({ ...prev, [currentImageIndex]: true }))}
                                />
                            )}

                            {hasMultipleImages && (
                                <>
                                    {/* Image counter */}
                                    <div style={{
                                        position: 'absolute', top: '16px', left: '16px', zIndex: 5,
                                        background: 'rgba(0,0,0,0.6)', color: '#fff',
                                        padding: '4px 12px', borderRadius: '999px',
                                        fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.03em'
                                    }}>
                                        {currentImageIndex + 1} / {images.length}
                                    </div>

                                    {/* Prev arrow */}
                                    <button
                                        onClick={() => moveImage(-1)}
                                        aria-label="이전 사진"
                                        style={{
                                            position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', zIndex: 5,
                                            width: '40px', height: '40px', borderRadius: '50%', border: 'none',
                                            background: 'rgba(255,255,255,0.9)', boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                            fontSize: '1.6rem', lineHeight: 1, cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1e293b'
                                        }}
                                    >
                                        ‹
                                    </button>

                                    {/* Next arrow */}
                                    <button
                                        onClick={() => moveImage(1)}
                                        aria-label="다음 사진"
                                        style={{
                                            position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', zIndex: 5,
                                            width: '40px', height: '40px', borderRadius: '50%', border: 'none',
                                            background: 'rgba(255,255,255,0.9)', boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                            fontSize: '1.6rem', lineHeight: 1, cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1e293b'
                                        }}
                                    >
                                        ›
                                    </button>

                                    {/* Dot indicators */}
                                    <div style={{
                                        position: 'absolute', bottom: '14px', left: '50%', transform: 'translateX(-50%)', zIndex: 5,
                                        display: 'flex', gap: '8px', padding: '6px 10px',
                                        background: 'rgba(0,0,0,0.3)', borderRadius: '999px'
                                    }}>
                                        {images.map((_, i) => (
                                            <button
                                                key={i}
                                                onClick={() => setCurrentImageIndex(i)}
                                                aria-label={`${i + 1}번째 사진`}
                                                style={{
                                                    width: i === currentImageIndex ? '22px' : '8px',
                                                    height: '8px', borderRadius: '999px', border: 'none', padding: 0, cursor: 'pointer',
                                                    background: i === currentImageIndex ? '#fff' : 'rgba(255,255,255,0.5)',
                                                    transition: 'all 0.2s ease'
                                                }}
                                            />
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Right: Text Info */}
                        <div className="option-info-padding" style={{ padding: '40px' }}>
                            <div style={{ color: 'var(--accent-color)', fontWeight: 800, fontSize: '0.9rem', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                                상품 상세 정보
                            </div>
                            <h2 id="option-product-title" className="option-header-title" style={{ fontSize: '2.2rem', fontWeight: 900, marginBottom: '15px', color: '#1e293b', lineHeight: 1.2 }}>
                                {product.name}
                            </h2>

                            {product.gyu && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                                    <span style={{ fontWeight: 700, color: '#64748b', fontSize: '0.95rem' }}>규격</span>
                                    <span style={{ background: '#fff7ed', color: 'var(--accent-color)', padding: '6px 14px', borderRadius: '10px', fontWeight: 800, fontSize: '1rem', border: '1px solid #fed7aa' }}>
                                        {product.gyu}
                                    </span>
                                </div>
                            )}

                            {product.description && <div className="option-description">
                                <div className="option-description-title">상품 설명</div>
                                <p>{product.description}</p>
                            </div>}

                        </div>
                    </div>
                </div>

                {/* Middle Section: Options */}
                <div ref={optionSectionRef} style={{ padding: '0 40px 40px 40px', background: '#fff' }} className={`option-info-padding option-choice-section${allOptionsSelected ? ' product-selection-complete' : showProductPrompt ? ' needs-product-selection' : ''}`}>
                    <div style={{ padding: '30px', background: '#f8fafc', borderRadius: '24px', border: '1px solid #e2e8f0' }}>
                        <h3 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '20px', color: '#334155', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span className="option-step">1</span> {autoSelectedOnly ? '규격이 하나뿐이라 자동 선택했습니다' : allOptionsSelected ? '제품 선택 완료 · 수량을 정해주세요' : '제품을 먼저 선택해 주세요'}
                        </h3>

                        <p className="option-choice-help">{autoSelectedOnly ? '이 상품은 아래 규격 하나로만 나옵니다. 수량만 정해 주세요.' : '아래에서 원하는 규격을 눌러 주세요. 각 항목에서 하나씩 선택합니다.'}</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
                            {groups.map((group) => (
                                <div key={group.name} data-option-missing={selections[group.name] == null}>
                                    <div style={{ fontWeight: 700, marginBottom: '12px', fontSize: '1.1rem', color: '#64748b' }}>{group.displayLabel} <span className="option-required">{selections[group.name] == null ? '선택 필수' : '선택 완료'}</span></div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                                        {group.values.map(val => {
                                            const isSelected = selections[group.name] === val;

                                            return (
                                                <button
                                                    key={val}
                                                    aria-pressed={isSelected}
                                                    className="option-choice-button"
                                                    onClick={() => {
                                                        // 옵션을 바꾸면 표시 사진 세트가 달라지므로 첫 장부터 보여준다.
                                                        const nextSelections = { ...selections, [group.name]: val };
                                                        setSelections(nextSelections);
                                                        setShowProductPrompt(!groups.every(g => nextSelections[g.name] != null));
                                                        setCurrentImageIndex(0);
                                                        setFailedImages({});
                                                    }}
                                                    style={{
                                                        padding: '16px 24px',
                                                        borderRadius: '12px',
                                                        border: isSelected ? '2px solid var(--accent-color)' : '1px solid #cbd5e1',
                                                        background: isSelected ? '#fff' : '#fff',
                                                        color: isSelected ? 'var(--accent-color)' : '#475569',
                                                        fontWeight: 700,
                                                        fontSize: '1.25rem',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.15s ease',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '8px',
                                                        boxShadow: isSelected ? '0 4px 12px rgba(255, 107, 0, 0.1)' : 'none'
                                                    }}
                                                >
                                                    <span className="option-choice-check" aria-hidden="true">{isSelected ? '✓' : ''}</span><span>{val}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className={`option-quantity-block${allOptionsSelected ? ' ready-for-quantity' : ''}`}>
                            <label className="option-quantity-label" htmlFor="option-quantity"><span className="option-step">2</span> 수량 선택 <small>숫자를 눌러 직접 입력할 수 있어요</small></label>
                            <div className="qty-controls" style={{ background: '#f1f5f9', padding: '6px', borderRadius: '16px', display: 'flex', alignItems: 'center' }}>
                                <button
                                    className="qty-btn"
                                    aria-label="10개 줄이기"
                                    style={{ width: '48px', height: '40px', background: 'white', border: 'none', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', userSelect: 'none', WebkitUserSelect: 'none', cursor: 'pointer', borderRadius: '8px', fontSize: '0.95rem', fontWeight: 800, color: '#475569' }}
                                    onClick={() => handleQuantityChange(-10)}
                                >
                                    −10
                                </button>
                                <button
                                    aria-label="1개 줄이기"
                                    className="qty-btn"
                                    style={{ width: '40px', height: '40px', background: 'white', border: 'none', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', userSelect: 'none', WebkitUserSelect: 'none', cursor: 'pointer', borderRadius: '8px' }}
                                    onClick={(e) => { if (e.detail === 0) handleQuantityChange(-1); }}
                                    onPointerDown={(e) => { e.preventDefault(); startPress(-1); }}
                                    onPointerUp={stopPress}
                                    onPointerLeave={stopPress}
                                    onPointerCancel={stopPress}
                                >
                                    −
                                </button>
                                <input
                                    id="option-quantity"
                                    type="number"
                                    inputMode="numeric"
                                    min="1"
                                    max="9999"
                                    className="qty-num"
                                    value={quantity}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        if (val === '') {
                                            setQuantity('');
                                        } else {
                                            const parsed = parseInt(val, 10);
                                            if (!isNaN(parsed)) setQuantity(Math.max(1, Math.min(parsed, 9999)));
                                        }
                                    }}
                                    onBlur={() => {
                                        if (quantity === '' || quantity < 1) setQuantity(1);
                                    }}
                                    style={{
                                        width: '60px',
                                        textAlign: 'center',
                                        fontSize: '1.2rem',
                                        fontWeight: 800,
                                        border: 'none',
                                        background: 'transparent',
                                        outline: 'none',
                                        padding: 0,
                                        margin: '0 10px'
                                    }}
                                />
                                <span className="option-quantity-unit">개</span>
                                <button
                                    className="qty-btn"
                                    style={{ width: '40px', height: '40px', background: 'white', border: 'none', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', userSelect: 'none', WebkitUserSelect: 'none', cursor: 'pointer', borderRadius: '8px' }}
                                    aria-label="1개 늘리기"
                                    onClick={(e) => { if (e.detail === 0) handleQuantityChange(1); }}
                                    onPointerDown={(e) => { e.preventDefault(); startPress(1); }}
                                    onPointerUp={stopPress}
                                    onPointerLeave={stopPress}
                                    onPointerCancel={stopPress}
                                >
                                    +
                                </button>
                                <button
                                    className="qty-btn"
                                    aria-label="10개 늘리기"
                                    style={{ width: '48px', height: '40px', background: 'white', border: 'none', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', userSelect: 'none', WebkitUserSelect: 'none', cursor: 'pointer', borderRadius: '8px', fontSize: '0.95rem', fontWeight: 800, color: '#475569' }}
                                    onClick={() => handleBulkStep(10)}
                                >
                                    +10
                                </button>
                                <button
                                    className="qty-btn"
                                    aria-label="50개 늘리기"
                                    style={{ width: '48px', height: '40px', background: 'white', border: 'none', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', userSelect: 'none', WebkitUserSelect: 'none', cursor: 'pointer', borderRadius: '8px', fontSize: '0.95rem', fontWeight: 800, color: '#475569' }}
                                    onClick={() => handleBulkStep(50)}
                                >
                                    +50
                                </button>
                            </div>
                        </div>

                        {/* 규격 → 수량 → 담기. 정하자마자 바로 누를 수 있게 같은 카드 안에 둔다.
                            아래 푸터에 있을 때는 시선이 화면 끝까지 갔다 와야 했다. */}
                        <div className="option-action-row">
                            <button className="option-browse-btn" onClick={onCancel}>다른 상품 보기</button>
                            <button className="option-order-btn" onClick={() => handleConfirm(true)}>담기</button>
                        </div>

                    </div>
                </div>
                </div>

                {/* 같은 전표에 함께 담긴 적이 많은 상품. 누르면 그 상품의 주문 화면으로 바로 넘어간다. */}
                {recommendedProducts.length > 0 && (
                    <div className="option-reco">
                        <div className="option-reco-head">연관 있는 상품</div>
                        <div className="option-reco-list">
                            {recommendedProducts.map(item => (
                                <button
                                    key={item.id}
                                    type="button"
                                    className="option-reco-card"
                                    onClick={() => onSelectProduct && onSelectProduct(item)}
                                >
                                    <div className="option-reco-thumb">
                                        {item.images && item.images.length > 0 ? (
                                            <img src={getImageUrl(item.images[0])} alt={item.name} />
                                        ) : (
                                            <span className="option-reco-thumb-empty">이미지 준비 중</span>
                                        )}
                                    </div>
                                    <div className="option-reco-name">{item.name}</div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
        </section>
    );
};

export default ProductDetailView;
