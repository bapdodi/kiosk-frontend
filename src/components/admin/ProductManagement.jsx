import { useEffect, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { getImageUrl } from '../../utils/imageUtils';
import BulkImageMatchModal from './BulkImageMatchModal';

const ProductManagement = () => {
    const navigate = useNavigate();
    const {
        products, setProducts,
        mainCategories, setMainCategories,
        subCategories, setSubCategories
    } = useOutletContext();
    const [adminActiveMainCat, setAdminActiveMainCat] = useState(() => sessionStorage.getItem('adminMainCat') || null);
    const [adminActiveSubCat, setAdminActiveSubCat] = useState(() => sessionStorage.getItem('adminSubCat') || 'all');
    const [adminSearchQuery, setAdminSearchQuery] = useState(() => sessionStorage.getItem('adminSearch') || '');
    const [selectedProducts, setSelectedProducts] = useState([]);
    const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
    const [editingCatId, setEditingCatId] = useState(null);
    const [tempMainCat, setTempMainCat] = useState('');
    const [tempSubCat, setTempSubCat] = useState('');

    const FALLBACK_IMAGE = '/no-image.png';

    useEffect(() => {
        // Persist filter states
        sessionStorage.setItem('adminMainCat', adminActiveMainCat || '');
        sessionStorage.setItem('adminSubCat', adminActiveSubCat || '');
        sessionStorage.setItem('adminSearch', adminSearchQuery || '');
    }, [adminActiveMainCat, adminActiveSubCat, adminSearchQuery]);

    useEffect(() => {
        // Restore scroll position
        const savedScroll = sessionStorage.getItem('adminScrollPos');
        if (savedScroll && products.length > 0) {
            // Use a small timeout to ensure the list is rendered
            const timer = setTimeout(() => {
                window.scrollTo(0, parseInt(savedScroll));
                sessionStorage.removeItem('adminScrollPos');
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [products.length]);

    const handleEditNavigate = (productId) => {
        sessionStorage.setItem('adminScrollPos', window.scrollY.toString());
        navigate(`/admin/products/edit/${productId}`);
    };

    const startEditingCategory = (product) => {
        setEditingCatId(product.id);
        setTempMainCat(product.mainCategory);
        setTempSubCat(product.subCategory || '');
    };

    const saveCategoryUpdate = async (product) => {
        try {
            const res = await fetch(`/api/products/admin/${product.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...product,
                    mainCategory: tempMainCat,
                    subCategory: tempSubCat
                })
            });
            if (res.ok) {
                const updated = await res.json();
                setProducts(products.map(p => p.id === updated.id ? updated : p));
                setEditingCatId(null);
            } else {
                alert('저장에 실패했습니다.');
            }
        } catch (err) {
            alert('오류가 발생했습니다.');
        }
    };

    const deleteProduct = async (id) => {
        if (!window.confirm('정말 삭제하시겠습니까?')) return;
        try {
            const res = await fetch(`/api/products/admin/${id}`, { method: 'DELETE' });
            if (res.ok) {
                setProducts(products.filter(p => p.id !== id));
                setSelectedProducts(selectedProducts.filter(selId => selId !== id));
            }
        } catch (err) {
            alert('삭제 중 오류가 발생했습니다.');
        }
    };

    const syncWithErp = async () => {
        if (!window.confirm('ERP 시스템의 최신 상품 정보를 가져오시겠습니까?')) return;
        try {
            const res = await fetch('/api/sync/erp', { method: 'POST' });
            if (res.ok) {
                const updatedProducts = await res.json();
                const allRes = await fetch('/api/products');
                if (allRes.ok) {
                    setProducts(await allRes.json());
                    alert('ERP 동기화가 완료되어 목록을 갱신했습니다.');
                }
            } else {
                alert('동기화 실패: ' + (await res.text()));
            }
        } catch (err) {
            alert('네트워크 오류');
        }
    };

    const deleteSelectedProducts = async () => {
        if (selectedProducts.length === 0) return alert('삭제할 상품을 선택해주세요.');
        if (!window.confirm(`선택한 ${selectedProducts.length}개의 상품을 정말 삭제하시겠습니까?`)) return;

        try {
            const res = await fetch('/api/products/admin/bulk-delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(selectedProducts)
            });

            if (res.ok) {
                setProducts(products.filter(p => !selectedProducts.includes(p.id)));
                setSelectedProducts([]);
                alert('선택한 상품들이 삭제되었습니다.');
            } else {
                alert('삭제 중 오류가 발생했습니다.');
            }
        } catch (err) {
            alert('삭제 중 오류가 발생했습니다.');
        }
    };

    const refreshProducts = async () => {
        const res = await fetch('/api/products');
        if (res.ok) {
            setProducts(await res.json());
        }
    };

    const filteredProducts = products.filter(p => {
        const matchesMain = adminActiveMainCat ? p.mainCategory === adminActiveMainCat : true;
        const matchesSub = adminActiveSubCat === 'all' ? true : p.subCategory === adminActiveSubCat;
        const matchesSearch = p.name.toLowerCase().includes(adminSearchQuery.toLowerCase()) ||
            (p.hashtags && p.hashtags.some(tag => tag.toLowerCase().includes(adminSearchQuery.toLowerCase())));
        return matchesMain && matchesSub && matchesSearch;
    });

    return (
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
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button className="apply-btn" style={{ background: '#3b82f6' }} onClick={() => setIsBulkModalOpen(true)}>
                            📸 이미지 일괄 매칭
                        </button>
                        <button className="apply-btn" style={{ background: '#2563eb' }} onClick={syncWithErp}>
                            🔄 ERP 상품 동기화
                        </button>
                        {selectedProducts.length > 0 && (
                            <button className="apply-btn" style={{ background: '#ef4444' }} onClick={deleteSelectedProducts}>
                                🗑️ 선택 삭제 ({selectedProducts.length})
                            </button>
                        )}
                        <button className="apply-btn" onClick={() => {
                            sessionStorage.setItem('adminScrollPos', window.scrollY.toString());
                            navigate('/admin/products/new');
                        }}>
                            ＋ 새로운 상품 등록
                        </button>
                    </div>
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
            </div>

            <div className="admin-card">
                <table className="admin-table">
                    <thead>
                        <tr>
                            <th style={{ width: '40px', textAlign: 'center' }}>
                                <input
                                    type="checkbox"
                                    onChange={(e) => {
                                        if (e.target.checked) setSelectedProducts(filteredProducts.map(p => p.id));
                                        else setSelectedProducts([]);
                                    }}
                                    checked={filteredProducts.length > 0 && selectedProducts.length === filteredProducts.length}
                                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                                />
                            </th>
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
                                <td style={{ textAlign: 'center' }}>
                                    <input
                                        type="checkbox"
                                        checked={selectedProducts.includes(p.id)}
                                        onChange={(e) => {
                                            if (e.target.checked) setSelectedProducts([...selectedProducts, p.id]);
                                            else setSelectedProducts(selectedProducts.filter(id => id !== p.id));
                                        }}
                                        style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                                    />
                                </td>
                                <td>
                                    {p.images && p.images.length > 0 ? (
                                        <img
                                            src={getImageUrl(p.images[0])}
                                            className="product-thumb"
                                            alt={p.name}
                                        />
                                    ) : (
                                        <div className="no-image-placeholder" style={{ width: '60px', height: '60px', fontSize: '0.6rem' }}>
                                            이미지 준비중
                                        </div>
                                    )}
                                </td>
                                <td>
                                    <div style={{ fontWeight: 700, marginBottom: '6px' }}>
                                        {p.name}
                                        {p.erpCode && <span style={{ marginLeft: '8px', fontSize: '0.75rem', color: '#64748b', fontWeight: 400 }}>[{p.erpCode}]</span>}
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                        {p.hashtags?.map(tag => <span key={tag} className="tag-badge">{tag}</span>)}
                                    </div>
                                </td>
                                <td>
                                    {editingCatId === p.id ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                            <select
                                                className="form-select"
                                                style={{ padding: '4px', fontSize: '0.8rem' }}
                                                value={tempMainCat}
                                                onChange={(e) => {
                                                    const mId = e.target.value;
                                                    setTempMainCat(mId);
                                                    setTempSubCat(subCategories[mId]?.[0]?.id || '');
                                                }}
                                            >
                                                {mainCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                            </select>
                                            <select
                                                className="form-select"
                                                style={{ padding: '4px', fontSize: '0.8rem' }}
                                                value={tempSubCat}
                                                onChange={(e) => setTempSubCat(e.target.value)}
                                            >
                                                <option value="">중분류 없음</option>
                                                {subCategories[tempMainCat]?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                            </select>
                                            <div style={{ display: 'flex', gap: '4px' }}>
                                                <button
                                                    onClick={() => saveCategoryUpdate(p)}
                                                    style={{ padding: '2px 8px', fontSize: '0.7rem', background: '#1e293b', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                                >
                                                    저장
                                                </button>
                                                <button
                                                    onClick={() => setEditingCatId(null)}
                                                    style={{ padding: '2px 8px', fontSize: '0.7rem', background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                                >
                                                    취소
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="cat-display-cell" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '2px' }}>
                                                <span className="tag-badge" style={{ background: '#e0f2fe', color: '#0369a1' }}>
                                                    {mainCategories.find(c => c.id === p.mainCategory)?.name || p.mainCategory}
                                                </span>
                                                {p.subCategory && (
                                                    <>
                                                        <span style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '0 5px' }}>›</span>
                                                        <span className="tag-badge" style={{ background: '#f0fdf4', color: '#15803d' }}>
                                                            {subCategories[p.mainCategory]?.find(s => s.id === p.subCategory)?.name || p.subCategory}
                                                        </span>
                                                    </>
                                                )}
                                            </div>
                                            <button
                                                className="mini-edit-btn"
                                                onClick={() => startEditingCategory(p)}
                                                title="카테고리 수정"
                                            >
                                                ✏️
                                            </button>
                                        </div>
                                    )}
                                </td>
                                <td>
                                    <div style={{ fontWeight: 800, color: '#1e293b' }}>
                                        {p.price.toLocaleString()}원
                                    </div>
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                        <button className="action-btn" onClick={() => handleEditNavigate(p.id)}>수정</button>
                                        <button className="action-btn" style={{ color: '#ef4444' }} onClick={() => deleteProduct(p.id)}>삭제</button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {filteredProducts.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '100px 0', color: '#94a3b8' }}>
                        검색 결과가 없습니다.
                    </div>
                )}
            </div>

            <BulkImageMatchModal
                isOpen={isBulkModalOpen}
                onClose={() => setIsBulkModalOpen(false)}
                products={products}
                onUpdateSuccess={refreshProducts}
            />
        </div>
    );
};

export default ProductManagement;
