import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { describeError, describeResponseError } from '../../utils/apiError';

const KIND_LABELS = { 3: '매출', 4: '매입', 13: '발주' };

const won = (n) => Number(n || 0).toLocaleString('ko-KR');

const todayInput = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const monthStartInput = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
};

// crypto.randomUUID 는 보안 컨텍스트(https 또는 localhost)에서만 존재한다.
// 내부망 IP(http://192.168.x.x:5173)로 열면 없어서 화면이 통째로 죽는다.
const newRequestId = () => {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
    const rand = () => Math.random().toString(16).slice(2, 10);
    return `${Date.now().toString(16)}-${rand()}-${rand()}`;
};

const readError = (res) => describeResponseError(res, '요청을 처리하지 못했습니다.');

/** 격자의 한 줄. itemCode 가 없으면 아직 품목이 안 정해진 빈 줄이다. */
const emptyRow = () => ({
    key: newRequestId(),
    itemCode: null,
    itemName: '',
    gyu: '',
    danwi: '',
    jego: null,
    ea: '',
    price: '',
    remark: '',
    lastVendorCode: null,
    lastVendorName: '',
    lastDate: '',
});

/** 격자에서 좌우/엔터로 옮겨 다니는 입력 칸 순서. */
const COLUMNS = ['itemName', 'ea', 'price', 'remark'];

/**
 * 재고 입고 관리 페이지.
 *
 * 경영박사(ERP 클라이언트)는 동시접속 2대 제한이 있어 세 번째 담당자가 띄울 수 없다.
 * 그래서 입고만 여기서 처리하고, 백엔드가 ERP 에 매입전표(IL<yy> KIND=4)를 직접 기록한다.
 *
 * 입력 방식은 경영박사의 전표 입력 화면을 그대로 따른다. 창고에서 쓰던 손버릇을 바꾸지
 * 않도록 마우스 없이 키보드만으로 끝까지 입력할 수 있어야 한다:
 *   품명 입력 → ↑↓ 로 품목 고르고 Enter → 수량 → 단가 → 적요 → Enter 면 다음 줄
 */
const ErpReceivingPage = () => {
    const [tab, setTab] = useState('entry');         // 'entry' | 'history'
    const [status, setStatus] = useState(null);
    const [date, setDate] = useState(todayInput());
    const [memo, setMemo] = useState('');

    const [vendors, setVendors] = useState([]);
    const [vendorCode, setVendorCode] = useState(null);
    const [vendorText, setVendorText] = useState('');
    const [vendorOpen, setVendorOpen] = useState(false);
    const [vendorIndex, setVendorIndex] = useState(0);

    const [rows, setRows] = useState([emptyRow()]);
    const [searchRow, setSearchRow] = useState(null);  // 품목 후보를 띄울 줄 번호
    // 후보 목록은 "어느 검색어의 결과인지"를 함께 들고 다닌다. 그래야 타이핑 중 Enter 를 쳐도
    // 아직 안 바뀐 옛 결과에서 엉뚱한 품목이 선택되는 일이 없다.
    const [results, setResults] = useState({ keyword: '', items: [] });
    const [resultIndex, setResultIndex] = useState(0);

    const [preview, setPreview] = useState(null);
    const [history, setHistory] = useState([]);
    const [historyFrom, setHistoryFrom] = useState(monthStartInput());
    const [historyTo, setHistoryTo] = useState(todayInput());
    const [historyQuery, setHistoryQuery] = useState('');
    const [historyDetail, setHistoryDetail] = useState(null);
    const [recent, setRecent] = useState(null);      // { code, name, rows }
    const [busy, setBusy] = useState('');            // '' | 'searching' | 'previewing' | 'saving' | 'cancelling'
    const [error, setError] = useState('');
    const [saved, setSaved] = useState(null);

    // 폼 1회당 하나. 더블클릭이나 네트워크 재시도가 전표를 두 번 만들지 못하게 하는 멱등키다.
    const requestIdRef = useRef(newRequestId());
    const searchSeqRef = useRef(0);
    const cellRefs = useRef({});
    const resultRefs = useRef({});
    const resultListRef = useRef(null);
    const vendorRefs = useRef({});
    const vendorRef = useRef(null);

    const writeEnabled = status?.writeEnabled === true;

    const load = useCallback(async (url, setter, onFail) => {
        try {
            const res = await fetch(url);
            if (!res.ok) return setError(await readError(res));
            setter(await res.json());
        } catch (e) {
            setError(describeError(e, onFail));
        }
    }, []);

    const loadHistory = useCallback((from = historyFrom, to = historyTo, q = historyQuery) => {
        const query = new URLSearchParams({ from, to });
        if (q.trim()) query.set('q', q.trim());
        load(`/api/erp-receiving/admin/history?${query}`, setHistory, '입고 이력을 불러오지 못했습니다.');
    }, [historyFrom, historyTo, historyQuery, load]);

    useEffect(() => {
        load('/api/erp-receiving/admin/status', setStatus, '상태를 불러오지 못했습니다.');
        load('/api/erp-receiving/admin/vendors', setVendors, '매입처 목록을 불러오지 못했습니다.');
        const query = new URLSearchParams({ from: monthStartInput(), to: todayInput() });
        load(`/api/erp-receiving/admin/history?${query}`, setHistory, '입고 이력을 불러오지 못했습니다.');
    }, [load]);

    // 품목 검색. 입력 중인 줄의 품명만 대상으로 한다(디바운스 250ms).
    const keyword = searchRow != null ? (rows[searchRow]?.itemName || '').trim() : '';
    useEffect(() => {
        if (!keyword) { setResults({ keyword: '', items: [] }); return; }
        const seq = ++searchSeqRef.current;
        const timer = setTimeout(async () => {
            setBusy('searching');
            try {
                const res = await fetch(`/api/erp-receiving/admin/items?q=${encodeURIComponent(keyword)}`);
                // 먼저 보낸 요청이 늦게 도착해 최신 결과를 덮어쓰지 않도록 순번으로 막는다.
                if (seq !== searchSeqRef.current) return;
                if (!res.ok) { setError(await readError(res)); setResults({ keyword, items: [] }); }
                else { setResults({ keyword, items: await res.json() }); setResultIndex(0); }
            } catch (e) {
                if (seq === searchSeqRef.current) setError(describeError(e, '품목 검색에 실패했습니다.'));
            } finally {
                if (seq === searchSeqRef.current) setBusy('');
            }
        }, 250);
        return () => clearTimeout(timer);
    }, [keyword]);

    /** 지금 입력한 글자에 대한 결과가 준비됐는가. 아니면 Enter 로 아무것도 고르지 않는다. */
    const resultsReady = results.keyword === keyword && results.items.length > 0;

    // 고정 헤더 아래의 실제 가시 영역을 기준으로 선택 줄을 따라간다.
    // scrollIntoView(nearest)는 sticky 헤더에 가린 첫 행도 "보인다"고 판단해 위쪽 한 줄을 잘랐다.
    useEffect(() => {
        const list = resultListRef.current;
        const row = resultRefs.current[resultIndex];
        if (!list || !row) return;

        const listRect = list.getBoundingClientRect();
        const rowRect = row.getBoundingClientRect();
        const headerHeight = list.querySelector('thead')?.getBoundingClientRect().height || 48;
        const visibleTop = listRect.top + headerHeight;

        if (rowRect.top < visibleTop) {
            list.scrollTop -= visibleTop - rowRect.top;
        } else if (rowRect.bottom > listRect.bottom) {
            list.scrollTop += rowRect.bottom - listRect.bottom;
        }
    }, [resultIndex, results]);

    useEffect(() => {
        vendorRefs.current[vendorIndex]?.scrollIntoView({ block: 'nearest' });
    }, [vendorIndex, vendorOpen]);

    // ── 격자 조작 ───────────────────────────────────────────────────────────

    const focusCell = (rowIdx, col) => {
        const el = cellRefs.current[`${rowIdx}-${col}`];
        if (el) { el.focus(); el.select?.(); }
    };

    /**
     * 줄 수정. 마지막 줄에 뭔가 들어가면 빈 줄을 하나 더 붙여 둔다
     * (경영박사처럼 줄이 끊기지 않게). effect 로 하면 매 입력마다 렌더가 두 번 돈다.
     */
    const patchRow = (idx, patch) => {
        setPreview(null);
        setRows(prev => {
            const next = prev.map((r, i) => (i === idx ? { ...r, ...patch } : r));
            const last = next[next.length - 1];
            if (last && (last.itemCode || last.itemName.trim())) next.push(emptyRow());
            return next;
        });
    };

    const chooseItem = (idx, item) => {
        const price = item.lastPrice != null ? Math.round(Number(item.lastPrice))
            : (item.INPR ? Math.round(Number(item.INPR)) : '');
        patchRow(idx, {
            itemCode: item.CODE,
            itemName: String(item.ITEM || '').trim(),
            gyu: String(item.GYU || '').trim(),
            danwi: String(item.DANWI || '').trim(),
            jego: Number(item.JEGO || 0),
            price,
            ea: '',
            lastVendorCode: item.lastVendorCode ?? null,
            lastVendorName: item.lastVendorName || '',
            lastDate: item.lastDate || '',
        });
        // 매입처가 비어 있으면 직전 매입처를 그대로 제안한다.
        if (vendorCode == null && item.lastVendorCode != null) {
            setVendorCode(Number(item.lastVendorCode));
            setVendorText(item.lastVendorName || String(item.lastVendorCode));
        }
        setSearchRow(null);
        setResults({ keyword: '', items: [] });
        setTimeout(() => focusCell(idx, 'ea'), 0);
    };

    const removeRow = (idx) => {
        setPreview(null);
        setRows(prev => (prev.length <= 1 ? [emptyRow()] : prev.filter((_, i) => i !== idx)));
    };

    /** 격자 키보드 이동. Enter/→ 는 다음 칸, ↑↓ 는 위아래 줄, 마지막 칸 Enter 면 다음 줄 품명. */
    const onCellKeyDown = (e, rowIdx, col) => {
        const colIdx = COLUMNS.indexOf(col);

        // 품명 칸에서 후보 목록이 열려 있으면 ↑↓/Enter 는 목록 조작에 쓴다.
        if (col === 'itemName' && searchRow === rowIdx && resultsReady) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                return setResultIndex(i => Math.min(i + 1, results.items.length - 1));
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                return setResultIndex(i => Math.max(i - 1, 0));
            }
            if (e.key === 'Enter') {
                e.preventDefault();
                return chooseItem(rowIdx, results.items[resultIndex]);
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                return setResults({ keyword: '', items: [] });
            }
        }

        // 아직 품목이 안 정해진 줄에서는 Enter 로 다음 칸에 넘어가지 못하게 막는다.
        // (검색 중이거나 후보를 못 고른 상태에서 넘어가면 품명만 적힌 유령 줄이 생긴다.)
        if (col === 'itemName' && e.key === 'Enter' && !rows[rowIdx]?.itemCode) {
            e.preventDefault();
            return;
        }

        if (e.key === 'Enter') {
            e.preventDefault();
            if (colIdx < COLUMNS.length - 1) return focusCell(rowIdx, COLUMNS[colIdx + 1]);
            return focusCell(rowIdx + 1, 'itemName');   // 마지막 칸 → 다음 줄
        }
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            return focusCell(rowIdx + 1, col);
        }
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            return focusCell(rowIdx - 1, col);
        }
        // 숫자 칸에서는 좌우 화살표로 칸을 옮긴다(텍스트 칸은 커서 이동이 우선).
        if (col !== 'itemName' && col !== 'remark') {
            if (e.key === 'ArrowRight' && colIdx < COLUMNS.length - 1) {
                e.preventDefault();
                return focusCell(rowIdx, COLUMNS[colIdx + 1]);
            }
            if (e.key === 'ArrowLeft' && colIdx > 0) {
                e.preventDefault();
                return focusCell(rowIdx, COLUMNS[colIdx - 1]);
            }
        }
        if (e.key === 'Delete' && (e.ctrlKey || e.shiftKey)) {
            e.preventDefault();
            removeRow(rowIdx);
            return focusCell(Math.max(rowIdx - 1, 0), 'itemName');
        }
    };

    // ── 매입처(상호) 자동완성 ───────────────────────────────────────────────

    const vendorMatches = useMemo(() => {
        const q = vendorText.trim();
        if (!q) return vendors.slice(0, 20);
        const lower = q.toLowerCase();
        return vendors.filter(v => String(v.NAME || '').toLowerCase().includes(lower)
            || String(v.CODE).includes(q)).slice(0, 20);
    }, [vendors, vendorText]);

    const chooseVendor = (v) => {
        setVendorCode(Number(v.CODE));
        setVendorText(v.NAME);
        setVendorOpen(false);
        setPreview(null);
        setTimeout(() => focusCell(0, 'itemName'), 0);
    };

    const onVendorKeyDown = (e) => {
        if (!vendorOpen && (e.key === 'ArrowDown' || e.key === 'Enter')) {
            setVendorOpen(true);
            return;
        }
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            return setVendorIndex(i => Math.min(i + 1, vendorMatches.length - 1));
        }
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            return setVendorIndex(i => Math.max(i - 1, 0));
        }
        if (e.key === 'Enter') {
            e.preventDefault();
            if (vendorMatches[vendorIndex]) chooseVendor(vendorMatches[vendorIndex]);
            return;
        }
        if (e.key === 'Escape') setVendorOpen(false);
    };

    // ── 합계/전송 ───────────────────────────────────────────────────────────

    const filled = rows.filter(r => r.itemCode && Number(r.ea) > 0);
    const total = useMemo(
        () => filled.reduce((sum, r) => sum + (Number(r.price) || 0) * (Number(r.ea) || 0), 0),
        [filled]
    );
    const totalQty = filled.reduce((sum, r) => sum + (Number(r.ea) || 0), 0);
    const missingPrice = filled.some(r => r.price === '' || r.price == null);
    const canSubmit = filled.length > 0 && !missingPrice && vendorCode != null;

    const body = () => ({
        clientRequestId: requestIdRef.current,
        date,
        vendorCode,
        memo,
        lines: filled.map(r => ({
            itemCode: r.itemCode,
            ea: Number(r.ea) || 0,
            price: Number(r.price) || 0,
            remark: r.remark || '',
        })),
    });

    const post = async (url, payload) => {
        let res;
        try {
            res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
        } catch (e) {
            throw new Error(describeError(e, '요청을 보내지 못했습니다.'));
        }
        if (!res.ok) throw new Error(await readError(res));
        return res.json();
    };

    const runPreview = async () => {
        setBusy('previewing'); setError(''); setSaved(null);
        try {
            setPreview(await post('/api/erp-receiving/admin/preview', body()));
        } catch (e) {
            setError(e.message); setPreview(null);
        } finally {
            setBusy('');
        }
    };

    const save = async () => {
        if (!window.confirm(`품목 ${filled.length}건, 합계 ${won(total)}원을 ERP 에 입고 처리합니다. 진행할까요?`)) return;
        setBusy('saving'); setError('');
        try {
            const result = await post('/api/erp-receiving/admin/vouchers', body());
            setSaved(result);
            setRows([emptyRow()]); setPreview(null); setMemo('');
            requestIdRef.current = newRequestId(); // 다음 전표는 새 멱등키로
            loadHistory();
        } catch (e) {
            setError(e.message);
        } finally {
            setBusy('');
        }
    };

    const cancel = async (row) => {
        if (!window.confirm(`${row.erpDate} 전표 ${row.voucherNo}번(${row.lineCount}줄)을 ERP 에서 삭제합니다. 진행할까요?`)) return;
        setBusy('cancelling'); setError('');
        try {
            await post(`/api/erp-receiving/admin/vouchers/${row.id}/cancel`, {});
            loadHistory();
        } catch (e) {
            setError(e.message);
        } finally {
            setBusy('');
        }
    };

    const showRecent = async (code, name) => {
        setError('');
        try {
            const res = await fetch(`/api/erp-receiving/admin/items/${code}/recent`);
            if (!res.ok) return setError(await readError(res));
            setRecent({ code, name, rows: await res.json() });
        } catch (e) {
            setError(describeError(e, '최근 거래를 불러오지 못했습니다.'));
        }
    };

    const showHistoryDetail = async (row) => {
        setBusy('history-detail'); setError('');
        try {
            const query = new URLSearchParams({
                date: row.erpDate,
                voucherNo: row.voucherNo,
                vendorCode: row.vendorCode,
            });
            const res = await fetch(`/api/erp-receiving/admin/history/detail?${query}`);
            if (!res.ok) return setError(await readError(res));
            setHistoryDetail(await res.json());
        } catch (e) {
            setError(describeError(e, '전표 상세를 불러오지 못했습니다.'));
        } finally {
            setBusy('');
        }
    };

    // ── 렌더 ────────────────────────────────────────────────────────────────

    const cellInput = {
        width: '100%', border: 'none', outline: 'none', background: 'transparent',
        padding: '10px 12px', fontSize: '1.02rem', fontFamily: 'inherit',
    };
    const gridCell = { borderRight: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', padding: 0 };
    const gridHead = {
        background: '#f1f5f9', borderRight: '1px solid #cbd5e1', borderBottom: '1px solid #cbd5e1',
        padding: '11px 8px', fontSize: '0.9rem', fontWeight: 700, color: '#334155', textAlign: 'center',
        textTransform: 'none', letterSpacing: 0,
    };

    return (
        <div style={{ padding: '24px', maxWidth: '1200px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '14px' }}>
                <h2 style={{ margin: 0, fontSize: '1.4rem' }}>재고 입고 관리</h2>
                {status && (writeEnabled
                    ? <span style={{ background: '#dcfce7', color: '#166534', padding: '4px 10px', borderRadius: '999px', fontSize: '0.78rem', fontWeight: 700 }}>ERP 기록 가능</span>
                    : <span style={{ background: '#fef3c7', color: '#92400e', padding: '4px 10px', borderRadius: '999px', fontSize: '0.78rem', fontWeight: 700 }}>읽기 전용</span>
                )}
            </div>

            {/* ── 탭 ── */}
            <div style={{ display: 'flex', gap: '4px', borderBottom: '2px solid #e2e8f0', marginBottom: '18px' }}>
                {[{ key: 'entry', label: '입고 입력' }, { key: 'history', label: `이전 기록${history.length ? ` (${history.length})` : ''}` }].map(t => (
                    <button
                        key={t.key}
                        onClick={() => setTab(t.key)}
                        style={{
                            padding: '10px 22px', border: 'none', cursor: 'pointer', fontSize: '0.95rem',
                            fontWeight: 700, background: 'transparent', marginBottom: '-2px',
                            color: tab === t.key ? 'var(--admin-primary)' : '#94a3b8',
                            borderBottom: `2px solid ${tab === t.key ? 'var(--admin-primary)' : 'transparent'}`,
                        }}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {error && (
                <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '12px 14px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.9rem' }}>
                    {error}
                </div>
            )}

            {saved && tab === 'entry' && (
                <div style={{ background: '#dcfce7', color: '#166534', padding: '14px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.9rem', lineHeight: 1.7 }}>
                    <strong>입고 완료</strong> — {saved.dDate} 전표 {saved.dNo}번, {saved.lineCount}줄 / {won(saved.totalAmount)}원
                    {saved.duplicate && ' (이미 저장돼 있던 전표입니다)'}
                    <br />경영박사에서 해당 전표가 정상으로 보이는지 확인해 주세요.
                </div>
            )}

            {tab === 'entry' && (
                <>
                    {/* ── 전표 머리 ── */}
                    <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '14px' }}>
                        <div>
                            <label className="admin-label">입고일자</label>
                            <input type="date" className="admin-input-small" style={{ width: '170px' }} value={date}
                                onChange={e => { setDate(e.target.value); setPreview(null); }} />
                        </div>

                        <div style={{ position: 'relative', width: '260px' }}>
                            <label className="admin-label">상호(매입처) <span style={{ color: '#dc2626' }}>*</span></label>
                            <input
                                ref={vendorRef}
                                className="admin-input-small"
                                value={vendorText}
                                placeholder="상호를 입력하세요"
                                onChange={e => {
                                    setVendorText(e.target.value);
                                    setVendorCode(null);
                                    setVendorOpen(true);
                                    setVendorIndex(0);
                                    setPreview(null);
                                }}
                                onFocus={() => setVendorOpen(true)}
                                onBlur={() => setTimeout(() => setVendorOpen(false), 150)}
                                onKeyDown={onVendorKeyDown}
                                style={{ borderColor: vendorCode == null && vendorText ? '#dc2626' : undefined }}
                            />
                            {vendorOpen && vendorMatches.length > 0 && (
                                <ul style={{
                                    position: 'absolute', zIndex: 20, left: 0, right: 0, top: '100%', margin: 0,
                                    padding: '6px 0', listStyle: 'none', background: '#fff', border: '1px solid #94a3b8',
                                    borderRadius: '10px', boxShadow: '0 16px 32px -8px rgba(0,0,0,.28)',
                                    maxHeight: 'min(46vh, 430px)', overflowY: 'auto', minWidth: '320px',
                                }}>
                                    {vendorMatches.map((v, i) => (
                                        <li key={v.CODE}
                                            ref={el => { vendorRefs.current[i] = el; }}
                                            onMouseDown={() => chooseVendor(v)}
                                            onMouseEnter={() => setVendorIndex(i)}
                                            style={{
                                                padding: '11px 16px', cursor: 'pointer', fontSize: '1.05rem',
                                                fontWeight: i === vendorIndex ? 700 : 500,
                                                background: i === vendorIndex ? '#dbeafe' : 'transparent',
                                                borderLeft: `4px solid ${i === vendorIndex ? '#2563eb' : 'transparent'}`,
                                            }}>
                                            {v.NAME} <span style={{ color: '#94a3b8', fontSize: '0.88rem' }}>{v.CODE}</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>

                        <div style={{ flex: 1, minWidth: '200px' }}>
                            <label className="admin-label">전표 메모 (선택)</label>
                            <input className="admin-input-small" value={memo}
                                onChange={e => { setMemo(e.target.value); setPreview(null); }}
                                placeholder="줄마다 적요를 안 쓰면 이 메모가 들어갑니다" />
                        </div>
                    </div>

                    {/* ── 격자 ── */}
                    <div style={{ border: '1px solid #cbd5e1', borderRadius: '8px', overflow: 'visible', background: '#fff' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                            <colgroup>
                                <col style={{ width: '42px' }} />
                                <col />
                                <col style={{ width: '150px' }} />
                                <col style={{ width: '60px' }} />
                                <col style={{ width: '90px' }} />
                                <col style={{ width: '110px' }} />
                                <col style={{ width: '120px' }} />
                                <col style={{ width: '100px' }} />
                                <col style={{ width: '150px' }} />
                                <col style={{ width: '44px' }} />
                            </colgroup>
                            <thead>
                                <tr>
                                    <th style={gridHead}>No</th>
                                    <th style={gridHead}>품명</th>
                                    <th style={gridHead}>규격</th>
                                    <th style={gridHead}>단위</th>
                                    <th style={gridHead}>수량</th>
                                    <th style={gridHead}>단가</th>
                                    <th style={gridHead}>금액</th>
                                    <th style={gridHead}>부가세</th>
                                    <th style={gridHead}>적요</th>
                                    <th style={gridHead}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((r, idx) => {
                                    const amount = (Number(r.price) || 0) * (Number(r.ea) || 0);
                                    const showList = searchRow === idx && resultsReady;
                                    return (
                                        <tr key={r.key} style={{ background: idx % 2 ? '#f8fafc' : '#fff' }}>
                                            <td style={{ ...gridCell, textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
                                                {idx + 1}
                                            </td>

                                            {/* 품명 - 자동완성 */}
                                            <td style={{ ...gridCell, position: 'relative' }}>
                                                <input
                                                    ref={el => { cellRefs.current[`${idx}-itemName`] = el; }}
                                                    style={{ ...cellInput, fontWeight: r.itemCode ? 600 : 400 }}
                                                    value={r.itemName}
                                                    placeholder={idx === 0 ? '품명을 입력하세요' : ''}
                                                    onChange={e => {
                                                        // 품명을 다시 치면 품목 선택이 풀린다. 이때 단가/수량까지 비워야
                                                        // "품명은 A 인데 단가는 B 품목 값" 같은 유령 줄이 남지 않는다.
                                                        patchRow(idx, {
                                                            itemName: e.target.value, itemCode: null,
                                                            gyu: '', danwi: '', jego: null,
                                                            ea: '', price: '',
                                                            lastVendorCode: null, lastVendorName: '', lastDate: '',
                                                        });
                                                        setSearchRow(idx);
                                                    }}
                                                    onFocus={() => { if (!r.itemCode) setSearchRow(idx); }}
                                                    onBlur={() => setTimeout(() => setSearchRow(s => (s === idx ? null : s)), 150)}
                                                    onKeyDown={e => onCellKeyDown(e, idx, 'itemName')}
                                                />
                                                {!r.itemCode && r.itemName.trim() && !showList && (
                                                    <span style={{
                                                        position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
                                                        fontSize: '0.75rem', color: busy === 'searching' ? '#64748b' : '#dc2626',
                                                        pointerEvents: 'none',
                                                    }}>
                                                        {busy === 'searching' ? '검색 중…' : '품목 미선택'}
                                                    </span>
                                                )}
                                                {showList && (
                                                    <div ref={resultListRef} style={{
                                                        position: 'absolute', zIndex: 30, left: 0, top: '100%', width: 'min(1080px, 82vw)',
                                                        margin: 0, background: '#fff',
                                                        border: '1px solid #94a3b8', borderRadius: '10px',
                                                        boxShadow: '0 16px 32px -8px rgba(0,0,0,.28)', maxHeight: 'min(52vh, 520px)', overflowY: 'auto',
                                                    }}>
                                                        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                                                            <colgroup>
                                                                <col style={{ width: '72px' }} /><col /><col style={{ width: '180px' }} />
                                                                <col style={{ width: '90px' }} /><col style={{ width: '130px' }} />
                                                                <col style={{ width: '130px' }} /><col style={{ width: '130px' }} />
                                                            </colgroup>
                                                            <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}><tr>
                                                                {['코드', '품명', '규격', '재고', '입고가', '출고A가', '출고B가'].map(label => (
                                                                    <th key={label} style={{ padding: '11px 12px', background: '#334155', color: '#fff', borderRight: '1px solid #64748b', fontSize: '0.98rem', textAlign: label === '품명' || label === '규격' ? 'left' : 'right', whiteSpace: 'nowrap' }}>{label}</th>
                                                                ))}
                                                            </tr></thead>
                                                            <tbody>{results.items.map((item, i) => (
                                                            <tr key={item.CODE}
                                                                ref={el => { resultRefs.current[i] = el; }}
                                                                onMouseDown={() => chooseItem(idx, item)}
                                                                onMouseEnter={() => setResultIndex(i)}
                                                                style={{
                                                                    cursor: 'pointer', fontSize: '1.05rem', lineHeight: 1.35,
                                                                    background: i === resultIndex ? '#bfdbfe' : (i % 2 ? '#f8fafc' : '#fff'),
                                                                    fontWeight: i === resultIndex ? 700 : 500,
                                                                    outline: i === resultIndex ? '2px solid #2563eb' : 'none', outlineOffset: '-2px',
                                                                }}>
                                                                <td style={{ padding: '12px', borderBottom: '1px solid #e2e8f0', textAlign: 'right', color: '#64748b' }}>{item.CODE}</td>
                                                                <td style={{ padding: '12px', borderBottom: '1px solid #e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#0f172a' }}>{String(item.ITEM || '').trim()}</td>
                                                                <td style={{ padding: '12px', borderBottom: '1px solid #e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#475569' }}>{String(item.GYU || '').trim()}</td>
                                                                {[item.JEGO, item.INPR, item.OUTA, item.OUTB].map((value, cellIndex) => (
                                                                    <td key={cellIndex} style={{ padding: '12px', borderBottom: '1px solid #e2e8f0', textAlign: 'right' }}>{Number(value || 0).toLocaleString('ko-KR')}</td>
                                                                ))}
                                                            </tr>
                                                        ))}</tbody></table>
                                                    </div>
                                                )}
                                            </td>

                                            <td style={{ ...gridCell, padding: '8px 10px', color: '#64748b', fontSize: '0.88rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {r.gyu}
                                            </td>
                                            <td style={{ ...gridCell, padding: '8px', textAlign: 'center', color: '#64748b', fontSize: '0.88rem' }}>
                                                {r.danwi}
                                            </td>

                                            <td style={gridCell}>
                                                <input
                                                    ref={el => { cellRefs.current[`${idx}-ea`] = el; }}
                                                    type="number" min="1"
                                                    disabled={!r.itemCode}
                                                    style={{ ...cellInput, textAlign: 'right' }}
                                                    value={r.ea}
                                                    onChange={e => patchRow(idx, { ea: e.target.value })}
                                                    onKeyDown={e => onCellKeyDown(e, idx, 'ea')}
                                                />
                                            </td>
                                            <td style={gridCell}>
                                                <input
                                                    ref={el => { cellRefs.current[`${idx}-price`] = el; }}
                                                    type="number" min="0"
                                                    disabled={!r.itemCode}
                                                    style={{
                                                        ...cellInput, textAlign: 'right',
                                                        color: r.itemCode && r.price === '' ? '#dc2626' : undefined,
                                                    }}
                                                    value={r.price}
                                                    onChange={e => patchRow(idx, { price: e.target.value })}
                                                    onKeyDown={e => onCellKeyDown(e, idx, 'price')}
                                                />
                                            </td>

                                            <td style={{ ...gridCell, padding: '8px 10px', textAlign: 'right', fontWeight: 600 }}>
                                                {amount ? won(amount) : ''}
                                            </td>
                                            <td style={{ ...gridCell, padding: '8px 10px', textAlign: 'right', color: '#64748b' }}>
                                                {amount ? won(Math.floor(amount / 10)) : ''}
                                            </td>

                                            <td style={gridCell}>
                                                <input
                                                    ref={el => { cellRefs.current[`${idx}-remark`] = el; }}
                                                    style={cellInput}
                                                    value={r.remark}
                                                    onChange={e => patchRow(idx, { remark: e.target.value })}
                                                    onKeyDown={e => onCellKeyDown(e, idx, 'remark')}
                                                />
                                            </td>

                                            <td style={{ ...gridCell, textAlign: 'center', borderRight: 'none' }}>
                                                {r.itemCode && (
                                                    <button
                                                        onClick={() => showRecent(r.itemCode, r.itemName)}
                                                        title="이 품목의 최근 거래"
                                                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#94a3b8', fontSize: '0.95rem' }}>
                                                        ⓘ
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* ── 합계 + 실행 ── */}
                    <div style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap',
                        gap: '12px', marginTop: '14px', padding: '14px 18px', background: '#f8fafc',
                        border: '1px solid #e2e8f0', borderRadius: '10px',
                    }}>
                        <div style={{ display: 'flex', gap: '24px', alignItems: 'baseline', flexWrap: 'wrap' }}>
                            <span style={{ color: '#64748b', fontSize: '0.88rem' }}>
                                총수량 <strong style={{ color: '#0f172a' }}>{won(totalQty)}</strong>
                            </span>
                            <span style={{ color: '#64748b', fontSize: '0.88rem' }}>
                                합계 <strong style={{ fontSize: '1.3rem', color: '#0f172a', marginLeft: '4px' }}>{won(total)}</strong>원
                            </span>
                            <span style={{ color: '#94a3b8', fontSize: '0.82rem' }}>
                                부가세 별도 {won(Math.floor(total / 10))}원
                            </span>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button className="action-btn" onClick={runPreview} disabled={!!busy || !canSubmit}>
                                {busy === 'previewing' ? '확인 중…' : '미리보기'}
                            </button>
                            <button className="apply-btn" onClick={save}
                                disabled={!!busy || !preview || !writeEnabled}
                                title={writeEnabled ? '' : '읽기 전용 모드입니다'}>
                                {busy === 'saving' ? '저장 중…' : 'ERP 에 저장'}
                            </button>
                        </div>
                    </div>

                    <p style={{ color: '#94a3b8', fontSize: '0.82rem', margin: '10px 0 0', lineHeight: 1.8 }}>
                        키보드만으로 입력할 수 있습니다 —
                        품명에 글자를 치면 후보가 뜨고 <strong>↑↓</strong> 로 고른 뒤 <strong>Enter</strong>,
                        이어서 <strong>수량 → 단가 → 적요</strong> 순으로 <strong>Enter</strong> 를 누르면 다음 줄로 넘어갑니다.
                        줄 삭제는 <strong>Ctrl+Delete</strong> 입니다.
                        {vendorCode == null && <><br /><span style={{ color: '#dc2626' }}>상호(매입처)를 먼저 선택해야 저장할 수 있습니다.</span></>}
                        {missingPrice && <><br /><span style={{ color: '#dc2626' }}>단가가 비어 있는 줄이 있습니다.</span></>}
                        {!preview && canSubmit && <><br />저장하기 전에 <strong>미리보기</strong>로 ERP 에 들어갈 내용을 먼저 확인해 주세요.</>}
                    </p>

                    {/* ── 미리보기 ── */}
                    {preview && (
                        <section className="admin-section" style={{ marginTop: '18px', borderColor: '#bfdbfe' }}>
                            <div className="admin-section-header" style={{ background: '#eff6ff', color: '#1d4ed8' }}>
                                ERP 에 이렇게 기록됩니다
                            </div>
                            <div className="admin-section-body">
                                <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '0 0 12px', lineHeight: 1.7 }}>
                                    {preview.ilTable} · {preview.dDate} · 전표번호 {preview.dNo} · 매입(KIND 4)<br />
                                    매입처 {preview.vendorName || preview.vendorCode} · 추적태그 <code>{preview.tag}</code>
                                    {preview.stockMode === 'NONE' && <><br />현재고(JEGO)는 건드리지 않습니다 — 경영박사가 자기 규칙대로 반영합니다.</>}
                                </p>
                                <table className="admin-table">
                                    <thead>
                                        <tr>
                                            <th style={{ width: '50px' }}>줄</th><th>품목</th>
                                            <th style={{ textAlign: 'right' }}>수량</th><th style={{ textAlign: 'right' }}>단가</th>
                                            <th style={{ textAlign: 'right' }}>공급가</th><th style={{ textAlign: 'right' }}>부가세</th>
                                            <th>적요</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {preview.lines.map(l => (
                                            <tr key={l.editNo}>
                                                <td>{l.editNo}</td>
                                                <td>{l.itemName} <span style={{ color: '#64748b' }}>{l.gyu}</span></td>
                                                <td style={{ textAlign: 'right' }}>{won(l.ea)}</td>
                                                <td style={{ textAlign: 'right' }}>{won(l.price)}</td>
                                                <td style={{ textAlign: 'right' }}>{won(l.gum)}</td>
                                                <td style={{ textAlign: 'right' }}>{won(l.vat)}</td>
                                                <td style={{ color: '#64748b', fontSize: '0.85rem' }}>{l.remark}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                <div style={{ textAlign: 'right', marginTop: '12px' }}>
                                    합계 <strong style={{ fontSize: '1.1rem' }}>{won(preview.totalAmount)}</strong>원 · 부가세 {won(preview.totalVat)}원
                                </div>
                            </div>
                        </section>
                    )}
                </>
            )}

            {/* ── 이전 기록 탭 ── */}
            {tab === 'history' && (
                <section className="admin-section">
                    <div className="admin-section-header">입고 전표 찾기</div>
                    <div className="admin-section-body">
                        <form onSubmit={e => { e.preventDefault(); loadHistory(); }} style={{
                            display: 'flex', alignItems: 'flex-end', gap: '10px', flexWrap: 'wrap',
                            padding: '14px', marginBottom: '16px', background: '#f8fafc',
                            border: '1px solid #e2e8f0', borderRadius: '10px',
                        }}>
                            <div>
                                <label className="admin-label">시작일</label>
                                <input type="date" className="admin-input-small" value={historyFrom}
                                    onChange={e => setHistoryFrom(e.target.value)} />
                            </div>
                            <span style={{ paddingBottom: '10px', color: '#64748b' }}>~</span>
                            <div>
                                <label className="admin-label">종료일</label>
                                <input type="date" className="admin-input-small" value={historyTo}
                                    onChange={e => setHistoryTo(e.target.value)} />
                            </div>
                            <div style={{ minWidth: '260px', flex: '1 1 260px' }}>
                                <label className="admin-label">매입처 또는 품목</label>
                                <input className="admin-input-small" value={historyQuery}
                                    onChange={e => setHistoryQuery(e.target.value)}
                                    placeholder="상호, 품명, 규격을 입력하세요" />
                            </div>
                            <button type="submit" className="apply-btn">검색</button>
                            <button type="button" className="action-btn" onClick={() => {
                                const today = todayInput(); setHistoryFrom(today); setHistoryTo(today);
                                loadHistory(today, today, historyQuery);
                            }}>오늘</button>
                            <button type="button" className="action-btn" onClick={() => {
                                const from = monthStartInput(); const to = todayInput();
                                setHistoryFrom(from); setHistoryTo(to); loadHistory(from, to, historyQuery);
                            }}>이번 달</button>
                            <span style={{ marginLeft: 'auto', color: '#64748b', fontSize: '0.88rem' }}>
                                {history.length}건 · 행을 누르면 상세 내용을 볼 수 있습니다
                            </span>
                        </form>
                        {history.length === 0 ? (
                            <p style={{ color: '#94a3b8', margin: 0, textAlign: 'center', padding: '24px 0' }}>
                                선택한 기간에 입고 기록이 없습니다.
                            </p>
                        ) : (
                            <table className="admin-table">
                                <thead>
                                    <tr>
                                        <th>일자</th><th>전표</th><th>매입처</th><th>품목</th>
                                        <th style={{ textAlign: 'right' }}>금액</th>
                                        <th>등록</th><th>상태</th><th style={{ width: '80px' }}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {history.map(row => (
                                        <tr key={`${row.erpDate}-${row.voucherNo}-${row.vendorCode}`}
                                            onClick={() => showHistoryDetail(row)}
                                            style={{ cursor: 'pointer' }} title="눌러서 전표 상세 보기">
                                            <td>{row.erpDate}</td>
                                            <td style={{ fontFamily: 'monospace', color: '#64748b' }}>{row.ilTable} · {row.voucherNo}</td>
                                            <td>{row.vendorName || row.vendorCode}</td>
                                            <td>
                                                <div style={{ fontSize: '0.88rem' }}>
                                                    {row.firstItem || '-'}
                                                    {Number(row.lineCount) > 1 && (
                                                        <span style={{ color: '#94a3b8', fontSize: '0.82rem' }}>
                                                            {' '}외 {Number(row.lineCount) - 1}건
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td style={{ textAlign: 'right' }}>{won(row.totalAmount)}</td>
                                            <td style={{ color: '#64748b', fontSize: '0.85rem' }}>
                                                경영박사<br />
                                                <span style={{ color: '#94a3b8' }}>{row.localLogId ? '이 화면에서 등록' : 'ERP 전표'}</span>
                                            </td>
                                            <td>
                                                <span style={{
                                                    fontSize: '0.8rem', fontWeight: 700, padding: '3px 9px', borderRadius: '999px',
                                                    background: row.status === 'CANCELLED' ? '#fee2e2' : '#dcfce7',
                                                    color: row.status === 'CANCELLED' ? '#b91c1c' : '#166534',
                                                }}>
                                                    기록됨
                                                </span>
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                                {row.localLogId && (
                                                    <button className="action-btn delete" onClick={e => { e.stopPropagation(); cancel({ ...row, id: row.localLogId }); }} disabled={!!busy || !writeEnabled}>
                                                        취소
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </section>
            )}

            {/* 입고 전표 상세 모달 */}
            {historyDetail && (
                <div onClick={() => setHistoryDetail(null)}
                    style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000, padding: '20px' }}>
                    <div onClick={e => e.stopPropagation()}
                        style={{ background: '#fff', borderRadius: '14px', width: 'min(1100px, 96vw)', maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 24px 60px rgba(15,23,42,.3)' }}>
                        <div style={{ position: 'sticky', top: 0, zIndex: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 22px', background: '#334155', color: '#fff' }}>
                            <div>
                                <strong style={{ fontSize: '1.18rem' }}>{historyDetail.erpDate} 입고 전표</strong>
                                <span style={{ marginLeft: '12px', color: '#cbd5e1' }}>{historyDetail.ilTable} · No {historyDetail.voucherNo}</span>
                            </div>
                            <button className="action-btn" onClick={() => setHistoryDetail(null)}>닫기</button>
                        </div>
                        <div style={{ padding: '20px 22px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(130px, 1fr))', gap: '10px', marginBottom: '18px' }}>
                                {[
                                    ['매입처', historyDetail.vendorName || historyDetail.vendorCode],
                                    ['구분', '매입(입고)'],
                                    ['전표번호', historyDetail.voucherNo],
                                    ['상태', 'ERP 기록됨'],
                                ].map(([label, value]) => (
                                    <div key={label} style={{ padding: '12px 14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                                        <div style={{ color: '#64748b', fontSize: '0.8rem', marginBottom: '4px' }}>{label}</div>
                                        <strong>{value || '-'}</strong>
                                    </div>
                                ))}
                            </div>
                            <div style={{ overflowX: 'auto', border: '1px solid #cbd5e1', borderRadius: '8px' }}>
                                <table className="admin-table" style={{ minWidth: '900px' }}>
                                    <thead><tr>
                                        <th style={{ width: '55px' }}>No</th><th>품명</th><th>규격</th><th>단위</th>
                                        <th style={{ textAlign: 'right' }}>수량</th><th style={{ textAlign: 'right' }}>단가</th>
                                        <th style={{ textAlign: 'right' }}>공급가</th><th style={{ textAlign: 'right' }}>부가세</th><th>적요</th>
                                    </tr></thead>
                                    <tbody>{(historyDetail.lines || []).map((line, i) => (
                                        <tr key={`${line.editNo}-${line.itemCode}`}>
                                            <td>{line.editNo || i + 1}</td><td>{line.itemName}</td><td>{line.gyu}</td><td>{line.danwi}</td>
                                            <td style={{ textAlign: 'right' }}>{won(line.ea)}</td>
                                            <td style={{ textAlign: 'right' }}>{won(line.price)}</td>
                                            <td style={{ textAlign: 'right' }}>{won(line.gum)}</td>
                                            <td style={{ textAlign: 'right' }}>{won(line.vat)}</td>
                                            <td style={{ color: '#64748b' }}>{line.remark}</td>
                                        </tr>
                                    ))}</tbody>
                                </table>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px', alignItems: 'center' }}>
                                <span style={{ color: '#64748b' }}>품목 {historyDetail.lines?.length || 0}건</span>
                                <strong style={{ fontSize: '1.12rem' }}>
                                    공급가 {won(historyDetail.totalAmount)}원 · 부가세 {won(historyDetail.totalVat)}원 · 합계 {won(Number(historyDetail.totalAmount || 0) + Number(historyDetail.totalVat || 0))}원
                                </strong>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 품목 최근 거래 모달 */}
            {recent && (
                <div onClick={() => setRecent(null)}
                    style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000, padding: '20px' }}>
                    <div onClick={e => e.stopPropagation()}
                        style={{ background: '#fff', borderRadius: '16px', padding: '24px', maxWidth: '760px', width: '100%', maxHeight: '80vh', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <h3 style={{ margin: 0, fontSize: '1.05rem' }}>
                                {recent.name} <span style={{ color: '#94a3b8', fontWeight: 400 }}>({recent.code})</span> 최근 거래
                            </h3>
                            <button className="action-btn" onClick={() => setRecent(null)}>닫기</button>
                        </div>
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>일자</th><th>구분</th><th>거래처</th>
                                    <th style={{ textAlign: 'right' }}>수량</th><th style={{ textAlign: 'right' }}>단가</th><th style={{ textAlign: 'right' }}>금액</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recent.rows.map((r, i) => (
                                    <tr key={i}>
                                        <td>{r.dDATE}</td>
                                        <td>{KIND_LABELS[r.KIND] || r.KIND}</td>
                                        <td>{r.custName || r.CUST}</td>
                                        <td style={{ textAlign: 'right' }}>{Number(r.EA || 0).toLocaleString('ko-KR')}</td>
                                        <td style={{ textAlign: 'right' }}>{won(Math.round(r.PRICE || 0))}</td>
                                        <td style={{ textAlign: 'right' }}>{won(Math.round(r.GUM || 0))}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ErpReceivingPage;
