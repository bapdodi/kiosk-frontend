import { useEffect, useState } from 'react';
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
        parentId: null,
        isEdit: false,
        editId: null
    });

    const [catSearchQuery, setCatSearchQuery] = useState('');
    const [catViewMode, setCatViewMode] = useState('grid');
    const [selectedCatId, setSelectedCatId] = useState(null);

    useEffect(() => {
        console.log('CategoryManagement loaded with mainCategories:', mainCategories);
    }, [mainCategories]);

    const openCatModal = (type, parentId = null, editItem = null) => {
        console.log('Opening modal:', { type, parentId, editItem });
        let title = '';
        if (editItem) {
            title = '카테고리 이름 수정 (' + editItem.name + ')';
        } else {
            if (type === 'main') title = '신규 대분류 등록';
            else if (type === 'sub') title = '신규 중분류 등록';
            else title = '신규 소분류 등록';
        }

        setCatModal({
            isOpen: true,
            title,
            value: editItem ? editItem.name : '',
            type,
            parentId,
            isEdit: !!editItem,
            editId: editItem ? editItem.id : null
        });
    };

    const handleModalSubmit = async () => {
        const { type, value, parentId, isEdit, editId } = catModal;
        if (!value.trim()) return alert('이름을 입력해주세요.');

        if (isEdit) {
            const catData = { id: editId, name: value, level: type, parentId };
            console.log('Updating category:', catData);
            try {
                const res = await fetch(`/api/categories/admin/${editId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(catData)
                });
                if (res.ok) {
                    const updated = await res.json();
                    if (type === 'main') {
                        setMainCategories(mainCategories.map(c => c.id === editId ? updated : c));
                    } else if (type === 'sub') {
                        setSubCategories({
                            ...subCategories,
                            [parentId]: subCategories[parentId].map(s => s.id === editId ? updated : s)
                        });
                    } else {
                        setDetailCategories({
                            ...detailCategories,
                            [parentId]: detailCategories[parentId].map(d => d.id === editId ? updated : d)
                        });
                    }
                    setCatModal({ ...catModal, isOpen: false });
                } else {
                    const errMsg = await res.text();
                    alert('수정 실패: ' + errMsg);
                }
            } catch (err) { alert('오류 발생: ' + err.message); }
        } else {
            const id = (type === 'main' ? 'cat_' : type === 'sub' ? 'sub_' : 'det_') + Date.now();
            const catData = { id, name: value, level: type, parentId };
            console.log('Creating category:', catData);

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
                } else {
                    const errMsg = await res.text();
                    alert('등록 실패: ' + errMsg);
                }
            } catch (err) { alert('오류 발생: ' + err.message); }
        }
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
        <div style={{ padding: '20px' }}>
            {/* 카테고리 추가/수정 모달 */}
            {catModal.isOpen && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', zIndex: 10000, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <div style={{ background: 'white', padding: '30px', borderRadius: '15px', width: '400px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
                        <h3 style={{ marginTop: 0, marginBottom: '20px', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>{catModal.title}</h3>
                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>명칭</label>
                            <input
                                style={{ width: '100%', padding: '12px', boxSizing: 'border-box', border: '1px solid #ddd', borderRadius: '8px' }}
                                autoFocus
                                value={catModal.value}
                                onChange={(e) => setCatModal({ ...catModal, value: e.target.value })}
                                onKeyDown={(e) => e.key === 'Enter' && handleModalSubmit()}
                            />
                        </div>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button
                                onClick={handleModalSubmit}
                                style={{ flex: 1, padding: '12px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
                            >
                                {catModal.isEdit ? '수정완료' : '등록하기'}
                            </button>
                            <button
                                onClick={() => setCatModal({ ...catModal, isOpen: false })}
                                style={{ flex: 1, padding: '12px', background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
                            >
                                취소
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                <h2 style={{ margin: 0, fontSize: '2rem', fontWeight: 900 }}>📁 카테고리 구성</h2>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <div style={{ position: 'relative' }}>
                        <input
                            placeholder="명칭으로 찾기..."
                            value={catSearchQuery}
                            onChange={(e) => setCatSearchQuery(e.target.value)}
                            style={{ padding: '12px 15px 12px 40px', borderRadius: '10px', border: '1px solid #e2e8f0', width: '250px' }}
                        />
                        <span style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)' }}>🔍</span>
                    </div>
                    <button
                        onClick={() => openCatModal('main')}
                        style={{ padding: '12px 20px', background: '#10b981', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                        + 대분류 추가
                    </button>
                </div>
            </div>

            <div style={{ display: 'flex', gap: '15px', marginBottom: '30px' }}>
                {['grid', 'tabs'].map(mode => (
                    <button
                        key={mode}
                        onClick={() => setCatViewMode(mode)}
                        style={{
                            padding: '10px 20px',
                            background: catViewMode === mode ? '#334155' : 'white',
                            color: catViewMode === mode ? 'white' : '#64748b',
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontWeight: 'bold'
                        }}
                    >
                        {mode === 'grid' ? '그리드 전체보기' : '탭으로 상세보기'}
                    </button>
                ))}
            </div>

            {catViewMode === 'tabs' && (
                <div style={{ display: 'flex', gap: '10px', marginBottom: '25px', overflowX: 'auto', paddingBottom: '10px' }}>
                    {mainCategories.map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => setSelectedCatId(cat.id)}
                            style={{
                                padding: '10px 20px',
                                background: selectedCatId === cat.id ? '#3b82f6' : '#f8fafc',
                                color: selectedCatId === cat.id ? 'white' : '#64748b',
                                border: 'none',
                                borderRadius: '25px',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap'
                            }}
                        >
                            {cat.name}
                        </button>
                    ))}
                </div>
            )}

            {catViewMode === 'grid' ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '25px' }}>
                    {filteredCats.map(main => (
                        <div key={main.id} style={{ background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ padding: '20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', borderTopLeftRadius: '16px', borderTopRightRadius: '16px' }}>
                                <div style={{ fontSize: '1.2rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontSize: '1.5rem' }}>📁</span>
                                    {main.name}
                                </div>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button
                                        onClick={() => openCatModal('main', null, main)}
                                        style={{ padding: '6px 12px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem' }}
                                    >
                                        수정
                                    </button>
                                    <button
                                        onClick={() => deleteMainCategory(main.id)}
                                        style={{ padding: '6px 12px', background: 'white', color: '#ef4444', border: '1px solid #ef4444', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem' }}
                                    >
                                        삭제
                                    </button>
                                </div>
                            </div>

                            <div style={{ padding: '20px', flex: 1 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#94a3b8' }}>중분류 / 소분류</span>
                                    <button
                                        onClick={() => openCatModal('sub', main.id)}
                                        style={{ padding: '5px 10px', background: '#334155', color: 'white', border: 'none', borderRadius: '5px', fontSize: '0.75rem', cursor: 'pointer' }}
                                    >
                                        + 중분류 추가
                                    </button>
                                </div>

                                {subCategories[main.id]?.map(sub => (
                                    <div key={sub.id} style={{ background: '#f8fafc', borderRadius: '10px', padding: '15px', marginBottom: '10px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                            <div style={{ fontWeight: 700, color: '#1e293b' }}>• {sub.name}</div>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button
                                                    onClick={() => openCatModal('sub', main.id, sub)}
                                                    style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}
                                                >
                                                    수정
                                                </button>
                                                <button
                                                    onClick={() => deleteSubCategory(main.id, sub.id)}
                                                    style={{ background: 'none', border: 'none', color: '#cbd5e1', cursor: 'pointer', fontSize: '1.2rem' }}
                                                >
                                                    ×
                                                </button>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                            {detailCategories[sub.id]?.map(det => (
                                                <div
                                                    key={det.id}
                                                    onClick={() => openCatModal('detail', sub.id, det)}
                                                    style={{ background: 'white', padding: '5px 12px', borderRadius: '20px', border: '1px solid #e2e8f0', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
                                                >
                                                    {det.name}
                                                    <span
                                                        onClick={(e) => { e.stopPropagation(); deleteDetailCategory(sub.id, det.id); }}
                                                        style={{ color: '#cbd5e1', fontSize: '1.1rem' }}
                                                    >
                                                        ×
                                                    </span>
                                                </div>
                                            ))}
                                            <button
                                                onClick={() => openCatModal('detail', sub.id)}
                                                style={{ padding: '4px 10px', background: 'none', border: '1px dashed #cbd5e1', borderRadius: '20px', color: '#94a3b8', fontSize: '0.85rem', cursor: 'pointer' }}
                                            >
                                                + 소분류
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                currentCat && (
                    <div style={{ maxWidth: '800px', margin: '0 auto', background: 'white', borderRadius: '20px', border: '1px solid #e2e8f0', padding: '30px' }}>
                        {/* Tab view details similar to grid but larger */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', borderBottom: '2px solid #f1f5f9', paddingBottom: '20px' }}>
                            <h2 style={{ margin: 0 }}>📁 {currentCat.name}</h2>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button onClick={() => openCatModal('main', null, currentCat)} style={{ padding: '10px 20px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer' }}>대분류 정보 수정</button>
                                <button onClick={() => deleteMainCategory(currentCat.id)} style={{ padding: '10px 20px', background: 'white', color: '#ef4444', border: '1px solid #ef4444', borderRadius: '10px', cursor: 'pointer' }}>대분류 삭제</button>
                            </div>
                        </div>
                        {/* ... more detailed view ... */}
                    </div>
                )
            )}
        </div>
    );
};

export default CategoryManagement;
