import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { getImageUrl, uploadImage } from '../../utils/imageUtils';
import BulkImageMatchModal from './BulkImageMatchModal';
import CategoryEditor from './CategoryEditor';

const ProductManagement = () => {
    const navigate = useNavigate();
    const {
        products, setProducts,
        mainCategories, setMainCategories,
        subCategories, setSubCategories,
        page, hasMore, isFetchingMore, onLoadMore, onRefresh,
        activeMainCat, setActiveMainCat,
        activeSubCat, setActiveSubCat,
        searchQuery, setSearchQuery
    } = useOutletContext();
    const [selectedProducts, setSelectedProducts] = useState([]);
    const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
    const [editingCatId, setEditingCatId] = useState(null);
    const [tempCategories, setTempCategories] = useState([]);
    const [dragOverProductId, setDragOverProductId] = useState(null);
    // 진입 시 전체 행(최대 2000개)을 한 번에 렌더하면 렉이 심하므로 보이는 만큼만 점진 렌더
    const PAGE_SIZE = 80;
    const [visibleCount, setVisibleCount] = useState(() => {
        const saved = sessionStorage.getItem('adminVisibleCount');
        return saved ? parseInt(saved, 10) : PAGE_SIZE;
    });
    const visibleCountRef = useRef(visibleCount);
    const filteredLenRef = useRef(0);

    const FALLBACK_IMAGE = '/no-image.png';

    useEffect(() => {
        // Persist filter states
        sessionStorage.setItem('adminMainCat', activeMainCat || '');
        sessionStorage.setItem('adminSubCat', activeSubCat || '');
        sessionStorage.setItem('adminSearch', searchQuery || '');
    }, [activeMainCat, activeSubCat, searchQuery]);

    // Infinite Scroll logic
    const observer = useRef();
    const lastProductElementRef = useCallback(node => {
        if (isFetchingMore) return;
        if (observer.current) observer.current.disconnect();
        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting) {
                if (visibleCountRef.current < filteredLenRef.current) {
                    // 이미 로드된 상품을 먼저 점진적으로 더 그림
                    setVisibleCount(c => Math.min(c + PAGE_SIZE, filteredLenRef.current));
                } else if (hasMore) {
                    onLoadMore();
                }
            }
        });
        if (node) observer.current.observe(node);
    }, [isFetchingMore, hasMore, onLoadMore]);

    useEffect(() => {
        // Restore scroll position
        const savedScroll = sessionStorage.getItem('adminScrollPos');
        if (savedScroll && products.length > 0) {
            // Use a small timeout to ensure the list is rendered
            const timer = setTimeout(() => {
                window.scrollTo(0, parseInt(savedScroll));
                sessionStorage.removeItem('adminScrollPos');
                sessionStorage.removeItem('adminVisibleCount');
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [products.length]);

    const handleEditNavigate = (productId) => {
        sessionStorage.setItem('adminScrollPos', window.scrollY.toString());
        sessionStorage.setItem('adminVisibleCount', visibleCount.toString());
        navigate(`/admin/products/edit/${productId}`);
    };

    const startEditingCategory = (product) => {
        setEditingCatId(product.id);
        setTempCategories(product.categories || []);
    };

    const saveCategoryUpdate = async (product) => {
        try {
            const res = await fetch(`/api/products/admin/${product.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...product,
                    categories: tempCategories
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
                    onRefresh();
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
        onRefresh();
    };

    const generateBetween = (p, n) => {
        const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
        let prev = p || "0";
        let next = n || "zzzzzzzz";

        if (prev >= next) {
            // Should not happen if logic is correct, but for safety:
            next = prev + "z";
        }

        let result = "";
        let i = 0;
        while (true) {
            let pChar = prev[i] || ALPHABET[0];
            let nChar = next[i] || ALPHABET[ALPHABET.length - 1];

            if (pChar === nChar) {
                result += pChar;
                i++;
                continue;
            }

            let pIdx = ALPHABET.indexOf(pChar);
            let nIdx = ALPHABET.indexOf(nChar);

            if (nIdx - pIdx > 1) {
                result += ALPHABET[pIdx + Math.floor((nIdx - pIdx) / 2)];
                break;
            } else {
                result += pChar;
                if (prev.length <= i + 1) {
                    result += ALPHABET[Math.floor(ALPHABET.length / 2)];
                    break;
                }
                i++;
            }
        }
        return result;
    };

    const compareByOrder = (a, b) => {
        const ao = a.sortOrder || "";
        const bo = b.sortOrder || "";
        if (ao < bo) return -1;
        if (ao > bo) return 1;
        return (a.id || 0) - (b.id || 0);
    };

    // Evenly-spaced, fixed-width numeric key for position `i` (lexicographically == numerically ordered).
    const rankForIndex = (i) => String((i + 1) * 1000).padStart(10, '0');

    const moveProduct = async (id, direction) => {
        const index = filteredProducts.findIndex(p => p.id === id);
        if (index < 0) return;
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        await reorderProduct(id, targetIndex);
    };

    // Move `movedId` so it ends up at `targetIndex` within the currently displayed list.
    const reorderProduct = async (movedId, targetIndex) => {
        const list = filteredProducts;
        const fromIndex = list.findIndex(p => p.id === movedId);
        if (fromIndex < 0) return;
        if (targetIndex < 0 || targetIndex >= list.length || targetIndex === fromIndex) return;

        const desired = [...list];
        const [moved] = desired.splice(fromIndex, 1);
        desired.splice(targetIndex, 0, moved);

        const before = desired[targetIndex - 1];
        const after = desired[targetIndex + 1];
        const beforeKey = before ? before.sortOrder : null;
        const afterKey = after ? after.sortOrder : null;

        // Fast path: the two new neighbours have distinct keys, so a single
        // fractional key between them is enough (one write).
        if ((beforeKey || '') !== (afterKey || '')) {
            const newKey = generateBetween(beforeKey, afterKey);
            if ((!beforeKey || newKey > beforeKey) && (!afterKey || newKey < afterKey)) {
                await persistOrders([{ id: movedId, sortOrder: newKey }]);
                return;
            }
        }

        // Robust path: neighbours share a key (e.g. the legacy default "80000000"),
        // which fractional indexing cannot split. Renumber the whole catalogue into
        // distinct, evenly-spaced keys with `moved` in its new spot, then persist the diff.
        const full = [...products].sort(compareByOrder).filter(p => p.id !== movedId);
        let insertAt = after ? full.findIndex(p => p.id === after.id) : full.length;
        if (insertAt < 0) insertAt = full.length;
        full.splice(insertAt, 0, moved);

        const updates = [];
        full.forEach((p, i) => {
            const key = rankForIndex(i);
            if (p.sortOrder !== key) updates.push({ id: p.id, sortOrder: key });
        });
        await persistOrders(updates);
    };

    // Apply optimistic UI update, then persist every changed order in ONE atomic request.
    // updateProductOrders() on the backend wraps the whole batch in a single transaction,
    // so the catalogue can never end up half-renumbered (the cause of the earlier scramble).
    const persistOrders = async (updates) => {
        if (!updates.length) return;
        const keyById = new Map(updates.map(u => [u.id, u.sortOrder]));

        // Optimistic UI update
        setProducts(prev => prev.map(p => keyById.has(p.id) ? { ...p, sortOrder: keyById.get(p.id) } : p));

        try {
            const res = await fetch('/api/products/admin/reorder', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates.map(u => ({ id: u.id, sortOrder: u.sortOrder })))
            });
            if (!res.ok) {
                alert('순서 저장 실패');
                onRefresh(); // Rollback on failure
            }
        } catch (e) {
            alert('오류 발생');
            onRefresh();
        }
    };

    // Native Drag and Drop logic
    const [draggedId, setDraggedId] = useState(null);

    const handleDragStart = (e, id) => {
        setDraggedId(id);
        e.dataTransfer.effectAllowed = "move";
        // Customize drag image if needed, or just let default happen
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
    };

    const handleDrop = async (e, targetId) => {
        e.preventDefault();
        if (draggedId === null || draggedId === targetId) return;

        const draggedIndex = filteredProducts.findIndex(p => p.id === draggedId);
        const targetIndex = filteredProducts.findIndex(p => p.id === targetId);

        if (draggedIndex === -1 || targetIndex === -1) return;

        // Drop the dragged row into the target row's slot (dragging down lands it
        // after the target, dragging up lands it before — both collapse to targetIndex
        // once the dragged item is removed from its original position).
        await reorderProduct(draggedId, targetIndex);
        setDraggedId(null);
    };

    const handleFileDrop = async (e, productId) => {
        e.preventDefault();
        setDragOverProductId(null);
        
        const files = Array.from(e.dataTransfer.files);
        if (files.length === 0) return;

        const product = products.find(p => p.id === productId);
        if (!product) return;

        try {
            const uploadedUrls = [];
            for (const file of files) {
                const data = await uploadImage(file);
                uploadedUrls.push(data.fileUrl);
            }

            const updatedProduct = {
                ...product,
                images: [...(product.images || []), ...uploadedUrls]
            };

            const res = await fetch(`/api/products/admin/${productId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedProduct)
            });

            if (res.ok) {
                const updated = await res.json();
                setProducts(products.map(p => p.id === updated.id ? updated : p));
            } else {
                alert('이미지 저장에 실패했습니다.');
            }
        } catch (err) {
            console.error(err);
            alert('업로드 중 오류가 발생했습니다.');
        }
    };

    const filteredProducts = useMemo(() => {
        const query = searchQuery.toLowerCase().trim();
        return [...products]
            .filter(p => {
                if (!query) return true;
                return p.name?.toLowerCase().includes(query) ||
                    p.hashtags?.some(t => t.toLowerCase().includes(query));
            })
            .sort((a, b) => {
                const aOrder = a.sortOrder || "";
                const bOrder = b.sortOrder || "";
                if (aOrder < bOrder) return -1;
                if (aOrder > bOrder) return 1;
                return (a.id || 0) - (b.id || 0);
            });
    }, [products, searchQuery]);

    const visibleProducts = filteredProducts.slice(0, visibleCount);
    visibleCountRef.current = visibleCount;
    filteredLenRef.current = filteredProducts.length;


    return (
        <div className="fade-in">
            <div className="admin-header-title">
                <h2 style={{ fontSize: '1.8rem', fontWeight: 800 }}>📦 상품 통합 관리</h2>
                <div style={{ display: 'flex', gap: '15px' }}>
                    <div className="search-container" style={{ margin: 0, flex: '0 0 300px' }}>
                        <input
                            className="search-input"
                            placeholder="상품명 또는 해시태그 검색..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
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
                    <button
                        className={`action-btn ${!activeMainCat ? 'active' : ''}`}
                        onClick={() => {
                            setActiveMainCat(null);
                            setActiveSubCat('all');
                        }}
                        style={{
                            borderRadius: '100px',
                            padding: '8px 18px',
                            background: !activeMainCat ? 'var(--admin-primary)' : '#f1f5f9',
                            color: !activeMainCat ? 'white' : '#64748b',
                            border: 'none',
                            fontWeight: 600,
                            fontSize: '0.9rem'
                        }}
                    >
                        전체 상품
                    </button>
                    {mainCategories.map(cat => (
                        <button
                            key={cat.id}
                            className={`action-btn ${activeMainCat === cat.id ? 'active' : ''}`}
                            onClick={() => {
                                setActiveMainCat(cat.id);
                                setActiveSubCat('all');
                            }}
                            style={{
                                borderRadius: '100px',
                                padding: '8px 18px',
                                background: activeMainCat === cat.id ? 'var(--admin-primary)' : '#f1f5f9',
                                color: activeMainCat === cat.id ? 'white' : '#64748b',
                                border: 'none',
                                fontWeight: 600,
                                fontSize: '0.9rem'
                            }}
                        >
                            {cat.name}
                        </button>
                    ))}
                </div>

                {activeMainCat && subCategories[activeMainCat] && (
                    <div style={{ display: 'flex', gap: '6px', marginBottom: '10px', flexWrap: 'wrap' }}>
                        <button
                            className={`sub-cat-btn ${activeSubCat === 'all' ? 'active' : ''}`}
                            onClick={() => {
                                setActiveSubCat('all');
                            }}
                            style={{
                                padding: '5px 12px',
                                borderRadius: '8px',
                                fontSize: '0.8rem',
                                background: activeSubCat === 'all' ? '#1e293b' : 'white',
                                color: activeSubCat === 'all' ? 'white' : '#64748b',
                                border: '1px solid #e2e8f0',
                                cursor: 'pointer'
                            }}
                        >
                            전체 중분류
                        </button>
                        {subCategories[activeMainCat].map(sub => (
                            <button
                                key={sub.id}
                                className={`sub-cat-btn ${activeSubCat === sub.id ? 'active' : ''}`}
                                onClick={() => {
                                    setActiveSubCat(sub.id);
                                }}
                                style={{
                                    padding: '5px 12px',
                                    borderRadius: '8px',
                                    fontSize: '0.8rem',
                                    background: activeSubCat === sub.id ? '#1e293b' : 'white',
                                    color: activeSubCat === sub.id ? 'white' : '#64748b',
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
                            <th style={{ width: '80px', textAlign: 'center' }}>순서</th>
                            <th style={{ textAlign: 'right' }}>관리</th>
                        </tr>
                    </thead>
                    <tbody>
                        {visibleProducts.map((p, index) => (
                            <tr
                                key={p.id}
                                ref={index === visibleProducts.length - 1 ? lastProductElementRef : null}
                                draggable="true"
                                onDragStart={(e) => handleDragStart(e, p.id)}
                                onDragOver={(e) => {
                                    e.preventDefault();
                                    const isFile = e.dataTransfer.types && Array.from(e.dataTransfer.types).includes('Files');
                                    if (isFile) {
                                        e.dataTransfer.dropEffect = 'copy';
                                        setDragOverProductId(p.id);
                                    } else {
                                        e.dataTransfer.dropEffect = 'move';
                                    }
                                }}
                                onDragLeave={() => setDragOverProductId(null)}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    setDragOverProductId(null);
                                    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                                        handleFileDrop(e, p.id);
                                    } else {
                                        handleDrop(e, p.id);
                                    }
                                }}
                                style={{
                                    cursor: 'grab',
                                    opacity: draggedId === p.id ? 0.4 : 1,
                                    background: dragOverProductId === p.id ? '#f0fdf4' : 'transparent',
                                    border: dragOverProductId === p.id ? '2px dashed #22c55e' : 'none',
                                    transition: 'all 0.2s ease'
                                }}
                            >
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
                                            loading="lazy"
                                            decoding="async"
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
                                <td style={{ minWidth: '260px' }}>
                                    {editingCatId === p.id ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            <CategoryEditor
                                                compact
                                                value={tempCategories}
                                                onChange={setTempCategories}
                                                mainCategories={mainCategories}
                                                subCategories={subCategories}
                                                setMainCategories={setMainCategories}
                                                setSubCategories={setSubCategories}
                                            />
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
                                        <div className="cat-display-cell" style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                                {(p.categories || []).map((c, ci) => (
                                                    <span key={ci} className="tag-badge" style={{ background: '#e0f2fe', color: '#0369a1', display: 'inline-flex', alignItems: 'center' }}>
                                                        {mainCategories.find(m => m.id === c.mainCategory)?.name || c.mainCategory}
                                                        {c.subCategory && (
                                                            <>
                                                                <span style={{ color: '#7dd3fc', margin: '0 4px' }}>›</span>
                                                                {subCategories[c.mainCategory]?.find(s => s.id === c.subCategory)?.name || c.subCategory}
                                                            </>
                                                        )}
                                                    </span>
                                                ))}
                                                {(p.categories || []).length === 0 && (
                                                    <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>미분류</span>
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
                                        {p.priceC.toLocaleString()}원
                                    </div>
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                        <button
                                            onClick={() => moveProduct(p.id, 'up')}
                                            style={{ padding: '6px 8px', background: '#f1f5f9', color: '#64748b', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem' }}
                                        >▲</button>
                                        <button
                                            onClick={() => moveProduct(p.id, 'down')}
                                            style={{ padding: '6px 8px', background: '#f1f5f9', color: '#64748b', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem' }}
                                        >▼</button>
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
                {isFetchingMore && (
                    <div style={{ textAlign: 'center', padding: '20px', color: '#64748b', fontSize: '0.9rem' }}>
                        데이터를 불러오는 중...
                    </div>
                )}
                {filteredProducts.length === 0 && !isFetchingMore && (
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
