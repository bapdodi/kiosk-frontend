import React, { useRef, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import XLSX from 'xlsx-js-style';
import { getImageUrl } from '../../utils/imageUtils';

const ProductManagement = () => {
    const navigate = useNavigate();
    const {
        products, setProducts,
        mainCategories, setMainCategories,
        subCategories, setSubCategories,
        detailCategories, setDetailCategories
    } = useOutletContext();
    const [adminActiveMainCat, setAdminActiveMainCat] = useState(null);
    const [adminActiveSubCat, setAdminActiveSubCat] = useState('all');
    const [adminActiveDetailCat, setAdminActiveDetailCat] = useState('all');
    const [adminSearchQuery, setAdminSearchQuery] = useState('');
    const [excelData, setExcelData] = useState([]);
    const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);

    // 일괄 적용을 위한 상태
    const [bulkMainCat, setBulkMainCat] = useState('');
    const [bulkSubCat, setBulkSubCat] = useState('');
    const [bulkDetailCat, setBulkDetailCat] = useState('');

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
                // Instead of reload, update the state directly
                // If the backend returns all products, we replace.
                // ErpSyncService returns the list of products synced from ERP.
                // To be safe and simple, we'll just fetch all products again after sync.
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
            ['상품명', '대분류', '중분류', '소분류', '규격', '가격'],
            ['예시 상품 A', '음료', '커피', '아메리카노', 'HOT', '3000'],
            ['예시 상품 B', '음식', '디저트', '케이크', '조각', '6500'],
            ['예시 상품 C', '기타', '굿즈', '컵', '머그', '12000']
        ];
        const ws = XLSX.utils.aoa_to_sheet(ws_data);

        // Column widths
        ws['!cols'] = [
            { wch: 25 }, // 상품명
            { wch: 15 }, // 대분류
            { wch: 15 }, // 중분류
            { wch: 15 }, // 소분류
            { wch: 15 }, // 규격
            { wch: 12 }  // 가격
        ];

        // Apply styles
        const range = XLSX.utils.decode_range(ws['!ref']);
        for (let R = range.s.r; R <= range.e.r; ++R) {
            for (let C = range.s.c; C <= range.e.c; ++C) {
                const cell_address = { c: C, r: R };
                const cell_ref = XLSX.utils.encode_cell(cell_address);
                if (!ws[cell_ref]) continue;

                // Basic style
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

                // Header specific style
                if (R === 0) {
                    ws[cell_ref].s.fill = { fgColor: { rgb: "D1E7DD" } }; // Light Green for header
                    ws[cell_ref].s.font.bold = true;
                    ws[cell_ref].s.font.sz = 12;
                }

                // Price formatting
                if (R > 0 && C === 5) {
                    ws[cell_ref].t = 'n'; // number type
                    ws[cell_ref].z = '#,##0'; // format
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
                    updateExcelItem(itemId, { mainCategory: saved.id, subCategory: '', detailCategory: '' });
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
                setDetailCategories({ ...detailCategories, [saved.id]: [] });
                if (itemId) {
                    updateExcelItem(itemId, { subCategory: saved.id, detailCategory: '' });
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
                subCategory: bulkSubCat || '',
                detailCategory: bulkDetailCat || ''
            };
        }));

        alert('일괄 적용되었습니다.');
    };

    const addDetailCategory = async (itemId, subId) => {
        if (!subId) return alert('중분류를 먼저 선택해주세요.');
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
                if (itemId) {
                    updateExcelItem(itemId, { detailCategory: saved.id });
                }
                return saved;
            }
        } catch (err) { alert('오류 발생'); }
    };

    // Helper to create category
    const createCategoryByName = async (name, parentId, level) => {
        try {
            const id = (level === 'main' ? 'cat_' : level === 'sub' ? 'sub_' : 'det_') + Date.now() + Math.random().toString(36).substr(2, 5);
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

            // 헤더 찾기
            let headerRowIndex = 0;
            for (let i = 0; i < data.length; i++) {
                if (data[i].includes('품명') || data[i].includes('상품명')) {
                    headerRowIndex = i;
                    break;
                }
            }
            const headers = data[headerRowIndex];
            const rows = data.slice(headerRowIndex + 1);

            // 임시 파싱 데이터
            const tempItemsMap = {};

            // 기존 카테고리 맵 (이름 -> ID)
            let mainMap = {};
            mainCategories.forEach(c => mainMap[c.name] = c.id);

            // 중분류: parentId -> name -> id
            let subMap = {};
            Object.keys(subCategories).forEach(pid => {
                subMap[pid] = {};
                subCategories[pid].forEach(c => subMap[pid][c.name] = c.id);
            });

            // 소분류: parentId -> name -> id
            let detailMap = {};
            Object.keys(detailCategories).forEach(pid => {
                detailMap[pid] = {};
                detailCategories[pid].forEach(c => detailMap[pid][c.name] = c.id);
            });

            for (let idx = 0; idx < rows.length; idx++) {
                const row = rows[idx];
                const rowData = {};
                headers.forEach((h, i) => rowData[h] = row[i]);

                const name = rowData['품명'] || rowData['상품명'];
                if (!name) continue;

                const mName = rowData['대분류'];
                const sName = rowData['중분류'];
                const dName = rowData['소분류'];

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
                        detailName: dName,
                        mainCategory: '',
                        subCategory: '',
                        detailCategory: '',
                        images: []
                    };
                }
                if (specName || parsedPrice > 0) {
                    tempItemsMap[name].options.push({ spec: specName, price: parsedPrice });
                }
            }

            const tempItems = Object.values(tempItemsMap);

            // 누락된 카테고리 확인
            const newMains = new Set();
            tempItems.forEach(item => {
                if (item.mainName && !mainMap[item.mainName]) {
                    newMains.add(item.mainName);
                }
            });

            let shouldCreate = false;
            // 간단하게 누락된게 하나라도 있으면 물어본다. 
            if (newMains.size > 0 || tempItems.some(item => item.subName || item.detailName)) {
                const missingCount = newMains.size;
                if (missingCount > 0 || tempItems.some(i => i.subName && (!mainMap[i.mainName] || !subMap[mainMap[i.mainName]]?.[i.subName]))) {
                    shouldCreate = window.confirm('엑셀 파일에 존재하지 않는 카테고리가 포함되어 있습니다.\n카테고리를 자동으로 생성하시겠습니까?');
                }
            }

            if (shouldCreate) {
                // 대분류 생성
                for (const mName of newMains) {
                    const newCat = await createCategoryByName(mName, null, 'main');
                    if (newCat) {
                        mainMap[mName] = newCat.id;
                        setMainCategories(prev => [...prev, newCat]);
                        // subCategories 초기화
                        setSubCategories(prev => ({ ...prev, [newCat.id]: [] }));
                        subMap[newCat.id] = {};
                    }
                }

                // 중분류 생성
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
                            setDetailCategories(prev => ({ ...prev, [newCat.id]: [] }));
                            detailMap[newCat.id] = {};
                        }
                    }
                }

                // 소분류 생성
                for (const item of tempItems) {
                    if (!item.detailName || !item.subName || !item.mainName) continue;
                    const mId = mainMap[item.mainName];
                    if (!mId) continue;
                    const sId = subMap[mId]?.[item.subName];
                    if (!sId) continue;

                    if (!detailMap[sId]) detailMap[sId] = {};

                    if (!detailMap[sId][item.detailName]) {
                        const newCat = await createCategoryByName(item.detailName, sId, 'detail');
                        if (newCat) {
                            detailMap[sId][item.detailName] = newCat.id;
                            setDetailCategories(prev => ({
                                ...prev,
                                [sId]: [...(prev[sId] || []), newCat]
                            }));
                        }
                    }
                }
            }

            // 최종 매핑
            const finalData = tempItems.map(item => {
                const mId = mainMap[item.mainName] || '';
                const sId = (mId && subMap[mId]?.[item.subName]) || '';
                const dId = (sId && detailMap[sId]?.[item.detailName]) || '';

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
                    subCategory: sId,
                    detailCategory: dId
                };
            });

            setExcelData(finalData);
            setExcelSelection([]); // Reset selection on new upload
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

        // 카테고리 미지정 체크
        // const unclassified = excelData.filter(item => !item.mainCategory); // 일단 강제하지 않음

        // 순차적으로 등록 (병렬 처리 시 서버 부하 고려)
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
                detailCategory: item.detailCategory || '',
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
                                    <div style={{ fontWeight: 700, marginBottom: '6px' }}>
                                        {p.name}
                                        {p.erpCode && <span style={{ marginLeft: '8px', fontSize: '0.75rem', color: '#64748b', fontWeight: 400 }}>[{p.erpCode}]</span>}
                                    </div>
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
            {/* Excel Preview Modal */}
            {isExcelModalOpen && (
                <div className="modal-overlay" style={{ zIndex: 2000 }}>
                    <div className="modal-content" style={{ maxWidth: '900px', width: '95%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: 0 }}>
                        <div style={{ padding: '20px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0 }}>📊 엑셀 가져오기 미리보기</h3>
                            <button onClick={() => setIsExcelModalOpen(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
                        </div>
                        <div style={{ padding: '15px 20px', background: '#f8fafc', borderBottom: '1px solid #eee' }}>
                            <div style={{ marginBottom: '10px', fontSize: '0.9rem', color: '#64748b' }}>
                                💡 등록 전 데이터를 확인하고 수정할 수 있습니다.
                            </div>
                            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#334155' }}>🗂️ 카테고리 일괄 적용:</span>
                                <div style={{ position: 'relative' }}>
                                    <select
                                        className="admin-input-small"
                                        style={{ width: '130px' }}
                                        value={bulkMainCat}
                                        onChange={(e) => {
                                            setBulkMainCat(e.target.value);
                                            setBulkSubCat('');
                                            setBulkDetailCat('');
                                        }}
                                    >
                                        <option value="">대분류 선택</option>
                                        {mainCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                    <button
                                        onClick={async () => {
                                            const newCat = await addMainCategory(null);
                                            if (newCat) {
                                                setBulkMainCat(newCat.id);
                                                setBulkSubCat('');
                                                setBulkDetailCat('');
                                            }
                                        }}
                                        style={{ position: 'absolute', top: -8, right: 0, fontSize: '0.7rem', padding: '2px 4px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', zIndex: 1 }}
                                    >
                                        +
                                    </button>
                                </div>

                                <div style={{ position: 'relative' }}>
                                    <select
                                        className="admin-input-small"
                                        style={{ width: '130px' }}
                                        value={bulkSubCat}
                                        onChange={(e) => {
                                            setBulkSubCat(e.target.value);
                                            setBulkDetailCat('');
                                        }}
                                        disabled={!bulkMainCat}
                                    >
                                        <option value="">중분류 없음 (선택)</option>
                                        {bulkMainCat && subCategories[bulkMainCat]?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                    {bulkMainCat && (
                                        <button
                                            onClick={async () => {
                                                const newCat = await addSubCategory(null, bulkMainCat);
                                                if (newCat) {
                                                    setBulkSubCat(newCat.id);
                                                    setBulkDetailCat('');
                                                }
                                            }}
                                            style={{ position: 'absolute', top: -8, right: 0, fontSize: '0.7rem', padding: '2px 4px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', zIndex: 1 }}
                                        >
                                            +
                                        </button>
                                    )}
                                </div>

                                <div style={{ position: 'relative' }}>
                                    <select
                                        className="admin-input-small"
                                        style={{ width: '130px' }}
                                        value={bulkDetailCat}
                                        onChange={(e) => setBulkDetailCat(e.target.value)}
                                        disabled={!bulkSubCat}
                                    >
                                        <option value="">소분류 없음 (선택)</option>
                                        {bulkSubCat && detailCategories[bulkSubCat]?.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                    </select>
                                    {bulkSubCat && (
                                        <button
                                            onClick={async () => {
                                                const newCat = await addDetailCategory(null, bulkSubCat);
                                                if (newCat) setBulkDetailCat(newCat.id);
                                            }}
                                            style={{ position: 'absolute', top: -8, right: 0, fontSize: '0.7rem', padding: '2px 4px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', zIndex: 1 }}
                                        >
                                            +
                                        </button>
                                    )}
                                </div>

                                <button
                                    className="apply-btn"
                                    style={{ padding: '6px 14px', fontSize: '0.85rem', height: '32px', display: 'flex', alignItems: 'center' }}
                                    onClick={applyBulkCategory}
                                >
                                    일괄 적용
                                </button>
                            </div>
                        </div>
                        <div style={{ flex: 1, overflow: 'auto', padding: '0' }}>
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
                                                style={{ cursor: 'pointer' }}
                                            />
                                        </th>
                                        <th style={{ width: '60px' }}>사진</th>
                                        <th>품명</th>
                                        <th>규격 (옵션)</th>
                                        <th>기본 단가</th>
                                        <th>카테고리 설정</th>
                                        <th>삭제</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {excelData.map((item, idx) => (
                                        <React.Fragment key={item.id}>
                                            <tr style={{ borderBottom: expandedExcelItems.includes(item.id) ? 'none' : '1px solid #e2e8f0' }}>
                                                <td style={{ textAlign: 'center' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={excelSelection.includes(item.id)}
                                                        onChange={(e) => {
                                                            if (e.target.checked) setExcelSelection([...excelSelection, item.id]);
                                                            else setExcelSelection(excelSelection.filter(id => id !== item.id));
                                                        }}
                                                        style={{ cursor: 'pointer' }}
                                                    />
                                                </td>
                                                <td>
                                                    <div style={{ position: 'relative', width: '40px', height: '40px', border: '1px dashed #cbd5e1', borderRadius: '4px', overflow: 'hidden', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                        {item.images && item.images.length > 0 ? (
                                                            <img src={item.images[0]} alt="thumb" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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
                                                <td style={{ position: 'relative' }}>
                                                    <input
                                                        className="admin-input-small"
                                                        value={item.spec}
                                                        disabled
                                                        style={{ background: '#f8fafc', color: '#64748b', cursor: 'not-allowed', width: '90%' }}
                                                    />
                                                    {item.options && item.options.length > 0 && (
                                                        <button
                                                            onClick={() => toggleExpandExcelItem(item.id)}
                                                            style={{ position: 'absolute', right: '5px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '10px' }}
                                                        >
                                                            {expandedExcelItems.includes(item.id) ? '▲' : '▼'}
                                                        </button>
                                                    )}
                                                </td>
                                                <td>
                                                    <input
                                                        type="number"
                                                        className="admin-input-small"
                                                        value={item.price}
                                                        onChange={(e) => updateExcelItem(item.id, { price: e.target.value })}
                                                    />
                                                </td>
                                                <td>
                                                    <div style={{ display: 'flex', gap: '5px' }}>
                                                        <div style={{ position: 'relative' }}>
                                                            <select
                                                                className="admin-input-small"
                                                                style={{ width: '100px' }}
                                                                value={item.mainCategory}
                                                                onChange={(e) => {
                                                                    const mId = e.target.value;
                                                                    updateExcelItem(item.id, {
                                                                        mainCategory: mId,
                                                                        subCategory: '',
                                                                        detailCategory: ''
                                                                    });
                                                                }}
                                                            >
                                                                <option value="">대분류 선택</option>
                                                                {mainCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                                            </select>
                                                            <button
                                                                onClick={() => addMainCategory(item.id)}
                                                                style={{ position: 'absolute', top: -8, right: 0, fontSize: '0.7rem', padding: '2px 4px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                                            >
                                                                +
                                                            </button>
                                                        </div>

                                                        {item.mainCategory && (
                                                            <div style={{ position: 'relative' }}>
                                                                <select
                                                                    className="admin-input-small"
                                                                    style={{ width: '100px' }}
                                                                    value={item.subCategory}
                                                                    onChange={(e) => {
                                                                        const sId = e.target.value;
                                                                        updateExcelItem(item.id, {
                                                                            subCategory: sId,
                                                                            detailCategory: ''
                                                                        });
                                                                    }}
                                                                >
                                                                    <option value="">중분류 없음</option>
                                                                    {subCategories[item.mainCategory]?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                                                </select>
                                                                <button
                                                                    onClick={() => addSubCategory(item.id, item.mainCategory)}
                                                                    style={{ position: 'absolute', top: -8, right: 0, fontSize: '0.7rem', padding: '2px 4px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                                                >
                                                                    +
                                                                </button>
                                                            </div>
                                                        )}



                                                        {item.subCategory && (
                                                            <div style={{ position: 'relative' }}>
                                                                <select
                                                                    className="admin-input-small"
                                                                    style={{ width: '100px' }}
                                                                    value={item.detailCategory}
                                                                    onChange={(e) => updateExcelItem(item.id, { detailCategory: e.target.value })}
                                                                >
                                                                    <option value="">소분류 없음</option>
                                                                    {detailCategories[item.subCategory]?.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                                                </select>
                                                                <button
                                                                    onClick={() => addDetailCategory(item.id, item.subCategory)}
                                                                    style={{ position: 'absolute', top: -8, right: 0, fontSize: '0.7rem', padding: '2px 4px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                                                >
                                                                    +
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td style={{ textAlign: 'center' }}>
                                                    <button
                                                        onClick={() => {
                                                            if (window.confirm('정말 삭제하시겠습니까?')) {
                                                                setExcelData(excelData.filter(d => d.id !== item.id));
                                                                setExcelSelection(excelSelection.filter(id => id !== item.id));
                                                            }
                                                        }}
                                                        style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', padding: '5px' }}
                                                    >
                                                        ×
                                                    </button>
                                                </td>
                                            </tr>
                                            {expandedExcelItems.includes(item.id) && item.options && item.options.length > 0 && (
                                                <tr key={`${item.id}-options`} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                                    <td colSpan="7" style={{ padding: '0 10px 10px 10px' }}>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', paddingLeft: '20px' }}>
                                                            {item.options.map((option, optionIdx) => (
                                                                <div key={optionIdx} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#f8fafc', padding: '5px 10px', borderRadius: '4px' }}>
                                                                    <span style={{ fontWeight: 500, color: '#475569', minWidth: '80px' }}>{option.name}:</span>
                                                                    <input
                                                                        className="admin-input-small"
                                                                        value={option.spec}
                                                                        onChange={(e) => {
                                                                            const newOptions = [...item.options];
                                                                            newOptions[optionIdx] = { ...option, spec: e.target.value };
                                                                            updateExcelItem(item.id, { options: newOptions });
                                                                        }}
                                                                        style={{ flex: 1 }}
                                                                    />
                                                                    <span style={{ fontWeight: 500, color: '#475569', minWidth: '40px' }}>가격:</span>
                                                                    <input
                                                                        type="number"
                                                                        className="admin-input-small"
                                                                        value={option.price}
                                                                        onChange={(e) => {
                                                                            const newOptions = [...item.options];
                                                                            newOptions[optionIdx] = { ...option, price: e.target.value };
                                                                            updateExcelItem(item.id, { options: newOptions });
                                                                        }}
                                                                        style={{ width: '80px' }}
                                                                    />
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div style={{ padding: '20px', borderTop: '1px solid #eee', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                            <button className="action-btn" onClick={() => setIsExcelModalOpen(false)}>취소</button>
                            <button className="apply-btn" onClick={saveExcelImport}>
                                {excelData.length}개 상품 일괄 등록
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProductManagement;
