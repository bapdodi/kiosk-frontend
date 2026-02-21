import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const AdminPage = ({
    products,
    setProducts,
    mainCategories,
    setMainCategories,
    subCategories,
    setSubCategories,
    detailCategories,
    setDetailCategories,
    orders,
    setOrders
}) => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('productList');
    const [editingProduct, setEditingProduct] = useState(null);
    const [adminActiveMainCat, setAdminActiveMainCat] = useState(mainCategories[0]?.id || null);
    const [adminActiveSubCat, setAdminActiveSubCat] = useState('all');
    const [adminActiveDetailCat, setAdminActiveDetailCat] = useState('all');
    const [adminSearchQuery, setAdminSearchQuery] = useState('');
    const [catSearchQuery, setCatSearchQuery] = useState('');
    const [catViewMode, setCatViewMode] = useState('grid'); // 'grid' or 'tabs'
    const [selectedCatId, setSelectedCatId] = useState(null);
    const [selectedOrder, setSelectedOrder] = useState(null);

    const FALLBACK_IMAGE = '/no-image.png';

    const [newProduct, setNewProduct] = useState({
        name: '',
        description: '',
        mainCategory: mainCategories[0]?.id || '',
        subCategory: subCategories[mainCategories[0]?.id]?.[0]?.id || '',
        detailCategory: detailCategories[subCategories[mainCategories[0]?.id]?.[0]?.id]?.[0]?.id || '',
        price: 0,
        hashtags: '',
        image: FALLBACK_IMAGE
    });
    const [optionGroups, setOptionGroups] = useState([]);
    const [combinations, setCombinations] = useState([]);

    const handleAddProduct = async (e) => {
        e.preventDefault();
        const productData = {
            ...newProduct,
            price: parseInt(newProduct.price || 0),
            hashtags: typeof newProduct.hashtags === 'string'
                ? newProduct.hashtags.split(',').map(tag => {
                    const t = tag.trim();
                    return t.startsWith('#') ? t : `#${t}`;
                }).filter(t => t !== '#')
                : newProduct.hashtags,
            isComplexOptions: combinations.length > 0,
            optionGroups: optionGroups.filter(g => g.name.trim() && g.values.trim()).map(g => ({
                name: g.name.trim(),
                values: g.values.split(',').map(v => v.trim()).filter(v => v)
            })),
            combinations: combinations
        };

        const method = editingProduct ? 'PUT' : 'POST';
        const url = editingProduct ? `/api/products/admin/${editingProduct.id}` : '/api/products/admin';

        try {
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(productData)
            });
            if (res.ok) {
                const savedProduct = await res.json();
                if (editingProduct) {
                    setProducts(products.map(p => p.id === savedProduct.id ? savedProduct : p));
                } else {
                    setProducts([...products, savedProduct]);
                }
                setEditingProduct(null);
                setActiveTab('productList');
                resetProductForm();
            }
        } catch (err) {
            alert('상품 저장 중 오류가 발생했습니다.');
        }
    };

    const resetProductForm = () => {
        setNewProduct({
            name: '',
            description: '',
            mainCategory: mainCategories[0]?.id || '',
            subCategory: subCategories[mainCategories[0]?.id]?.[0]?.id || '',
            detailCategory: detailCategories[subCategories[mainCategories[0]?.id]?.[0]?.id]?.[0]?.id || '',
            price: 0,
            hashtags: '',
            image: FALLBACK_IMAGE
        });
        setOptionGroups([]);
        setCombinations([]);
    };

    const startEditProduct = (product) => {
        setEditingProduct(product);
        setNewProduct({
            ...product,
            detailCategory: product.detailCategory,
            hashtags: product.hashtags ? product.hashtags.join(', ') : '',
        });
        setCombinations(product.combinations || []);
        setOptionGroups(product.optionGroups?.map(g => ({
            name: g.name,
            values: g.values ? g.values.join(', ') : ''
        })) || []);
        setActiveTab('addProduct');
    };

    const deleteProduct = async (id) => {
        if (!window.confirm('정말 삭제하시겠습니까?')) return;
        try {
            const res = await fetch(`/api/products/admin/${id}`, { method: 'DELETE' });
            if (res.ok) {
                setProducts(products.filter(p => p.id !== id));
            }
        } catch (err) {
            alert('삭제 중 오류가 발생했습니다.');
        }
    };

    const addMainCategory = async () => {
        const name = prompt('새 대분류 이름을 입력하세요:');
        if (!name) return;
        const id = 'cat_' + Date.now();
        const catData = { id, name, level: 'main' };
        try {
            const res = await fetch('/api/categories/admin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(catData)
            });
            if (res.ok) {
                const saved = await res.json();
                setMainCategories([...mainCategories, saved]);
                setSubCategories({ ...subCategories, [saved.id]: [] });
            }
        } catch (err) { alert('오류 발생'); }
    };

    const deleteMainCategory = async (id) => {
        if (!window.confirm('해당 대분류가 삭제됩니다.')) return;
        try {
            const res = await fetch(`/api/categories/admin/${id}`, { method: 'DELETE' });
            if (res.ok) {
                setMainCategories(mainCategories.filter(c => c.id !== id));
            }
        } catch (err) { alert('오류 발생'); }
    };

    const addSubCategory = async (mainId) => {
        const name = prompt('새 중분류 이름을 입력하세요:');
        if (!name) return;
        const id = 'sub_' + Date.now();
        const catData = { id, name, parentId: mainId, level: 'sub' };
        try {
            const res = await fetch('/api/categories/admin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(catData)
            });
            if (res.ok) {
                const saved = await res.json();
                setSubCategories({
                    ...subCategories,
                    [mainId]: [...(subCategories[mainId] || []), saved]
                });
                setDetailCategories({ ...detailCategories, [saved.id]: [] });
            }
        } catch (err) { alert('오류 발생'); }
    };

    const deleteSubCategory = async (mainId, subId) => {
        try {
            const res = await fetch(`/api/categories/admin/${subId}`, { method: 'DELETE' });
            if (res.ok) {
                setSubCategories({
                    ...subCategories,
                    [mainId]: subCategories[mainId].filter(s => s.id !== subId)
                });
            }
        } catch (err) { alert('오류 발생'); }
    };

    const addDetailCategory = async (subId) => {
        const name = prompt('새 소분류 이름을 입력하세요:');
        if (!name) return;
        const id = 'det_' + Date.now();
        const catData = { id, name, parentId: subId, level: 'detail' };
        try {
            const res = await fetch('/api/categories/admin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(catData)
            });
            if (res.ok) {
                const saved = await res.json();
                setDetailCategories({
                    ...detailCategories,
                    [subId]: [...(detailCategories[subId] || []), saved]
                });
            }
        } catch (err) { alert('오류 발생'); }
    };

    const deleteDetailCategory = async (subId, detId) => {
        try {
            const res = await fetch(`/api/categories/admin/${detId}`, { method: 'DELETE' });
            if (res.ok) {
                setDetailCategories({
                    ...detailCategories,
                    [subId]: detailCategories[subId].filter(d => d.id !== detId)
                });
            }
        } catch (err) { alert('오류 발생'); }
    };

    const filteredProducts = products.filter(p => {
        const matchesMain = adminActiveMainCat ? p.mainCategory === adminActiveMainCat : true;
        const matchesSub = adminActiveSubCat === 'all' ? true : p.subCategory === adminActiveSubCat;
        const matchesDetail = adminActiveDetailCat === 'all' ? true : p.detailCategory === adminActiveDetailCat;
        const matchesSearch = p.name.toLowerCase().includes(adminSearchQuery.toLowerCase()) ||
            (p.hashtags && p.hashtags.some(tag => tag.toLowerCase().includes(adminSearchQuery.toLowerCase())));
        return matchesMain && matchesSub && matchesDetail && matchesSearch;
    });

    const renderProductList = () => (
        <div className="fade-in">
            <div className="admin-header-title">
                <h2 style={{ fontSize: '1.8rem', fontWeight: 800 }}>📦 상품 통합 관리</h2>
                <div style={{ display: 'flex', gap: '15px' }}>
                    <div className="search-container" style={{ margin: 0, flex: '0 0 300px' }}>
                        <input
                            className="search-input"
                            placeholder="상품명 또는 해시태그 검색..."
                            value={adminSearchQuery}
                            onChange={(e) => setAdminSearchQuery(e.target.value)}
                            style={{ padding: '10px 15px 10px 40px' }}
                        />
                        <span className="search-icon" style={{ left: '15px' }}>🔍</span>
                    </div>
                    <button className="apply-btn" onClick={() => { resetProductForm(); setActiveTab('addProduct'); }}>
                        ＋ 새로운 상품 등록
                    </button>
                </div>
            </div>

            <div style={{ marginBottom: '25px' }}>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', overflowX: 'auto', paddingBottom: '5px' }}>
                    {mainCategories.map(cat => (
                        <button
                            key={cat.id}
                            className={`action-btn ${adminActiveMainCat === cat.id ? 'active' : ''}`}
                            onClick={() => {
                                setAdminActiveMainCat(cat.id);
                                setAdminActiveSubCat('all');
                                setAdminActiveDetailCat('all');
                            }}
                            style={{
                                borderRadius: '100px',
                                padding: '8px 18px',
                                background: adminActiveMainCat === cat.id ? 'var(--admin-primary)' : '#f1f5f9',
                                color: adminActiveMainCat === cat.id ? 'white' : '#64748b',
                                border: 'none',
                                fontWeight: 600,
                                fontSize: '0.9rem'
                            }}
                        >
                            {cat.name}
                        </button>
                    ))}
                </div>

                {adminActiveMainCat && subCategories[adminActiveMainCat] && (
                    <div style={{ display: 'flex', gap: '6px', marginBottom: '10px', flexWrap: 'wrap' }}>
                        <button
                            className={`sub-cat-btn ${adminActiveSubCat === 'all' ? 'active' : ''}`}
                            onClick={() => {
                                setAdminActiveSubCat('all');
                                setAdminActiveDetailCat('all');
                            }}
                            style={{
                                padding: '5px 12px',
                                borderRadius: '8px',
                                fontSize: '0.8rem',
                                background: adminActiveSubCat === 'all' ? '#1e293b' : 'white',
                                color: adminActiveSubCat === 'all' ? 'white' : '#64748b',
                                border: '1px solid #e2e8f0',
                                cursor: 'pointer'
                            }}
                        >
                            전체 중분류
                        </button>
                        {subCategories[adminActiveMainCat].map(sub => (
                            <button
                                key={sub.id}
                                className={`sub-cat-btn ${adminActiveSubCat === sub.id ? 'active' : ''}`}
                                onClick={() => {
                                    setAdminActiveSubCat(sub.id);
                                    setAdminActiveDetailCat('all');
                                }}
                                style={{
                                    padding: '5px 12px',
                                    borderRadius: '8px',
                                    fontSize: '0.8rem',
                                    background: adminActiveSubCat === sub.id ? '#1e293b' : 'white',
                                    color: adminActiveSubCat === sub.id ? 'white' : '#64748b',
                                    border: '1px solid #e2e8f0',
                                    cursor: 'pointer'
                                }}
                            >
                                {sub.name}
                            </button>
                        ))}
                    </div>
                )}

                {adminActiveSubCat !== 'all' && detailCategories[adminActiveSubCat] && (
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        <button
                            onClick={() => setAdminActiveDetailCat('all')}
                            style={{
                                padding: '4px 10px',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                background: adminActiveDetailCat === 'all' ? '#64748b' : 'white',
                                color: adminActiveDetailCat === 'all' ? 'white' : '#94a3b8',
                                border: '1px solid #f1f5f9',
                                cursor: 'pointer'
                            }}
                        >
                            전체 소분류
                        </button>
                        {detailCategories[adminActiveSubCat].map(det => (
                            <button
                                key={det.id}
                                onClick={() => setAdminActiveDetailCat(det.id)}
                                style={{
                                    padding: '4px 10px',
                                    borderRadius: '6px',
                                    fontSize: '0.75rem',
                                    background: adminActiveDetailCat === det.id ? '#64748b' : 'white',
                                    color: adminActiveDetailCat === det.id ? 'white' : '#94a3b8',
                                    border: '1px solid #f1f5f9',
                                    cursor: 'pointer'
                                }}
                            >
                                {det.name}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <div className="admin-card">
                <table className="admin-table">
                    <thead>
                        <tr>
                            <th style={{ width: '80px' }}>이미지</th>
                            <th>상품 정보</th>
                            <th>카테고리</th>
                            <th>기본 판매가</th>
                            <th style={{ textAlign: 'right' }}>관리</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredProducts.map(p => (
                            <tr key={p.id}>
                                <td>
                                    {p.image && p.image !== '/no-image.png' ? (
                                        <img
                                            src={p.image}
                                            className="product-thumb"
                                            onError={(e) => {
                                                e.target.style.display = 'none';
                                                const parent = e.target.parentNode;
                                                const placeholder = document.createElement('div');
                                                placeholder.className = 'no-image-placeholder';
                                                placeholder.style.width = '60px';
                                                placeholder.style.height = '60px';
                                                placeholder.style.fontSize = '0.6rem';
                                                placeholder.innerText = '이미지 준비중';
                                                parent.appendChild(placeholder);
                                            }}
                                        />
                                    ) : (
                                        <div className="no-image-placeholder" style={{ width: '60px', height: '60px', fontSize: '0.6rem' }}>
                                            이미지 준비중
                                        </div>
                                    )}
                                </td>
                                <td>
                                    <div style={{ fontWeight: 700, marginBottom: '6px' }}>{p.name}</div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                        {p.hashtags.map(tag => <span key={tag} className="tag-badge">{tag}</span>)}
                                    </div>
                                </td>
                                <td>
                                    <span className="tag-badge" style={{ background: '#e0f2fe', color: '#0369a1' }}>
                                        {mainCategories.find(c => c.id === p.mainCategory)?.name || p.mainCategory}
                                    </span>
                                    <span style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '0 5px' }}>›</span>
                                    <span className="tag-badge" style={{ background: '#f0fdf4', color: '#15803d' }}>
                                        {subCategories[p.mainCategory]?.find(s => s.id === p.subCategory)?.name || p.subCategory}
                                    </span>
                                    {p.detailCategory && (
                                        <>
                                            <span style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '0 5px' }}>›</span>
                                            <span className="tag-badge" style={{ background: '#fff7ed', color: '#c2410c' }}>
                                                {detailCategories[p.subCategory]?.find(d => d.id === p.detailCategory)?.name || p.detailCategory}
                                            </span>
                                        </>
                                    )}
                                </td>
                                <td style={{ fontWeight: 800 }}>₩{p.price.toLocaleString()}</td>
                                <td style={{ textAlign: 'right' }}>
                                    <button className="action-btn edit" onClick={() => startEditProduct(p)}>수정</button>
                                    <button className="action-btn delete" onClick={() => deleteProduct(p.id)}>삭제</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {filteredProducts.length === 0 && (
                    <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>등록된 상품이 없습니다.</div>
                )}
            </div>
        </div>
    );

    const renderProductForm = () => (
        <div className="fade-in" style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div className="admin-header-title">
                <h2 style={{ fontSize: '1.8rem', fontWeight: 800 }}>{editingProduct ? '✏️ 상품 정보 수정' : '🆕 신규 상품 등록'}</h2>
                <button className="action-btn" onClick={() => { setEditingProduct(null); setActiveTab('productList'); }}>뒤로 가기</button>
            </div>

            <form onSubmit={handleAddProduct}>
                <div className="admin-section">
                    <div className="admin-section-header">📁 카테고리 설정</div>
                    <div className="admin-section-body">
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px' }}>
                            <div>
                                <label className="admin-label">대분류</label>
                                <select className="admin-input-small" value={newProduct.mainCategory} onChange={(e) => {
                                    const mId = e.target.value;
                                    const sId = subCategories[mId]?.[0]?.id;
                                    setNewProduct({
                                        ...newProduct,
                                        mainCategory: mId,
                                        subCategory: sId,
                                        detailCategory: sId ? detailCategories[sId]?.[0]?.id : null
                                    });
                                }}>
                                    {mainCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="admin-label">중분류</label>
                                <select className="admin-input-small" value={newProduct.subCategory} onChange={(e) => {
                                    const sId = e.target.value;
                                    setNewProduct({
                                        ...newProduct,
                                        subCategory: sId,
                                        detailCategory: detailCategories[sId]?.[0]?.id
                                    });
                                }}>
                                    {subCategories[newProduct.mainCategory]?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="admin-label">소분류</label>
                                <select className="admin-input-small" value={newProduct.detailCategory} onChange={(e) => setNewProduct({ ...newProduct, detailCategory: e.target.value })}>
                                    {(detailCategories[newProduct.subCategory] || []).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="admin-section">
                    <div className="admin-section-header">📦 기본 정보</div>
                    <div className="admin-section-body">
                        <div style={{ marginBottom: '20px' }}>
                            <label className="admin-label">상품명</label>
                            <input className="admin-input-small" required placeholder="고객에게 보여질 상품명을 입력하세요" value={newProduct.name} onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })} />
                        </div>

                        <div style={{ marginBottom: '20px' }}>
                            <label className="admin-label">상품 설명</label>
                            <textarea
                                className="admin-input-small"
                                style={{ height: '100px', resize: 'vertical', paddingTop: '10px' }}
                                placeholder="상품에 대한 상세 설명을 입력하세요 (키오스크 상세페이지에 노출)"
                                value={newProduct.description}
                                onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                            />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                            <div>
                                <label className="admin-label">판매가 (원)</label>
                                <input type="number" className="admin-input-small" required value={newProduct.price} onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })} />
                            </div>
                            <div>
                                <label className="admin-label">해시태그</label>
                                <input className="admin-input-small" placeholder="콤마(,)로 구분 예: 배관, PVC" value={newProduct.hashtags} onChange={(e) => setNewProduct({ ...newProduct, hashtags: e.target.value })} />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="admin-section">
                    <div className="admin-section-header">⚙️ 옵션 및 조합 설정</div>
                    <div className="admin-section-body">
                        <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                <span style={{ fontWeight: 700, color: '#475569' }}>옵션 그룹 생성</span>
                                <button type="button" className="apply-btn" style={{ background: '#1e293b', padding: '8px 16px' }} onClick={() => setOptionGroups([...optionGroups, { name: '', values: '' }])}>＋ 옵션 항목 추가</button>
                            </div>
                            {optionGroups.map((group, idx) => (
                                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '150px 1fr 40px', gap: '15px', marginBottom: '15px', alignItems: 'center' }}>
                                    <input className="admin-input-small" placeholder="옵션명" value={group.name} onChange={(e) => {
                                        const updated = [...optionGroups]; updated[idx].name = e.target.value; setOptionGroups(updated);
                                    }} />
                                    <input className="admin-input-small" placeholder="옵션값 (콤마 구분)" value={group.values} onChange={(e) => {
                                        const updated = [...optionGroups]; updated[idx].values = e.target.value; setOptionGroups(updated);
                                    }} />
                                    <button type="button" onClick={() => setOptionGroups(optionGroups.filter((_, i) => i !== idx))} style={{ color: '#ef4444', border: 'none', background: 'none', fontSize: '1.2rem', cursor: 'pointer' }}>×</button>
                                </div>
                            ))}
                            {optionGroups.length > 0 && <button type="button" className="apply-btn" style={{ width: '100%', marginTop: '10px' }} onClick={() => {
                                const validGroups = optionGroups.filter(g => g.name.trim() && g.values.trim());
                                if (validGroups.length === 0) return alert('내용을 입력해주세요.');
                                const groupValues = validGroups.map(g => g.values.split(',').map(v => v.trim()).filter(v => v));
                                const cartesian = (...a) => a.reduce((a, b) => a.flatMap(d => b.map(e => [d, e].flat())));
                                const results = groupValues.length > 1 ? cartesian(...groupValues) : groupValues[0].map(v => [v]);
                                setCombinations(results.map((res, i) => ({ id: `c-${i}`, name: Array.isArray(res) ? res.join(' / ') : res, price: 0 })));
                            }}>모든 조합 생성하기</button>}
                        </div>
                        {combinations.length > 0 && (
                            <div style={{ marginTop: '20px' }}>
                                <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '10px', paddingLeft: '5px' }}>
                                    💡 <b>추가금액</b>은 기본 판매가에 더해질 금액을 의미합니다. (예: +500)
                                </div>
                                <table className="admin-table">
                                    <thead><tr><th>선택 옵션명</th><th>추가금액 (원)</th></tr></thead>
                                    <tbody>
                                        {combinations.map((c, i) => (
                                            <tr key={i}>
                                                <td style={{ fontWeight: 600 }}>{c.name}</td>
                                                <td><input type="number" className="admin-input-small" style={{ width: '140px' }} placeholder="0" value={c.price} onChange={(e) => {
                                                    const updated = [...combinations]; updated[i].price = parseInt(e.target.value || 0); setCombinations(updated);
                                                }} /></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
                    <button type="submit" className="apply-btn" style={{ padding: '18px 80px', fontSize: '1.2rem', borderRadius: '14px', boxShadow: '0 10px 15px -3px rgba(0, 199, 60, 0.3)' }}>
                        {editingProduct ? '✅ 수정 내용 저장하기' : '💾 상품 등록 완료'}
                    </button>
                </div>
            </form>
        </div>
    );

    const renderCategoryManage = () => {
        const filteredCats = mainCategories.filter(c =>
            c.name.toLowerCase().includes(catSearchQuery.toLowerCase())
        );

        const currentCat = selectedCatId ? mainCategories.find(c => c.id === selectedCatId) : mainCategories[0];

        return (
            <div className="fade-in">
                <div className="admin-header-title">
                    <h2 style={{ fontSize: '1.8rem', fontWeight: 800 }}>📁 카테고리 구조 설정</h2>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <div className="search-container" style={{ margin: 0, flex: '0 0 250px' }}>
                            <input
                                className="search-input"
                                placeholder="카테고리 검색..."
                                value={catSearchQuery}
                                onChange={(e) => setCatSearchQuery(e.target.value)}
                                style={{ padding: '10px 15px 10px 40px' }}
                            />
                            <span className="search-icon" style={{ left: '15px' }}>🔍</span>
                        </div>
                        <button className="apply-btn" onClick={addMainCategory}>＋ 대분류 추가</button>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', marginBottom: '25px', borderBottom: '1px solid #e2e8f0', paddingBottom: '15px' }}>
                    <button
                        className={`action-btn ${catViewMode === 'grid' ? 'active' : ''}`}
                        onClick={() => setCatViewMode('grid')}
                        style={{ background: catViewMode === 'grid' ? 'var(--admin-primary)' : 'white', color: catViewMode === 'grid' ? 'white' : 'inherit' }}
                    >
                        전체 그리드 보기
                    </button>
                    <button
                        className={`action-btn ${catViewMode === 'tabs' ? 'active' : ''}`}
                        onClick={() => {
                            setCatViewMode('tabs');
                            if (!selectedCatId && filteredCats.length > 0) setSelectedCatId(filteredCats[0].id);
                        }}
                        style={{ background: catViewMode === 'tabs' ? 'var(--admin-primary)' : 'white', color: catViewMode === 'tabs' ? 'white' : 'inherit' }}
                    >
                        탭 방식으로 보기
                    </button>
                </div>

                {catViewMode === 'tabs' && (
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', overflowX: 'auto', paddingBottom: '10px' }}>
                        {mainCategories.map(cat => (
                            <button
                                key={cat.id}
                                className={`category-tab ${selectedCatId === cat.id ? 'active' : ''}`}
                                onClick={() => setSelectedCatId(cat.id)}
                                style={{ fontSize: '0.9rem', padding: '8px 20px' }}
                            >
                                {cat.name}
                            </button>
                        ))}
                    </div>
                )}

                {catViewMode === 'grid' ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '24px' }}>
                        {filteredCats.map(main => (
                            <div key={main.id} className="category-card">
                                <div className="category-card-header">
                                    <div className="category-card-title">
                                        <span style={{ fontSize: '1.5rem' }}>📁</span>
                                        {main.name}
                                    </div>
                                    <button className="action-btn delete" onClick={() => deleteMainCategory(main.id)}>삭제</button>
                                </div>

                                <div className="sub-category-list">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                        <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>중분류 & 소분류</span>
                                        <button
                                            className="apply-btn"
                                            style={{ padding: '4px 12px', fontSize: '0.75rem', borderRadius: '6px', background: '#334155' }}
                                            onClick={() => addSubCategory(main.id)}
                                        >
                                            ＋ 중분류 추가
                                        </button>
                                    </div>

                                    {subCategories[main.id]?.map(sub => (
                                        <div key={sub.id} className="sub-category-item">
                                            <div className="sub-category-header">
                                                <div className="sub-category-name">
                                                    <span style={{ color: 'var(--admin-primary)', marginRight: '6px' }}>•</span>
                                                    {sub.name}
                                                </div>
                                                <button
                                                    onClick={() => deleteSubCategory(main.id, sub.id)}
                                                    style={{ background: 'none', border: 'none', color: '#cbd5e1', cursor: 'pointer', fontSize: '1.1rem' }}
                                                    onMouseEnter={(e) => e.target.style.color = '#ff4444'}
                                                    onMouseLeave={(e) => e.target.style.color = '#cbd5e1'}
                                                >
                                                    ×
                                                </button>
                                            </div>

                                            <div className="detail-category-wrap">
                                                {detailCategories[sub.id]?.map(det => (
                                                    <div key={det.id} className="detail-chip">
                                                        {det.name}
                                                        <span className="detail-delete" onClick={() => deleteDetailCategory(sub.id, det.id)}>×</span>
                                                    </div>
                                                ))}
                                                <button className="add-detail-btn" onClick={() => addDetailCategory(sub.id)}>
                                                    + 소분류
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    {(!subCategories[main.id] || subCategories[main.id].length === 0) && (
                                        <div style={{ textAlign: 'center', padding: '20px', color: '#94a3b8', fontSize: '0.85rem', fontStyle: 'italic' }}>
                                            등록된 중분류가 없습니다.
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                        {filteredCats.length === 0 && <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '50px', color: '#94a3b8', background: '#f8fafc', borderRadius: '20px', border: '2px dashed #e2e8f0' }}>검색 결과가 없습니다.</div>}
                    </div>
                ) : (
                    currentCat && (
                        <div className="category-card" style={{ maxWidth: '700px', margin: '0 auto', minHeight: '400px' }}>
                            <div className="category-card-header">
                                <div className="category-card-title" style={{ fontSize: '1.8rem' }}>
                                    <span style={{ fontSize: '2rem' }}>📁</span>
                                    {currentCat.name}
                                </div>
                                <button className="action-btn delete" onClick={() => deleteMainCategory(currentCat.id)}>대분류 삭제</button>
                            </div>

                            <div className="sub-category-list" style={{ padding: '24px', flex: 1 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                                    <h4 style={{ margin: 0, color: '#475569' }}>중분류 관리</h4>
                                    <button className="apply-btn" onClick={() => addSubCategory(currentCat.id)}>＋ 새로운 중분류 추가</button>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {subCategories[currentCat.id]?.map(sub => (
                                        <div key={sub.id} className="sub-category-item" style={{ padding: '16px' }}>
                                            <div className="sub-category-header" style={{ marginBottom: '12px' }}>
                                                <div className="sub-category-name" style={{ fontSize: '1.1rem' }}>
                                                    <span style={{ color: 'var(--admin-primary)', marginRight: '8px' }}>•</span>
                                                    {sub.name}
                                                </div>
                                                <button
                                                    className="action-btn delete"
                                                    style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                                                    onClick={() => deleteSubCategory(currentCat.id, sub.id)}
                                                >
                                                    삭제
                                                </button>
                                            </div>

                                            <div className="detail-category-wrap" style={{ paddingTop: '12px' }}>
                                                {detailCategories[sub.id]?.map(det => (
                                                    <div key={det.id} className="detail-chip" style={{ padding: '6px 14px', fontSize: '0.9rem' }}>
                                                        {det.name}
                                                        <span className="detail-delete" onClick={() => deleteDetailCategory(sub.id, det.id)}>×</span>
                                                    </div>
                                                ))}
                                                <button className="add-detail-btn" style={{ padding: '6px 14px', fontSize: '0.9rem' }} onClick={() => addDetailCategory(sub.id)}>
                                                    + 소분류 추가
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )
                )}
            </div>
        );
    };

    const deleteOrder = async (orderId) => {
        if (!window.confirm('주문 내역을 삭제하시겠습니까?')) return;
        try {
            const res = await fetch(`/api/orders/admin/${orderId}`, { method: 'DELETE' });
            if (res.ok) {
                setOrders(orders.filter(o => o.id !== orderId));
            }
        } catch (err) {
            alert('오류 발생');
        }
    };

    const updateOrderStatus = async (orderId, status) => {
        try {
            const res = await fetch(`/api/orders/admin/${orderId}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(status)
            });
            if (res.ok) {
                const updated = await res.json();
                setOrders(orders.map(o => o.id === orderId ? updated : o));
            }
        } catch (err) {
            alert('오류 발생');
        }
    };

    const renderOrderList = () => (
        <div className="fade-in">
            {/* Order Detail Modal */}
            {selectedOrder && (
                <div className="modal-overlay" style={{ zIndex: 1000 }} onClick={() => setSelectedOrder(null)}>
                    <div className="modal-content" style={{ maxWidth: '500px', width: '90%', padding: '0' }} onClick={e => e.stopPropagation()}>
                        <div style={{ padding: '20px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0 }}>주문 상세 정보</h3>
                            <button onClick={() => setSelectedOrder(null)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
                        </div>
                        <div style={{ padding: '20px' }}>
                            <div style={{ marginBottom: '20px', padding: '15px', background: '#f8fafc', borderRadius: '12px' }}>
                                <div style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '4px' }}>주문자: <span style={{ color: '#1e293b', fontWeight: 700 }}>{selectedOrder.customerName}</span></div>
                                <div style={{ fontSize: '0.9rem', color: '#64748b' }}>주문시간: <span style={{ color: '#1e293b' }}>{selectedOrder.timestamp}</span></div>
                            </div>
                            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                                <h4 style={{ marginBottom: '10px' }}>주문 상품 목록 ({selectedOrder.items.length})</h4>
                                {selectedOrder.items.map((item, idx) => (
                                    <div key={idx} style={{ padding: '10px 0', borderBottom: idx === selectedOrder.items.length - 1 ? 'none' : '1px solid #f1f5f9' }}>
                                        <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{item.name}</div>
                                        {item.selectedOption && <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>옵션: {item.selectedOption}</div>}
                                        <div style={{ fontSize: '0.9rem', textAlign: 'right', fontWeight: 700, marginTop: '4px' }}>₩{item.finalPrice.toLocaleString()}</div>
                                    </div>
                                ))}
                            </div>
                            <div style={{ marginTop: '20px', paddingTop: '15px', borderTop: '2px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontWeight: 700 }}>총 결제 금액</span>
                                <span style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--admin-primary)' }}>₩{selectedOrder.totalAmount.toLocaleString()}</span>
                            </div>
                        </div>
                        <div style={{ padding: '15px', textAlign: 'center' }}>
                            <button className="apply-btn" style={{ width: '100%' }} onClick={() => setSelectedOrder(null)}>닫기</button>
                        </div>
                    </div>
                </div>
            )}

            <div className="admin-header-title">
                <h2 style={{ fontSize: '1.8rem', fontWeight: 800 }}>🧾 실시간 주문 내역</h2>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <div style={{ background: '#f1f5f9', padding: '8px 20px', borderRadius: '12px', fontWeight: 700, color: '#475569' }}>
                        총 주문액: ₩{orders.reduce((sum, o) => sum + (o.status !== 'cancelled' ? o.totalAmount : 0), 0).toLocaleString()}
                    </div>
                </div>
            </div>

            <div className="admin-table-container">
                <table className="admin-table">
                    <thead>
                        <tr>
                            <th>주문 시간</th>
                            <th>주문자</th>
                            <th>주문 상품</th>
                            <th>결제 금액</th>
                            <th>상태</th>
                            <th style={{ textAlign: 'right' }}>관리</th>
                        </tr>
                    </thead>
                    <tbody>
                        {[...orders].reverse().map(order => (
                            <tr key={order.id}>
                                <td style={{ fontSize: '0.85rem', color: '#64748b' }}>{order.timestamp}</td>
                                <td style={{ fontWeight: 700 }}>{order.customerName}</td>
                                <td>
                                    <div style={{ fontSize: '0.9rem' }}>
                                        {order.items.length > 2 ? (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span>{order.items[0].name} 외 {order.items.length - 1}건</span>
                                                <button
                                                    onClick={() => setSelectedOrder(order)}
                                                    style={{ padding: '2px 8px', fontSize: '0.7rem', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer' }}
                                                >
                                                    상세보기
                                                </button>
                                            </div>
                                        ) : (
                                            order.items.map((item, idx) => (
                                                <div key={idx} style={{ marginBottom: '2px', color: '#334155' }}>
                                                    • {item.name} {item.selectedOption ? <span style={{ color: '#64748b', fontSize: '0.8rem' }}>({item.selectedOption})</span> : ''}
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </td>
                                <td style={{ fontWeight: 800 }}>₩{order.totalAmount.toLocaleString()}</td>
                                <td>
                                    <select
                                        className="admin-input-small"
                                        style={{ width: '100px', padding: '4px', fontSize: '0.8rem', background: order.status === 'completed' ? '#f0fdf4' : order.status === 'cancelled' ? '#fef2f2' : 'white' }}
                                        value={order.status}
                                        onChange={(e) => updateOrderStatus(order.id, e.target.value)}
                                    >
                                        <option value="pending">대기 중</option>
                                        <option value="completed">처리 완료</option>
                                        <option value="cancelled">주문 취소</option>
                                    </select>
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                    <button className="action-btn delete" onClick={() => deleteOrder(order.id)}>삭제</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {orders.length === 0 && (
                    <div style={{ padding: '80px', textAlign: 'center', color: '#94a3b8', fontSize: '1.1rem' }}>
                        📦 새로운 주문이 들어오기를 기다리고 있습니다.
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <div className="admin-page-container">
            <aside className="admin-sidebar">
                <div className="admin-sidebar-header">
                    <div style={{ color: 'white', fontSize: '0.7rem', opacity: 0.5, marginBottom: '5px', letterSpacing: '0.1em' }}>관리 서비스</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>매장 관리자</div>
                </div>
                <nav style={{ flex: 1, padding: '20px 0' }}>
                    <div className={`admin-nav-item ${activeTab === 'productList' || activeTab === 'addProduct' ? 'active' : ''}`} onClick={() => setActiveTab('productList')}>
                        <span>📦</span> 상품 통합 관리
                    </div>
                    <div className={`admin-nav-item ${activeTab === 'categoryManage' ? 'active' : ''}`} onClick={() => setActiveTab('categoryManage')}>
                        <span>📁</span> 카테고리 설정
                    </div>
                    <div className={`admin-nav-item ${activeTab === 'orderList' ? 'active' : ''}`} onClick={() => setActiveTab('orderList')}>
                        <span>🧾</span> 주문 내역 관리
                    </div>
                </nav>
            </aside>

            <main className="admin-content">
                <div style={{ position: 'absolute', top: '30px', right: '40px' }}>
                    <button className="back-to-kiosk" onClick={() => navigate('/')}>🏠 키오스크 화면으로 이동</button>
                </div>
                <div style={{ maxWidth: '1100px', margin: '60px auto 0 auto' }}>
                    {activeTab === 'productList' && renderProductList()}
                    {activeTab === 'addProduct' && renderProductForm()}
                    {activeTab === 'categoryManage' && renderCategoryManage()}
                    {activeTab === 'orderList' && renderOrderList()}
                </div>
            </main>
        </div>
    );
};

export default AdminPage;
