import { useEffect, useRef, useState } from 'react';
import { getImageUrl } from '../utils/imageUtils';
import './OptionModal.css';
import { COMBINATION_GROUP } from '../utils/optionConstants';

// 복합옵션 상품은 규격이 수십 개일 수 있어, 추천 기준으로 보낼 ERP 코드 수를 제한한다.
const MAX_RECOMMENDATION_SOURCE_CODES = 30;
// 키오스크 화면에서 한 줄로 훑을 수 있는 개수. 더 늘리면 스크롤해야 보여서 눌리지 않는다.
const VISIBLE_RECOMMENDATIONS = 6;

const OptionModal = ({ product, cartItems = [], products = [], onConfirm, onCancel, onSelectProduct }) => {
    // Normalizing option groups from different data structures
    const getOptionGroups = () => {
        if (!product) return [];

        const compareOptions = (strA, strB) => {
            const regex = /(\d+)|(\D+)/g;
            const partsA = [...strA.trim().matchAll(regex)].map(m => m[0]);
            const partsB = [...strB.trim().matchAll(regex)].map(m => m[0]);

            for (let i = 0; i < Math.min(partsA.length, partsB.length); i++) {
                const pA = partsA[i];
                const pB = partsB[i];

                const isNumA = /^\d+$/.test(pA);
                const isNumB = /^\d+$/.test(pB);

                if (isNumA && isNumB) {
                    const diff = parseInt(pA, 10) - parseInt(pB, 10);
                    if (diff !== 0) return diff;
                } else if (isNumA !== isNumB) {
                    return isNumB ? 1 : -1;
                } else {
                    const comp = pA.localeCompare(pB, 'ko-KR');
                    if (comp !== 0) return comp;
                }
            }
            return partsA.length - partsB.length;
        };

        if (product.optionGroups && product.optionGroups.length > 0) {
            return product.optionGroups.map(g => ({
                ...g,
                values: g.values || []
            }));
        }

        const groups = [];
        if (product.sizes && product.sizes.length > 0) {
            groups.push({ name: '규격 (Size)', values: product.sizes.map(s => s.name), legacySource: 'sizes' });
        }
        if (product.origins && product.origins.length > 0) {
            groups.push({ name: '원산지 (Origin)', values: product.origins.map(o => o.name), legacySource: 'origins' });
        }

        // Handle ERP-grouped items as a generic "Options" choice
        const activeCombos = (product.combinations || []).filter(c => !c.deleted);
        if (groups.length === 0 && activeCombos.length > 1) {
            groups.push({
                name: COMBINATION_GROUP,
                label: '',
                values: activeCombos.map(c => c.name),
                legacySource: 'combinations'
            });
        }
        return groups;
    };

    const groups = getOptionGroups();
    const [selections, setSelections] = useState({});
    const [quantity, setQuantity] = useState(1);
    const optionSectionRef = useRef(null);
    const [showProductPrompt, setShowProductPrompt] = useState(false);

    // Image carousel state
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [failedImages, setFailedImages] = useState({});
    // 어떤 상품의 추천인지 함께 들고 있어야, 다른 상품으로 갈아탄 순간 이전 추천이 잠깐 비치지 않는다.
    const [recommendations, setRecommendations] = useState({ productId: null, items: [] });
    const touchStartX = useRef(null);

    const optionImages = product?.optionImages || [];

    // 현재 선택된 옵션값들에 등록된 사진을 모으고, 하나도 없으면 메인 사진으로 폴백한다.
    const matchedOptionImages = [];
    groups.forEach(g => {
        const sel = selections[g.name];
        if (!sel) return;
        optionImages
            .filter(oi => oi.groupName === g.name && oi.optionValue === sel)
            .forEach(oi => matchedOptionImages.push(oi.imageUrl));
    });
    const images = matchedOptionImages.length > 0 ? matchedOptionImages : (product?.images || []);
    const hasMultipleImages = images.length > 1;

    const moveImage = (dir) => {
        const count = images.length;
        if (count <= 1) return;
        setCurrentImageIndex(prev => (prev + dir + count) % count);
    };

    const handleImageTouchStart = (e) => {
        touchStartX.current = e.touches[0].clientX;
    };

    const handleImageTouchEnd = (e) => {
        if (touchStartX.current === null) return;
        const delta = e.changedTouches[0].clientX - touchStartX.current;
        if (Math.abs(delta) > 40) {
            moveImage(delta < 0 ? 1 : -1);
        }
        touchStartX.current = null;
    };

    const intervalRef = useRef(null);
    const timeoutRef = useRef(null);

    const handleQuantityChange = (delta) => {
        setQuantity(prev => {
            const val = typeof prev === 'number' ? prev : parseInt(prev || '0', 10);
            return Math.max(1, Math.min(val + delta, 9999));
        });
    };

    // 묶음 수량 버튼(+10/+50). 아직 수량을 정하지 않은 초기 상태(1)에서 누르면
    // 1+50=51 이 아니라 눌린 수량 그대로 맞춘다. 손님이 기대하는 "50개 담기"에 맞춘 동작.
    const handleBulkStep = (step) => {
        setQuantity(prev => {
            const val = typeof prev === 'number' ? prev : parseInt(prev || '0', 10);
            if (val === 1) return step;
            return Math.max(1, Math.min(val + step, 9999));
        });
    };

    const startPress = (delta) => {
        // Stop any running intervals first
        stopPress();
        handleQuantityChange(delta);
        timeoutRef.current = setTimeout(() => {
            intervalRef.current = setInterval(() => {
                handleQuantityChange(delta);
            }, 30); // 속도를 더 빠르게 80ms -> 30ms로 변경
        }, 400);
    };

    const stopPress = () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        if (intervalRef.current) clearInterval(intervalRef.current);
    };

    useEffect(() => () => stopPress(), []);

    // Initialize selections.
    // 옵션이 2개 이상인 그룹은 사용자가 직접 고르도록 디폴트 선택하지 않는다.
    // (값이 하나뿐인 그룹은 선택의 여지가 없으므로 그대로 선택해 둔다.)
    useEffect(() => {
        const initial = {};
        groups.forEach(g => {
            if (g.values.length === 1) {
                initial[g.name] = g.values[0];
            }
        });
        setSelections(initial);
        setQuantity(1);
        setCurrentImageIndex(0);
        setFailedImages({});
        setShowProductPrompt(false);
    }, [product]);

    // 동시구매 추천. ERP 거래이력에서 집계한 "이 상품 주문한 전표에 함께 담긴 상품"을 가져온다.
    // 복합옵션 상품은 규격마다 ERP 코드가 달라서, 규격을 고르기 전에도 추천이 보이도록 전 규격의
    // 코드를 함께 보내고 서버가 합산한 결과를 돌려준다.
    useEffect(() => {
        const codes = (!product ? [] : [
            product.erpCode,
            ...(product.combinations || []).filter(c => !c.deleted).map(c => c.erpCode)
        ]).filter(Boolean).slice(0, MAX_RECOMMENDATION_SOURCE_CODES);

        if (codes.length === 0) return;

        let cancelled = false;
        const productId = product.id;
        fetch(`/api/recommendations?codes=${encodeURIComponent(codes.join(','))}&limit=8`)
            .then(res => (res.ok ? res.json() : []))
            .then(data => {
                if (!cancelled) {
                    setRecommendations({ productId, items: Array.isArray(data) ? data : [] });
                }
            })
            .catch(() => {
                // 추천은 주문에 필수가 아니므로 실패하면 조용히 숨긴다.
                if (!cancelled) setRecommendations({ productId, items: [] });
            });

        return () => { cancelled = true; };
    }, [product]);

    // All hooks are declared above; safe to bail out for a missing product here.
    if (!product) return null;

    // Internal price calculation helper
    const getPriceForSelections = (tempSelections) => {
        const activeCombos = (product.combinations || []).filter(c => !c.deleted);
        if (activeCombos.length > 0) {
            const comboName = groups.map(g => tempSelections[g.name]).join(' / ');
            const combo = activeCombos.find(c => c.name === comboName);
            // If combination based price exists, it's usually the final price (or extra)
            // But for ERP grouped, it's should be treated as the unit price directly
            if (combo) {
                // For ERP items synced as combinations, 'priceC' is the actual unit price,
                // not an "extra" fee. We handle that by returning (combo.priceC - product.priceC)
                return combo.priceC - product.priceC;
            }
            return 0;
        } else {
            let extra = 0;
            groups.forEach(g => {
                const val = tempSelections[g.name];
                if (g.legacySource === 'sizes') {
                    const s = product.sizes.find(sz => sz.name === val);
                    if (s) extra += s.price;
                }
                if (g.legacySource === 'origins') {
                    const o = product.origins.find(og => og.name === val);
                    if (o) extra += o.price;
                }
            });
            return extra;
        }
    };

    const safeQuantity = typeof quantity === 'number' ? quantity : parseInt(quantity || '0', 10);
    // 이 상품으로 이미 장바구니에 담긴 항목들. 모달을 다시 열어도 그대로 보이도록
    // 모달 내부 상태가 아니라 장바구니에서 직접 가져온다.
    const addedLines = (cartItems || []).filter(i => i.id === product.id);
    const addedTotalQuantity = addedLines.reduce((sum, line) => sum + (line.quantity || 1), 0);

    // 서버는 상품 id 만 돌려준다. 사진·가격은 이미 메모리에 있는 전체 상품 목록에서 찾아 쓰고,
    // 목록에 없는(삭제됐거나 아직 동기화 전인) 상품은 버린다.
    const recommendedProducts = (recommendations.productId === product.id ? recommendations.items : [])
        .map(reco => products.find(p => p.id === reco.productId))
        .filter(Boolean)
        .slice(0, VISIBLE_RECOMMENDATIONS);
    // 모든 옵션 그룹이 선택되어야 담을 수 있다 (자동 디폴트가 없으므로 직접 선택 필수).
    const allOptionsSelected = groups.every(g => selections[g.name] != null);

    // 현재 선택값(selections)을 하나의 라인 객체로 변환
    const buildLineFromSelections = (sel, qty) => {
        const comboName = groups.map(g => sel[g.name]).join(' / ');
        const foundCombo = (product.combinations || []).filter(c => !c.deleted).find(c => c.name === comboName);
        const extra = getPriceForSelections(sel);
        const comboId = foundCombo ? foundCombo.id : comboName;
        return {
            lineId: comboId,
            comboId,
            displayName: comboName,
            totalExtra: extra,
            unitPrice: (product.priceC || 0) + extra,
            erpCode: foundCombo ? foundCombo.erpCode : (product.erpCode || null),
            quantity: Math.max(1, qty)
        };
    };

    const focusMissingProduct = () => {
        setShowProductPrompt(true);
        const target = optionSectionRef.current?.querySelector('[data-option-missing="true"]');
        target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        target?.querySelector('button')?.focus({ preventScroll: true });
    };

    const handleConfirm = (stayOpen = false) => {
        if (!allOptionsSelected) {
            focusMissingProduct();
            return;
        }
        const qty = safeQuantity < 1 ? 1 : safeQuantity;
        const line = buildLineFromSelections(selections, qty);
        onConfirm(product, [{
            id: line.comboId,
            displayName: line.displayName,
            totalExtra: line.totalExtra,
            erpCode: line.erpCode
        }], { [line.comboId]: qty }, stayOpen);

        if (stayOpen) {
            const initial = {};
            groups.forEach(g => {
                if (g.values.length === 1) initial[g.name] = g.values[0];
            });
            setSelections(initial);
            setQuantity(1);
            setShowProductPrompt(true);
        }
    };

    const FALLBACK_IMAGE = '/no-image.png';

    return (
        <div className="modal-overlay mobile-bottom option-modal-overlay" onClick={onCancel}>
            <div className="modal-content full-mobile mobile-bottom guided-option-modal" role="dialog" aria-modal="true" aria-labelledby="option-product-title" onClick={e => e.stopPropagation()}>
                {/* Header Close Button */}
                <button
                    onClick={onCancel}
                    aria-label="상품 선택 닫기"
                    style={{
                        position: 'absolute', top: '20px', right: '20px', zIndex: 10,
                        width: '52px', height: '52px', borderRadius: '50%', border: '2px solid #b91c1c',
                        background: '#dc2626', color: '#fff', boxShadow: '0 4px 12px rgba(185,28,28,0.35)',
                        fontSize: '2rem', fontWeight: 900, lineHeight: 1,
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}
                >
                    ×
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
                            <span className="option-step">1</span> {groups.length ? (allOptionsSelected ? '제품 선택 완료 · 수량을 정해주세요' : '제품을 먼저 선택해 주세요') : '기본 제품으로 담습니다'}
                        </h3>

                        <p className="option-choice-help">{groups.length ? '아래에서 원하는 규격을 눌러 주세요. 각 항목에서 하나씩 선택합니다.' : '아래에서 필요한 수량을 확인해 주세요.'}</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
                            {groups.map((group) => (
                                <div key={group.name} data-option-missing={selections[group.name] == null}>
                                    <div style={{ fontWeight: 700, marginBottom: '12px', fontSize: '1.1rem', color: '#64748b' }}>{group.label || (group.name === COMBINATION_GROUP ? '규격' : group.name)} <span className="option-required">{selections[group.name] == null ? '선택 필수' : '선택 완료'}</span></div>
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

                    </div>
                </div>
                </div>

                {/* 이 상품으로 장바구니에 담긴 항목 목록. 모달을 다시 열어도 무엇을 주문했는지 보인다. */}
                {addedLines.length > 0 && (
                    <div className="option-added-summary">
                        <div className="option-added-head">
                            <strong>장바구니에 담긴 이 상품 {addedLines.length}종</strong>
                            <span>{addedTotalQuantity}개</span>
                        </div>
                        <ul className="option-added-list">
                            {addedLines.map(line => (
                                <li key={line.cartId}>
                                    <span className="option-added-name">{line.selectedOption || '기본'}</span>
                                    <span className="option-added-qty">{line.quantity || 1}개</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* 같은 전표에 함께 담긴 적이 많은 상품. 누르면 그 상품의 주문 화면으로 바로 넘어간다. */}
                {recommendedProducts.length > 0 && (
                    <div className="option-reco">
                        <div className="option-reco-head">이 상품을 주문한 분들이 함께 주문한 상품</div>
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
                                    <div className="option-reco-price">{(item.priceC || 0).toLocaleString()}원</div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Bottom Section: Qty & Footer */}
                <div className="option-footer" style={{
                    position: 'sticky', bottom: 0, padding: '25px 40px',
                    background: 'rgba(255,255,255,0.98)', backdropFilter: 'blur(10px)',
                    borderTop: '1px solid #e2e8f0', display: 'flex',
                    justifyContent: 'space-between', alignItems: 'center',
                    gap: '20px'
                }}>
                    <div className="option-footer-btns" style={{ display: 'flex', gap: '12px', flex: '1', justifyContent: 'flex-end' }}>
                        <button className="option-order-btn" onClick={() => handleConfirm(true)}>주문하기</button>
                        <button className="option-exit-btn" onClick={onCancel}>나가기</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OptionModal;
