import { useRef, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import XLSX from 'xlsx-js-style';
import { getImageUrl } from '../../utils/imageUtils';

const ProductManagement = () => {
    const navigate = useNavigate();
    const {
        products, setProducts,
        mainCategories, setMainCategories,
        subCategories, setSubCategories
    } = useOutletContext();
    const [adminActiveMainCat, setAdminActiveMainCat] = useState(null);
    const [adminActiveSubCat, setAdminActiveSubCat] = useState('all');
    const [adminSearchQuery, setAdminSearchQuery] = useState('');
    const [excelData, setExcelData] = useState([]);
    const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);

    // 일괄 적용을 위한 상태
    const [bulkMainCat, setBulkMainCat] = useState('');
    const [bulkSubCat, setBulkSubCat] = useState('');

    // 선택 상태
    const [excelSelection, setExcelSelection] = useState([]);
    const [expandedExcelItems, setExpandedExcelItems] = useState([]);
    const [selectedProducts, setSelectedProducts] = useState([]);

    const fileInputRef = useRef(null);

    // eslint-disable-next-line no-unused-vars
    const FALLBACK_IMAGE = '/no-image.png';

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

    const downloadExampleExcel = () => {
        const ws_data = [
            ['상품명', '대분류', '중분류', '규격', '가격'],
            ['예시 상품 A', '음료', '커피', 'HOT', '3000'],
            ['예시 상품 B', '음식', '디저트', '조각', '6500'],
            ['예시 상품 C', '기타', '굿즈', '머그', '12000']
        ];
        const ws = XLSX.utils.aoa_to_sheet(ws_data);

        ws['!cols'] = [
            { wch: 25 }, // 상품명
            { wch: 15 }, // 대분류
            { wch: 15 }, // 중분류
            { wch: 15 }, // 규격
            { wch: 12 }  // 가격
        ];

        const range = XLSX.utils.decode_range(ws['!ref']);
        for (let R = range.s.r; R <= range.e.r; ++R) {
            for (let C = range.s.c; C <= range.e.c; ++C) {
                const cell_address = { c: C, r: R };
                const cell_ref = XLSX.utils.encode_cell(cell_address);
                if (!ws[cell_ref]) continue;

                ws[cell_ref].s = {
                    font: { name: 'Malgun Gothic', sz: 11 },
                    alignment: { vertical: 'center', horizontal: 'center' },
                    border: {
                        top: { style: 'thin', color: { rgb: "000000" } },
                        bottom: { style: 'thin', color: { rgb: "000000" } },
                        left: { style: 'thin', color: { rgb: "000000" } },
                        right: { style: 'thin', color: { rgb: "000000" } }
                    }
                };

                if (R === 0) {
                    ws[cell_ref].s.fill = { fgColor: { rgb: "D1E7DD" } };
                    ws[cell_ref].s.font.bold = true;
                    ws[cell_ref].s.font.sz = 12;
                }

                if (R > 0 && C === 4) {
                    ws[cell_ref].t = 'n';
                    ws[cell_ref].z = '#,##0';
                    ws[cell_ref].s.alignment.horizontal = 'right';
                }
            }
        }

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "상품등록예시");
        XLSX.writeFile(wb, "상품등록예시.xlsx");
    };

    const updateExcelItem = (id, updates) => {
        setExcelData(prev => prev.map(item =>
            item.id === id ? { ...item, ...updates } : item
        ));
    };

    const handleExcelImageUpload = async (id, file) => {
        if (!file) return;
        const formData = new FormData();
        formData.append('file', file);
        try {
            const res = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });
            if (res.ok) {
                const data = await res.json();
                setExcelData(prev => prev.map(item =>
                    item.id === id ? { ...item, images: [...(item.images || []), data.fileUrl] } : item
                ));
            }
        } catch (err) {
            console.error("Upload failed", err);
        }
    };

    const toggleExpandExcelItem = (id) => {
        setExpandedExcelItems(prev => prev.includes(id) ? prev.filter(itemId => itemId !== id) : [...prev, id]);
    };

    const addMainCategory = async (itemId) => {
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
                if (itemId) {
                    updateExcelItem(itemId, { mainCategory: saved.id, subCategory: '' });
                }
                return saved;
            }
        } catch (err) { alert('오류 발생'); }
    };

    const addSubCategory = async (itemId, mainId) => {
        if (!mainId) return alert('대분류를 먼저 선택해주세요.');
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
                if (itemId) {
                    updateExcelItem(itemId, { subCategory: saved.id });
                }
                return saved;
            }
        } catch (err) { alert('오류 발생'); }
    };

    const applyBulkCategory = () => {
        if (!bulkMainCat) return alert('일괄 적용할 대분류를 선택해주세요.');

        if (excelSelection.length === 0) {
            if (!window.confirm('선택된 항목이 없습니다. 모든 항목에 선택한 카테고리를 일괄 적용하시겠습니까?\n(기존 설정은 덮어씌워집니다)')) return;
        } else {
            if (!window.confirm(`선택한 ${excelSelection.length}개 항목에 카테고리를 일괄 적용하시겠습니까?\n(기존 설정은 덮어씌워집니다)`)) return;
        }

        setExcelData(prev => prev.map(item => {
            if (excelSelection.length > 0 && !excelSelection.includes(item.id)) return item;

            return {
                ...item,
                mainCategory: bulkMainCat,
                subCategory: bulkSubCat || ''
            };
        }));

        alert('일괄 적용되었습니다.');
    };

    const createCategoryByName = async (name, parentId, level) => {
        try {
            const id = (level === 'main' ? 'cat_' : 'sub_') + Date.now() + Math.random().toString(36).substr(2, 5);
            const catData = { id, name, parentId, level };
            const res = await fetch('/api/categories/admin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(catData)
            });
            if (res.ok) return await res.json();
            return null;
        } catch (e) {
            console.error('Category creation failed', e);
            return null;
        }
    };

    const handleExcelUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            const bstr = evt.target.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];
            const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

            let headerRowIndex = 0;
            for (let i = 0; i < data.length; i++) {
                if (data[i].includes('품명') || data[i].includes('상품명')) {
                    headerRowIndex = i;
                    break;
                }
            }
            const headers = data[headerRowIndex];
            const rows = data.slice(headerRowIndex + 1);

            const tempItemsMap = {};

            let mainMap = {};
            mainCategories.forEach(c => mainMap[c.name] = c.id);

            let subMap = {};
            Object.keys(subCategories).forEach(pid => {
                subMap[pid] = {};
                subCategories[pid].forEach(c => subMap[pid][c.name] = c.id);
            });

            for (let idx = 0; idx < rows.length; idx++) {
                const row = rows[idx];
                const rowData = {};
                headers.forEach((h, i) => rowData[h] = row[i]);

                const name = rowData['품명'] || rowData['상품명'];
                if (!name) continue;

                const mName = rowData['대분류'];
                const sName = rowData['중분류'];

                let rawPrice = rowData['단가'] || rowData['가격'] || rowData['금액'] || rowData['판매가'];
                if (rawPrice == null || rawPrice === '') rawPrice = 0;
                let parsedPrice = typeof rawPrice === 'string' ? rawPrice.replace(/,/g, '') : rawPrice;
                parsedPrice = parseInt(parsedPrice, 10);
                if (isNaN(parsedPrice)) parsedPrice = 0;

                const specName = rowData['규격'] || '';

                if (!tempItemsMap[name]) {
                    tempItemsMap[name] = {
                        id: `temp-${idx}`,
                        name,
                        options: [],
                        mainName: mName,
                        subName: sName,
                        mainCategory: '',
                        subCategory: '',
                        images: []
                    };
                }
                if (specName || parsedPrice > 0) {
                    tempItemsMap[name].options.push({ spec: specName, price: parsedPrice });
                }
            }

            const tempItems = Object.values(tempItemsMap);

            const newMains = new Set();
            tempItems.forEach(item => {
                if (item.mainName && !mainMap[item.mainName]) {
                    newMains.add(item.mainName);
                }
            });

            let shouldCreate = false;
            if (newMains.size > 0 || tempItems.some(item => item.subName)) {
                const missingCount = newMains.size;
                if (missingCount > 0 || tempItems.some(i => i.subName && (!mainMap[i.mainName] || !subMap[mainMap[i.mainName]]?.[i.subName]))) {
                    shouldCreate = window.confirm('엑셀 파일에 존재하지 않는 카테고리가 포함되어 있습니다.\n카테고리를 자동으로 생성하시겠습니까?');
                }
            }

            if (shouldCreate) {
                for (const mName of newMains) {
                    const newCat = await createCategoryByName(mName, null, 'main');
                    if (newCat) {
                        mainMap[mName] = newCat.id;
                        setMainCategories(prev => [...prev, newCat]);
                        setSubCategories(prev => ({ ...prev, [newCat.id]: [] }));
                        subMap[newCat.id] = {};
                    }
                }

                for (const item of tempItems) {
                    if (!item.subName || !item.mainName) continue;
                    const mId = mainMap[item.mainName];
                    if (!mId) continue;
                    if (!subMap[mId]) subMap[mId] = {};
                    if (!subMap[mId][item.subName]) {
                        const newCat = await createCategoryByName(item.subName, mId, 'sub');
                        if (newCat) {
                            subMap[mId][item.subName] = newCat.id;
                            setSubCategories(prev => ({
                                ...prev,
                                [mId]: [...(prev[mId] || []), newCat]
                            }));
                        }
                    }
                }
            }

            const finalData = tempItems.map(item => {
                const mId = mainMap[item.mainName] || '';
                const sId = (mId && subMap[mId]?.[item.subName]) || '';

                const validOptions = item.options ? item.options.filter(o => o.spec) : [];
                let basePrice = item.options && item.options.length > 0 ? item.options[0].price : 0;
                if (validOptions.length > 0) {
                    basePrice = Math.min(...validOptions.map(o => o.price));
                }

                return {
                    id: item.id,
                    name: item.name,
                    spec: validOptions.length > 0 ? `${validOptions[0].spec} 등 ${validOptions.length}개 규격` : '',
                    price: basePrice,
                    options: item.options || [],
                    images: item.images || [],
                    mainCategory: mId,
                    subCategory: sId
                };
            });

            setExcelData(finalData);
            setExcelSelection([]);
            setExpandedExcelItems([]);
            setIsExcelModalOpen(true);
        };
        reader.readAsBinaryString(file);
        e.target.value = '';
    };

    const saveExcelImport = async () => {
        if (!window.confirm(`${excelData.length}개의 상품을 등록하시겠습니까?`)) return;

        let successCount = 0;
        let failCount = 0;

        for (const item of excelData) {
            let optionGroups = [];
            let combinations = [];
            let isComplexOptions = false;

            const validOptions = item.options.filter(o => o.spec);
            if (validOptions.length > 0) {
                isComplexOptions = true;
                optionGroups = [{
                    name: '규격',
                    values: validOptions.map(o => o.spec)
                }];
                combinations = validOptions.map((o, i) => ({
                    id: `c-${i}`,
                    name: o.spec,
                    price: Math.max(0, o.price - item.price)
                }));
            }

            const payload = {
                name: item.name,
                description: validOptions.length > 0 ? `규격: ${validOptions.map(o => o.spec).join(', ')}` : '',
                price: parseInt(item.price || 0),
                mainCategory: item.mainCategory || mainCategories[0]?.id,
                subCategory: item.subCategory || '',
                hashtags: [],
                images: item.images || [],
                isComplexOptions,
                optionGroups,
                combinations
            };

            try {
                const res = await fetch('/api/products/admin', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (res.ok) {
                    const saved = await res.json();
                    setProducts(prev => [...prev, saved]);
                    successCount++;
                } else {
                    failCount++;
                }
            } catch (err) {
                failCount++;
            }
        }

        alert(`완료: 성공 ${successCount}건, 실패 ${failCount}건`);
        setIsExcelModalOpen(false);
        setExcelData([]);
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
                        <button className="apply-btn" style={{ background: '#64748b' }} onClick={downloadExampleExcel}>
                            📥 엑셀 예시 다운로드
                        </button>
                        <input
                            type="file"
                            ref={fileInputRef}
                            style={{ display: 'none' }}
                            accept=".xlsx, .xls"
                            onChange={handleExcelUpload}
                        />
                        <button className="apply-btn" style={{ background: '#107c41' }} onClick={() => fileInputRef.current.click()}>
                            📊 엑셀 업로드
                        </button>
                        <button className="apply-btn" style={{ background: '#2563eb' }} onClick={syncWithErp}>
                            🔄 ERP 상품 동기화
                        </button>
                        {selectedProducts.length > 0 && (
                            <button className="apply-btn" style={{ background: '#ef4444' }} onClick={deleteSelectedProducts}>
                                🗑️ 선택 삭제 ({selectedProducts.length})
                            </button>
                        )}
                        <button className="apply-btn" onClick={() => navigate('/admin/products/new')}>
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
                                </td>
                                <td>
                                    <div style={{ fontWeight: 800, color: '#1e293b' }}>
                                        {p.price.toLocaleString()}원
                                    </div>
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                        <button className="action-btn" onClick={() => navigate(`/admin/products/edit/${p.id}`)}>수정</button>
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

            {/* Excel Import Modal */}
            {isExcelModalOpen && (
                <div className="modal-overlay">
                    <div className="admin-modal" style={{ maxWidth: '1100px', height: '90vh', display: 'flex', flexDirection: 'column' }}>
                        <div className="modal-header">
                            <div>
                                <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>📊 엑셀 상품 일괄 등록</h3>
                                <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '4px' }}>엑셀 파일의 내용을 확인하고 카테고리를 지정하세요.</p>
                            </div>
                            <button onClick={() => setIsExcelModalOpen(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
                        </div>
                        <div style={{ padding: '15px 25px', background: '#f1f5f9', borderBottom: '1px solid #e2e8f0', display: 'flex', gap: '15px', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#475569' }}>일괄 카테고리 설정:</span>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <select
                                    className="admin-input-small"
                                    value={bulkMainCat}
                                    onChange={(e) => {
                                        setBulkMainCat(e.target.value);
                                        setBulkSubCat('');
                                    }}
                                >
                                    <option value="">대분류 선택</option>
                                    {mainCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                                <select
                                    className="admin-input-small"
                                    value={bulkSubCat}
                                    onChange={(e) => setBulkSubCat(e.target.value)}
                                >
                                    <option value="">중분류 선택</option>
                                    {subCategories[bulkMainCat]?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                                <button className="apply-btn" style={{ padding: '6px 14px', fontSize: '0.85rem' }} onClick={applyBulkCategory}>
                                    일괄 적용
                                </button>
                            </div>
                        </div>
                        <div style={{ flex: 1, overflow: 'auto' }}>
                            <table className="admin-table" style={{ borderTop: 'none' }}>
                                <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                                    <tr>
                                        <th style={{ width: '40px', textAlign: 'center' }}>
                                            <input
                                                type="checkbox"
                                                checked={excelData.length > 0 && excelSelection.length === excelData.length}
                                                onChange={(e) => {
                                                    if (e.target.checked) setExcelSelection(excelData.map(d => d.id));
                                                    else setExcelSelection([]);
                                                }}
                                            />
                                        </th>
                                        <th style={{ width: '60px' }}>사진</th>
                                        <th>품명</th>
                                        <th>규격</th>
                                        <th>단가</th>
                                        <th>카테고리 지정</th>
                                        <th>삭제</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {excelData.map((item) => (
                                        <tr key={item.id}>
                                            <td style={{ textAlign: 'center' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={excelSelection.includes(item.id)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) setExcelSelection([...excelSelection, item.id]);
                                                        else setExcelSelection(excelSelection.filter(id => id !== item.id));
                                                    }}
                                                />
                                            </td>
                                            <td>
                                                <div style={{ position: 'relative', width: '40px', height: '40px', border: '1px dashed #cbd5e1', borderRadius: '4px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    {item.images && item.images.length > 0 ? (
                                                        <img src={getImageUrl(item.images[0])} alt="thumb" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                    ) : (
                                                        <span style={{ fontSize: '10px', color: '#94a3b8' }}>+사진</span>
                                                    )}
                                                    <input
                                                        type="file"
                                                        style={{ position: 'absolute', opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }}
                                                        onChange={(e) => handleExcelImageUpload(item.id, e.target.files[0])}
                                                    />
                                                </div>
                                            </td>
                                            <td>
                                                <input
                                                    className="admin-input-small"
                                                    value={item.name}
                                                    onChange={(e) => updateExcelItem(item.id, { name: e.target.value })}
                                                />
                                            </td>
                                            <td>
                                                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{item.spec}</span>
                                            </td>
                                            <td>
                                                <input
                                                    type="number"
                                                    className="admin-input-small"
                                                    style={{ width: '80px' }}
                                                    value={item.price}
                                                    onChange={(e) => updateExcelItem(item.id, { price: e.target.value })}
                                                />
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', gap: '5px' }}>
                                                    <select
                                                        className="admin-input-small"
                                                        value={item.mainCategory}
                                                        onChange={(e) => updateExcelItem(item.id, { mainCategory: e.target.value, subCategory: '' })}
                                                    >
                                                        <option value="">대분류 선택</option>
                                                        {mainCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                                    </select>
                                                    <select
                                                        className="admin-input-small"
                                                        value={item.subCategory}
                                                        onChange={(e) => updateExcelItem(item.id, { subCategory: e.target.value })}
                                                    >
                                                        <option value="">중분류 선택</option>
                                                        {subCategories[item.mainCategory]?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                                    </select>
                                                </div>
                                            </td>
                                            <td style={{ textAlign: 'center' }}>
                                                <button
                                                    onClick={() => setExcelData(excelData.filter(d => d.id !== item.id))}
                                                    style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}
                                                >
                                                    ×
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div style={{ padding: '20px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                            <button className="action-btn" onClick={() => setIsExcelModalOpen(false)}>취소</button>
                            <button className="apply-btn" onClick={saveExcelImport}>{excelData.length}개 상품 일괄 등록</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProductManagement;
