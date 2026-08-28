import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';

const CategoryManagement = () => {
    const {
        mainCategories, setMainCategories,
        subCategories, setSubCategories, refreshCategories
    } = useOutletContext();

    const [catModal, setCatModal] = useState({
        isOpen: false,
        title: '',
        value: '',
        type: '', // 'main', 'sub'
        parentId: null,
        isEdit: false,
        editId: null
    });

    const [catSearchQuery, setCatSearchQuery] = useState('');
    const [catViewMode, setCatViewMode] = useState('grid');
    const [selectedCatId, setSelectedCatId] = useState(null);
    const [isReordering, setIsReordering] = useState(false);
    const [draggedCategory, setDraggedCategory] = useState(null);
    const [dragOverCategory, setDragOverCategory] = useState(null);

    useEffect(() => {
        console.log('CategoryManagement loaded with mainCategories:', mainCategories);
    }, [mainCategories]);

    const openCatModal = (type, parentId = null, editItem = null) => {
        let title = '';
        if (editItem) {
            title = '카테고리 이름 수정 (' + editItem.name + ')';
        } else {
            if (type === 'main') title = '신규 대분류 등록';
            else title = '신규 중분류 등록';
        }

        setCatModal({
            isOpen: true,
            title,
            value: editItem ? editItem.name : '',
            type,
            parentId,
            isEdit: !!editItem,
            editId: editItem ? editItem.id : null,
            editSortOrder: editItem ? editItem.sortOrder : null
        });
    };

    const handleModalSubmit = async () => {
        const { type, value, parentId, isEdit, editId, editSortOrder } = catModal;
        if (!value.trim()) return alert('이름을 입력해주세요.');

        if (isEdit) {
            // sortOrder 를 빼고 보내면 서버가 순서를 초기화해 카테고리가 맨 앞으로 튄다.
            const catData = { id: editId, name: value, level: type, parentId, sortOrder: editSortOrder };
            try {
                const res = await fetch(`/api/categories/admin/${editId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(catData)
                });
                if (res.ok) {
                    await refreshCategories();
                    setCatModal({ ...catModal, isOpen: false });
                } else {
                    const errMsg = await res.text();
                    alert('수정 실패: ' + errMsg);
                }
            } catch (err) { alert('오류 발생: ' + err.message); }
        } else {
            const id = (type === 'main' ? 'cat_' : 'sub_') + Date.now();
            const catData = { id, name: value, level: type, parentId };

            try {
                const res = await fetch('/api/categories/admin', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(catData)
                });
                if (res.ok) {
                    // 서버가 그룹 max+1 로 sortOrder 를 정하므로, append 하지 말고 다시 받아온다.
                    await refreshCategories();
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
                await refreshCategories();
            }
        } catch (err) { alert('오류 발생'); }
    };

    const persistCategoryOrder = async (type, updatedItems, parentId = null) => {
        setIsReordering(true);
        try {
            const res = await fetch('/api/categories/admin/reorder', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedItems)
            });
            if (!res.ok) {
                alert('순서 변경 실패');
                return;
            }

            // 낙관적 반영 후, 서버가 실제로 저장한 순서로 확정한다.
            if (type === 'main') {
                setMainCategories(() => updatedItems);
            } else {
                setSubCategories(prev => ({ ...prev, [parentId]: updatedItems }));
            }
            // 저장은 이미 성공했으므로, 재조회가 실패해도 낙관적 순서를 유지하고 넘어간다.
            await refreshCategories().catch(() => { });
        } catch (e) {
            alert('오류 발생');
        } finally {
            setIsReordering(false);
        }
    };

    const moveCategory = async (type, id, direction, parentId = null) => {
        // 연속 클릭으로 오래된 배열이 뒤늦게 저장되어 순서를 덮어쓰지 않도록 한다.
        if (isReordering) return;

        // search query가 적용된 상태에서는 순서 변경을 막는 것이 안전함
        if (catSearchQuery.trim()) {
            return alert('순서 변경은 검색어가 없을 때만 가능합니다.');
        }

        let listToUpdate = [];
        if (type === 'main') {
            listToUpdate = [...mainCategories];
        } else {
            listToUpdate = [...(subCategories[parentId] || [])];
        }

        const index = listToUpdate.findIndex(c => c.id === id);
        if (index < 0) return;

        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= listToUpdate.length) return;

        // Swap
        const temp = listToUpdate[index];
        listToUpdate[index] = listToUpdate[newIndex];
        listToUpdate[newIndex] = temp;

        // Assign sortOrder
        const updatedItems = listToUpdate.map((cat, i) => ({ ...cat, sortOrder: i }));

        setIsReordering(true);
        await persistCategoryOrder(type, updatedItems, parentId);
    };

    const handleCategoryDragStart = (e, type, id, parentId = null) => {
        if (catSearchQuery.trim() || isReordering) {
            e.preventDefault();
            return;
        }
        setDraggedCategory({ type, id, parentId });
        setDragOverCategory({ type, id, parentId });
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', id);
    };

    const handleCategoryDrop = async (e, type, targetId, parentId = null) => {
        e.preventDefault();
        setDragOverCategory(null);
        if (!draggedCategory || draggedCategory.type !== type || draggedCategory.id === targetId) {
            setDraggedCategory(null);
            return;
        }
        if (type === 'sub' && draggedCategory.parentId !== parentId) {
            setDraggedCategory(null);
            return;
        }

        const source = type === 'main' ? mainCategories : (subCategories[parentId] || []);
        const fromIndex = source.findIndex(c => c.id === draggedCategory.id);
        const targetIndex = source.findIndex(c => c.id === targetId);
        if (fromIndex < 0 || targetIndex < 0) {
            setDraggedCategory(null);
            return;
        }

        const reordered = [...source];
        const [moved] = reordered.splice(fromIndex, 1);
        reordered.splice(targetIndex, 0, moved);
        const updatedItems = reordered.map((cat, i) => ({ ...cat, sortOrder: i }));
        setDraggedCategory(null);
        await persistCategoryOrder(type, updatedItems, parentId);
    };

    const deleteSubCategory = async (mainId, subId) => {
        if (!window.confirm('해당 중분류를 삭제하시겠습니까?')) return;
        try {
            const res = await fetch(`/api/categories/admin/${subId}`, { method: 'DELETE' });
            if (res.ok) {
                await refreshCategories();
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
                        <div key={main.id}
                            draggable={!catSearchQuery.trim()}
                            onDragStart={(e) => handleCategoryDragStart(e, 'main', main.id)}
                            onDragOver={(e) => { e.preventDefault(); setDragOverCategory({ type: 'main', id: main.id }); }}
                            onDragLeave={() => setDragOverCategory(null)}
                            onDrop={(e) => handleCategoryDrop(e, 'main', main.id)}
                            style={{ background: 'white', borderRadius: '16px', border: dragOverCategory?.type === 'main' && dragOverCategory.id === main.id ? '2px solid #3b82f6' : '1px solid #e2e8f0', boxShadow: '0 4px 6px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', cursor: catSearchQuery.trim() ? 'default' : 'grab' }}>
                            <div style={{ padding: '20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', borderTopLeftRadius: '16px', borderTopRightRadius: '16px' }}>
                                <div style={{ fontSize: '1.2rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontSize: '1.5rem' }}>📁</span>
                                    {main.name}
                                </div>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button
                                        onClick={() => moveCategory('main', main.id, 'up')}
                                        style={{ padding: '6px 8px', background: '#f1f5f9', color: '#64748b', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem' }}
                                    >▲</button>
                                    <button
                                        onClick={() => moveCategory('main', main.id, 'down')}
                                        style={{ padding: '6px 8px', background: '#f1f5f9', color: '#64748b', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem' }}
                                    >▼</button>
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
                                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#94a3b8' }}>중분류</span>
                                    <button
                                        onClick={() => openCatModal('sub', main.id)}
                                        style={{ padding: '5px 10px', background: '#334155', color: 'white', border: 'none', borderRadius: '5px', fontSize: '0.75rem', cursor: 'pointer' }}
                                    >
                                        + 중분류 추가
                                    </button>
                                </div>

                                {subCategories[main.id]?.map(sub => (
                                    <div key={sub.id}
                                        draggable={!catSearchQuery.trim()}
                                        onDragStart={(e) => { e.stopPropagation(); handleCategoryDragStart(e, 'sub', sub.id, main.id); }}
                                        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOverCategory({ type: 'sub', id: sub.id, parentId: main.id }); }}
                                        onDragLeave={() => setDragOverCategory(null)}
                                        onDrop={(e) => { e.stopPropagation(); handleCategoryDrop(e, 'sub', sub.id, main.id); }}
                                        style={{ background: '#f8fafc', borderRadius: '10px', padding: '15px', marginBottom: '10px', border: dragOverCategory?.type === 'sub' && dragOverCategory.id === sub.id ? '2px solid #3b82f6' : '1px solid transparent', cursor: catSearchQuery.trim() ? 'default' : 'grab' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div style={{ fontWeight: 700, color: '#1e293b' }}>• {sub.name}</div>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button
                                                    onClick={() => moveCategory('sub', sub.id, 'up', main.id)}
                                                    style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.85rem' }}
                                                >▲</button>
                                                <button
                                                    onClick={() => moveCategory('sub', sub.id, 'down', main.id)}
                                                    style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.85rem' }}
                                                >▼</button>
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
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                currentCat && (
                    <div style={{ maxWidth: '800px', margin: '0 auto', background: 'white', borderRadius: '20px', border: '1px solid #e2e8f0', padding: '30px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', borderBottom: '2px solid #f1f5f9', paddingBottom: '20px' }}>
                            <h2 style={{ margin: 0 }}>📁 {currentCat.name}</h2>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button onClick={() => openCatModal('main', null, currentCat)} style={{ padding: '10px 20px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer' }}>대분류 정보 수정</button>
                                <button onClick={() => deleteMainCategory(currentCat.id)} style={{ padding: '10px 20px', background: 'white', color: '#ef4444', border: '1px solid #ef4444', borderRadius: '10px', cursor: 'pointer' }}>대분류 삭제</button>
                            </div>
                        </div>
                    </div>
                )
            )}
        </div>
    );
};

export default CategoryManagement;
