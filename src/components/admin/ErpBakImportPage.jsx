import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// ITEM 컬럼 → 화면 라벨. 백엔드 ErpBakImportService.COMPARED_COLUMNS 와 같은 집합.
const FIELD_LABELS = {
    ITEM: '품명',
    GYU: '규격',
    OUTA: '단가A',
    OUTB: '단가B',
    OUTC: '단가C',
    PARTCODE: '대분류',
    MIDCODE: '중분류',
    SMALLCODE: '소분류',
};

const PRICE_FIELDS = ['OUTA', 'OUTB', 'OUTC'];

const TABS = [
    { key: 'changed', label: '변경', color: '#1d4ed8' },
    { key: 'added', label: '추가', color: '#15803d' },
    { key: 'removed', label: '삭제', color: '#b91c1c' },
];

const PAGE_SIZE = 100; // 한 번에 그리는 행 수 (변경 수천 건이면 한 번에 렌더하면 렉이 걸린다)

const formatValue = (field, value) => {
    if (value === null || value === undefined || value === '') return '—';
    if (PRICE_FIELDS.includes(field)) return Number(value).toLocaleString('ko-KR');
    return String(value).trim() || '—';
};

const formatSize = (bytes) => {
    if (!bytes) return '';
    const mb = bytes / 1024 / 1024;
    return mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${mb.toFixed(1)} MB`;
};

/**
 * ERP 백업(.bak) 반영 페이지.
 * .bak 을 올리면 백엔드가 스테이징 DB 로 복원해 현재 ERP 와의 ITEM 차이를 보여주고,
 * 체크한 품목만 ERP 에 반영한 뒤 키오스크 상품까지 동기화한다.
 */
const ErpBakImportPage = () => {
    const [status, setStatus] = useState(null);       // null = 조회 전
    const [diff, setDiff] = useState(null);           // null = 아직 안 불러옴
    const [activeTab, setActiveTab] = useState('changed');
    const [selectedCodes, setSelectedCodes] = useState([]);
    const [runProductSync, setRunProductSync] = useState(true);
    const [uploadPercent, setUploadPercent] = useState(null); // null = 업로드 중 아님
    const [busy, setBusy] = useState('');             // '' | 'restoring' | 'diff' | 'applying' | 'discarding'
    const [error, setError] = useState('');
    const [applyResult, setApplyResult] = useState(null);
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
    const fileInputRef = useRef(null);

    const readError = async (res) => {
        try {
            const body = await res.json();
            return body.error || JSON.stringify(body);
        } catch {
            return await res.text();
        }
    };

    const loadStatus = useCallback(async () => {
        try {
            const res = await fetch('/api/erp-bak/admin/status');
            if (!res.ok) return setError(await readError(res));
            setStatus(await res.json());
        } catch {
            setError('상태를 불러오지 못했습니다.');
        }
    }, []);

    useEffect(() => { loadStatus(); }, [loadStatus]);

    const loadDiff = useCallback(async () => {
        setBusy('diff');
        setError('');
        try {
            const res = await fetch('/api/erp-bak/admin/diff');
            if (!res.ok) return setError(await readError(res));
            const data = await res.json();
            setDiff(data);
            // 기본값은 전체 선택 — 대개 백업 내용 그대로 맞추는 게 목적이다.
            setSelectedCodes([...data.changed, ...data.added, ...data.removed].map(row => row.code));
            setActiveTab(data.changed.length ? 'changed' : data.added.length ? 'added' : 'removed');
            setVisibleCount(PAGE_SIZE);
        } catch {
            setError('차이를 불러오지 못했습니다.');
        } finally {
            setBusy('');
        }
    }, []);

    // 조각 하나를 보낸다. 진행률 이벤트가 필요해 fetch 대신 XHR 을 쓴다(fetch 는 업로드 진행률이 없다).
    const sendChunk = (uploadId, index, blob, sentBefore, totalSize) => new Promise((resolve, reject) => {
        const form = new FormData();
        form.append('uploadId', uploadId);
        form.append('index', String(index));
        form.append('file', blob, 'chunk');

        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/erp-bak/admin/upload/chunk');
        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
                setUploadPercent(Math.round(((sentBefore + e.loaded) / totalSize) * 100));
            }
        };
        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) return resolve();
            let message = `조각 ${index + 1} 전송 실패 (HTTP ${xhr.status})`;
            try {
                message = JSON.parse(xhr.responseText).error || message;
            } catch {
                // 프록시가 돌려준 HTML 오류 문서 등 — 위의 기본 문구를 그대로 쓴다.
            }
            reject(new Error(message));
        };
        xhr.onerror = () => reject(new Error(`조각 ${index + 1} 전송 중 네트워크 오류가 발생했습니다.`));
        xhr.send(form);
    });

    /**
     * .bak 을 조각내어 올린다. Cloudflare 가 요청 본문을 100MB 로 막기 때문에 한 번에 보낼 수 없고,
     * 조각 크기는 서버가 알려주는 값(chunkSize)을 따른다.
     */
    const upload = async (file) => {
        setError('');
        setDiff(null);
        setApplyResult(null);
        setUploadPercent(0);

        let uploadId = null;
        try {
            const beginRes = await fetch('/api/erp-bak/admin/upload/begin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fileName: file.name, totalSize: file.size }),
            });
            if (!beginRes.ok) throw new Error(await readError(beginRes));
            const session = await beginRes.json();
            uploadId = session.uploadId;

            for (let index = 0, sent = 0; sent < file.size; index++) {
                const blob = file.slice(sent, Math.min(sent + session.chunkSize, file.size));
                await sendChunk(uploadId, index, blob, sent, file.size);
                sent += blob.size;
            }

            // 전송이 끝나면 서버가 이어붙인 파일을 복원하는 동안 기다린다(수십 초 걸릴 수 있음).
            setUploadPercent(null);
            setBusy('restoring');
            const finishRes = await fetch('/api/erp-bak/admin/upload/finish', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ uploadId }),
            });
            if (!finishRes.ok) throw new Error(await readError(finishRes));
            setStatus(await finishRes.json());
            uploadId = null;
            await loadDiff();
        } catch (err) {
            setError(err.message || '업로드에 실패했습니다.');
            // 실패한 조각 파일이 서버에 남지 않게 정리한다.
            if (uploadId) {
                fetch(`/api/erp-bak/admin/upload/${uploadId}`, { method: 'DELETE' }).catch(() => {});
            }
        } finally {
            setUploadPercent(null);
            setBusy(current => (current === 'restoring' ? '' : current));
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const onFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.name.toLowerCase().endsWith('.bak')) {
            setError('MS SQL 백업 파일(.bak)만 올릴 수 있습니다.');
            e.target.value = '';
            return;
        }
        upload(file);
    };

    const rows = useMemo(() => (diff ? diff[activeTab] : []), [diff, activeTab]);
    const visibleRows = useMemo(() => rows.slice(0, visibleCount), [rows, visibleCount]);
    const tabCodes = useMemo(() => rows.map(row => row.code), [rows]);
    const selectedInTab = useMemo(
        () => tabCodes.filter(code => selectedCodes.includes(code)).length,
        [tabCodes, selectedCodes]
    );

    const toggleCode = (code) => setSelectedCodes(prev =>
        prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    );

    const toggleTabAll = (checked) => setSelectedCodes(prev => (
        checked
            ? [...new Set([...prev, ...tabCodes])]
            : prev.filter(code => !tabCodes.includes(code))
    ));

    const apply = async () => {
        if (selectedCodes.length === 0) return alert('반영할 품목을 하나 이상 선택해주세요.');
        const counts = TABS.map(tab => {
            const n = diff[tab.key].filter(row => selectedCodes.includes(row.code)).length;
            return n ? `${tab.label} ${n}건` : null;
        }).filter(Boolean).join(', ');
        if (!window.confirm(
            `선택한 ${selectedCodes.length}개 품목(${counts})을 ERP 에 반영합니다.\n`
            + '반영 전 ITEM 테이블 전체가 백업되고, 실패하면 되돌립니다.\n\n계속할까요?'
        )) return;

        setBusy('applying');
        setError('');
        try {
            const res = await fetch('/api/erp-bak/admin/apply', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ codes: selectedCodes, syncProducts: runProductSync }),
            });
            if (!res.ok) return setError(await readError(res));
            setApplyResult(await res.json());
            setDiff(null);
            setSelectedCodes([]);
            await loadStatus();
        } catch {
            setError('반영 중 네트워크 오류가 발생했습니다.');
        } finally {
            setBusy('');
        }
    };

    const discard = async () => {
        if (!window.confirm('올린 백업과 스테이징 DB 를 지웁니다. 계속할까요?')) return;
        setBusy('discarding');
        try {
            const res = await fetch('/api/erp-bak/admin/staging', { method: 'DELETE' });
            if (!res.ok) return setError(await readError(res));
            setDiff(null);
            setSelectedCodes([]);
            setApplyResult(null);
            await loadStatus();
        } finally {
            setBusy('');
        }
    };

    const isWorking = Boolean(busy) || uploadPercent !== null;

    return (
        <div style={{ padding: '24px', maxWidth: '1100px' }}>
            <h2 style={{ margin: '0 0 6px', fontSize: '1.4rem' }}>ERP 백업(.bak) 반영</h2>
            <p style={{ margin: '0 0 20px', color: '#64748b', fontSize: '0.9rem', lineHeight: 1.6 }}>
                매장 ERP 백업 파일을 올리면 현재 ERP 와 물품(ITEM) 차이를 보여줍니다. 체크한 품목만 반영되고,
                반영 전 ITEM 테이블 전체가 자동 백업됩니다. 재고(JEGO)는 수시로 바뀌어 차이 목록에서는 빼지만,
                반영할 때는 해당 품목의 행 전체가 백업 내용으로 교체됩니다.
            </p>

            {/* ── 1. 업로드 ── */}
            <section style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '18px', marginBottom: '16px' }}>
                <h3 style={{ margin: '0 0 12px', fontSize: '1rem' }}>1. 백업 파일 올리기</h3>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".bak"
                    onChange={onFileChange}
                    disabled={isWorking}
                />
                {uploadPercent !== null && (
                    <div style={{ marginTop: '12px' }}>
                        <div style={{ height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ width: `${uploadPercent}%`, height: '100%', background: '#2563eb', transition: 'width .2s' }} />
                        </div>
                        <span style={{ fontSize: '0.85rem', color: '#64748b' }}>업로드 중… {uploadPercent}%</span>
                    </div>
                )}
                {busy === 'restoring' && (
                    <p style={{ marginTop: '12px', color: '#2563eb', fontSize: '0.9rem' }}>
                        백업을 스테이징 DB 로 복원하는 중입니다. 파일 크기에 따라 1분 이상 걸릴 수 있습니다…
                    </p>
                )}
                {status?.staged && (
                    <div style={{ marginTop: '12px', fontSize: '0.9rem', color: '#334155' }}>
                        올라온 백업: <strong>{status.fileName || 'staging.bak'}</strong>
                        {status.fileSize ? ` (${formatSize(status.fileSize)})` : ''}
                        {status.itemRows != null ? ` · ITEM ${status.itemRows.toLocaleString('ko-KR')}행` : ''}
                        <button className="action-btn" style={{ marginLeft: '12px' }} onClick={loadDiff} disabled={isWorking}>
                            {busy === 'diff' ? '비교 중…' : '차이 다시 보기'}
                        </button>
                        <button className="action-btn" style={{ marginLeft: '8px' }} onClick={discard} disabled={isWorking}>
                            스테이징 지우기
                        </button>
                    </div>
                )}
            </section>

            {error && (
                <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '12px 14px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.9rem' }}>
                    {error}
                </div>
            )}

            {applyResult && (
                <div style={{ background: '#dcfce7', color: '#166534', padding: '14px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.9rem', lineHeight: 1.7 }}>
                    <strong>반영 완료</strong> — 선택 {applyResult.applied}건 (삭제 {applyResult.deleted}행, 삽입 {applyResult.inserted}행)
                    <br />백업 테이블: <code>{applyResult.backupTable}</code> (문제가 생기면 이 테이블로 되돌릴 수 있습니다)
                    {applyResult.syncedProducts != null && <><br />키오스크 상품 동기화: {applyResult.syncedProducts}개</>}
                </div>
            )}

            {/* ── 2. 차이 확인 + 반영 ── */}
            {diff && (
                <section style={{ border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
                    <div style={{ padding: '18px', borderBottom: '1px solid #e2e8f0' }}>
                        <h3 style={{ margin: '0 0 6px', fontSize: '1rem' }}>2. 차이 확인하고 반영하기</h3>
                        <span style={{ color: '#64748b', fontSize: '0.88rem' }}>
                            현재 ERP {diff.prodRows.toLocaleString('ko-KR')}개 · 백업 {diff.stagingRows.toLocaleString('ko-KR')}개
                            (품목코드 100 이상)
                        </span>
                    </div>

                    <div style={{ display: 'flex', gap: '6px', padding: '12px 18px', borderBottom: '1px solid #e2e8f0' }}>
                        {TABS.map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => { setActiveTab(tab.key); setVisibleCount(PAGE_SIZE); }}
                                style={{
                                    padding: '7px 14px', borderRadius: '999px', cursor: 'pointer', fontSize: '0.88rem',
                                    border: `1px solid ${activeTab === tab.key ? tab.color : '#e2e8f0'}`,
                                    background: activeTab === tab.key ? tab.color : '#fff',
                                    color: activeTab === tab.key ? '#fff' : '#334155',
                                    fontWeight: activeTab === tab.key ? 700 : 500,
                                }}
                            >
                                {tab.label} {diff[tab.key].length}
                            </button>
                        ))}
                    </div>

                    <div style={{ padding: '10px 18px', borderBottom: '1px solid #e2e8f0' }}>
                        <label style={{ display: 'inline-flex', gap: '8px', alignItems: 'center', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem' }}>
                            <input
                                type="checkbox"
                                checked={tabCodes.length > 0 && selectedInTab === tabCodes.length}
                                onChange={e => toggleTabAll(e.target.checked)}
                                disabled={tabCodes.length === 0}
                            />
                            이 탭 전체 선택 ({selectedInTab}/{tabCodes.length})
                        </label>
                    </div>

                    <div style={{ maxHeight: '52vh', overflowY: 'auto' }}>
                        {rows.length === 0 && (
                            <p style={{ padding: '28px', textAlign: 'center', color: '#94a3b8', margin: 0 }}>
                                이 항목에는 차이가 없습니다.
                            </p>
                        )}
                        {visibleRows.map(row => (
                            <label
                                key={row.code}
                                style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', padding: '12px 18px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}
                            >
                                <input
                                    type="checkbox"
                                    checked={selectedCodes.includes(row.code)}
                                    onChange={() => toggleCode(row.code)}
                                    style={{ marginTop: '3px' }}
                                />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'baseline', flexWrap: 'wrap' }}>
                                        <span style={{ color: '#94a3b8', fontSize: '0.8rem', fontFamily: 'monospace' }}>{row.code}</span>
                                        <strong style={{ fontSize: '0.95rem' }}>{row.name || '(품명 없음)'}</strong>
                                        <span style={{ color: '#64748b', fontSize: '0.85rem' }}>{row.spec}</span>
                                    </div>

                                    {row.kind === 'changed' && (
                                        <div style={{ marginTop: '6px', display: 'grid', gap: '3px' }}>
                                            {row.changedFields.map(field => (
                                                <div key={field} style={{ fontSize: '0.85rem', color: '#475569' }}>
                                                    <span style={{ display: 'inline-block', minWidth: '54px', color: '#94a3b8' }}>
                                                        {FIELD_LABELS[field] || field}
                                                    </span>
                                                    <span style={{ textDecoration: 'line-through', color: '#b91c1c' }}>
                                                        {formatValue(field, row.before[field])}
                                                    </span>
                                                    <span style={{ margin: '0 6px', color: '#94a3b8' }}>→</span>
                                                    <span style={{ color: '#15803d', fontWeight: 600 }}>
                                                        {formatValue(field, row.after[field])}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {row.kind !== 'changed' && (
                                        <div style={{ marginTop: '4px', fontSize: '0.85rem', color: '#475569' }}>
                                            {PRICE_FIELDS.map(field => (
                                                <span key={field} style={{ marginRight: '14px' }}>
                                                    {FIELD_LABELS[field]} {formatValue(field, (row.after || row.before)[field])}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <span style={{
                                    fontSize: '0.78rem', fontWeight: 700, whiteSpace: 'nowrap',
                                    color: TABS.find(t => t.key === row.kind)?.color,
                                }}>
                                    {row.kind === 'added' ? '신규 등록' : row.kind === 'removed' ? 'ERP 에서 삭제' : '내용 변경'}
                                </span>
                            </label>
                        ))}
                        {visibleCount < rows.length && (
                            <div style={{ padding: '14px', textAlign: 'center' }}>
                                <button className="action-btn" onClick={() => setVisibleCount(c => c + PAGE_SIZE)}>
                                    더 보기 ({visibleCount}/{rows.length})
                                </button>
                            </div>
                        )}
                    </div>

                    <div style={{ padding: '16px 18px', borderTop: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                        <label style={{ display: 'inline-flex', gap: '8px', alignItems: 'center', fontSize: '0.88rem', cursor: 'pointer' }}>
                            <input type="checkbox" checked={runProductSync} onChange={e => setRunProductSync(e.target.checked)} />
                            반영 후 키오스크 상품까지 동기화
                            <span style={{ color: '#94a3b8', fontWeight: 400 }}>(전체 상품 대상이라 30초 이상 걸립니다)</span>
                        </label>
                        <div style={{ flex: 1 }} />
                        <span style={{ color: '#64748b', fontSize: '0.88rem' }}>선택 {selectedCodes.length}건</span>
                        <button
                            className="apply-btn"
                            style={{ background: '#16a34a' }}
                            onClick={apply}
                            disabled={isWorking || selectedCodes.length === 0}
                        >
                            {busy === 'applying' ? '반영 중…' : `선택 반영 (${selectedCodes.length})`}
                        </button>
                    </div>
                </section>
            )}
        </div>
    );
};

export default ErpBakImportPage;
