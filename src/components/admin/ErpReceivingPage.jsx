import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const KIND_LABELS = { 3: '매출', 4: '매입', 13: '발주' };

const won = (n) => Number(n || 0).toLocaleString('ko-KR');

const todayInput = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const readError = async (res) => {
    try {
        const body = await res.json();
        return body.error || JSON.stringify(body);
    } catch {
        return await res.text();
    }
};

/**
 * 재고 입고 관리 페이지.
 *
 * 경영박사(ERP 클라이언트)는 동시접속 2대 제한이 있어 세 번째 담당자가 띄울 수 없다.
 * 그래서 입고만 여기서 처리하고, 백엔드가 ERP 에 매입전표(IL<yy> KIND=4)를 직접 기록한다.
 * 담당자는 수량만 넣으면 되도록, 품목의 직전 매입에서 매입처와 단가를 자동으로 끌어와 채운다.
 */
const ErpReceivingPage = () => {
    const [status, setStatus] = useState(null);
    const [date, setDate] = useState(todayInput());
    const [memo, setMemo] = useState('');
    const [vendorCode, setVendorCode] = useState('');
    const [vendors, setVendors] = useState([]);
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [lines, setLines] = useState([]);
    const [preview, setPreview] = useState(null);
    const [history, setHistory] = useState([]);
    const [recent, setRecent] = useState(null);      // { code, name, rows }
    const [busy, setBusy] = useState('');            // '' | 'searching' | 'previewing' | 'saving' | 'cancelling'
    const [error, setError] = useState('');
    const [saved, setSaved] = useState(null);

    // 폼 1회당 하나. 더블클릭이나 네트워크 재시도가 전표를 두 번 만들지 못하게 하는 멱등키다.
    const requestIdRef = useRef(crypto.randomUUID());

    const writeEnabled = status?.writeEnabled === true;

    const load = useCallback(async (url, setter, onFail) => {
        try {
            const res = await fetch(url);
            if (!res.ok) return setError(await readError(res));
            setter(await res.json());
        } catch {
            setError(onFail);
        }
    }, []);

    useEffect(() => {
        load('/api/erp-receiving/admin/status', setStatus, '상태를 불러오지 못했습니다.');
        load('/api/erp-receiving/admin/vendors', setVendors, '매입처 목록을 불러오지 못했습니다.');
        load('/api/erp-receiving/admin/history', setHistory, '입고 이력을 불러오지 못했습니다.');
    }, [load]);

    // 품목 검색 (디바운스 300ms)
    useEffect(() => {
        const keyword = query.trim();
        if (!keyword) { setResults([]); return; }
        const timer = setTimeout(async () => {
            setBusy('searching');
            setError('');
            try {
                const res = await fetch(`/api/erp-receiving/admin/items?q=${encodeURIComponent(keyword)}`);
                if (!res.ok) { setError(await readError(res)); setResults([]); }
                else setResults(await res.json());
            } catch {
                setError('품목 검색에 실패했습니다.');
            } finally {
                setBusy('');
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [query]);

    const addLine = (item) => {
        if (lines.some(l => l.itemCode === item.CODE)) return;
        setPreview(null);
        setLines(prev => [...prev, {
            itemCode: item.CODE,
            itemName: String(item.ITEM || '').trim(),
            gyu: String(item.GYU || '').trim(),
            jego: Number(item.JEGO || 0),
            ea: 1,
            // 직전 매입에서 끌어온 기본값. 이력이 없으면 비워 두고 화면에서 입력을 요구한다.
            price: item.lastPrice != null ? Math.round(Number(item.lastPrice)) : '',
            lastVendorCode: item.lastVendorCode ?? null,
            lastVendorName: item.lastVendorName || '',
            lastDate: item.lastDate || '',
        }]);
        // 매입처가 비어 있으면 첫 품목의 직전 매입처를 전표 매입처로 제안한다.
        if (!vendorCode && item.lastVendorCode != null) setVendorCode(String(item.lastVendorCode));
    };

    const patchLine = (code, patch) => {
        setPreview(null);
        setLines(prev => prev.map(l => (l.itemCode === code ? { ...l, ...patch } : l)));
    };

    const removeLine = (code) => {
        setPreview(null);
        setLines(prev => prev.filter(l => l.itemCode !== code));
    };

    const total = useMemo(
        () => lines.reduce((sum, l) => sum + (Number(l.price) || 0) * (Number(l.ea) || 0), 0),
        [lines]
    );

    const missingPrice = lines.some(l => l.price === '' || l.price == null);

    const body = () => ({
        clientRequestId: requestIdRef.current,
        date,
        vendorCode: vendorCode ? Number(vendorCode) : null,
        memo,
        lines: lines.map(l => ({ itemCode: l.itemCode, ea: Number(l.ea) || 0, price: Number(l.price) || 0 })),
    });

    const post = async (url, payload) => {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
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
        if (!window.confirm(`품목 ${lines.length}건, 합계 ${won(total)}원을 ERP 에 입고 처리합니다. 진행할까요?`)) return;
        setBusy('saving'); setError('');
        try {
            const result = await post('/api/erp-receiving/admin/vouchers', body());
            setSaved(result);
            setLines([]); setPreview(null); setMemo('');
            requestIdRef.current = crypto.randomUUID(); // 다음 전표는 새 멱등키로
            load('/api/erp-receiving/admin/history', setHistory, '입고 이력을 불러오지 못했습니다.');
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
            load('/api/erp-receiving/admin/history', setHistory, '입고 이력을 불러오지 못했습니다.');
        } catch (e) {
            setError(e.message);
        } finally {
            setBusy('');
        }
    };

    const showRecent = async (item) => {
        setError('');
        try {
            const res = await fetch(`/api/erp-receiving/admin/items/${item.CODE}/recent`);
            if (!res.ok) return setError(await readError(res));
            setRecent({ code: item.CODE, name: String(item.ITEM || '').trim(), rows: await res.json() });
        } catch {
            setError('최근 거래를 불러오지 못했습니다.');
        }
    };

    return (
        <div className="admin-page-container">
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', flexWrap: 'wrap', marginBottom: '6px' }}>
                <h2 style={{ margin: 0 }}>재고 입고 관리</h2>
                {status && !writeEnabled && (
                    <span style={{ background: '#fef3c7', color: '#92400e', padding: '4px 10px', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 700 }}>
                        읽기 전용 모드
                    </span>
                )}
            </div>
            <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: 0, lineHeight: 1.7 }}>
                입고한 물건을 ERP 매입전표로 기록합니다. 품목을 검색해 담고 <strong>수량만</strong> 넣으면
                매입처와 단가는 직전 매입 내역에서 자동으로 채워집니다.
                {status && !writeEnabled && ' 지금은 저장이 막혀 있어 미리보기까지만 확인할 수 있습니다.'}
            </p>

            {error && (
                <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '12px 14px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.9rem' }}>
                    {error}
                </div>
            )}

            {saved && (
                <div style={{ background: '#dcfce7', color: '#166534', padding: '14px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.9rem', lineHeight: 1.7 }}>
                    <strong>입고 완료</strong> — {saved.dDate} 전표 {saved.dNo}번, {saved.lineCount}줄 / {won(saved.totalAmount)}원
                    {saved.duplicate && ' (이미 저장돼 있던 전표입니다)'}
                    <br />경영박사에서 해당 전표가 정상으로 보이는지 확인해 주세요.
                </div>
            )}

            {/* ── 1. 전표 헤더 ── */}
            <section className="admin-card" style={{ padding: '18px', marginBottom: '16px' }}>
                <h3 style={{ margin: '0 0 14px', fontSize: '1rem' }}>1. 전표 정보</h3>
                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <div>
                        <label className="admin-label">입고일자</label>
                        <input type="date" className="admin-input-small" value={date} onChange={e => { setDate(e.target.value); setPreview(null); }} />
                    </div>
                    <div style={{ minWidth: '220px' }}>
                        <label className="admin-label">매입처</label>
                        <select className="admin-input-small" style={{ width: '100%' }} value={vendorCode}
                            onChange={e => { setVendorCode(e.target.value); setPreview(null); }}>
                            <option value="">선택하세요</option>
                            {vendors.map(v => <option key={v.CODE} value={v.CODE}>{v.NAME}</option>)}
                        </select>
                    </div>
                    <div style={{ flex: 1, minWidth: '240px' }}>
                        <label className="admin-label">메모 (선택)</label>
                        <input className="admin-input-small" style={{ width: '100%' }} value={memo}
                            onChange={e => { setMemo(e.target.value); setPreview(null); }} placeholder="전표 비고" />
                    </div>
                </div>
            </section>

            {/* ── 2. 품목 검색 ── */}
            <section className="admin-card" style={{ padding: '18px', marginBottom: '16px' }}>
                <h3 style={{ margin: '0 0 14px', fontSize: '1rem' }}>2. 품목 담기</h3>
                <input
                    className="admin-input-small"
                    style={{ width: '100%', maxWidth: '420px' }}
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="품명 · 규격 · 품목코드로 검색"
                />
                {busy === 'searching' && <span style={{ marginLeft: '10px', color: '#64748b', fontSize: '0.85rem' }}>검색 중…</span>}

                {results.length > 0 && (
                    <div style={{ maxHeight: '38vh', overflowY: 'auto', marginTop: '12px', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                        <table className="admin-table" style={{ width: '100%' }}>
                            <thead>
                                <tr>
                                    <th>코드</th><th>품명</th><th>규격</th><th style={{ textAlign: 'right' }}>현재고</th>
                                    <th>직전 매입</th><th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {results.map(item => (
                                    <tr key={item.CODE}>
                                        <td style={{ fontFamily: 'monospace', color: '#94a3b8' }}>{item.CODE}</td>
                                        <td>{String(item.ITEM || '').trim()}</td>
                                        <td style={{ color: '#64748b' }}>{String(item.GYU || '').trim()}</td>
                                        <td style={{ textAlign: 'right' }}>{Number(item.JEGO || 0).toLocaleString('ko-KR')}</td>
                                        <td style={{ fontSize: '0.85rem', color: '#64748b' }}>
                                            {item.lastPrice != null
                                                ? `${item.lastVendorName || item.lastVendorCode} · ${won(Math.round(item.lastPrice))}원 (${item.lastDate})`
                                                : '이력 없음'}
                                        </td>
                                        <td style={{ whiteSpace: 'nowrap' }}>
                                            <button onClick={() => showRecent(item)} style={{ marginRight: '6px' }}>거래</button>
                                            <button onClick={() => addLine(item)} disabled={lines.some(l => l.itemCode === item.CODE)}>
                                                {lines.some(l => l.itemCode === item.CODE) ? '담김' : '담기'}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            {/* ── 3. 담은 라인 ── */}
            <section className="admin-card" style={{ padding: '18px', marginBottom: '16px' }}>
                <h3 style={{ margin: '0 0 14px', fontSize: '1rem' }}>3. 입고 수량 입력 ({lines.length}건)</h3>
                {lines.length === 0 ? (
                    <p style={{ color: '#94a3b8', margin: 0 }}>위에서 품목을 검색해 담으세요.</p>
                ) : (
                    <>
                        <table className="admin-table" style={{ width: '100%' }}>
                            <thead>
                                <tr>
                                    <th>품목</th><th style={{ textAlign: 'right' }}>현재고</th>
                                    <th style={{ width: '110px' }}>수량</th><th style={{ width: '130px' }}>단가</th>
                                    <th style={{ textAlign: 'right' }}>금액</th><th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {lines.map(l => (
                                    <tr key={l.itemCode}>
                                        <td>
                                            <div>{l.itemName} <span style={{ color: '#64748b' }}>{l.gyu}</span></div>
                                            <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                                                {l.itemCode}
                                                {l.lastVendorName && ` · 직전 ${l.lastVendorName} ${l.lastDate}`}
                                            </div>
                                        </td>
                                        <td style={{ textAlign: 'right' }}>{l.jego.toLocaleString('ko-KR')}</td>
                                        <td>
                                            <input type="number" min="1" className="admin-input-small" style={{ width: '100%' }}
                                                value={l.ea} onChange={e => patchLine(l.itemCode, { ea: e.target.value })} />
                                        </td>
                                        <td>
                                            <input type="number" min="0" className="admin-input-small"
                                                style={{ width: '100%', borderColor: l.price === '' ? '#dc2626' : undefined }}
                                                value={l.price} onChange={e => patchLine(l.itemCode, { price: e.target.value })}
                                                placeholder="단가 입력" />
                                        </td>
                                        <td style={{ textAlign: 'right' }}>{won((Number(l.price) || 0) * (Number(l.ea) || 0))}</td>
                                        <td><button onClick={() => removeLine(l.itemCode)}>삭제</button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <div style={{ textAlign: 'right', marginTop: '12px', fontSize: '1rem' }}>
                            합계 <strong>{won(total)}</strong>원 <span style={{ color: '#64748b', fontSize: '0.85rem' }}>(부가세 별도 {won(Math.floor(total / 10))}원)</span>
                        </div>
                        {missingPrice && (
                            <p style={{ color: '#b91c1c', fontSize: '0.85rem', margin: '8px 0 0' }}>
                                직전 매입 이력이 없는 품목은 단가를 직접 입력해야 합니다.
                            </p>
                        )}
                        <div style={{ display: 'flex', gap: '8px', marginTop: '14px', flexWrap: 'wrap' }}>
                            <button onClick={runPreview} disabled={!!busy || lines.length === 0 || missingPrice}>
                                {busy === 'previewing' ? '확인 중…' : '미리보기'}
                            </button>
                            <button onClick={save}
                                disabled={!!busy || !preview || !writeEnabled}
                                title={writeEnabled ? '' : '읽기 전용 모드입니다'}
                                style={{ fontWeight: 700 }}>
                                {busy === 'saving' ? '저장 중…' : 'ERP 에 저장'}
                            </button>
                        </div>
                    </>
                )}
            </section>

            {/* ── 4. 미리보기 ── */}
            {preview && (
                <section className="admin-card" style={{ padding: '18px', marginBottom: '16px', borderLeft: '4px solid #1d4ed8' }}>
                    <h3 style={{ margin: '0 0 6px', fontSize: '1rem' }}>ERP 에 이렇게 기록됩니다</h3>
                    <p style={{ color: '#64748b', fontSize: '0.85rem', marginTop: 0 }}>
                        {preview.ilTable} · {preview.dDate} · 전표번호 {preview.dNo} · 매입(KIND 4) ·
                        매입처 {preview.vendorName || preview.vendorCode} · 추적태그 <code>{preview.tag}</code>
                        {preview.stockMode === 'NONE' && ' · 현재고(JEGO)는 경영박사가 반영합니다'}
                    </p>
                    <table className="admin-table" style={{ width: '100%' }}>
                        <thead>
                            <tr><th>줄</th><th>품목</th><th style={{ textAlign: 'right' }}>수량</th><th style={{ textAlign: 'right' }}>단가</th><th style={{ textAlign: 'right' }}>공급가</th><th style={{ textAlign: 'right' }}>부가세</th></tr>
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
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <div style={{ textAlign: 'right', marginTop: '10px' }}>
                        합계 <strong>{won(preview.totalAmount)}</strong>원 / 부가세 {won(preview.totalVat)}원
                    </div>
                </section>
            )}

            {/* ── 5. 입고 이력 ── */}
            <section className="admin-card" style={{ padding: '18px' }}>
                <h3 style={{ margin: '0 0 14px', fontSize: '1rem' }}>최근 입고 이력</h3>
                {history.length === 0 ? (
                    <p style={{ color: '#94a3b8', margin: 0 }}>아직 이 화면에서 넣은 입고가 없습니다.</p>
                ) : (
                    <table className="admin-table" style={{ width: '100%' }}>
                        <thead>
                            <tr><th>일자</th><th>전표</th><th>매입처</th><th style={{ textAlign: 'right' }}>줄</th><th style={{ textAlign: 'right' }}>금액</th><th>상태</th><th></th></tr>
                        </thead>
                        <tbody>
                            {history.map(row => (
                                <tr key={row.id}>
                                    <td>{row.erpDate}</td>
                                    <td style={{ fontFamily: 'monospace' }}>{row.ilTable} · {row.voucherNo}</td>
                                    <td>{row.vendorName || row.vendorCode}</td>
                                    <td style={{ textAlign: 'right' }}>{row.lineCount}</td>
                                    <td style={{ textAlign: 'right' }}>{won(row.totalAmount)}</td>
                                    <td style={{ color: row.status === 'CANCELLED' ? '#b91c1c' : '#166534' }}>
                                        {row.status === 'CANCELLED' ? '취소됨' : '기록됨'}
                                    </td>
                                    <td>
                                        {row.status === 'CREATED' && (
                                            <button onClick={() => cancel(row)} disabled={!!busy || !writeEnabled}>취소</button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </section>

            {/* 품목 최근 거래 모달 */}
            {recent && (
                <div onClick={() => setRecent(null)}
                    style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
                    <div onClick={e => e.stopPropagation()}
                        style={{ background: '#fff', borderRadius: '12px', padding: '20px', maxWidth: '760px', width: '100%', maxHeight: '80vh', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                            <h3 style={{ margin: 0, fontSize: '1rem' }}>{recent.name} <span style={{ color: '#94a3b8' }}>({recent.code})</span> 최근 거래</h3>
                            <button onClick={() => setRecent(null)}>닫기</button>
                        </div>
                        <table className="admin-table" style={{ width: '100%' }}>
                            <thead>
                                <tr><th>일자</th><th>구분</th><th>거래처</th><th style={{ textAlign: 'right' }}>수량</th><th style={{ textAlign: 'right' }}>단가</th><th style={{ textAlign: 'right' }}>금액</th></tr>
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
