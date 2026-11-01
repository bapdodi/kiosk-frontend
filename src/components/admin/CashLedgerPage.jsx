import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { describeError, describeResponseError } from '../../utils/apiError';

const API = '/api/cash-ledger/admin';

const won = (n) => Number(n || 0).toLocaleString('ko-KR');
const num = (v) => Number(String(v ?? '').replace(/\D/g, '')) || 0;
const toInput = (n) => (n ? String(n) : '');

const todayInput = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const newKey = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const blankRow = (entryDate) => ({ key: newKey(), id: null, entryDate, memo: '', cashIn: '', cardIn: '', expense: '', etc: '', orig: '' });

/** 서버에 보낼 값만 뽑은 문자열. 저장된 값(orig)과 같으면 고친 게 없다. */
const snapshot = (r) => JSON.stringify([r.entryDate, r.memo.trim(), num(r.cashIn), num(r.cardIn), num(r.expense), r.etc.trim()]);

const isBlank = (r) => !r.memo.trim() && !r.etc.trim() && !num(r.cashIn) && !num(r.cardIn) && !num(r.expense);

const fromServer = (e) => {
    const r = {
        key: newKey(), id: e.id, entryDate: e.entryDate, memo: e.memo, etc: e.etc,
        cashIn: toInput(e.cashIn), cardIn: toInput(e.cardIn), expense: toInput(e.expense),
    };
    return { ...r, orig: snapshot(r) };
};

/** 일자 → 저장된 줄(id) 순. 아직 저장 안 된 줄은 맨 뒤에 둔다. */
const sortRows = (rows) => [...rows].sort((a, b) =>
    (a.id == null) - (b.id == null) || a.entryDate.localeCompare(b.entryDate) || (a.id ?? 0) - (b.id ?? 0));

const COLUMNS = ['entryDate', 'memo', 'cashIn', 'cardIn', 'expense', 'etc'];
const NUMERIC = ['cashIn', 'cardIn', 'expense'];

/** 포커스 중엔 숫자만 그대로, 벗어나면 천 단위 쉼표. */
const MoneyInput = ({ value, onChange, ...rest }) => {
    const [focused, setFocused] = useState(false);
    return (
        <input
            {...rest}
            inputMode="numeric"
            value={focused ? value : (value ? won(num(value)) : '')}
            onFocus={e => { setFocused(true); e.target.select(); }}
            onBlur={() => setFocused(false)}
            onChange={e => onChange(e.target.value.replace(/\D/g, ''))}
        />
    );
};

/**
 * 금전출납부. 엑셀처럼 칸을 고쳐 쓰면 줄을 벗어날 때 저장된다(정정 = 그냥 고치기).
 * 잔고는 저장하지 않고 일자·입력 순으로 누적해 계산하므로 중간 줄을 고치면 뒤 잔고가 모두 따라온다.
 * 잔고 = 현금 수입 + 카드 수입 − 지출.
 */
const CashLedgerPage = () => {
    const location = useLocation();
    const [rows, setRowsState] = useState([]);
    const rowsRef = useRef([]);
    const cellRefs = useRef({});
    const [month, setMonth] = useState(todayInput().slice(0, 7));   // '' = 전체
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const [aiNotice, setAiNotice] = useState(null);

    // 저장 응답이 오는 동안에도 최신 줄을 읽을 수 있게 ref 를 먼저 갱신한다.
    const update = (fn) => { rowsRef.current = fn(rowsRef.current); setRowsState(rowsRef.current); };
    const patch = (key, p) => update(rs => {
        const next = rs.map(r => (r.key === key ? { ...r, ...p } : r));
        const last = next[next.length - 1];
        return isBlank(last) && last.id == null ? next : [...next, blankRow(last.entryDate)];
    });

    /** AI 도우미가 전달한 금전출납부 줄을 표에 자동 입력한다. */
    const applyAiDraftData = useCallback((draft) => {
        if (!draft) return;
        const memo = draft.memo || draft.details?.항목 || '';
        const entryDate = draft.entryDate || draft.date || todayInput();
        const cashIn = draft.cashIn != null ? num(draft.cashIn) : (draft.details?.현금수입 != null ? num(draft.details.현금수입) : 0);
        const cardIn = draft.cardIn != null ? num(draft.cardIn) : (draft.details?.카드수입 != null ? num(draft.details.카드수입) : 0);
        const expense = draft.expense != null ? num(draft.expense) : (draft.details?.지출 != null ? num(draft.details.지출) : 0);
        const etc = draft.etc || draft.details?.비고 || '';

        if (!memo && !cashIn && !cardIn && !expense) return;

        const targetMonth = entryDate.slice(0, 7);
        if (targetMonth) {
            setMonth(targetMonth);
        }

        const newRow = {
            key: newKey(),
            id: null,
            entryDate,
            memo,
            cashIn: toInput(cashIn),
            cardIn: toInput(cardIn),
            expense: toInput(expense),
            etc,
            orig: '', // 미저장(노란색 표시)
        };

        update(rs => {
            const withoutEmpty = rs.filter(r => r.id != null || !isBlank(r));
            return [...withoutEmpty, newRow, blankRow(entryDate)];
        });

        const amountText = expense > 0 ? `지출 ${won(expense)}원` : `수입 ${won(cashIn + cardIn)}원`;
        setAiNotice({
            key: newRow.key,
            entryDate,
            memo,
            amountText,
        });
    }, []);

    useEffect(() => {
        const handler = (e) => {
            if (e.detail) {
                applyAiDraftData(e.detail);
            }
        };
        window.addEventListener('applyAiDraft', handler);
        return () => window.removeEventListener('applyAiDraft', handler);
    }, [applyAiDraftData]);

    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const res = await fetch(API);
                if (!res.ok) throw new Error(await describeResponseError(res, '출납부를 불러오지 못했습니다.'));
                const list = (await res.json()).map(fromServer);
                if (alive) {
                    update(() => [...sortRows(list), blankRow(list.at(-1)?.entryDate || todayInput())]);
                    if (location.state?.aiDraft) {
                        applyAiDraftData(location.state.aiDraft);
                        window.history.replaceState({}, document.title);
                    }
                }
            } catch (e) {
                if (alive) setError(describeError(e, '출납부를 불러오지 못했습니다.'));
            } finally {
                if (alive) setLoading(false);
            }
        })();
        return () => { alive = false; };
    }, [location.state, applyAiDraftData]);

    const commit = async (key) => {
        const r = rowsRef.current.find(x => x.key === key);
        if (!r || r.saving || snapshot(r) === r.orig) return;
        if (r.id == null && isBlank(r)) return;
        if (!r.entryDate) return setError('일자를 입력해 주세요.');
        const sent = snapshot(r);
        const [entryDate, memo, cashIn, cardIn, expense, etc] = JSON.parse(sent);
        update(rs => rs.map(x => (x.key === key ? { ...x, saving: true } : x)));
        setError('');
        try {
            const res = await fetch(r.id == null ? API : `${API}/${r.id}`, {
                method: r.id == null ? 'POST' : 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ entryDate, memo, cashIn, cardIn, expense, etc }),
            });
            if (!res.ok) throw new Error(await describeResponseError(res, '저장하지 못했습니다.'));
            const saved = await res.json();
            update(rs => sortRows(rs.map(x => (x.key === key ? { ...x, id: saved.id, orig: sent, saving: false } : x))));
        } catch (e) {
            update(rs => rs.map(x => (x.key === key ? { ...x, saving: false } : x)));
            return setError(describeError(e, '저장하지 못했습니다.'));
        }
        commit(key);   // 저장 중에 또 고쳤다면 한 번 더
    };

    const removeRow = async (r) => {
        if (r.id != null || !isBlank(r)) {
            if (!window.confirm(`${r.entryDate} "${r.memo || r.etc || '(적요 없음)'}" 줄을 삭제합니다. 진행할까요?`)) return;
        }
        if (r.id != null) {
            try {
                const res = await fetch(`${API}/${r.id}`, { method: 'DELETE' });
                if (!res.ok) throw new Error(await describeResponseError(res, '삭제하지 못했습니다.'));
            } catch (e) {
                return setError(describeError(e, '삭제하지 못했습니다.'));
            }
        }
        update(rs => {
            const next = rs.filter(x => x.key !== r.key);
            return next.length && next.at(-1).id == null ? next : [...next, blankRow(next.at(-1)?.entryDate || todayInput())];
        });
    };

    // ── 계산: 잔고는 전체 줄을 기준으로 누적, 월을 고르면 그 전 달까지를 이월로 깐다 ──

    const net = (r) => num(r.cashIn) + num(r.cardIn) - num(r.expense);
    const inMonth = (r) => !month || r.entryDate.startsWith(month);
    const monthStart = `${month}-01`;
    const carry = month ? rows.reduce((s, r) => (r.entryDate && r.entryDate < monthStart ? s + net(r) : s), 0) : 0;
    let run = carry;
    const view = rows.filter(r => inMonth(r) || r.id == null).map(r => {
        if (!inMonth(r)) return { r, bal: null };   // 다른 달 날짜로 막 적는 중인 새 줄
        run += net(r);
        return { r, bal: run };
    });
    const counted = rows.filter(inMonth);
    const sum = (k) => counted.reduce((s, r) => s + num(r[k]), 0);
    const months = [...new Set([...rows.map(r => r.entryDate.slice(0, 7)).filter(Boolean), todayInput().slice(0, 7)])].sort().reverse();

    // ── 키보드 ────────────────────────────────────────────────────────────

    const focusCell = (viewIdx, col) => {
        const target = view[viewIdx];
        const el = target && cellRefs.current[`${target.r.key}-${col}`];
        if (el) { el.focus(); el.select?.(); }
    };

    /** Enter/→ 다음 칸, 줄 끝 Enter 는 다음 줄 적요(일자는 보통 같다), ↑↓ 위아래, Ctrl+Delete 줄 삭제. */
    const onCellKeyDown = (e, idx, col) => {
        const c = COLUMNS.indexOf(col);
        if (e.key === 'Enter') {
            e.preventDefault();
            return c < COLUMNS.length - 1 ? focusCell(idx, COLUMNS[c + 1]) : focusCell(idx + 1, 'memo');
        }
        if (col !== 'entryDate' && e.key === 'ArrowDown') { e.preventDefault(); return focusCell(idx + 1, col); }
        if (col !== 'entryDate' && e.key === 'ArrowUp') { e.preventDefault(); return focusCell(idx - 1, col); }
        if (NUMERIC.includes(col)) {
            if (e.key === 'ArrowRight') { e.preventDefault(); return focusCell(idx, COLUMNS[c + 1]); }
            if (e.key === 'ArrowLeft') { e.preventDefault(); return focusCell(idx, COLUMNS[c - 1]); }
        }
        if (e.key === 'Delete' && (e.ctrlKey || e.shiftKey)) {
            e.preventDefault();
            removeRow(view[idx].r);
        }
    };

    const cellInput = {
        width: '100%', border: 'none', outline: 'none', background: 'transparent',
        padding: '10px 12px', fontSize: '1.02rem', fontFamily: 'inherit', boxSizing: 'border-box',
    };
    const gridCell = { borderRight: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', padding: 0 };
    const gridHead = {
        background: '#f1f5f9', borderRight: '1px solid #cbd5e1', borderBottom: '1px solid #cbd5e1',
        padding: '11px 8px', fontSize: '0.9rem', fontWeight: 700, color: '#334155', textAlign: 'center',
        textTransform: 'none', letterSpacing: 0,
    };
    const fixedCell = { ...gridCell, padding: '10px 12px', textAlign: 'right', fontWeight: 600 };
    const balColor = (b) => (b < 0 ? '#dc2626' : '#0f172a');

    return (
        <div style={{ padding: '24px', maxWidth: '1200px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', marginBottom: '14px' }}>
                <h2 style={{ margin: 0, fontSize: '1.4rem' }}>금전 출납부</h2>
                <select className="admin-input-small" style={{ width: '160px' }} value={month} onChange={e => setMonth(e.target.value)}>
                    <option value="">전체</option>
                    {months.map(m => <option key={m} value={m}>{m.replace('-', '년 ')}월</option>)}
                </select>
            </div>

            {error && (
                <div role="alert" style={{ background: '#fee2e2', color: '#b91c1c', padding: '12px 14px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.9rem' }}>
                    {error}
                </div>
            )}

            {aiNotice && (
                <div style={{
                    background: '#eff6ff',
                    color: '#1e40af',
                    border: '1px solid #bfdbfe',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    marginBottom: '14px',
                    fontSize: '0.88rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    boxShadow: '0 1px 3px rgba(37, 99, 235, 0.08)',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '1.4rem' }}>🤖</span>
                        <div>
                            <strong style={{ fontSize: '0.92rem' }}>AI 도우미 초안 자동 입력:</strong>{' '}
                            [{aiNotice.entryDate}] <strong>{aiNotice.memo}</strong> ({aiNotice.amountText}) 항목이 아래 노란색 행으로 채워졌습니다.
                            <div style={{ fontSize: '0.78rem', color: '#2563eb', marginTop: '2px' }}>
                                내용을 확인하시고 다른 칸을 클릭하거나 오른쪽 <strong>[저장하기]</strong>를 누르면 장부에 확정 등록됩니다.
                            </div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                            type="button"
                            onClick={() => { commit(aiNotice.key); setAiNotice(null); }}
                            style={{
                                padding: '6px 14px',
                                borderRadius: '6px',
                                border: 'none',
                                background: '#2563eb',
                                color: '#fff',
                                fontWeight: 700,
                                fontSize: '0.82rem',
                                cursor: 'pointer',
                            }}
                        >
                            저장하기
                        </button>
                        <button
                            type="button"
                            onClick={() => setAiNotice(null)}
                            title="알림 닫기"
                            style={{
                                border: 'none',
                                background: 'none',
                                color: '#64748b',
                                cursor: 'pointer',
                                fontSize: '1.2rem',
                                padding: '2px 6px',
                            }}
                        >
                            ✕
                        </button>
                    </div>
                </div>
            )}

            <div style={{ border: '1px solid #cbd5e1', borderRadius: '8px', background: '#fff', overflowX: 'auto' }}>
                <table style={{ width: '100%', minWidth: '900px', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                    <colgroup>
                        <col style={{ width: '150px' }} />
                        <col />
                        <col style={{ width: '115px' }} />
                        <col style={{ width: '115px' }} />
                        <col style={{ width: '115px' }} />
                        <col style={{ width: '125px' }} />
                        <col style={{ width: '150px' }} />
                        <col style={{ width: '36px' }} />
                    </colgroup>
                    <thead>
                        <tr>
                            {['일자', '적요', '현금 수입', '카드 수입', '지출', '잔고', '기타', ''].map((h, i) => <th key={i} style={gridHead}>{h}</th>)}
                        </tr>
                    </thead>
                    <tbody>
                        {month && (
                            <tr style={{ background: '#f8fafc' }}>
                                <td style={{ ...gridCell, padding: '10px 12px', color: '#64748b' }} colSpan={5}>전월 이월</td>
                                <td style={{ ...fixedCell, color: balColor(carry) }}>{won(carry)}</td>
                                <td style={gridCell} colSpan={2}></td>
                            </tr>
                        )}
                        {loading && <tr><td colSpan={8} style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>불러오는 중…</td></tr>}
                        {!loading && view.map(({ r, bal }, idx) => {
                            const dirty = !isBlank(r) && snapshot(r) !== r.orig;
                            const ref = col => el => { cellRefs.current[`${r.key}-${col}`] = el; };
                            const money = (col) => (
                                <td style={gridCell}>
                                    <MoneyInput
                                        ref={ref(col)} style={{ ...cellInput, textAlign: 'right' }} value={r[col]}
                                        onChange={v => patch(r.key, { [col]: v })}
                                        onKeyDown={e => onCellKeyDown(e, idx, col)} />
                                </td>
                            );
                            return (
                                <tr key={r.key}
                                    style={{ background: dirty ? '#fffbeb' : idx % 2 ? '#f8fafc' : '#fff' }}
                                    onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) commit(r.key); }}>
                                    <td style={gridCell}>
                                        <input
                                            ref={ref('entryDate')} type="date" style={cellInput} value={r.entryDate}
                                            onChange={e => patch(r.key, { entryDate: e.target.value })}
                                            onKeyDown={e => onCellKeyDown(e, idx, 'entryDate')} />
                                    </td>
                                    <td style={gridCell}>
                                        <input
                                            ref={ref('memo')} style={cellInput} value={r.memo} maxLength={200}
                                            placeholder={idx === 0 ? '적요' : ''}
                                            onChange={e => patch(r.key, { memo: e.target.value })}
                                            onKeyDown={e => onCellKeyDown(e, idx, 'memo')} />
                                    </td>
                                    {money('cashIn')}
                                    {money('cardIn')}
                                    {money('expense')}
                                    <td style={{ ...fixedCell, color: bal == null ? undefined : balColor(bal) }}>
                                        {bal == null || (r.id == null && isBlank(r)) ? '' : won(bal)}
                                    </td>
                                    <td style={gridCell}>
                                        <input
                                            ref={ref('etc')} style={cellInput} value={r.etc} maxLength={200}
                                            onChange={e => patch(r.key, { etc: e.target.value })}
                                            onKeyDown={e => onCellKeyDown(e, idx, 'etc')} />
                                    </td>
                                    <td style={{ ...gridCell, textAlign: 'center', borderRight: 'none' }}>
                                        {!(r.id == null && isBlank(r)) && (
                                            <button type="button" tabIndex={-1} title="줄 삭제 (Ctrl+Delete)" onClick={() => removeRow(r)}
                                                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#94a3b8', fontSize: '1rem' }}>✕</button>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                    <tfoot>
                        <tr style={{ background: '#f1f5f9' }}>
                            <td style={{ ...fixedCell, textAlign: 'center' }} colSpan={2}>{month ? '월 합계' : '합계'}</td>
                            <td style={fixedCell}>{won(sum('cashIn'))}</td>
                            <td style={fixedCell}>{won(sum('cardIn'))}</td>
                            <td style={fixedCell}>{won(sum('expense'))}</td>
                            <td style={{ ...fixedCell, color: balColor(run) }}>{won(run)}</td>
                            <td style={gridCell} colSpan={2}></td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: '14px', lineHeight: 1.6 }}>
                칸을 고치면 줄을 벗어날 때 자동 저장됩니다(노란 줄은 아직 저장 전). Enter 는 다음 칸, 줄 끝에서 Enter 면 다음 줄 적요로 넘어갑니다.
                잔고 = 현금 수입 + 카드 수입 − 지출이며, 중간 줄을 고치면 뒤 잔고가 모두 다시 계산됩니다. 줄 삭제는 Ctrl+Delete 입니다.
            </p>
        </div>
    );
};

export default CashLedgerPage;
