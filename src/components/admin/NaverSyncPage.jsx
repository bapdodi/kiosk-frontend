import { Fragment, useEffect, useMemo, useState } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';

// 사이드바 플라이아웃과 공유되는 탭 정의 (AdminLayout 의 NAVER_TABS 와 key 동일)
const TABS = [
    { key: 'mapping', label: '카테고리 매핑' },
    { key: 'push', label: '상품' },
    { key: 'sync', label: '재고·가격 동기화' },
    { key: 'sales', label: '최근 판매 확인' },
];

// 네이버 연동 상태 키 → 배지 표시(라벨/색상)
const STATUS_META = {
    unknown: { label: '…', color: '#94a3b8', bg: '#f1f5f9' },
    unlinked: { label: '미연동', color: '#64748b', bg: '#f1f5f9' },
    error: { label: '오류', color: '#b91c1c', bg: '#fee2e2' },
    suspended: { label: '판매중지', color: '#c2410c', bg: '#ffedd5' },
    changed: { label: '변경있음', color: '#1d4ed8', bg: '#dbeafe' },
    linked: { label: '연동됨', color: '#15803d', bg: '#dcfce7' },
};

// 상품 탭 상태 필터 드롭다운 옵션
const STATUS_FILTERS = [
    { key: '', label: '전체 상태' },
    { key: 'linked', label: '연동됨' },
    { key: 'changed', label: '변경있음' },
    { key: 'unlinked', label: '미연동' },
    { key: 'suspended', label: '판매중지' },
    { key: 'error', label: '오류' },
];

/**
 * 네이버 스마트스토어 연동 관리 페이지.
 *  1) 카테고리 매핑: 키오스크 카테고리(대/중분류) → 네이버 리프 카테고리 ID
 *  2) 동기화: 링크된 상품의 재고/가격/상품명 변경분을 미리보고, 선택 수락 시 반영
 */
const PRODUCT_PAGE_SIZE = 20; // 상품 탭 한 페이지당 상품 수

// '기본 카테고리' 매핑의 대분류 특수값(백엔드 NaverConnector.DEFAULT_MAIN_CATEGORY 와 동일).
// 이 매핑은 특정 카테고리 매핑이 없는 모든 상품에 폴백으로 적용된다.
const DEFAULT_MAIN = '*';

const NaverSyncPage = () => {
    const { mainCategories, subCategories, products } = useOutletContext();

    // ── 탭 상태 (URL ?tab= 으로 관리 → 사이드바 플라이아웃에서 딥링크 가능) ──
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = TABS.some(t => t.key === searchParams.get('tab')) ? searchParams.get('tab') : 'mapping';
    const goTab = (key) => setSearchParams(key === 'mapping' ? {} : { tab: key });

    const [configured, setConfigured] = useState(true);

    // ── 카테고리 매핑 상태 ──
    const [mappings, setMappings] = useState([]);
    const [form, setForm] = useState({ kioskMainCategory: '', kioskSubCategory: '', naverLeafCategoryId: '', naverCategoryName: '' });
    // 기본(전체) 카테고리 입력 — 이 하나만 지정하면 모든 상품이 자동으로 이 카테고리로 등록된다.
    const [defaultForm, setDefaultForm] = useState({ naverLeafCategoryId: '', naverCategoryName: '' });
    const [showAdvanced, setShowAdvanced] = useState(false); // 카테고리별 세부 매핑(선택) 펼침 여부

    // ── 상품 상태 ── productId -> link(객체) | null(미연동) | undefined(미조회)
    const [naverLinks, setNaverLinks] = useState({});
    const [naverBusyId, setNaverBusyId] = useState(null);
    const [statusMenuId, setStatusMenuId] = useState(null); // 상태 변경 메뉴가 열린 상품 id
    const [statusBusyId, setStatusBusyId] = useState(null);  // 상태 변경 요청 중인 상품 id
    const [selectedProducts, setSelectedProducts] = useState([]);
    const [productFilter, setProductFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');    // '' = 전체, 그 외 STATUS_META 키
    const [productPage, setProductPage] = useState(1);       // 1-based 페이지 번호
    const [expandedIds, setExpandedIds] = useState([]);      // 규격 펼친 상품 id 목록

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

    // ── 규격/가격 표시 헬퍼 ──
    const activeCombos = (p) => (p.combinations || []).filter(c => !c.deleted);
    // ERP 동기화 상품은 combination.priceC 가 각 옵션의 '절대 판매가'다(기본가+추가금이 아님).
    // 손님 키오스크·네이버 모두 이 값을 그대로 청구하므로 표시도 이 값을 그대로 쓴다.
    const comboPrice = (c) => (c.priceC || 0);
    const priceLabel = (p) => {
        const combos = activeCombos(p);
        if (combos.length === 0) return `${(p.priceC || 0).toLocaleString()}원`;
        const prices = combos.map(c => comboPrice(c));
        const min = Math.min(...prices), max = Math.max(...prices);
        return min === max ? `${min.toLocaleString()}원` : `${min.toLocaleString()} ~ ${max.toLocaleString()}원`;
    };
    const toggleExpand = (id) => setExpandedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

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

    // 판매상태 변경(판매중 ↔ 판매중지). status: 'SALE' | 'SUSPENSION'
    const changeStatus = async (id, status) => {
        const label = status === 'SUSPENSION' ? '판매중지' : '재판매(판매중)';
        setStatusMenuId(null);
        if (!window.confirm(`이 상품을 네이버에서 '${label}' 상태로 변경할까요?`)) return;
        setStatusBusyId(id);
        try {
            const res = await fetch(`/api/channels/naver/admin/products/${id}/status`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status })
            });
            const data = await res.json().catch(() => null);
            if (res.ok) {
                setNaverLinks(prev => ({ ...prev, [id]: data }));
            } else {
                alert('상태 변경 실패: ' + ((data && data.error) || `오류 (${res.status})`));
                await refreshNaverStatuses([id], { overwrite: true });
            }
        } catch {
            alert('네트워크 오류');
        } finally {
            setStatusBusyId(null);
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

    // link 상태 → 상태 키 (필터/배지 공용)
    const naverStatusKey = (p) => {
        const link = naverLinks[p.id];
        if (link === undefined) return 'unknown';   // 아직 조회 안 됨
        if (link === null) return 'unlinked';        // 조회했으나 미연동
        if (link.lastError) return 'error';
        if (link.naverStatus === 'SUSPENSION') return 'suspended';
        const changed = link.lastSyncedName !== p.name
            || link.lastSyncedPrice !== p.priceC
            || link.lastSyncedStock !== computeEffectiveStock(p);
        return changed ? 'changed' : 'linked';
    };

    // 상태 키 → 배지 정보(라벨/색상, 오류는 title 에 상세)
    const naverBadge = (p) => {
        const key = naverStatusKey(p);
        return key === 'error' ? { ...STATUS_META.error, title: naverLinks[p.id].lastError } : STATUS_META[key];
    };

    // 판매상태 변경이 가능한(=이미 네이버에 등록된) 링크. 미연동/미조회면 null.
    const naverLink = (p) => {
        const l = naverLinks[p.id];
        return l && l.originProductNo ? l : null;
    };

    const filteredProducts = useMemo(() => {
        const q = productFilter.toLowerCase().trim();
        let list = products;
        if (q) list = list.filter(p => p.name?.toLowerCase().includes(q) || p.hashtags?.some(t => t.toLowerCase().includes(q)));
        if (statusFilter) list = list.filter(p => naverStatusKey(p) === statusFilter);
        return list;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [products, productFilter, statusFilter, naverLinks]);

    // 상태 필터가 켜지면 전체 상품의 연동 상태를 미리 불러온다(페이지 밖 상품도 필터되도록). 100개씩 나눠 조회.
    useEffect(() => {
        if (!statusFilter) return;
        const missing = products.filter(p => naverLinks[p.id] === undefined).map(p => p.id);
        (async () => {
            for (let i = 0; i < missing.length; i += 100) {
                await refreshNaverStatuses(missing.slice(i, i + 100));
            }
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [statusFilter, products]);

    // ── 페이지네이션 ──
    const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PRODUCT_PAGE_SIZE));
    const currentPage = Math.min(productPage, totalPages);
    const visibleProducts = filteredProducts.slice((currentPage - 1) * PRODUCT_PAGE_SIZE, currentPage * PRODUCT_PAGE_SIZE);
    const pageWindow = useMemo(() => {
        const maxButtons = 7;
        let start = Math.max(1, currentPage - Math.floor(maxButtons / 2));
        const end = Math.min(totalPages, start + maxButtons - 1);
        start = Math.max(1, end - maxButtons + 1);
        return Array.from({ length: end - start + 1 }, (_, i) => start + i);
    }, [currentPage, totalPages]);

    // 현재 페이지에서 규격(복합옵션)이 있는 상품들 → 전체 펼치기/접기 토글용
    const combosOnPage = visibleProducts.filter(p => activeCombos(p).length > 0);
    const allExpanded = combosOnPage.length > 0 && combosOnPage.every(p => expandedIds.includes(p.id));
    const toggleAll = () => setExpandedIds(allExpanded ? [] : combosOnPage.map(p => p.id));

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

    // 기본(전체) 매핑과 카테고리별 세부 매핑을 분리
    const defaultMapping = useMemo(() => mappings.find(m => m.kioskMainCategory === DEFAULT_MAIN) || null, [mappings]);
    const specificMappings = useMemo(() => mappings.filter(m => m.kioskMainCategory !== DEFAULT_MAIN), [mappings]);

    // 저장된 기본 매핑이 로드되면 입력값에 반영
    useEffect(() => {
        setDefaultForm({
            naverLeafCategoryId: defaultMapping ? String(defaultMapping.naverLeafCategoryId) : '',
            naverCategoryName: defaultMapping?.naverCategoryName || '',
        });
    }, [defaultMapping]);

    const mainName = (id) => mainCategories.find(m => m.id === id)?.name || id;
    const subName = (mainId, subId) => subCategories[mainId]?.find(s => s.id === subId)?.name || subId;

    // 기본(전체) 카테고리 저장 — 기존 기본 매핑이 있으면 지우고 새로 등록(중복 방지)
    const saveDefault = async () => {
        if (!defaultForm.naverLeafCategoryId) {
            return alert('네이버 리프 카테고리 ID 를 입력하세요.');
        }
        try {
            if (defaultMapping) {
                await fetch(`/api/channels/naver/admin/category-mappings/${defaultMapping.id}`, { method: 'DELETE' });
            }
            const res = await fetch('/api/channels/naver/admin/category-mappings', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    kioskMainCategory: DEFAULT_MAIN,
                    kioskSubCategory: null,
                    naverLeafCategoryId: Number(defaultForm.naverLeafCategoryId),
                    naverCategoryName: defaultForm.naverCategoryName || null,
                })
            });
            if (res.ok) loadMappings();
            else alert('저장 실패');
        } catch { alert('네트워크 오류'); }
    };

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

            {/* ── 탭 바 ── */}
            <div className="naver-tabs">
                {TABS.map((t, i) => (
                    <button
                        key={t.key}
                        className={`naver-tab ${activeTab === t.key ? 'active' : ''}`}
                        onClick={() => goTab(t.key)}
                    >
                        <span className="naver-tab-num">{i + 1}</span>
                        {t.label}
                    </button>
                ))}
            </div>

            {!configured && (
                <div style={{ background: '#fef3c7', border: '1px solid #f59e0b', color: '#92400e', padding: '12px 16px', borderRadius: '10px', marginBottom: '20px' }}>
                    ⚠ 네이버 커머스API 자격증명(client_id/secret)이 아직 설정되지 않았습니다. 백엔드 <code>.env</code> 의
                    <code> NAVER_COMMERCE_CLIENT_ID / SECRET </code> 를 채운 뒤 백엔드를 재시작하세요.
                </div>
            )}

            {/* ── 카테고리 매핑 ── */}
            {activeTab === 'mapping' && (
            <div className="admin-card">
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '6px' }}>기본 네이버 카테고리</h3>
                <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '16px' }}>
                    모든 상품은 여기서 지정한 네이버 카테고리로 자동 등록됩니다. 카테고리별로 따로 매핑할 필요 없이,
                    아래 <b>기본 카테고리</b> 하나만 설정하면 됩니다. 리프(최하위) 카테고리 ID 는 스마트스토어센터
                    상품등록 화면에서 카테고리 선택 시 확인할 수 있습니다.
                </p>

                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '10px' }}>
                    <label style={{ display: 'flex', flexDirection: 'column', fontSize: '0.8rem', color: '#475569' }}>
                        네이버 리프 카테고리 ID
                        <input type="number" value={defaultForm.naverLeafCategoryId}
                            onChange={e => setDefaultForm(f => ({ ...f, naverLeafCategoryId: e.target.value }))}
                            placeholder="예: 50003288" style={inputStyle} />
                    </label>
                    <label style={{ display: 'flex', flexDirection: 'column', fontSize: '0.8rem', color: '#475569' }}>
                        네이버 카테고리명(메모)
                        <input type="text" value={defaultForm.naverCategoryName}
                            onChange={e => setDefaultForm(f => ({ ...f, naverCategoryName: e.target.value }))}
                            placeholder="예: 생활/건강 > 공구 > 설비공구 > 배관용품" style={{ ...inputStyle, width: '300px' }} />
                    </label>
                    <button className="apply-btn" onClick={saveDefault}>💾 기본 카테고리 저장</button>
                </div>
                <div style={{ fontSize: '0.85rem', color: defaultMapping ? '#15803d' : '#b45309', marginBottom: '4px' }}>
                    {defaultMapping
                        ? `✔ 현재 기본 카테고리: ${defaultMapping.naverCategoryName || '(메모 없음)'} · 리프 ID ${defaultMapping.naverLeafCategoryId}`
                        : '⚠ 아직 기본 카테고리가 설정되지 않았습니다. 상품 전송 전에 먼저 저장하세요.'}
                </div>

                {/* ── 세부 매핑(선택) — 특정 카테고리만 다른 네이버 카테고리로 보낼 때 ── */}
                <div style={{ marginTop: '20px', borderTop: '1px solid #e2e8f0', paddingTop: '14px' }}>
                    <button className="action-btn" onClick={() => setShowAdvanced(v => !v)}
                        style={{ fontSize: '0.85rem', color: '#475569' }}>
                        {showAdvanced ? '▾' : '▸'} 카테고리별 세부 매핑 (선택){specificMappings.length > 0 ? ` · ${specificMappings.length}건` : ''}
                    </button>
                    {showAdvanced && (
                    <>
                        <p style={{ color: '#64748b', fontSize: '0.82rem', margin: '10px 0 14px' }}>
                            특정 키오스크 카테고리만 기본과 다른 네이버 카테고리로 보내고 싶을 때만 사용하세요.
                            여기서 매핑한 카테고리는 기본 카테고리 대신 이 값이 우선 적용됩니다.
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
                                {specificMappings.map(m => (
                                    <tr key={m.id}>
                                        <td>{mainName(m.kioskMainCategory)}{m.kioskSubCategory ? ` › ${subName(m.kioskMainCategory, m.kioskSubCategory)}` : ' (전체)'}</td>
                                        <td>{m.naverLeafCategoryId}</td>
                                        <td style={{ color: '#64748b' }}>{m.naverCategoryName || '-'}</td>
                                        <td style={{ textAlign: 'right' }}>
                                            <button className="action-btn" style={{ color: '#ef4444' }} onClick={() => deleteMapping(m.id)}>삭제</button>
                                        </td>
                                    </tr>
                                ))}
                                {specificMappings.length === 0 && (
                                    <tr><td colSpan={4} style={{ textAlign: 'center', color: '#94a3b8', padding: '30px' }}>세부 매핑이 없습니다. 기본 카테고리만으로 충분합니다.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </>
                    )}
                </div>
            </div>
            )}

            {/* ── 상품 전송(개별/일괄) ── */}
            {activeTab === 'push' && (
            <div className="admin-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '10px' }}>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>상품</h3>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <input
                            type="text"
                            placeholder="초성 또는 상품명으로 검색해주셔요..."
                            value={productFilter}
                            onChange={e => { setProductFilter(e.target.value); setProductPage(1); }}
                            style={{ ...inputStyle, width: '220px' }}
                        />
                        <select
                            value={statusFilter}
                            onChange={e => { setStatusFilter(e.target.value); setProductPage(1); }}
                            style={{ ...selectStyle, marginTop: 0, minWidth: '120px' }}
                            title="네이버 연동 상태로 필터"
                        >
                            {STATUS_FILTERS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                        </select>
                        {combosOnPage.length > 0 && (
                            <button className="action-btn" onClick={toggleAll} title="이 페이지의 모든 규격을 펼치거나 접습니다">
                                {allExpanded ? '규격 접기' : '규격 펼치기'}
                            </button>
                        )}
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
                            <th style={{ width: '28px' }}></th>
                            <th>상품명</th>
                            <th style={{ width: '150px' }}>규격</th>
                            <th style={{ width: '160px' }}>판매가</th>
                            <th style={{ width: '90px', textAlign: 'center' }}>상태</th>
                            <th style={{ width: '110px', textAlign: 'center' }}>전송</th>
                        </tr>
                    </thead>
                    <tbody>
                        {visibleProducts.map(p => {
                            const b = naverBadge(p);
                            const combos = activeCombos(p);
                            const repPrice = combos.length ? Math.min(...combos.map(c => c.priceC || 0)) : 0; // 대표(최저) 옵션가 = 추가금 기준
                            const isExpanded = expandedIds.includes(p.id);
                            return (
                                <Fragment key={p.id}>
                                    <tr>
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
                                        <td style={{ textAlign: 'center' }}>
                                            {combos.length > 0 && (
                                                <button
                                                    onClick={() => toggleExpand(p.id)}
                                                    title="규격 펼치기/접기"
                                                    style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#64748b', fontSize: '0.8rem', padding: 0 }}
                                                >
                                                    {isExpanded ? '▾' : '▸'}
                                                </button>
                                            )}
                                        </td>
                                        <td style={{ fontWeight: 700 }}>{p.name}</td>
                                        <td>
                                            {combos.length > 0 ? (
                                                <button
                                                    onClick={() => toggleExpand(p.id)}
                                                    style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#2563eb', fontWeight: 600, fontSize: '0.85rem', padding: 0 }}
                                                >
                                                    규격 {combos.length}개
                                                </button>
                                            ) : (
                                                <span style={{ color: p.gyu ? '#0f172a' : '#94a3b8' }}>{p.gyu || '-'}</span>
                                            )}
                                        </td>
                                        <td style={{ fontWeight: 600 }}>{priceLabel(p)}</td>
                                        <td style={{ textAlign: 'center', position: 'relative' }}>
                                            {(() => {
                                                const badgeStyle = { fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: '10px', color: b.color, background: b.bg, whiteSpace: 'nowrap' };
                                                const link = naverLink(p);
                                                if (!link) {
                                                    // 미연동/미조회 상품은 상태 변경 불가 → 정적 배지
                                                    return <span title={b.title || ''} style={badgeStyle}>{b.label}</span>;
                                                }
                                                const busy = statusBusyId === p.id;
                                                const suspended = link.naverStatus === 'SUSPENSION';
                                                return (
                                                    <>
                                                        <button
                                                            type="button"
                                                            title={b.title || '클릭하여 판매상태 변경'}
                                                            disabled={busy}
                                                            onClick={() => setStatusMenuId(statusMenuId === p.id ? null : p.id)}
                                                            style={{ ...badgeStyle, border: 'none', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.5 : 1 }}
                                                        >
                                                            {busy ? '변경중…' : `${b.label} ▾`}
                                                        </button>
                                                        {statusMenuId === p.id && (
                                                            <>
                                                                {/* 바깥 클릭 시 닫기용 백드롭 */}
                                                                <div onClick={() => setStatusMenuId(null)} style={{ position: 'fixed', inset: 0, zIndex: 10 }} />
                                                                <div style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: '4px', zIndex: 11, background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', boxShadow: '0 6px 20px rgba(0,0,0,0.12)', overflow: 'hidden', minWidth: '120px' }}>
                                                                    <button type="button" disabled={!suspended} onClick={() => changeStatus(p.id, 'SALE')} style={statusMenuItemStyle(!suspended)}>▶ 판매중</button>
                                                                    <button type="button" disabled={suspended} onClick={() => changeStatus(p.id, 'SUSPENSION')} style={statusMenuItemStyle(suspended)}>⏸ 판매중지</button>
                                                                </div>
                                                            </>
                                                        )}
                                                    </>
                                                );
                                            })()}
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
                                    {isExpanded && combos.length > 0 && (
                                        <tr>
                                            <td colSpan={7} style={{ background: '#f8fafc', padding: '0 0 0 68px' }}>
                                                <table className="combo-detail-table">
                                                    <thead>
                                                        <tr>
                                                            <th>규격</th>
                                                            <th style={{ width: '140px', textAlign: 'right' }}>추가금액</th>
                                                            <th style={{ width: '140px', textAlign: 'right' }}>판매가</th>
                                                            <th style={{ width: '100px', textAlign: 'right' }}>재고</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {combos.map((c, i) => (
                                                            <tr key={i}>
                                                                <td style={{ fontWeight: 600 }}>{c.name}</td>
                                                                <td style={{ textAlign: 'right', color: '#64748b' }}>
                                                                    {(c.priceC || 0) - repPrice > 0 ? `+${((c.priceC || 0) - repPrice).toLocaleString()}원` : '-'}
                                                                </td>
                                                                <td style={{ textAlign: 'right', fontWeight: 700 }}>{comboPrice(c).toLocaleString()}원</td>
                                                                <td style={{ textAlign: 'right' }}>{c.stock ?? 0}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </td>
                                        </tr>
                                    )}
                                </Fragment>
                            );
                        })}
                        {visibleProducts.length === 0 && (
                            <tr><td colSpan={7} style={{ textAlign: 'center', color: '#94a3b8', padding: '30px' }}>표시할 상품이 없습니다.</td></tr>
                        )}
                    </tbody>
                </table>
                {totalPages > 1 && (
                    <div className="naver-pagination">
                        <button className="page-btn" disabled={currentPage === 1} onClick={() => setProductPage(1)}>«</button>
                        <button className="page-btn" disabled={currentPage === 1} onClick={() => setProductPage(currentPage - 1)}>‹</button>
                        {pageWindow.map(n => (
                            <button
                                key={n}
                                className={`page-btn ${n === currentPage ? 'active' : ''}`}
                                onClick={() => setProductPage(n)}
                            >
                                {n}
                            </button>
                        ))}
                        <button className="page-btn" disabled={currentPage === totalPages} onClick={() => setProductPage(currentPage + 1)}>›</button>
                        <button className="page-btn" disabled={currentPage === totalPages} onClick={() => setProductPage(totalPages)}>»</button>
                    </div>
                )}
            </div>
            )}

            {/* ── 동기화 미리보기/수락 ── */}
            {activeTab === 'sync' && (
            <div className="admin-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>재고·가격·상품명 동기화</h3>
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
            )}

            {/* ── 최근 판매 확인 ── */}
            {activeTab === 'sales' && (
            <div className="admin-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>최근 판매 확인</h3>
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
            )}
        </div>
    );
};

// 상태 변경 팝오버 메뉴 항목 스타일. isCurrent=true 면 현재 상태(비활성/회색).
const statusMenuItemStyle = (isCurrent) => ({
    display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px',
    fontSize: '0.8rem', border: 'none', background: isCurrent ? '#f1f5f9' : 'white',
    color: isCurrent ? '#94a3b8' : '#0f172a', cursor: isCurrent ? 'default' : 'pointer', whiteSpace: 'nowrap',
});

const selectStyle = { padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', marginTop: '4px', minWidth: '150px' };
const inputStyle = { padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', marginTop: '4px', width: '160px' };

export default NaverSyncPage;
