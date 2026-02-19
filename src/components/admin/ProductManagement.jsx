import { useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';

const ProductManagement = () => {
    const navigate = useNavigate();
    const { products, setProducts, mainCategories, subCategories, detailCategories } = useOutletContext();
    const [adminActiveMainCat, setAdminActiveMainCat] = useState(null);
    const [adminActiveSubCat, setAdminActiveSubCat] = useState('all');
    const [adminActiveDetailCat, setAdminActiveDetailCat] = useState('all');
    const [adminSearchQuery, setAdminSearchQuery] = useState('');

    // eslint-disable-next-line no-unused-vars
    const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1581094288338-2314dddb7bc3?w=500&auto=format&fit=crop&q=60';

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

    const filteredProducts = products.filter(p => {
        const matchesMain = adminActiveMainCat ? p.mainCategory === adminActiveMainCat : true;
        const matchesSub = adminActiveSubCat === 'all' ? true : p.subCategory === adminActiveSubCat;
        const matchesDetail = adminActiveDetailCat === 'all' ? true : p.detailCategory === adminActiveDetailCat;
        const matchesSearch = p.name.toLowerCase().includes(adminSearchQuery.toLowerCase()) ||
            (p.hashtags && p.hashtags.some(tag => tag.toLowerCase().includes(adminSearchQuery.toLowerCase())));
        return matchesMain && matchesSub && matchesDetail && matchesSearch;
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
                    <button className="apply-btn" onClick={() => navigate('/admin/products/new')}>
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
                                    <img
                                        src={p.images && p.images.length > 0 ? p.images[0] : FALLBACK_IMAGE}
                                        className="product-thumb"
                                        onError={(e) => {
                                            if (e.target.src !== FALLBACK_IMAGE) e.target.src = FALLBACK_IMAGE;
                                        }}
                                    />
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
                                    <button className="action-btn edit" onClick={() => navigate(`/admin/products/edit/${p.id}`)}>수정</button>
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
};

export default ProductManagement;
