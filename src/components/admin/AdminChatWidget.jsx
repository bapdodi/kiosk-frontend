import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { describeError, describeResponseError } from '../../utils/apiError';
import MarkdownView from './MarkdownView';

const API = '/api/assistant/admin/chat';
const EXECUTE_API = '/api/assistant/admin/action/execute';

/** AI 도우미가 할 수 있는 일 카테고리별 대표 질문 목록 */
const CAPABILITY_CATEGORIES = [
    {
        title: '📦 재고 및 발주 추천',
        desc: 'ERP 현재고, 단가, 1년 판매량 분석 발주 추천',
        questions: [
            '동관 15A 재고 얼마야?',
            '지금 발주해야 할 품목 추천해줘',
            '동관 15A 최근 거래 내역 보여줘',
        ],
    },
    {
        title: '📥 입고 · 발주 전표 등록',
        desc: '대화 한마디나 사진으로 초안 카드 작성 후 승인',
        questions: [
            '고려메탈 동관 15A 10개 6875원 입고 잡아줘',
            '미도금속에 동관 20A 5본 발주서 작성해줘',
        ],
    },
    {
        title: '📊 매장 매출 및 주문 분석',
        desc: 'ERP 매장 전체 매출 및 키오스크 주문 집계',
        questions: [
            '이번 달 매출 얼마야?',
            '지난주 많이 팔린 품목 10개 알려줘',
            '오늘 키오스크 주문 몇 건이야?',
        ],
    },
    {
        title: '💰 금전출납부 및 매장 동기화',
        desc: '장부 지출/수입 등록 및 ERP-키오스크 상품 동기화',
        questions: [
            '오늘 식대 25,000원 현금 지출 적어줘',
            'ERP 상품 변경사항 키오스크에 동기화해줘',
            '주문 #12 완료 처리해줘',
        ],
    },
];

const fmt = (v) => (typeof v === 'number' ? v.toLocaleString('ko-KR') : v == null ? '' : String(v));

const cell = { border: '1px solid #e2e8f0', padding: '6px 8px', fontSize: '0.8rem', whiteSpace: 'nowrap' };

/** 이미지 리사이즈 및 base64 추출 (고화질 원본은 최대 1600px로 줄여 전송량 최적화) */
const processImageFile = (file) => {
    return new Promise((resolve, reject) => {
        if (!file.type.startsWith('image/')) {
            reject(new Error('이미지 파일(JPG, PNG 등)만 첨부할 수 있습니다.'));
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const maxDim = 1600;
                let { width, height } = img;
                if (width > maxDim || height > maxDim) {
                    if (width > height) {
                        height = Math.round((height * maxDim) / width);
                        width = maxDim;
                    } else {
                        width = Math.round((width * maxDim) / height);
                        height = maxDim;
                    }
                }
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                const mimeType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
                const dataUrl = canvas.toDataURL(mimeType, 0.85);
                const base64 = dataUrl.split(',')[1];
                resolve({
                    name: file.name,
                    size: file.size,
                    mimeType,
                    dataUrl,
                    base64,
                });
            };
            img.onerror = () => reject(new Error('이미지를 읽을 수 없습니다.'));
            img.src = e.target.result;
        };
        reader.onerror = () => reject(new Error('파일 읽기 실패'));
        reader.readAsDataURL(file);
    });
};

/** 조회 결과(키가 한글인 JSON)를 그대로 보여 준다. */
const ResultView = ({ result }) => {
    if (result == null || typeof result !== 'object') return <div>{fmt(result)}</div>;
    return Object.entries(result).map(([k, v]) => {
        if (Array.isArray(v)) {
            if (!v.length) return <div key={k}><b>{k}</b>: 없음</div>;
            const cols = Object.keys(v[0]);
            return (
                <div key={k} style={{ margin: '6px 0', overflowX: 'auto' }}>
                    <b>{k}</b>
                    <table style={{ borderCollapse: 'collapse', marginTop: '4px', background: '#fff', width: '100%' }}>
                        <thead><tr>{cols.map(c => <th key={c} style={{ ...cell, background: '#f1f5f9' }}>{c}</th>)}</tr></thead>
                        <tbody>
                            {v.map((row, i) => (
                                <tr key={i}>{cols.map(c => <td key={c} style={{ ...cell, textAlign: typeof row[c] === 'number' ? 'right' : 'left' }}>{fmt(row[c])}</td>)}</tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            );
        }
        if (v && typeof v === 'object') {
            return <div key={k}><b>{k}</b>: {Object.entries(v).map(([a, b]) => `${a} ${fmt(b)}`).join(', ')}</div>;
        }
        return <div key={k}><b>{k}</b>: {fmt(v)}</div>;
    });
};

/** 대화형 액션 카드 (Human-in-the-Loop) */
const ActionCardView = ({ action, onExecute, onCancel, onOpenInWeb }) => {
    const isPending = !action.status || action.status === 'pending';
    const isExecuting = action.status === 'executing';
    const isSuccess = action.status === 'success';
    const isCancelled = action.status === 'cancelled';
    const isFailed = action.status === 'failed';

    const getIcon = () => {
        switch (action.type) {
            case 'RECEIVING_VOUCHER': return '📥';
            case 'ORDER_VOUCHER': return '📦';
            case 'CASH_LEDGER_ENTRY': return '💰';
            case 'PRODUCT_UPDATE': return '🏷️';
            case 'ERP_SYNC': return '🔄';
            case 'ORDER_STATUS': return '📋';
            default: return '⚡';
        }
    };

    return (
        <div style={{
            marginTop: '10px',
            border: isSuccess ? '1px solid #86efac' : isFailed ? '1px solid #fca5a5' : '1px solid #bfdbfe',
            borderLeft: isSuccess ? '4px solid #22c55e' : isFailed ? '4px solid #ef4444' : '4px solid #2563eb',
            background: isSuccess ? '#f0fdf4' : isFailed ? '#fef2f2' : '#f8fafc',
            borderRadius: '8px',
            padding: '12px 14px',
            fontSize: '0.86rem',
            color: '#1e293b',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '6px' }}>
                <div style={{ fontWeight: 700, fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>{getIcon()}</span>
                    <span>{action.title}</span>
                </div>
                <div>
                    {isPending && <span style={{ background: '#fef3c7', color: '#92400e', padding: '2px 7px', borderRadius: '999px', fontSize: '0.74rem', fontWeight: 700 }}>승인 대기</span>}
                    {isExecuting && <span style={{ background: '#dbeafe', color: '#1e40af', padding: '2px 7px', borderRadius: '999px', fontSize: '0.74rem', fontWeight: 700 }}>실행 중…</span>}
                    {isSuccess && <span style={{ background: '#dcfce7', color: '#166534', padding: '2px 7px', borderRadius: '999px', fontSize: '0.74rem', fontWeight: 700 }}>✅ 실행 완료</span>}
                    {isCancelled && <span style={{ background: '#f1f5f9', color: '#64748b', padding: '2px 7px', borderRadius: '999px', fontSize: '0.74rem', fontWeight: 700 }}>취소됨</span>}
                    {isFailed && <span style={{ background: '#fee2e2', color: '#991b1b', padding: '2px 7px', borderRadius: '999px', fontSize: '0.74rem', fontWeight: 700 }}>실패</span>}
                </div>
            </div>

            <div style={{ marginBottom: '8px', lineHeight: 1.45, fontWeight: 500 }}>
                {action.summary}
            </div>

            {/* 품목 표 미리보기 */}
            {action.details?.lines && Array.isArray(action.details.lines) && action.details.lines.length > 0 && (
                <div style={{ overflowX: 'auto', marginBottom: '8px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', background: '#fff' }}>
                        <thead>
                            <tr style={{ background: '#f1f5f9' }}>
                                <th style={cell}>품명</th>
                                <th style={cell}>수량</th>
                                <th style={cell}>단가</th>
                                <th style={cell}>공급가</th>
                            </tr>
                        </thead>
                        <tbody>
                            {action.details.lines.map((l, i) => (
                                <tr key={i}>
                                    <td style={cell}>{l.itemName || l.itemCode}</td>
                                    <td style={{ ...cell, textAlign: 'right' }}>{fmt(l.ea)}</td>
                                    <td style={{ ...cell, textAlign: 'right' }}>{fmt(l.price)}원</td>
                                    <td style={{ ...cell, textAlign: 'right', fontWeight: 600 }}>{fmt(l.gum)}원</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {isSuccess && (
                <div style={{ color: '#15803d', fontWeight: 600, fontSize: '0.84rem', marginTop: '4px' }}>
                    {action.resultMessage || '성공적으로 실행되었습니다.'}
                </div>
            )}

            {isFailed && (
                <div style={{ color: '#b91c1c', fontSize: '0.84rem', marginTop: '4px' }}>
                    오류: {action.errorMessage}
                </div>
            )}

            {isCancelled && (
                <div style={{ color: '#64748b', fontSize: '0.82rem', marginTop: '4px' }}>
                    사장님에 의해 취소되었습니다.
                </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '10px' }}>
                {isPending && (
                    <>
                        <button
                            type="button"
                            onClick={() => onExecute(action)}
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
                            승인 및 실행
                        </button>
                        <button
                            type="button"
                            onClick={() => onCancel(action)}
                            style={{
                                padding: '6px 12px',
                                borderRadius: '6px',
                                border: '1px solid #cbd5e1',
                                background: '#fff',
                                color: '#475569',
                                fontWeight: 600,
                                fontSize: '0.82rem',
                                cursor: 'pointer',
                            }}
                        >
                            취소
                        </button>
                    </>
                )}

                {isFailed && (
                    <button
                        type="button"
                        onClick={() => onExecute(action)}
                        style={{
                            padding: '5px 12px',
                            borderRadius: '6px',
                            border: 'none',
                            background: '#dc2626',
                            color: '#fff',
                            fontWeight: 600,
                            fontSize: '0.82rem',
                            cursor: 'pointer',
                        }}
                    >
                        다시 시도
                    </button>
                )}

                {action.linkUrl && (
                    <button
                        type="button"
                        onClick={() => onOpenInWeb ? onOpenInWeb(action) : null}
                        title="넓은 웹 화면에서 이어서 작성하거나 상세 검토합니다"
                        style={{
                            marginLeft: 'auto',
                            padding: '6px 12px',
                            borderRadius: '6px',
                            border: '1px solid #93c5fd',
                            background: '#eff6ff',
                            color: '#1d4ed8',
                            fontWeight: 700,
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            transition: 'all 0.15s ease',
                        }}
                    >
                        🖥️ {action.linkText ? action.linkText.replace('으로 이동', '에서 열기') : '웹 화면에서 열기'} ↗
                    </button>
                )}
            </div>
        </div>
    );
};

/** 관리자 화면 전역 오른쪽 아래 플로팅 챗봇 위젯 */
export default function AdminChatWidget() {
    const navigate = useNavigate();
    const [isOpen, setIsOpen] = useState(false);
    const [isMaximized, setIsMaximized] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const [size, setSize] = useState(() => {
        try {
            const saved = localStorage.getItem('admin_ai_chat_size');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed.width && parsed.height) {
                    const w = Math.min(Math.max(380, Number(parsed.width)), (typeof window !== 'undefined' ? window.innerWidth : 1200) - 40);
                    const h = Math.min(Math.max(420, Number(parsed.height)), (typeof window !== 'undefined' ? window.innerHeight : 900) - 110);
                    return { width: w, height: h };
                }
            }
        } catch {}
        return { width: 480, height: 660 };
    });

    const [messages, setMessages] = useState(() => {
        try {
            const saved = localStorage.getItem('admin_ai_chat_messages');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed)) return parsed;
            }
        } catch {}
        return [];
    });
    const [input, setInput] = useState('');
    const [attachedImage, setAttachedImage] = useState(null);
    const [viewingImage, setViewingImage] = useState(null);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState('');

    // 과거 세션 대화 기록 (DB assistant_log)
    const [showHistory, setShowHistory] = useState(false);
    const [historyList, setHistoryList] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [historyError, setHistoryError] = useState('');

    const fileInputRef = useRef(null);
    const bottomRef = useRef(null);

    // 활성 대화 내용 localStorage 자동 동기화 (새로고침 / 페이지 이동 시 복원)
    useEffect(() => {
        try {
            if (!messages || messages.length === 0) {
                localStorage.removeItem('admin_ai_chat_messages');
            } else {
                const sanitized = messages.map(m => {
                    if (!m.images || m.images.length === 0) return m;
                    return {
                        ...m,
                        images: m.images.map(img => ({
                            mimeType: img.mimeType,
                            previewUrl: (img.previewUrl && img.previewUrl.length < 50000) ? img.previewUrl : null,
                            data: (img.data && img.data.length < 50000) ? img.data : '',
                        })),
                    };
                });
                localStorage.setItem('admin_ai_chat_messages', JSON.stringify(sanitized));
            }
        } catch (e) {
            console.warn('대화 기록 로컬 저장 실패:', e);
        }
    }, [messages]);

    const loadHistory = async () => {
        setLoadingHistory(true);
        setHistoryError('');
        try {
            const res = await fetch('/api/assistant/admin/history?limit=30');
            if (!res.ok) throw new Error(await describeResponseError(res, '기록을 불러오지 못했습니다.'));
            const data = await res.json();
            setHistoryList(Array.isArray(data) ? data : []);
        } catch (e) {
            setHistoryError(describeError(e, '기록 조회 중 오류가 발생했습니다.'));
        } finally {
            setLoadingHistory(false);
        }
    };

    const handleOpenHistory = () => {
        setShowHistory(true);
        loadHistory();
    };

    const handleRestoreLog = (item) => {
        const userMsg = { role: 'user', text: item.question, images: [] };
        const modelMsg = {
            role: 'model',
            text: item.answer || '(답변 없음)',
            tools: item.tools ? [{ name: item.tools, label: item.tools, args: {}, result: null }] : [],
            actions: [],
        };
        setMessages(prev => [...prev, userMsg, modelMsg]);
        setShowHistory(false);
    };

    const handleReaskLog = (question) => {
        setShowHistory(false);
        setInput(question);
    };

    const handleResetChat = () => {
        setMessages([]);
        setError('');
        setAttachedImage(null);
        try {
            localStorage.removeItem('admin_ai_chat_messages');
        } catch {}
    };

    useEffect(() => {
        try {
            localStorage.setItem('admin_ai_chat_size', JSON.stringify(size));
        } catch {}
    }, [size]);

    const handleResizeStart = (e, direction) => {
        e.preventDefault();
        e.stopPropagation();
        if (isMaximized) setIsMaximized(false);
        setIsResizing(true);

        const startX = e.clientX ?? (e.touches && e.touches[0].clientX);
        const startY = e.clientY ?? (e.touches && e.touches[0].clientY);
        const startW = size.width;
        const startH = size.height;

        const onMove = (moveEvent) => {
            const curX = moveEvent.clientX ?? (moveEvent.touches && moveEvent.touches[0].clientX);
            const curY = moveEvent.clientY ?? (moveEvent.touches && moveEvent.touches[0].clientY);
            if (curX == null || curY == null) return;

            let nextW = startW;
            let nextH = startH;

            if (direction === 'both' || direction === 'left') {
                const deltaX = startX - curX; // 왼쪽으로 끌면 너비 증가
                const maxW = Math.min(1200, window.innerWidth - 40);
                nextW = Math.min(maxW, Math.max(380, startW + deltaX));
            }

            if (direction === 'both' || direction === 'top') {
                const deltaY = startY - curY; // 위로 끌면 높이 증가
                const maxH = Math.min(950, window.innerHeight - 110);
                nextH = Math.min(maxH, Math.max(420, startH + deltaY));
            }

            setSize({ width: nextW, height: nextH });
        };

        const onEnd = () => {
            setIsResizing(false);
            document.body.style.userSelect = '';
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onEnd);
            window.removeEventListener('touchmove', onMove);
            window.removeEventListener('touchend', onEnd);
        };

        document.body.style.userSelect = 'none';
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onEnd);
        window.addEventListener('touchmove', onMove, { passive: false });
        window.addEventListener('touchend', onEnd);
    };

    useEffect(() => {
        if (isOpen && messages.length > 0) {
            bottomRef.current?.scrollIntoView({ block: 'end' });
        }
    }, [messages, sending, isOpen]);

    const handleFileSelect = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const img = await processImageFile(file);
            setAttachedImage(img);
            setError('');
        } catch (err) {
            setError(err.message);
        } finally {
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handlePaste = async (e) => {
        const items = e.clipboardData?.items;
        if (!items) return;
        for (const item of items) {
            if (item.type.startsWith('image/')) {
                e.preventDefault();
                const file = item.getAsFile();
                if (file) {
                    try {
                        const img = await processImageFile(file);
                        setAttachedImage(img);
                        setError('');
                    } catch (err) {
                        setError(err.message);
                    }
                }
                break;
            }
        }
    };

    const send = async (text, imgObj = null) => {
        const question = (text || '').trim();
        const attached = imgObj || attachedImage;
        if ((!question && !attached) || sending) return;

        const userMsg = {
            role: 'user',
            text: question,
            images: attached ? [{
                mimeType: attached.mimeType,
                data: attached.base64,
                previewUrl: attached.dataUrl,
            }] : [],
        };

        const next = [...messages, userMsg];
        setMessages(next);
        setInput('');
        setAttachedImage(null);
        setError('');
        setSending(true);

        try {
            const res = await fetch(API, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: next.map(m => ({
                        role: m.role,
                        text: m.text,
                        images: m.images?.map(img => ({ mimeType: img.mimeType, data: img.data })),
                    })),
                }),
            });
            if (!res.ok) throw new Error(await describeResponseError(res, '답을 받지 못했습니다.'));
            const data = await res.json();
            setMessages([
                ...next,
                {
                    role: 'model',
                    text: data.reply || '(답이 비어 있습니다)',
                    tools: data.tools || [],
                    actions: (data.actions || []).map(a => ({ ...a, status: 'pending' })),
                },
            ]);
        } catch (e) {
            setMessages(messages);
            setInput(question);
            setAttachedImage(attached);
            setError(describeError(e, '답을 받지 못했습니다.'));
        } finally {
            setSending(false);
        }
    };

    const updateActionStatus = (msgIndex, actionIndex, patch) => {
        setMessages((prev) => {
            const next = [...prev];
            const msg = { ...next[msgIndex] };
            const actions = [...msg.actions];
            actions[actionIndex] = { ...actions[actionIndex], ...patch };
            msg.actions = actions;
            next[msgIndex] = msg;
            return next;
        });
    };

    const handleExecuteAction = async (msgIndex, actionIndex, action) => {
        if (!window.confirm(`'${action.title}' 작업을 실행하시겠습니까?`)) return;

        updateActionStatus(msgIndex, actionIndex, { status: 'executing' });
        try {
            const res = await fetch(EXECUTE_API, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    actionType: action.type,
                    payload: action.payload,
                }),
            });
            if (!res.ok) throw new Error(await describeResponseError(res, '실행에 실패했습니다.'));
            const data = await res.json();
            updateActionStatus(msgIndex, actionIndex, {
                status: 'success',
                resultMessage: data.message || '성공적으로 실행되었습니다.',
            });
        } catch (e) {
            updateActionStatus(msgIndex, actionIndex, {
                status: 'failed',
                errorMessage: describeError(e, '실행 중 오류가 발생했습니다.'),
            });
        }
    };

    const handleCancelAction = (msgIndex, actionIndex) => {
        updateActionStatus(msgIndex, actionIndex, { status: 'cancelled' });
    };

    const handleOpenInWeb = (action) => {
        if (!action.linkUrl) return;

        const draft = {
            type: action.type,
            // 전표용 (입고 / 발주)
            vendorCode: action.details?.vendorCode || action.payload?.vendorCode,
            vendorName: action.details?.vendorName,
            date: action.details?.date || action.payload?.date || action.payload?.entryDate,
            memo: action.details?.memo || action.payload?.memo,
            lines: action.details?.lines || action.payload?.lines || [],
            // 금전출납부용
            entryDate: action.payload?.entryDate || action.details?.일자 || action.details?.date,
            cashIn: action.payload?.cashIn != null ? action.payload.cashIn : action.details?.현금수입,
            cardIn: action.payload?.cardIn != null ? action.payload.cardIn : action.details?.카드수입,
            expense: action.payload?.expense != null ? action.payload.expense : action.details?.지출,
            etc: action.payload?.etc || action.details?.비고 || '',
            // 상품 수정용
            productId: action.payload?.productId,
            name: action.payload?.name,
            description: action.payload?.description,
            // 원본 데이터
            payload: action.payload,
            details: action.details,
        };

        // 1. 이미 동일 페이지에 머물고 있을 경우에도 즉시 반영되도록 커스텀 이벤트 발행
        window.dispatchEvent(new CustomEvent('applyAiDraft', { detail: draft }));

        // 2. 해당 메뉴 페이지로 이동하며 state 에 초안 데이터 전달
        navigate(action.linkUrl, { state: { aiDraft: draft } });

        // 3. 전체 웹 화면 격자를 넓게 볼 수 있도록 챗봇 창 닫기
        setIsOpen(false);
    };

    const bubble = (role) => ({
        maxWidth: role === 'user' ? '85%' : '96%',
        padding: '10px 14px',
        borderRadius: '12px',
        lineHeight: 1.5,
        whiteSpace: role === 'user' ? 'pre-wrap' : 'normal',
        fontSize: '0.88rem',
        alignSelf: role === 'user' ? 'flex-end' : 'flex-start',
        background: role === 'user' ? '#2563eb' : '#fff',
        color: role === 'user' ? '#fff' : '#0f172a',
        border: role === 'user' ? 'none' : '1px solid #e2e8f0',
        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
        wordBreak: 'break-word',
    });

    return (
        <>
            {/* 오른쪽 아래 플로팅 챗봇 트리거 버튼 */}
            <button
                type="button"
                aria-label={isOpen ? 'AI 도우미 닫기' : 'AI 도우미 열기'}
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    position: 'fixed',
                    bottom: '24px',
                    right: '28px',
                    width: '60px',
                    height: '60px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                    color: '#fff',
                    border: 'none',
                    boxShadow: '0 8px 24px rgba(37, 99, 235, 0.45)',
                    cursor: 'pointer',
                    zIndex: 4500,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: isOpen ? '1.5rem' : '1.8rem',
                    transition: 'all 0.2s ease',
                }}
            >
                {isOpen ? '✕' : '🤖'}
            </button>

            {/* 챗봇 팝업 창 */}
            {isOpen && (() => {
                const currentWidth = isMaximized
                    ? Math.min(1100, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 40)
                    : size.width;
                const currentHeight = isMaximized
                    ? Math.min(950, (typeof window !== 'undefined' ? window.innerHeight : 900) - 110)
                    : size.height;

                return (
                    <div
                        style={{
                            position: 'fixed',
                            bottom: '96px',
                            right: '28px',
                            width: `${currentWidth}px`,
                            maxWidth: 'calc(100vw - 36px)',
                            height: `${currentHeight}px`,
                            maxHeight: 'calc(100vh - 110px)',
                            background: '#ffffff',
                            borderRadius: '16px',
                            boxShadow: '0 20px 48px rgba(0, 0, 0, 0.22), 0 0 0 1px rgba(0, 0, 0, 0.08)',
                            zIndex: 4500,
                            display: 'flex',
                            flexDirection: 'column',
                            overflow: 'hidden',
                            animation: isResizing ? 'none' : 'fadeIn 0.15s ease',
                            transition: isResizing ? 'none' : 'width 0.15s ease, height 0.15s ease',
                            userSelect: isResizing ? 'none' : 'auto',
                        }}
                    >
                        {/* 좌상단 코너 리사이즈 핸들 */}
                        <div
                            onPointerDown={(e) => handleResizeStart(e, 'both')}
                            title="모서리를 드래그하여 크기 조절"
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '24px',
                                height: '24px',
                                cursor: 'nwse-resize',
                                zIndex: 50,
                                display: 'flex',
                                alignItems: 'flex-start',
                                justifyContent: 'flex-start',
                                padding: '4px',
                            }}
                        >
                            <svg width="10" height="10" viewBox="0 0 10 10" style={{ opacity: 0.65 }}>
                                <path d="M 0,0 L 10,0 L 0,10 Z" fill="#ffffff" />
                            </svg>
                        </div>

                        {/* 상단 가장자리 리사이즈 핸들 */}
                        <div
                            onPointerDown={(e) => handleResizeStart(e, 'top')}
                            title="상단을 드래그하여 높이 조절"
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: '24px',
                                right: '110px',
                                height: '8px',
                                cursor: 'ns-resize',
                                zIndex: 40,
                            }}
                        />

                        {/* 좌측 가장자리 리사이즈 핸들 */}
                        <div
                            onPointerDown={(e) => handleResizeStart(e, 'left')}
                            title="좌측을 드래그하여 너비 조절"
                            style={{
                                position: 'absolute',
                                top: '24px',
                                left: 0,
                                bottom: 0,
                                width: '8px',
                                cursor: 'ew-resize',
                                zIndex: 40,
                            }}
                        />

                        {/* 상단 헤더 바 */}
                        <div
                            style={{
                                padding: '14px 18px',
                                background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
                                color: '#fff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                flexShrink: 0,
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '1.3rem' }}>🤖</span>
                                <div>
                                    <div style={{ fontWeight: 800, fontSize: '0.98rem' }}>AI 관리자 도우미</div>
                                    <div style={{ fontSize: '0.74rem', opacity: 0.85 }}>매출·재고 조회부터 입고·발주 전표까지</div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <button
                                    type="button"
                                    title={showHistory ? '대화창으로 돌아가기' : '이전 세션 대화 기록 열기'}
                                    onClick={() => {
                                        if (showHistory) {
                                            setShowHistory(false);
                                        } else {
                                            handleOpenHistory();
                                        }
                                    }}
                                    style={{
                                        border: 'none',
                                        background: showHistory ? 'rgba(255, 255, 255, 0.4)' : 'rgba(255, 255, 255, 0.2)',
                                        color: '#fff',
                                        borderRadius: '6px',
                                        padding: '4px 8px',
                                        fontSize: '0.75rem',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                    }}
                                >
                                    📜 {showHistory ? '대화창' : '이전 기록'}
                                </button>
                                {messages.length > 0 && !showHistory && (
                                    <button
                                        type="button"
                                        onClick={handleResetChat}
                                        disabled={sending}
                                        style={{
                                            border: 'none',
                                            background: 'rgba(255, 255, 255, 0.2)',
                                            color: '#fff',
                                            borderRadius: '6px',
                                            padding: '4px 8px',
                                            fontSize: '0.75rem',
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                        }}
                                    >
                                        새 대화
                                    </button>
                                )}
                                <button
                                    type="button"
                                    title={isMaximized ? '원래 크기로 복원' : '최대화'}
                                    onClick={() => setIsMaximized(!isMaximized)}
                                    style={{
                                        border: 'none',
                                        background: 'rgba(255, 255, 255, 0.2)',
                                        color: '#fff',
                                        borderRadius: '6px',
                                        padding: '4px 8px',
                                        fontSize: '0.82rem',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        lineHeight: 1,
                                    }}
                                >
                                    {isMaximized ? '❐' : '⛶'}
                                </button>
                                <button
                                    type="button"
                                    title="닫기"
                                    onClick={() => setIsOpen(false)}
                                    style={{
                                        border: 'none',
                                        background: 'none',
                                        color: '#fff',
                                        fontSize: '1.2rem',
                                        cursor: 'pointer',
                                        padding: '0 4px',
                                        lineHeight: 1,
                                    }}
                                >
                                    ✕
                                </button>
                            </div>
                        </div>

                    {/* 이전 기록 보기 패널 */}
                    {showHistory ? (
                        <div
                            style={{
                                flex: 1,
                                overflowY: 'auto',
                                padding: '16px',
                                background: '#f8fafc',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '12px',
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
                                <div>
                                    <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1e293b' }}>
                                        📜 이전 세션 대화 기록
                                    </span>
                                    <span style={{ fontSize: '0.74rem', color: '#64748b', marginLeft: '6px' }}>
                                        (DB 저장 최신 {historyList.length}건)
                                    </span>
                                </div>
                                <div style={{ display: 'flex', gap: '6px' }}>
                                    <button
                                        type="button"
                                        onClick={loadHistory}
                                        disabled={loadingHistory}
                                        style={{
                                            background: '#e2e8f0',
                                            border: 'none',
                                            borderRadius: '4px',
                                            padding: '4px 8px',
                                            fontSize: '0.74rem',
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                        }}
                                    >
                                        {loadingHistory ? '조회 중…' : '🔄 새로고침'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setShowHistory(false)}
                                        style={{
                                            background: '#2563eb',
                                            color: '#fff',
                                            border: 'none',
                                            borderRadius: '4px',
                                            padding: '4px 10px',
                                            fontSize: '0.74rem',
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                        }}
                                    >
                                        대화로 복귀
                                    </button>
                                </div>
                            </div>

                            {loadingHistory && historyList.length === 0 && (
                                <div style={{ textAlign: 'center', padding: '36px 0', color: '#64748b', fontSize: '0.85rem' }}>
                                    이전 대화 기록을 불러오는 중입니다…
                                </div>
                            )}

                            {historyError && (
                                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', padding: '10px 12px', borderRadius: '8px', fontSize: '0.82rem' }}>
                                    {historyError}
                                </div>
                            )}

                            {!loadingHistory && historyList.length === 0 && !historyError && (
                                <div style={{ textAlign: 'center', padding: '48px 0', color: '#94a3b8', fontSize: '0.85rem' }}>
                                    저장된 이전 대화 기록이 없습니다.
                                </div>
                            )}

                            {historyList.map((item) => {
                                const timeStr = item.createdAt ? new Date(item.createdAt).toLocaleString('ko-KR', {
                                    month: 'numeric',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                }) : '';
                                return (
                                    <div
                                        key={item.id}
                                        style={{
                                            background: '#ffffff',
                                            border: '1px solid #e2e8f0',
                                            borderRadius: '10px',
                                            padding: '12px',
                                            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '8px',
                                        }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.74rem', color: '#64748b' }}>
                                            <span style={{ fontWeight: 600 }}>🕒 {timeStr}</span>
                                            {item.tools && (
                                                <span style={{ background: '#f1f5f9', color: '#334155', padding: '2px 6px', borderRadius: '4px', fontFamily: 'monospace', fontSize: '0.7rem' }}>
                                                    ⚙️ {item.tools.split('{')[0]}
                                                </span>
                                            )}
                                        </div>
                                        <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#1e3a8a' }}>
                                            💬 {item.question}
                                        </div>
                                        <div style={{
                                            fontSize: '0.8rem',
                                            color: '#334155',
                                            background: '#f8fafc',
                                            padding: '8px 10px',
                                            borderRadius: '6px',
                                            lineHeight: 1.45,
                                            maxHeight: '130px',
                                            overflowY: 'auto',
                                            whiteSpace: 'pre-wrap',
                                            border: '1px solid #edf2f7',
                                        }}>
                                            {item.answer || '(답변 없음)'}
                                        </div>
                                        <div style={{ display: 'flex', gap: '8px', marginTop: '2px' }}>
                                            <button
                                                type="button"
                                                onClick={() => handleRestoreLog(item)}
                                                style={{
                                                    flex: 1,
                                                    background: '#eff6ff',
                                                    border: '1px solid #bfdbfe',
                                                    color: '#1d4ed8',
                                                    borderRadius: '6px',
                                                    padding: '6px 10px',
                                                    fontSize: '0.78rem',
                                                    fontWeight: 600,
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: '4px',
                                                }}
                                            >
                                                ➕ 대화창에 불러오기
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleReaskLog(item.question)}
                                                style={{
                                                    background: '#f8fafc',
                                                    border: '1px solid #cbd5e1',
                                                    color: '#475569',
                                                    borderRadius: '6px',
                                                    padding: '6px 10px',
                                                    fontSize: '0.78rem',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '4px',
                                                }}
                                            >
                                                ✍️ 질문 복사
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                    /* 대화 본문 스크롤 영역 */
                    <div
                        style={{
                            flex: 1,
                            overflowY: 'auto',
                            padding: '16px',
                            background: '#f8fafc',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '10px',
                        }}
                    >
                        {messages.length === 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '4px 0 12px' }}>
                                <div style={{ textAlign: 'center', color: '#64748b' }}>
                                    <div style={{ fontSize: '1.8rem', marginBottom: '6px' }}>🤖</div>
                                    <div style={{ fontWeight: 700, fontSize: '0.96rem', color: '#1e293b', marginBottom: '4px' }}>
                                        관리자 전용 AI 도우미
                                    </div>
                                    <div style={{ fontSize: '0.78rem', color: '#64748b', lineHeight: 1.45 }}>
                                        궁금한 점을 질문하거나 아래 대표 질문을 클릭해보세요.<br />
                                        📷 사진(거래명세서, 영수증, 부품)을 첨부하여 입고·발주 초안을 잡을 수도 있습니다.
                                    </div>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    {CAPABILITY_CATEGORIES.map((cat, ci) => (
                                        <div
                                            key={ci}
                                            style={{
                                                background: '#ffffff',
                                                border: '1px solid #e2e8f0',
                                                borderRadius: '10px',
                                                padding: '10px 12px',
                                                boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                                            }}
                                        >
                                            <div style={{ fontWeight: 700, fontSize: '0.84rem', color: '#0f172a', marginBottom: '2px' }}>
                                                {cat.title}
                                            </div>
                                            <div style={{ fontSize: '0.74rem', color: '#64748b', marginBottom: '8px' }}>
                                                {cat.desc}
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                                {cat.questions.map((q, qi) => (
                                                    <button
                                                        key={qi}
                                                        type="button"
                                                        onClick={() => send(q)}
                                                        style={{
                                                            background: '#f8fafc',
                                                            border: '1px solid #e2e8f0',
                                                            borderRadius: '6px',
                                                            padding: '6px 10px',
                                                            cursor: 'pointer',
                                                            fontSize: '0.78rem',
                                                            color: '#334155',
                                                            textAlign: 'left',
                                                            transition: 'all 0.15s ease',
                                                        }}
                                                        onMouseEnter={(e) => {
                                                            e.currentTarget.style.background = '#e2e8f0';
                                                            e.currentTarget.style.borderColor = '#cbd5e1';
                                                        }}
                                                        onMouseLeave={(e) => {
                                                            e.currentTarget.style.background = '#f8fafc';
                                                            e.currentTarget.style.borderColor = '#e2e8f0';
                                                        }}
                                                    >
                                                        💬 {q}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {messages.map((m, i) => (
                            <div key={i} style={bubble(m.role)}>
                                {m.images?.length > 0 && (
                                    <div style={{ marginBottom: '6px' }}>
                                        {m.images.map((img, idx) => (
                                            <img
                                                key={idx}
                                                src={img.previewUrl || `data:${img.mimeType};base64,${img.data}`}
                                                alt="첨부 이미지"
                                                onClick={() => setViewingImage(img.previewUrl || `data:${img.mimeType};base64,${img.data}`)}
                                                style={{ maxHeight: '140px', maxWidth: '100%', borderRadius: '6px', cursor: 'pointer' }}
                                            />
                                        ))}
                                    </div>
                                )}

                                {m.role === 'model' ? (
                                    <MarkdownView text={m.text} onAction={send} />
                                ) : (
                                    m.text
                                )}

                                {m.tools?.length > 0 && (
                                    <details style={{ marginTop: '8px', whiteSpace: 'normal' }}>
                                        <summary style={{ cursor: 'pointer', color: '#2563eb', fontSize: '0.82rem' }}>
                                            조회 내용 ({m.tools.map(t => t.label).join(', ')})
                                        </summary>
                                        {m.tools.map((t, j) => (
                                            <div key={j} style={{ marginTop: '6px', padding: '8px', background: '#f8fafc', borderRadius: '6px', fontSize: '0.82rem' }}>
                                                <div style={{ fontWeight: 700, marginBottom: '4px' }}>{t.label}</div>
                                                <ResultView result={t.result} />
                                            </div>
                                        ))}
                                    </details>
                                )}

                                {m.actions?.length > 0 && (
                                    <div style={{ marginTop: '8px', whiteSpace: 'normal' }}>
                                        {m.actions.map((act, actIdx) => (
                                            <ActionCardView
                                                key={act.id || actIdx}
                                                action={act}
                                                onExecute={(a) => handleExecuteAction(i, actIdx, a)}
                                                onCancel={(a) => handleCancelAction(i, actIdx, a)}
                                                onOpenInWeb={handleOpenInWeb}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}

                        {sending && (
                            <div role="status" style={{ ...bubble('model'), color: '#64748b' }}>
                                확인하는 중…
                            </div>
                        )}
                        <div ref={bottomRef} />
                    </div>
                    )}

                    {error && (
                        <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '8px 14px', fontSize: '0.82rem' }}>
                            {error}
                        </div>
                    )}

                    {/* 첨부 이미지 미리보기 */}
                    {attachedImage && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', background: '#f1f5f9', borderTop: '1px solid #e2e8f0' }}>
                            <img src={attachedImage.dataUrl} alt="첨부 사진" style={{ width: '38px', height: '38px', objectFit: 'cover', borderRadius: '4px' }} />
                            <div style={{ flex: 1, minWidth: 0, fontSize: '0.78rem' }}>
                                <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{attachedImage.name}</div>
                                <div style={{ color: '#64748b', fontSize: '0.72rem' }}>{(attachedImage.size / 1024).toFixed(1)} KB</div>
                            </div>
                            <button type="button" onClick={() => setAttachedImage(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.1rem', color: '#64748b' }}>✕</button>
                        </div>
                    )}

                    {/* 입력 폼 */}
                    <form onSubmit={e => { e.preventDefault(); send(input); }} style={{ padding: '10px 12px', background: '#fff', borderTop: '1px solid #e2e8f0', display: 'flex', gap: '6px', alignItems: 'flex-end' }}>
                        <input
                            type="file"
                            ref={fileInputRef}
                            accept="image/*"
                            style={{ display: 'none' }}
                            onChange={handleFileSelect}
                        />
                        <button
                            type="button"
                            title="사진 첨부 (거래명세서, 영수증, 제품 등)"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={sending}
                            style={{
                                padding: '8px 10px',
                                borderRadius: '8px',
                                border: '1px solid #cbd5e1',
                                background: attachedImage ? '#eff6ff' : '#f8fafc',
                                color: attachedImage ? '#2563eb' : '#475569',
                                fontSize: '1.15rem',
                                cursor: sending ? 'wait' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                lineHeight: 1,
                            }}
                        >
                            📷
                        </button>

                        <textarea
                            aria-label="질문"
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onPaste={handlePaste}
                            onKeyDown={e => {
                                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                                    e.preventDefault();
                                    send(input);
                                }
                            }}
                            placeholder={attachedImage ? "사진에 대해 지시하세요 (예: 입고 잡아줘)" : "질문 또는 지시 (Enter 전송, 이미지 붙여넣기)"}
                            rows={1}
                            maxLength={4000}
                            style={{
                                flex: 1,
                                padding: '8px 10px',
                                fontSize: '0.88rem',
                                borderRadius: '8px',
                                border: '1px solid #cbd5e1',
                                fontFamily: 'inherit',
                                resize: 'none',
                                maxHeight: '80px',
                            }}
                        />

                        <button
                            type="submit"
                            disabled={sending || (!input.trim() && !attachedImage)}
                            style={{
                                padding: '8px 14px',
                                borderRadius: '8px',
                                border: 'none',
                                background: sending || (!input.trim() && !attachedImage) ? '#94a3b8' : '#2563eb',
                                color: '#fff',
                                fontWeight: 700,
                                fontSize: '0.88rem',
                                cursor: sending ? 'wait' : 'pointer',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            전송
                        </button>
                    </form>
                </div>
                );
            })()}

            {/* 원본 확대 모달 */}
            {viewingImage && (
                <div onClick={() => setViewingImage(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px' }}>
                    <img src={viewingImage} alt="원본 확대" style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: '8px' }} />
                </div>
            )}
        </>
    );
}
