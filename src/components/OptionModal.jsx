import { useEffect, useState } from 'react';

const OptionModal = ({ product, onConfirm, onCancel }) => {
    if (!product) return null;

    // Normalizing option groups from different data structures
    const getOptionGroups = () => {
        if (product.optionGroups && product.optionGroups.length > 0) {
            return product.optionGroups;
        }

        const groups = [];
        if (product.sizes && product.sizes.length > 0) {
            groups.push({ name: '규격 (Size)', values: product.sizes.map(s => s.name), legacySource: 'sizes' });
        }
        if (product.origins && product.origins.length > 0) {
            groups.push({ name: '원산지 (Origin)', values: product.origins.map(o => o.name), legacySource: 'origins' });
        }
        return groups;
    };

    const groups = getOptionGroups();
    const [selections, setSelections] = useState({});
    const [quantity, setQuantity] = useState(1);

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
        if (product.isComplexOptions && product.combinations) {
            const comboName = groups.map(g => tempSelections[g.name]).join(' / ');
            const combo = product.combinations.find(c => c.name === comboName);
            return combo ? combo.price : 0;
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
    const totalPrice = unitPrice * quantity;

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
        const combinations = [{ id: comboName, displayName: comboName, totalExtra: currentExtraPrice }];
        const quantities = { [comboName]: quantity };
        onConfirm(product, combinations, quantities);
    };

    const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1581094288338-2314dddb7bc3?w=500&auto=format&fit=crop&q=60';

    return (
        <div className="modal-overlay" onClick={onCancel}>
            <div className="modal-content" style={{ maxWidth: '800px', width: '95%', padding: '0', borderRadius: '32px' }} onClick={e => e.stopPropagation()}>
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

                <div className="detail-layout" style={{ display: 'flex', flexDirection: 'column', maxHeight: '90vh', overflowY: 'auto' }}>
                    {/* Top Section: Info & Image */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', background: '#fff' }}>
                        {/* Left: Image */}
                        <div style={{ position: 'relative', height: '100%', minHeight: '300px' }}>
                            <img
                                src={product.images && product.images.length > 0 ? product.images[0] : FALLBACK_IMAGE}
                                alt={product.name}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                        </div>

                        {/* Right: Text Info */}
                        <div style={{ padding: '40px' }}>
                            <div style={{ color: 'var(--accent-color)', fontWeight: 800, fontSize: '0.9rem', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                                상품 상세 정보
                            </div>
                            <h2 style={{ fontSize: '2.2rem', fontWeight: 900, marginBottom: '15px', color: '#1e293b', lineHeight: 1.2 }}>
                                {product.name}
                            </h2>

                            <div style={{ marginBottom: '20px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                {product.hashtags?.map(tag => (
                                    <span key={tag} style={{ background: '#f1f5f9', color: '#64748b', padding: '6px 12px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600 }}>
                                        {tag}
                                    </span>
                                ))}
                            </div>

                            <p style={{ color: '#475569', lineHeight: 1.6, fontSize: '1.05rem', marginBottom: '25px' }}>
                                {product.description || `본 상품은 고품질 자재로 제작된 ${product.name}입니다. 산업 현장 및 일반 가정에서 신뢰하고 사용할 수 있는 내구성을 갖추고 있습니다. 상세 규격은 옵션에서 선택 가능합니다.`}
                            </p>

                            <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '20px' }}>
                                <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '5px' }}>기본 판매가</div>
                                <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#1e293b' }}>
                                    ₩{product.price.toLocaleString()}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Middle Section: Options */}
                <div style={{ padding: '0 40px 40px 40px', background: '#fff' }}>
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
                                                    {adj && <span style={{ fontSize: '0.8rem', opacity: 0.7, fontWeight: 500 }}>{adj}</span>}
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
                <div style={{
                    position: 'sticky', bottom: 0, padding: '25px 40px',
                    background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(10px)',
                    borderTop: '1px solid #e2e8f0', display: 'flex',
                    justifyContent: 'space-between', alignItems: 'center',
                    gap: '20px', flexWrap: 'wrap'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '25px' }}>
                        <div className="qty-controls" style={{ background: '#f1f5f9', padding: '6px', borderRadius: '16px' }}>
                            <button className="qty-btn" style={{ width: '40px', height: '40px', background: 'white', border: 'none', shadow: '0 2px 4px rgba(0,0,0,0.05)' }} onClick={() => setQuantity(Math.max(1, quantity - 1))}>−</button>
                            <span className="qty-num" style={{ minWidth: '40px', textAlign: 'center', fontSize: '1.2rem', fontWeight: 800 }}>{quantity}</span>
                            <button className="qty-btn" style={{ width: '40px', height: '40px', background: 'white', border: 'none', shadow: '0 2px 4px rgba(0,0,0,0.05)' }} onClick={() => setQuantity(quantity + 1)}>+</button>
                        </div>

                        <div>
                            <div style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: 600, marginBottom: '2px' }}>총 주문 금액</div>
                            <div style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--accent-color)' }}>
                                ₩{totalPrice.toLocaleString()}
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '12px', flex: '1', justifyContent: 'flex-end', minWidth: '280px' }}>
                        <button
                            onClick={onCancel}
                            style={{
                                padding: '18px 30px', borderRadius: '18px', border: '1px solid #e2e8f0',
                                background: 'white', color: '#64748b', fontWeight: 700, fontSize: '1.1rem',
                                cursor: 'pointer'
                            }}
                        >
                            취소
                        </button>
                        <button
                            onClick={handleConfirm}
                            style={{
                                padding: '18px 50px', borderRadius: '18px', border: 'none',
                                background: 'var(--accent-color)', color: 'white', fontWeight: 800, fontSize: '1.1rem',
                                cursor: 'pointer', boxShadow: '0 10px 20px rgba(255, 107, 0, 0.2)',
                                flex: 0.6
                            }}
                        >
                            장바구니에 담기
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OptionModal;
