import { useEffect, useRef, useState } from 'react';
import { getImageUrl } from '../utils/imageUtils';

const OptionModal = ({ product, onConfirm, onCancel }) => {
    if (!product) return null;

    // Normalizing option groups from different data structures
    const getOptionGroups = () => {
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
        if (groups.length === 0 && product.combinations && product.combinations.length > 1) {
            groups.push({
                values: product.combinations.map(c => c.name),
                legacySource: 'combinations'
            });
        }
        return groups;
    };

    const groups = getOptionGroups();
    const [selections, setSelections] = useState({});
    const [quantity, setQuantity] = useState(1);

    const intervalRef = useRef(null);
    const timeoutRef = useRef(null);

    const handleQuantityChange = (delta) => {
        setQuantity(prev => {
            const val = typeof prev === 'number' ? prev : parseInt(prev || '0', 10);
            return Math.max(1, Math.min(val + delta, 9999));
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

    // Initialize selections with the first value of each group
    useEffect(() => {
        const initial = {};
        groups.forEach(g => {
            initial[g.name] = g.values[0];
        });
        setSelections(initial);
        setQuantity(1);
    }, [product]);

    // Internal price calculation helper
    const getPriceForSelections = (tempSelections) => {
        if (product.combinations && product.combinations.length > 0) {
            const comboName = groups.map(g => tempSelections[g.name]).join(' / ');
            const combo = product.combinations.find(c => c.name === comboName);
            // If combination based price exists, it's usually the final price (or extra)
            // But for ERP grouped, it's should be treated as the unit price directly
            if (combo) {
                // For ERP items synced as combinations, 'price' is the actual unit price, 
                // not an "extra" fee. We handle that by returning (combo.price - product.price)
                return combo.price - product.price;
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

    const currentExtraPrice = getPriceForSelections(selections);
    const unitPrice = product.price + currentExtraPrice;
    const safeQuantity = typeof quantity === 'number' ? quantity : parseInt(quantity || '0', 10);
    const totalPrice = unitPrice * safeQuantity;

    // Helper to calculate potential price change for an option button
    const getPriceAdjustment = (groupName, value) => {
        const currentPrice = currentExtraPrice;
        const potentialSelections = { ...selections, [groupName]: value };
        const potentialPrice = getPriceForSelections(potentialSelections);
        const diff = potentialPrice - currentPrice;

        if (diff === 0) return null;
        const sign = diff > 0 ? '+' : '';
        return `(${sign}${diff.toLocaleString()}원)`;
    };

    const handleConfirm = () => {
        const comboName = groups.map(g => selections[g.name]).join(' / ');
        const foundCombo = product.combinations?.find(c => c.name === comboName);

        const combinations = [{
            id: foundCombo ? foundCombo.id : comboName,
            displayName: comboName,
            totalExtra: currentExtraPrice,
            erpCode: foundCombo ? foundCombo.erpCode : (product.erpCode || null)
        }];
        const quantities = { [foundCombo ? foundCombo.id : comboName]: safeQuantity === 0 ? 1 : safeQuantity };
        onConfirm(product, combinations, quantities);
    };

    const FALLBACK_IMAGE = '/no-image.png';

    return (
        <div className="modal-overlay mobile-bottom" onClick={onCancel}>
            <div className="modal-content full-mobile mobile-bottom" style={{ maxWidth: '800px' }} onClick={e => e.stopPropagation()}>
                {/* Header Close Button */}
                <button
                    onClick={onCancel}
                    style={{
                        position: 'absolute', top: '20px', right: '20px', zIndex: 10,
                        width: '40px', height: '40px', borderRadius: '50%', border: 'none',
                        background: 'rgba(255,255,255,0.9)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                        fontSize: '1.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}
                >
                    ×
                </button>

                <div className="option-detail-layout" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
                    {/* Top Section: Info & Image */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'inherit', background: '#fff' }}>
                        {/* Left: Image */}
                        <div className="option-image-area" style={{ position: 'relative', height: '100%', minHeight: '300px', display: 'flex' }}>
                            {(!product.images || product.images.length === 0) ? (
                                <div className="no-image-placeholder">이미지 준비 중</div>
                            ) : (
                                <img
                                    src={getImageUrl(product.images[0])}
                                    alt={product.name}
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
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

                        {/* Right: Text Info */}
                        <div className="option-info-padding" style={{ padding: '40px' }}>
                            <div style={{ color: 'var(--accent-color)', fontWeight: 800, fontSize: '0.9rem', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                                상품 상세 정보
                            </div>
                            <h2 className="option-header-title" style={{ fontSize: '2.2rem', fontWeight: 900, marginBottom: '15px', color: '#1e293b', lineHeight: 1.2 }}>
                                {product.name}
                            </h2>

                            <div style={{ marginBottom: '20px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                {product.hashtags?.map(tag => (
                                    <span key={tag} style={{ background: '#f1f5f9', color: '#64748b', padding: '6px 12px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600 }}>
                                        {tag}
                                    </span>
                                ))}
                            </div>

                            <p className="option-description" style={{ color: '#475569', lineHeight: 1.6, fontSize: '1.05rem', marginBottom: '25px' }}>
                                {product.description || `본 상품은 고품질 자재로 제작된 ${product.name}입니다. 산업 현장 및 일반 가정에서 신뢰하고 사용할 수 있는 내구성을 갖추고 있습니다. 상세 규격은 옵션에서 선택 가능합니다.`}
                            </p>

                        </div>
                    </div>
                </div>

                {/* Middle Section: Options */}
                <div style={{ padding: '0 40px 40px 40px', background: '#fff' }} className="option-info-padding">
                    <div style={{ padding: '30px', background: '#f8fafc', borderRadius: '24px', border: '1px solid #e2e8f0' }}>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '20px', color: '#334155', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            ⚙️ 옵션 선택
                        </h3>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
                            {groups.map((group) => (
                                <div key={group.name}>
                                    <div style={{ fontWeight: 700, marginBottom: '12px', fontSize: '0.95rem', color: '#64748b' }}>{group.name}</div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                                        {group.values.map(val => {
                                            const isSelected = selections[group.name] === val;
                                            const adj = isSelected ? null : getPriceAdjustment(group.name, val);

                                            return (
                                                <button
                                                    key={val}
                                                    onClick={() => setSelections({ ...selections, [group.name]: val })}
                                                    style={{
                                                        padding: '12px 20px',
                                                        borderRadius: '12px',
                                                        border: isSelected ? '2px solid var(--accent-color)' : '1px solid #cbd5e1',
                                                        background: isSelected ? '#fff' : '#fff',
                                                        color: isSelected ? 'var(--accent-color)' : '#475569',
                                                        fontWeight: 700,
                                                        fontSize: '0.95rem',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.15s ease',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '8px',
                                                        boxShadow: isSelected ? '0 4px 12px rgba(255, 107, 0, 0.1)' : 'none'
                                                    }}
                                                >
                                                    <span>{val}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Bottom Section: Qty & Footer */}
                <div className="option-footer" style={{
                    position: 'sticky', bottom: 0, padding: '25px 40px',
                    background: 'rgba(255,255,255,0.98)', backdropFilter: 'blur(10px)',
                    borderTop: '1px solid #e2e8f0', display: 'flex',
                    justifyContent: 'space-between', alignItems: 'center',
                    gap: '20px'
                }}>
                    <div className="option-footer-content" style={{ display: 'flex', alignItems: 'center', gap: '25px' }}>
                        <div className="qty-controls" style={{ background: '#f1f5f9', padding: '6px', borderRadius: '16px', display: 'flex', alignItems: 'center' }}>
                            <button
                                className="qty-btn"
                                style={{ width: '40px', height: '40px', background: 'white', border: 'none', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', userSelect: 'none', WebkitUserSelect: 'none', cursor: 'pointer', borderRadius: '8px' }}
                                onMouseDown={(e) => { e.preventDefault(); startPress(-1); }}
                                onMouseUp={stopPress}
                                onMouseLeave={stopPress}
                                onTouchStart={(e) => { e.preventDefault(); startPress(-1); }}
                                onTouchEnd={stopPress}
                                onTouchCancel={stopPress}
                            >
                                −
                            </button>
                            <input
                                type="number"
                                className="qty-num"
                                value={quantity}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    if (val === '') {
                                        setQuantity('');
                                    } else {
                                        const parsed = parseInt(val, 10);
                                        if (!isNaN(parsed)) setQuantity(parsed);
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
                            <button
                                className="qty-btn"
                                style={{ width: '40px', height: '40px', background: 'white', border: 'none', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', userSelect: 'none', WebkitUserSelect: 'none', cursor: 'pointer', borderRadius: '8px' }}
                                onMouseDown={(e) => { e.preventDefault(); startPress(1); }}
                                onMouseUp={stopPress}
                                onMouseLeave={stopPress}
                                onTouchStart={(e) => { e.preventDefault(); startPress(1); }}
                                onTouchEnd={stopPress}
                                onTouchCancel={stopPress}
                            >
                                +
                            </button>
                        </div>

                    </div>

                    <div className="option-footer-btns" style={{ display: 'flex', gap: '12px', flex: '1', justifyContent: 'flex-end' }}>
                        <button
                            className="action-btn"
                            onClick={onCancel}
                            style={{
                                padding: '16px 20px', borderRadius: '18px', height: 'auto',
                                background: 'white', color: '#64748b', fontWeight: 700, fontSize: '1.1rem',
                                cursor: 'pointer', flex: 1
                            }}
                        >
                            취소
                        </button>
                        <button
                            onClick={handleConfirm}
                            style={{
                                padding: '16px 20px', borderRadius: '18px', border: 'none',
                                background: 'var(--accent-color)', color: 'white', fontWeight: 800, fontSize: '1.1rem',
                                cursor: 'pointer', boxShadow: '0 10px 20px rgba(255, 107, 0, 0.2)',
                                flex: 2
                            }}
                        >
                            장바구니 담기
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OptionModal;
