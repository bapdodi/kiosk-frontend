import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';

/**
 * 네이버 스마트스토어 연동 관리 페이지.
 *  1) 카테고리 매핑: 키오스크 카테고리(대/중분류) → 네이버 리프 카테고리 ID
 *  2) 동기화: 링크된 상품의 재고/가격/상품명 변경분을 미리보고, 선택 수락 시 반영
 */
const PRODUCT_PAGE_SIZE = 100;

const NaverSyncPage = () => {
    const { mainCategories, subCategories, products } = useOutletContext();

    const [configured, setConfigured] = useState(true);

    // ── 카테고리 매핑 상태 ──
    const [mappings, setMappings] = useState([]);
    const [form, setForm] = useState({ kioskMainCategory: '', kioskSubCategory: '', naverLeafCategoryId: '', naverCategoryName: '' });

    // ── 상품 전송 상태 ── productId -> link(객체) | null(미연동) | undefined(미조회)
    const [naverLinks, setNaverLinks] = useState({});
    const [naverBusyId, setNaverBusyId] = useState(null);
    const [selectedProducts, setSelectedProducts] = useState([]);
    const [productFilter, setProductFilter] = useState('');
    const [productVisibleCount, setProductVisibleCount] = useState(PRODUCT_PAGE_SIZE);

    // ── 동기화 상태 ──
    const [previews, setPreviews] = useState(null); // null = 아직 안 불러옴
    const [selected, setSelected] = useState([]);
    const [loadingPreview, setLoadingPreview] = useState(false);
    const [applying, setApplying] = useState(false);

    // ── 최근 판매 ──
    const [sales, setSales] = useState(null); // null = 아직 안 불러옴
    const [salesHours, setSalesHours] = useState(24);
    const [loadingSales, setLoadingSales] = useState(false);
    const [salesError, setSalesError] = useState('');

    const loadSales = async (hours = salesHours) => {
        setLoadingSales(true);
        setSalesError('');
        try {
            const res = await fetch(`/api/channels/naver/admin/sales/recent?hours=${hours}`);
            const data = await res.json().catch(() => null);
            if (!res.ok) {
                setSalesError((data && data.error) || `조회 실패 (${res.status})`);
                setSales([]);
                return;
            }
            setSales(data.sales || []);
        } catch {
            setSalesError('네트워크 오류');
            setSales([]);
        } finally {
            setLoadingSales(false);
        }
    };

    useEffect(() => {
        fetch('/api/channels/naver/admin/config-status').then(r => r.ok ? r.json() : null).then(d => { if (d) setConfigured(!!d.configured); }).catch(() => { });
        loadMappings();
    }, []);

    // ── 상품 전송 헬퍼 ──────────────────────────────────────────────────────
    // 키오스크 기준 유효 재고(복합옵션이면 조합 재고 합, 아니면 단품 재고) — 백엔드 effectiveStock 과 동일 규칙
    const computeEffectiveStock = (p) => {
        const combos = (p.combinations || []).filter(c => !c.deleted);
        if (combos.length > 0) return combos.reduce((s, c) => s + (c.stock || 0), 0);
        return p.stock || 0;
    };

    const refreshNaverStatuses = async (ids, { overwrite = false } = {}) => {
        const target = overwrite ? ids : ids.filter(id => naverLinks[id] === undefined);
        if (target.length === 0) return;
        try {
            const res = await fetch(`/api/channels/naver/admin/products/status?ids=${target.join(',')}`);
            const links = res.ok ? await res.json() : [];
            setNaverLinks(prev => {
                const next = { ...prev };
                target.forEach(id => { next[id] = null; }); // 조회했으나 링크 없으면 미연동(null)
                links.forEach(l => { next[l.productId] = l; });
                return next;
            });
        } catch { /* 무시 */ }
    };

    const pushToNaver = async (id) => {
        if (!configured && !window.confirm('네이버 자격증명이 아직 설정되지 않았을 수 있습니다. 계속할까요?')) return;
        setNaverBusyId(id);
        try {
            const res = await fetch(`/api/channels/naver/admin/products/${id}/push`, { method: 'POST' });
            const data = await res.json();
            if (res.ok) {
                setNaverLinks(prev => ({ ...prev, [id]: data }));
                alert('네이버 전송 완료');
            } else {
                alert('네이버 전송 실패: ' + (data.error || '알 수 없는 오류'));
                await refreshNaverStatuses([id], { overwrite: true });
            }
        } catch {
            alert('네트워크 오류');
        } finally {
            setNaverBusyId(null);
        }
    };

    const bulkPushToNaver = async () => {
        if (selectedProducts.length === 0) return alert('전송할 상품을 먼저 선택하세요.');
        if (!window.confirm(`선택한 ${selectedProducts.length}개 상품을 네이버 스마트스토어로 전송할까요?`)) return;
        try {
            const res = await fetch('/api/channels/naver/admin/products/push-bulk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(selectedProducts)
            });
            const results = res.ok ? await res.json() : [];
            const ok = results.filter(r => r.success).length;
            const fails = results.filter(r => !r.success);
            await refreshNaverStatuses(selectedProducts, { overwrite: true });
            let msg = `전송 완료 — 성공 ${ok}건, 실패 ${fails.length}건`;
            if (fails.length > 0) {
                msg += '\n\n[실패 상세]\n' + fails.map(r => `- ${r.name}: ${r.message}`).join('\n');
            }
            alert(msg);
        } catch {
            alert('네트워크 오류');
        }
    };

    // link 상태 → 배지 정보
    const naverBadge = (p) => {
        const link = naverLinks[p.id];
        if (link === undefined) return { label: '…', color: '#94a3b8', bg: '#f1f5f9' };
        if (link === null) return { label: '미연동', color: '#64748b', bg: '#f1f5f9' };
        if (link.lastError) return { label: '오류', color: '#b91c1c', bg: '#fee2e2', title: link.lastError };
        if (link.naverStatus === 'SUSPENSION') return { label: '판매중지', color: '#c2410c', bg: '#ffedd5' };
        const changed = link.lastSyncedName !== p.name
            || link.lastSyncedPrice !== p.price
            || link.lastSyncedStock !== computeEffectiveStock(p);
        if (changed) return { label: '변경있음', color: '#1d4ed8', bg: '#dbeafe' };
        return { label: '연동됨', color: '#15803d', bg: '#dcfce7' };
    };

    const filteredProducts = useMemo(() => {
        const q = productFilter.toLowerCase().trim();
        if (!q) return products;
        return products.filter(p => p.name?.toLowerCase().includes(q) || p.hashtags?.some(t => t.toLowerCase().includes(q)));
    }, [products, productFilter]);

    const visibleProducts = filteredProducts.slice(0, productVisibleCount);

    // 목록에 보이는 상품들의 네이버 연동 상태를 조회(아직 조회 안 한 것만)
    const visibleIdsKey = visibleProducts.map(p => p.id).join(',');
    useEffect(() => {
        if (visibleProducts.length > 0) refreshNaverStatuses(visibleProducts.map(p => p.id));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visibleIdsKey]);

    const loadMappings = async () => {
        try {
            const res = await fetch('/api/channels/naver/admin/category-mappings');
            if (res.ok) setMappings(await res.json());
        } catch { /* 무시 */ }
    };

    const mainName = (id) => mainCategories.find(m => m.id === id)?.name || id;
    const subName = (mainId, subId) => subCategories[mainId]?.find(s => s.id === subId)?.name || subId;

    const saveMapping = async () => {
        if (!form.kioskMainCategory || !form.naverLeafCategoryId) {
            return alert('키오스크 대분류와 네이버 리프 카테고리 ID 는 필수입니다.');
        }
        const body = {
            kioskMainCategory: form.kioskMainCategory,
            kioskSubCategory: form.kioskSubCategory || null,
            naverLeafCategoryId: Number(form.naverLeafCategoryId),
            naverCategoryName: form.naverCategoryName || null
        };
        try {
            const res = await fetch('/api/channels/naver/admin/category-mappings', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
            });
            if (res.ok) {
                setForm({ kioskMainCategory: '', kioskSubCategory: '', naverLeafCategoryId: '', naverCategoryName: '' });
                loadMappings();
            } else {
                alert('저장 실패');
            }
        } catch { alert('네트워크 오류'); }
    };

    const deleteMapping = async (id) => {
        if (!window.confirm('이 매핑을 삭제할까요?')) return;
        try {
            const res = await fetch(`/api/channels/naver/admin/category-mappings/${id}`, { method: 'DELETE' });
            if (res.ok) loadMappings();
        } catch { alert('네트워크 오류'); }
    };

    const loadPreview = async () => {
        setLoadingPreview(true);
        try {
            const res = await fetch('/api/channels/naver/admin/sync/preview');
            const data = res.ok ? await res.json() : [];
            setPreviews(data);
            setSelected(data.map(p => p.productId)); // 기본 전체 선택
        } catch {
            alert('네트워크 오류');
            setPreviews([]);
        } finally {
            setLoadingPreview(false);
        }
    };

    const applySelected = async () => {
        if (selected.length === 0) return alert('반영할 상품을 선택하세요.');
        if (!window.confirm(`선택한 ${selected.length}개 상품의 변경사항을 네이버에 반영할까요?`)) return;
        setApplying(true);
        try {
            const res = await fetch('/api/channels/naver/admin/sync/apply', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(selected)
            });
            const results = res.ok ? await res.json() : [];
            const ok = results.filter(r => r.success).length;
            const fails = results.filter(r => !r.success);
            let msg = `반영 완료 — 성공 ${ok}건, 실패 ${fails.length}건`;
            if (fails.length > 0) msg += '\n\n[실패]\n' + fails.map(r => `- ${r.name}: ${r.message}`).join('\n');
            alert(msg);
            await loadPreview();
        } catch {
            alert('네트워크 오류');
        } finally {
            setApplying(false);
        }
    };

    const toggle = (id) => setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

    const availableSubs = useMemo(
        () => (form.kioskMainCategory && subCategories[form.kioskMainCategory]) || [],
        [form.kioskMainCategory, subCategories]
    );

    return (
        <div className="fade-in">
            <div className="admin-header-title">
                <h2 style={{ fontSize: '1.8rem', fontWeight: 800 }}>🟢 네이버 스마트스토어 연동</h2>
            </div>

            {!configured && (
                <div style={{ background: '#fef3c7', border: '1px solid #f59e0b', color: '#92400e', padding: '12px 16px', borderRadius: '10px', marginBottom: '20px' }}>
                    ⚠ 네이버 커머스API 자격증명(client_id/secret)이 아직 설정되지 않았습니다. 백엔드 <code>.env</code> 의
                    <code> NAVER_COMMERCE_CLIENT_ID / SECRET </code> 를 채운 뒤 백엔드를 재시작하세요.
                </div>
            )}

            {/* ── 카테고리 매핑 ── */}
            <div className="admin-card" style={{ marginBottom: '30px' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '6px' }}>1. 카테고리 매핑</h3>
                <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '16px' }}>
                    네이버는 리프(최하위) 카테고리 ID 로만 상품을 등록할 수 있습니다. 키오스크 카테고리를 네이버 카테고리에 매핑하세요.
                    리프 카테고리 ID 는 스마트스토어센터 상품등록 화면에서 카테고리 선택 시 확인할 수 있습니다.
                </p>

                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '18px' }}>
                    <label style={{ display: 'flex', flexDirection: 'column', fontSize: '0.8rem', color: '#475569' }}>
                        키오스크 대분류
                        <select value={form.kioskMainCategory}
                            onChange={e => setForm(f => ({ ...f, kioskMainCategory: e.target.value, kioskSubCategory: '' }))}
                            style={selectStyle}>
                            <option value="">선택</option>
                            {mainCategories.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select>
                    </label>
                    <label style={{ display: 'flex', flexDirection: 'column', fontSize: '0.8rem', color: '#475569' }}>
                        키오스크 중분류(선택)
                        <select value={form.kioskSubCategory}
                            onChange={e => setForm(f => ({ ...f, kioskSubCategory: e.target.value }))}
                            style={selectStyle} disabled={!form.kioskMainCategory}>
                            <option value="">(대분류 전체)</option>
                            {availableSubs.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </label>
                    <label style={{ display: 'flex', flexDirection: 'column', fontSize: '0.8rem', color: '#475569' }}>
                        네이버 리프 카테고리 ID
                        <input type="number" value={form.naverLeafCategoryId}
                            onChange={e => setForm(f => ({ ...f, naverLeafCategoryId: e.target.value }))}
                            placeholder="예: 50000840" style={inputStyle} />
                    </label>
                    <label style={{ display: 'flex', flexDirection: 'column', fontSize: '0.8rem', color: '#475569' }}>
                        네이버 카테고리명(메모)
                        <input type="text" value={form.naverCategoryName}
                            onChange={e => setForm(f => ({ ...f, naverCategoryName: e.target.value }))}
                            placeholder="예: 생활/건강 > 공구 > 배관공구" style={{ ...inputStyle, width: '260px' }} />
                    </label>
                    <button className="apply-btn" onClick={saveMapping}>＋ 매핑 추가</button>
                </div>

                <table className="admin-table">
                    <thead>
                        <tr>
                            <th>키오스크 카테고리</th>
                            <th>네이버 리프 ID</th>
                            <th>네이버 카테고리명</th>
                            <th style={{ textAlign: 'right' }}>관리</th>
                        </tr>
                    </thead>
                    <tbody>
                        {mappings.map(m => (
                            <tr key={m.id}>
                                <td>{mainName(m.kioskMainCategory)}{m.kioskSubCategory ? ` › ${subName(m.kioskMainCategory, m.kioskSubCategory)}` : ' (전체)'}</td>
                                <td>{m.naverLeafCategoryId}</td>
                                <td style={{ color: '#64748b' }}>{m.naverCategoryName || '-'}</td>
                                <td style={{ textAlign: 'right' }}>
                                    <button className="action-btn" style={{ color: '#ef4444' }} onClick={() => deleteMapping(m.id)}>삭제</button>
                                </td>
                            </tr>
                        ))}
                        {mappings.length === 0 && (
                            <tr><td colSpan={4} style={{ textAlign: 'center', color: '#94a3b8', padding: '30px' }}>아직 매핑이 없습니다.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* ── 상품 전송(개별/일괄) ── */}
            <div className="admin-card" style={{ marginBottom: '30px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '10px' }}>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>2. 상품 전송</h3>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <input
                            type="text"
                            placeholder="상품명 또는 해시태그 검색..."
                            value={productFilter}
                            onChange={e => { setProductFilter(e.target.value); setProductVisibleCount(PRODUCT_PAGE_SIZE); }}
                            style={{ ...inputStyle, width: '220px' }}
                        />
                        <button
                            className="apply-btn"
                            style={{ background: '#16a34a' }}
                            onClick={bulkPushToNaver}
                            title="선택한 상품을 네이버 스마트스토어로 전송"
                        >
                            🟢 선택 전송{selectedProducts.length > 0 ? ` (${selectedProducts.length})` : ''}
                        </button>
                    </div>
                </div>
                <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '16px' }}>
                    상품을 네이버 스마트스토어에 처음 등록하거나, 개별적으로 다시 전송할 때 사용합니다.
                </p>

                <table className="admin-table">
                    <thead>
                        <tr>
                            <th style={{ width: '40px', textAlign: 'center' }}>
                                <input
                                    type="checkbox"
                                    onChange={(e) => setSelectedProducts(e.target.checked ? visibleProducts.map(p => p.id) : [])}
                                    checked={visibleProducts.length > 0 && selectedProducts.length === visibleProducts.length}
                                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                                />
                            </th>
                            <th>상품명</th>
                            <th style={{ width: '120px' }}>기본 판매가</th>
                            <th style={{ width: '100px', textAlign: 'center' }}>상태</th>
                            <th style={{ width: '110px', textAlign: 'center' }}>전송</th>
                        </tr>
                    </thead>
                    <tbody>
                        {visibleProducts.map(p => {
                            const b = naverBadge(p);
                            return (
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
                                    <td style={{ fontWeight: 700 }}>{p.name}</td>
                                    <td>{p.price.toLocaleString()}원</td>
                                    <td style={{ textAlign: 'center' }}>
                                        <span title={b.title || ''} style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: '10px', color: b.color, background: b.bg, whiteSpace: 'nowrap' }}>{b.label}</span>
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                        <button
                                            disabled={naverBusyId === p.id}
                                            onClick={() => pushToNaver(p.id)}
                                            style={{ fontSize: '0.72rem', padding: '3px 8px', border: '1px solid #cbd5e1', borderRadius: '6px', background: 'white', color: '#0f172a', cursor: naverBusyId === p.id ? 'default' : 'pointer', opacity: naverBusyId === p.id ? 0.5 : 1, whiteSpace: 'nowrap' }}
                                        >
                                            {naverBusyId === p.id ? '전송중…' : '네이버 전송'}
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                        {visibleProducts.length === 0 && (
                            <tr><td colSpan={5} style={{ textAlign: 'center', color: '#94a3b8', padding: '30px' }}>표시할 상품이 없습니다.</td></tr>
                        )}
                    </tbody>
                </table>
                {filteredProducts.length > productVisibleCount && (
                    <div style={{ textAlign: 'center', padding: '16px 0 4px' }}>
                        <button className="action-btn" onClick={() => setProductVisibleCount(c => c + PRODUCT_PAGE_SIZE)}>
                            더 보기 ({filteredProducts.length - productVisibleCount}개 더 있음)
                        </button>
                    </div>
                )}
            </div>

            {/* ── 동기화 미리보기/수락 ── */}
            <div className="admin-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>3. 재고·가격·상품명 동기화</h3>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button className="apply-btn" style={{ background: '#2563eb' }} onClick={loadPreview} disabled={loadingPreview}>
                            {loadingPreview ? '불러오는 중…' : '🔍 변경사항 불러오기'}
                        </button>
                        {previews && previews.length > 0 && (
                            <button className="apply-btn" style={{ background: '#16a34a' }} onClick={applySelected} disabled={applying}>
                                {applying ? '반영 중…' : `✅ 선택 반영 (${selected.length})`}
                            </button>
                        )}
                    </div>
                </div>
                <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '16px' }}>
                    이미 네이버에 등록된 상품 중, 마지막 전송 이후 재고·가격·상품명이 바뀐 것만 표시됩니다. 확인 후 선택 반영하세요.
                </p>

                {previews === null ? (
                    <div style={{ textAlign: 'center', color: '#94a3b8', padding: '40px' }}>‘변경사항 불러오기’를 눌러 확인하세요.</div>
                ) : previews.length === 0 ? (
                    <div style={{ textAlign: 'center', color: '#16a34a', padding: '40px' }}>변경된 상품이 없습니다. 모두 최신 상태입니다.</div>
                ) : (
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th style={{ width: '40px', textAlign: 'center' }}>
                                    <input type="checkbox"
                                        checked={selected.length === previews.length}
                                        onChange={e => setSelected(e.target.checked ? previews.map(p => p.productId) : [])} />
                                </th>
                                <th>상품명</th>
                                <th>변경 내용</th>
                            </tr>
                        </thead>
                        <tbody>
                            {previews.map(p => (
                                <tr key={p.productId}>
                                    <td style={{ textAlign: 'center' }}>
                                        <input type="checkbox" checked={selected.includes(p.productId)} onChange={() => toggle(p.productId)} />
                                    </td>
                                    <td style={{ fontWeight: 700 }}>{p.name}</td>
                                    <td>
                                        {p.changes.map((c, i) => (
                                            <div key={i} style={{ fontSize: '0.85rem' }}>
                                                <span style={{ color: '#64748b' }}>{c.field}: </span>
                                                <span style={{ color: '#b91c1c', textDecoration: 'line-through' }}>{c.before}</span>
                                                <span style={{ margin: '0 6px' }}>→</span>
                                                <span style={{ color: '#15803d', fontWeight: 700 }}>{c.after}</span>
                                            </div>
                                        ))}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* ── 최근 판매 확인 ── */}
            <div className="admin-card" style={{ marginTop: '30px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>4. 최근 판매 확인</h3>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <select value={salesHours} onChange={e => setSalesHours(Number(e.target.value))} style={selectStyle}>
                            <option value={1}>최근 1시간</option>
                            <option value={6}>최근 6시간</option>
                            <option value={12}>최근 12시간</option>
                            <option value={24}>최근 24시간</option>
                        </select>
                        <button className="apply-btn" style={{ background: '#7c3aed' }} onClick={() => loadSales()} disabled={loadingSales}>
                            {loadingSales ? '조회 중…' : '💰 판매 조회'}
                        </button>
                    </div>
                </div>
                <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '16px' }}>
                    네이버에서 최근 발생한 주문(결제)을 확인합니다. 네이버 API 제한으로 한 번에 최대 24시간 범위까지 조회됩니다.
                </p>

                {salesError && (
                    <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c', padding: '10px 14px', borderRadius: '10px', marginBottom: '14px' }}>
                        ⚠ {salesError}
                    </div>
                )}

                {sales === null ? (
                    <div style={{ textAlign: 'center', color: '#94a3b8', padding: '40px' }}>‘판매 조회’를 눌러 확인하세요.</div>
                ) : sales.length === 0 && !salesError ? (
                    <div style={{ textAlign: 'center', color: '#64748b', padding: '40px' }}>선택한 기간에 판매된 상품이 없습니다.</div>
                ) : sales.length > 0 ? (
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>주문일시</th>
                                <th>상품명(네이버)</th>
                                <th>키오스크 상품</th>
                                <th style={{ textAlign: 'right' }}>수량</th>
                                <th style={{ textAlign: 'right' }}>결제금액</th>
                                <th>상태</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sales.map(s => (
                                <tr key={s.productOrderId}>
                                    <td style={{ fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                                        {s.orderDate ? s.orderDate.replace('T', ' ').slice(0, 16) : '-'}
                                    </td>
                                    <td style={{ fontWeight: 700 }}>{s.naverProductName || '-'}</td>
                                    <td style={{ fontSize: '0.85rem', color: s.kioskProductName ? '#0f172a' : '#94a3b8' }}>
                                        {s.kioskProductName || '(매칭 안 됨)'}
                                    </td>
                                    <td style={{ textAlign: 'right' }}>{s.quantity}</td>
                                    <td style={{ textAlign: 'right', fontWeight: 700 }}>
                                        {Number(s.totalPaymentAmount || 0).toLocaleString()}원
                                    </td>
                                    <td style={{ fontSize: '0.85rem' }}>{s.orderStatus || '-'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : null}
            </div>
        </div>
    );
};

const selectStyle = { padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', marginTop: '4px', minWidth: '150px' };
const inputStyle = { padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', marginTop: '4px', width: '160px' };

export default NaverSyncPage;
