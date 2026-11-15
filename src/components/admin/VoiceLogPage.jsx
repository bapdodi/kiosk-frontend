import { useCallback, useEffect, useState } from 'react';
import { describeResponseError } from '../../utils/apiError';

export default function VoiceLogPage() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [selectedLog, setSelectedLog] = useState(null);

    const fetchLogs = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await fetch('/api/order-voice/logs?limit=50');
            if (!res.ok) throw new Error(await describeResponseError(res, '통화 로그를 불러오지 못했습니다.'));
            const data = await res.json();
            setLogs(Array.isArray(data) ? data : []);
        } catch (err) {
            setError(err.message || '통화 로그를 불러오지 못했습니다.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    const formatTime = (ts) => {
        if (!ts) return '';
        try {
            const d = new Date(ts);
            return `${d.toLocaleDateString('ko-KR')} ${d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
        } catch {
            return String(ts);
        }
    };

    const statusBadge = (status) => {
        switch (status) {
            case 'ordered':
                return <span style={{ padding: '3px 8px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 700, background: '#e6f4ea', color: '#137333' }}>주문 접수</span>;
            case 'error':
                return <span style={{ padding: '3px 8px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 700, background: '#fce8e6', color: '#c5221f' }}>오류 발생</span>;
            case 'completed':
            default:
                return <span style={{ padding: '3px 8px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 700, background: '#e8f0fe', color: '#1a73e8' }}>통화 종료</span>;
        }
    };

    return (
        <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto', fontFamily: 'sans-serif' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800 }}>📞 AI 통화 주문 기록</h2>
                    <p style={{ margin: '6px 0 0', color: '#666', fontSize: '0.9rem' }}>
                        손님이 키오스크에서 진행한 실시간 AI 음성 주문 통화 기록과 인식 내역입니다.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={fetchLogs}
                    disabled={loading}
                    style={{
                        padding: '10px 16px', background: '#1a73e8', color: 'white', border: 'none',
                        borderRadius: '8px', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 600,
                    }}
                >
                    {loading ? '불러오는 중…' : '🔄 새로고침'}
                </button>
            </div>

            {error && (
                <div role="alert" style={{ padding: '12px 16px', background: '#fce8e6', color: '#c5221f', borderRadius: '8px', marginBottom: '16px' }}>
                    {error}
                </div>
            )}

            <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e0e0e0', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                    <thead style={{ background: '#f8f9fa', borderBottom: '1px solid #e0e0e0', color: '#555' }}>
                        <tr>
                            <th style={{ padding: '12px 16px' }}>일시</th>
                            <th style={{ padding: '12px 16px' }}>상호 / 고객</th>
                            <th style={{ padding: '12px 16px' }}>상태</th>
                            <th style={{ padding: '12px 16px' }}>주문 번호</th>
                            <th style={{ padding: '12px 16px' }}>대화 요약</th>
                            <th style={{ padding: '12px 16px' }}>상세</th>
                        </tr>
                    </thead>
                    <tbody>
                        {logs.length === 0 ? (
                            <tr>
                                <td colSpan="6" style={{ padding: '40px 16px', textAlign: 'center', color: '#888' }}>
                                    {loading ? '통화 기록을 불러오는 중입니다…' : '아직 기록된 AI 통화 내역이 없습니다.'}
                                </td>
                            </tr>
                        ) : (
                            logs.map(log => (
                                <tr key={log.id} style={{ borderBottom: '1px solid #f0f0f0', cursor: 'pointer' }} onClick={() => setSelectedLog(log)}>
                                    <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>{formatTime(log.createdAt)}</td>
                                    <td style={{ padding: '12px 16px', fontWeight: 600 }}>{log.customerName || '미지정 (비회원 등)'}</td>
                                    <td style={{ padding: '12px 16px' }}>{statusBadge(log.status)}</td>
                                    <td style={{ padding: '12px 16px', fontWeight: 600, color: log.orderId ? '#137333' : '#888' }}>
                                        {log.orderId ? `#${log.orderId}` : '-'}
                                    </td>
                                    <td style={{ padding: '12px 16px', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#555' }}>
                                        {log.transcript ? log.transcript.replace(/\n/g, '  |  ') : (log.errorMessage ? `오류: ${log.errorMessage}` : '-')}
                                    </td>
                                    <td style={{ padding: '12px 16px' }}>
                                        <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); setSelectedLog(log); }}
                                            style={{ padding: '4px 10px', fontSize: '0.8rem', background: '#f1f3f4', border: '1px solid #dadce0', borderRadius: '4px', cursor: 'pointer' }}
                                        >
                                            상세 보기
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {selectedLog && (
                <div
                    style={{
                        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
                        display: 'grid', placeItems: 'center', padding: '20px',
                    }}
                    onClick={() => setSelectedLog(null)}
                >
                    <div
                        style={{
                            background: 'white', borderRadius: '12px', maxWidth: '750px', width: '100%',
                            maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
                            boxShadow: '0 8px 30px rgba(0,0,0,0.25)',
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e0e0e0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>
                                    통화 상세 기록 #{selectedLog.id}
                                </h3>
                                <span style={{ fontSize: '0.85rem', color: '#666' }}>{formatTime(selectedLog.createdAt)}</span>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedLog(null)}
                                style={{ border: 'none', background: 'transparent', fontSize: '1.5rem', cursor: 'pointer' }}
                            >
                                ×
                            </button>
                        </div>
                        <div style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div style={{ display: 'flex', gap: '16px' }}>
                                <div><strong>상호:</strong> {selectedLog.customerName || '미지정'}</div>
                                <div><strong>상태:</strong> {statusBadge(selectedLog.status)}</div>
                                {selectedLog.orderId && <div><strong>주문번호:</strong> #{selectedLog.orderId}</div>}
                            </div>

                            {selectedLog.errorMessage && (
                                <div style={{ padding: '12px', background: '#fce8e6', color: '#c5221f', borderRadius: '8px' }}>
                                    <strong>오류 메시지:</strong> {selectedLog.errorMessage}
                                </div>
                            )}

                            <div>
                                <h4 style={{ margin: '0 0 8px', fontSize: '1rem' }}>🗣️ 대화 전문 (인식된 말 및 AI 응답)</h4>
                                <pre style={{
                                    background: '#f8f9fa', padding: '14px', borderRadius: '8px',
                                    fontSize: '0.85rem', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                                    maxHeight: '250px', overflowY: 'auto', border: '1px solid #e0e0e0',
                                }}>
                                    {selectedLog.transcript || '(대화 내용 없음)'}
                                </pre>
                            </div>

                            {selectedLog.tools && (
                                <div>
                                    <h4 style={{ margin: '0 0 8px', fontSize: '1rem' }}>⚙️ 실행된 도구 (Function Calls)</h4>
                                    <pre style={{
                                        background: '#f8f9fa', padding: '14px', borderRadius: '8px',
                                        fontSize: '0.82rem', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                                        maxHeight: '200px', overflowY: 'auto', border: '1px solid #e0e0e0', color: '#333',
                                    }}>
                                        {selectedLog.tools}
                                    </pre>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
