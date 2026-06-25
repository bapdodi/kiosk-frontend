/**
 * 상품의 다중 카테고리 편집기.
 * value: [{ mainCategory, subCategory }] 형태의 배열.
 * 한 상품을 여러 (대분류 + 중분류) 쌍에 동시에 소속시킬 수 있다.
 *
 * mainCategories / subCategories / setMainCategories / setSubCategories 는
 * 상위(App)의 카테고리 컨텍스트를 그대로 전달받아 신규 분류 생성도 지원한다.
 */

const createCategory = async (catData) => {
    const res = await fetch('/api/categories/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(catData)
    });
    if (!res.ok) throw new Error('failed');
    return res.json();
};

const CategoryEditor = ({
    value,
    onChange,
    mainCategories = [],
    subCategories = {},
    setMainCategories,
    setSubCategories,
    compact = false
}) => {
    const cats = value || [];

    const addRow = () => {
        const mId = mainCategories[0]?.id || '';
        const sId = subCategories[mId]?.[0]?.id || '';
        onChange([...cats, { mainCategory: mId, subCategory: sId }]);
    };

    const updateRow = (idx, patch) => {
        onChange(cats.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
    };

    const removeRow = (idx) => {
        onChange(cats.filter((_, i) => i !== idx));
    };

    const addMainCategory = async () => {
        const name = prompt('새 대분류 이름을 입력하세요:');
        if (!name) return;
        try {
            const saved = await createCategory({ id: 'cat_' + Date.now(), name, level: 'main' });
            setMainCategories?.([...mainCategories, saved]);
            setSubCategories?.({ ...subCategories, [saved.id]: [] });
        } catch {
            alert('오류 발생');
        }
    };

    const addSubCategory = async (mainId) => {
        if (!mainId) return alert('대분류를 먼저 선택해주세요.');
        const name = prompt('새 중분류 이름을 입력하세요:');
        if (!name) return;
        try {
            const saved = await createCategory({ id: 'sub_' + Date.now(), name, parentId: mainId, level: 'sub' });
            setSubCategories?.({
                ...subCategories,
                [mainId]: [...(subCategories[mainId] || []), saved]
            });
        } catch {
            alert('오류 발생');
        }
    };

    const fontSize = compact ? '0.8rem' : '0.9rem';
    const pad = compact ? '4px 6px' : '8px 10px';
    const selectStyle = {
        padding: pad,
        border: '1px solid #dee2e6',
        borderRadius: '8px',
        fontSize,
        background: '#fff',
        flex: 1,
        minWidth: 0
    };
    const miniBtn = {
        padding: compact ? '2px 6px' : '4px 8px',
        fontSize: compact ? '0.7rem' : '0.78rem',
        borderRadius: '6px',
        background: '#f1f5f9',
        color: '#475569',
        border: 'none',
        cursor: 'pointer',
        whiteSpace: 'nowrap'
    };
    const delBtn = {
        padding: compact ? '2px 8px' : '6px 10px',
        fontSize: compact ? '0.7rem' : '0.8rem',
        borderRadius: '6px',
        background: '#fee2e2',
        color: '#ef4444',
        border: 'none',
        cursor: 'pointer',
        whiteSpace: 'nowrap'
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {cats.length === 0 && (
                <div style={{ color: '#94a3b8', fontSize, padding: '4px 0' }}>
                    등록된 카테고리가 없습니다. 아래에서 추가하세요.
                </div>
            )}

            {cats.map((c, idx) => (
                <div key={idx} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <select
                        style={selectStyle}
                        value={c.mainCategory || ''}
                        onChange={(e) => {
                            const mId = e.target.value;
                            const sId = subCategories[mId]?.[0]?.id || '';
                            updateRow(idx, { mainCategory: mId, subCategory: sId });
                        }}
                    >
                        {mainCategories.map((m) => (
                            <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                    </select>
                    <select
                        style={selectStyle}
                        value={c.subCategory || ''}
                        onChange={(e) => updateRow(idx, { subCategory: e.target.value })}
                    >
                        <option value="">중분류 없음</option>
                        {(subCategories[c.mainCategory] || []).map((s) => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                    </select>
                    <button type="button" style={miniBtn} onClick={() => addSubCategory(c.mainCategory)} title="이 대분류에 새 중분류 추가">
                        ＋중분류
                    </button>
                    <button type="button" style={delBtn} onClick={() => removeRow(idx)}>
                        삭제
                    </button>
                </div>
            ))}

            <div style={{ display: 'flex', gap: '8px', marginTop: '2px' }}>
                <button
                    type="button"
                    style={{ ...miniBtn, background: '#1e293b', color: '#fff', padding: compact ? '4px 10px' : '8px 14px' }}
                    onClick={addRow}
                    disabled={mainCategories.length === 0}
                >
                    ＋ 카테고리 추가
                </button>
                <button type="button" style={miniBtn} onClick={addMainCategory}>
                    ＋ 새 대분류
                </button>
            </div>
        </div>
    );
};

export default CategoryEditor;
