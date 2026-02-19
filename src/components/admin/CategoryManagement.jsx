
import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';

const CategoryManagement = () => {
    const {
        mainCategories, setMainCategories,
        subCategories, setSubCategories,
        detailCategories, setDetailCategories
    } = useOutletContext();

    const [catModal, setCatModal] = useState({
        isOpen: false,
        title: '',
        value: '',
        type: '', // 'main', 'sub', 'detail'
        parentId: null
    });

    const [catSearchQuery, setCatSearchQuery] = useState('');
    const [catViewMode, setCatViewMode] = useState('grid');
    const [selectedCatId, setSelectedCatId] = useState(null);

    const openCatModal = (type, parentId = null) => {
        let title = '';
        if (type === 'main') title = '신규 대분류 등록';
        else if (type === 'sub') title = '신규 중분류 등록';
        else title = '신규 소분류 등록';

        setCatModal({
            isOpen: true,
            title,
            value: '',
            type,
            parentId
        });
    };

    const handleModalSubmit = async () => {
        const { type, value, parentId } = catModal;
        if (!value.trim()) return alert('이름을 입력해주세요.');

        const id = (type === 'main' ? 'cat_' : type === 'sub' ? 'sub_' : 'det_') + Date.now();
        const catData = { id, name: value, level: type, parentId };

        try {
            const res = await fetch('/api/categories/admin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(catData)
            });
            if (res.ok) {
                const saved = await res.json();
                if (type === 'main') {
                    setMainCategories([...mainCategories, saved]);
                    setSubCategories({ ...subCategories, [saved.id]: [] });
                } else if (type === 'sub') {
                    setSubCategories({
                        ...subCategories,
                        [parentId]: [...(subCategories[parentId] || []), saved]
                    });
                    setDetailCategories({ ...detailCategories, [saved.id]: [] });
                } else {
                    setDetailCategories({
                        ...detailCategories,
                        [parentId]: [...(detailCategories[parentId] || []), saved]
                    });
                }
                setCatModal({ ...catModal, isOpen: false });
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

    const deleteSubCategory = async (mainId, subId) => {
        if (!window.confirm('해당 중분류를 삭제하시겠습니까?')) return;
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

    const filteredCats = mainCategories.filter(c =>
        c.name.toLowerCase().includes(catSearchQuery.toLowerCase())
    );

    const currentCat = selectedCatId ? mainCategories.find(c => c.id === selectedCatId) : mainCategories[0];

    return (
        <div className="fade-in">
            {/* 카테고리 추가 모달 */}
            {catModal.isOpen && (
                <div className="modal-overlay" style={{ zIndex: 4000 }}>
                    <div className="modal-content" style={{ maxWidth: '400px', padding: '0', borderRadius: '16px' }}>
                        <div style={{ padding: '20px 25px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, fontWeight: 800, fontSize: '1.2rem' }}>{catModal.title}</h3>
                            <button onClick={() => setCatModal({ ...catModal, isOpen: false })} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#94a3b8' }}>×</button>
                        </div>
                        <div style={{ padding: '30px' }}>
                            <div className="form-item" style={{ marginBottom: '25px' }}>
                                <label className="admin-label">카테고리명</label>
                                <input
                                    className="admin-input-small"
                                    autoFocus
                                    placeholder="이름을 입력하세요"
                                    value={catModal.value}
                                    onChange={(e) => setCatModal({ ...catModal, value: e.target.value })}
                                    onKeyDown={(e) => e.key === 'Enter' && handleModalSubmit()}
                                    style={{ padding: '15px' }}
                                />
                            </div>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button className="apply-btn" style={{ flex: 1, padding: '15px' }} onClick={handleModalSubmit}>등록하기</button>
                                <button className="action-btn" style={{ flex: 1, height: 'auto', padding: '15px' }} onClick={() => setCatModal({ ...catModal, isOpen: false })}>취소</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

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
                    <button className="apply-btn" onClick={() => openCatModal('main')}>+ 대분류 추가</button>
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
                                        onClick={() => openCatModal('sub', main.id)}
                                    >
                                        + 중분류 추가
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
                                            <button className="add-detail-btn" onClick={() => openCatModal('detail', sub.id)}>
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
                                <button className="apply-btn" onClick={() => openCatModal('sub', currentCat.id)}>+ 새로운 중분류 추가</button>
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
                                                style={{ padding: '6px 14px', fontSize: '0.85rem' }}
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
                                            <button className="add-detail-btn" style={{ padding: '6px 14px', fontSize: '0.9rem' }} onClick={() => openCatModal('detail', sub.id)}>
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

export default CategoryManagement;
