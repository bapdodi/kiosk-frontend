import { useState } from 'react';

const AdminModal = ({
    isOpen,
    onClose,
    onAdd,
    newProduct,
    setNewProduct,
    mainCategories,
    subCategories,
    detailCategories
}) => {
    if (!isOpen) return null;

    const [optionGroups, setOptionGroups] = useState([]);
    const [combinations, setCombinations] = useState([]);

    const handleGroupChange = (index, field, value) => {
        const updated = [...optionGroups];
        updated[index][field] = value;
        setOptionGroups(updated);
    };

    const addOptionGroup = () => {
        if (optionGroups.length < 3) {
            setOptionGroups([...optionGroups, { name: '', values: '' }]);
        } else {
            alert('옵션 그룹은 최대 3개까지 추가 가능합니다.');
        }
    };

    const removeOptionGroup = (index) => {
        const updated = optionGroups.filter((_, i) => i !== index);
        setOptionGroups(updated);
        // Optionally clear combinations if groups are removed
        if (updated.length === 0) setCombinations([]);
    };

    const generateCombinations = () => {
        const validGroups = optionGroups.filter(g => g.name.trim() && g.values.trim());
        if (validGroups.length === 0) {
            alert('최소 하나 이상의 옵션명과 옵션값을 입력해주세요.');
            return;
        }

        const groupValues = validGroups.map(g => g.values.split(',').map(v => v.trim()).filter(v => v));

        const cartesian = (...a) => a.reduce((a, b) => a.flatMap(d => b.map(e => [d, e].flat())));
        const results = groupValues.length > 1 ? cartesian(...groupValues) : groupValues[0].map(v => [v]);

        const newCombos = results.map((res, idx) => {
            const displayName = Array.isArray(res) ? res.join(' / ') : res;
            return {
                id: `combo-${idx}`,
                name: displayName,
                price: 0
            };
        });
        setCombinations(newCombos);
    };

    const handleComboPriceChange = (index, price) => {
        const updated = [...combinations];
        updated[index].price = parseInt(price || 0);
        setCombinations(updated);
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        const productToAdd = {
            ...newProduct,
            price: parseInt(newProduct.price || 0),
            hashtags: newProduct.hashtags.split(',').map(tag => {
                const t = tag.trim();
                return t.startsWith('#') ? t : `#${t}`;
            }).filter(t => t !== '#'),
            isComplexOptions: combinations.length > 0,
            combinations: combinations
        };

        onAdd(productToAdd);
        // Reset local state after add
        setOptionGroups([]);
        setCombinations([]);
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: '800px', width: '95%', maxHeight: '90vh', overflowY: 'auto', padding: '0', borderRadius: '8px' }}>
                <div style={{ padding: '20px 30px', borderBottom: '1px solid #ddd', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={{ margin: 0, fontSize: '1.2rem' }}>상품 등록</h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
                </div>

                <form onSubmit={handleSubmit} style={{ padding: '30px' }}>
                    {/* Category Section */}
                    <div className="admin-section">
                        <div className="admin-section-header">카테고리</div>
                        <div className="admin-section-body">
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' }}>
                                <div>
                                    <div className="admin-label">대분류</div>
                                    <select
                                        className="admin-input-small"
                                        value={newProduct.mainCategory}
                                        onChange={(e) => {
                                            const mId = e.target.value;
                                            const sId = subCategories[mId][0].id;
                                            setNewProduct({
                                                ...newProduct,
                                                mainCategory: mId,
                                                subCategory: sId,
                                                detailCategory: detailCategories[sId][0].id
                                            });
                                        }}
                                    >
                                        {mainCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <div className="admin-label">중분류</div>
                                    <select
                                        className="admin-input-small"
                                        value={newProduct.subCategory}
                                        onChange={(e) => {
                                            const sId = e.target.value;
                                            setNewProduct({
                                                ...newProduct,
                                                subCategory: sId,
                                                detailCategory: detailCategories[sId][0].id
                                            });
                                        }}
                                    >
                                        {subCategories[newProduct.mainCategory].map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <div className="admin-label">소분류</div>
                                    <select
                                        className="admin-input-small"
                                        value={newProduct.detailCategory}
                                        onChange={(e) => setNewProduct({ ...newProduct, detailCategory: e.target.value })}
                                    >
                                        {detailCategories[newProduct.subCategory]?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Product Name Section */}
                    <div className="admin-section">
                        <div className="admin-section-header">상품명</div>
                        <div className="admin-section-body">
                            <div className="admin-label">상품명</div>
                            <input
                                className="admin-input-small"
                                required
                                placeholder="상품명을 입력하세요"
                                value={newProduct.name}
                                onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                            />
                        </div>
                    </div>

                    {/* Price Section */}
                    <div className="admin-section">
                        <div className="admin-section-header">판매가</div>
                        <div className="admin-section-body">
                            <div className="admin-label">판매가</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <input
                                    type="number"
                                    className="admin-input-small"
                                    style={{ width: '200px' }}
                                    required
                                    value={newProduct.price}
                                    onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
                                />
                                <span>원</span>
                            </div>
                        </div>
                    </div>

                    {/* Options Section */}
                    <div className="admin-section">
                        <div className="admin-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            옵션
                            <button type="button" onClick={addOptionGroup} className="apply-btn" style={{ padding: '5px 15px', fontSize: '0.9rem', marginTop: 0 }}>+ 옵션 항목 추가</button>
                        </div>
                        <div className="admin-section-body">
                            <div className="admin-label">옵션 설정</div>
                            <div className="option-config-box">
                                {optionGroups.length === 0 ? (
                                    <div style={{ padding: '20px', textAlign: 'center', color: '#999' }}>
                                        등록된 옵션이 없습니다. 상단의 버튼을 눌러 옵션을 추가해주세요.
                                    </div>
                                ) : (
                                    <>
                                        {optionGroups.map((group, idx) => (
                                            <div key={idx} style={{ display: 'grid', gridTemplateColumns: '150px 1fr 40px', gap: '15px', marginBottom: '15px', alignItems: 'center' }}>
                                                <input
                                                    className="admin-input-small"
                                                    placeholder="옵션명 (예: 규격)"
                                                    value={group.name}
                                                    onChange={(e) => handleGroupChange(idx, 'name', e.target.value)}
                                                />
                                                <input
                                                    className="admin-input-small"
                                                    placeholder="옵션값 (콤마로 구분, 예: 15mm, 20mm)"
                                                    value={group.values}
                                                    onChange={(e) => handleGroupChange(idx, 'values', e.target.value)}
                                                />
                                                <button type="button" onClick={() => removeOptionGroup(idx)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', color: '#ff4444', cursor: 'pointer' }}>×</button>
                                            </div>
                                        ))}
                                        <button type="button" className="apply-btn" onClick={generateCombinations}>옵션 목록 적용</button>
                                    </>
                                )}
                            </div>

                            {combinations.length > 0 && (
                                <table className="combo-table">
                                    <thead>
                                        <tr>
                                            <th>옵션명</th>
                                            <th>옵션가 (원)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {combinations.map((combo, idx) => (
                                            <tr key={idx}>
                                                <td>{combo.name}</td>
                                                <td>
                                                    <input
                                                        type="number"
                                                        className="admin-input-small"
                                                        value={combo.price}
                                                        onChange={(e) => handleComboPriceChange(idx, e.target.value)}
                                                    />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>

                    <div className="admin-section">
                        <div className="admin-section-header">추가 정보</div>
                        <div className="admin-section-body">
                            <div className="admin-label">해시태그</div>
                            <input
                                className="admin-input-small"
                                placeholder="콤마로 구분 (예: PVC, 엘보, KS인증)"
                                value={newProduct.hashtags}
                                onChange={(e) => setNewProduct({ ...newProduct, hashtags: e.target.value })}
                            />
                        </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', marginTop: '40px' }}>
                        <button type="submit" className="apply-btn" style={{ padding: '15px 60px', fontSize: '1.1rem' }}>저장하기</button>
                        <button type="button" onClick={onClose} style={{ padding: '15px 60px', border: '1px solid #ddd', background: 'white', borderRadius: '4px', cursor: 'pointer' }}>취소</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AdminModal;
