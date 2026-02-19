
import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';

const OrderManagement = () => {
    const { orders, setOrders } = useOutletContext();
    const [selectedOrder, setSelectedOrder] = useState(null);

    const deleteOrder = async (orderId) => {
        if (!window.confirm('주문 내역을 삭제하시겠습니까?')) return;
        try {
            const res = await fetch(`/api/orders/admin/${orderId}`, { method: 'DELETE' });
            if (res.ok) {
                setOrders(orders.filter(o => o.id !== orderId));
            }
        } catch (err) {
            alert('오류 발생');
        }
    };

    const updateOrderStatus = async (orderId, status) => {
        try {
            const res = await fetch(`/api/orders/admin/${orderId}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(status)
            });
            if (res.ok) {
                const updated = await res.json();
                setOrders(orders.map(o => o.id === orderId ? updated : o));
            }
        } catch (err) {
            alert('오류 발생');
        }
    };

    return (
        <div className="fade-in">
            {/* Order Detail Modal */}
            {selectedOrder && (
                <div className="modal-overlay" style={{ zIndex: 1000 }} onClick={() => setSelectedOrder(null)}>
                    <div className="modal-content" style={{ maxWidth: '500px', width: '90%', padding: '0' }} onClick={e => e.stopPropagation()}>
                        <div style={{ padding: '20px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0 }}>주문 상세 정보</h3>
                            <button onClick={() => setSelectedOrder(null)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
                        </div>
                        <div style={{ padding: '20px' }}>
                            <div style={{ marginBottom: '20px', padding: '15px', background: '#f8fafc', borderRadius: '12px' }}>
                                <div style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '4px' }}>주문자: <span style={{ color: '#1e293b', fontWeight: 700 }}>{selectedOrder.customerName}</span></div>
                                <div style={{ fontSize: '0.9rem', color: '#64748b' }}>주문시간: <span style={{ color: '#1e293b' }}>{selectedOrder.timestamp}</span></div>
                            </div>
                            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                                <h4 style={{ marginBottom: '10px' }}>주문 상품 목록 ({selectedOrder.items.length})</h4>
                                {selectedOrder.items.map((item, idx) => (
                                    <div key={idx} style={{ padding: '10px 0', borderBottom: idx === selectedOrder.items.length - 1 ? 'none' : '1px solid #f1f5f9' }}>
                                        <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{item.name}</div>
                                        {item.selectedOption && <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>옵션: {item.selectedOption}</div>}
                                        <div style={{ fontSize: '0.9rem', textAlign: 'right', fontWeight: 700, marginTop: '4px' }}>₩{item.finalPrice.toLocaleString()}</div>
                                    </div>
                                ))}
                            </div>
                            <div style={{ marginTop: '20px', paddingTop: '15px', borderTop: '2px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontWeight: 700 }}>총 결제 금액</span>
                                <span style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--admin-primary)' }}>₩{selectedOrder.totalAmount.toLocaleString()}</span>
                            </div>
                        </div>
                        <div style={{ padding: '15px', textAlign: 'center' }}>
                            <button className="apply-btn" style={{ width: '100%' }} onClick={() => setSelectedOrder(null)}>닫기</button>
                        </div>
                    </div>
                </div>
            )}

            <div className="admin-header-title">
                <h2 style={{ fontSize: '1.8rem', fontWeight: 800 }}>🧾 실시간 주문 내역</h2>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <div style={{ background: '#f1f5f9', padding: '8px 20px', borderRadius: '12px', fontWeight: 700, color: '#475569' }}>
                        총 주문액: ₩{orders.reduce((sum, o) => sum + (o.status !== 'cancelled' ? o.totalAmount : 0), 0).toLocaleString()}
                    </div>
                </div>
            </div>

            <div className="admin-table-container">
                <table className="admin-table">
                    <thead>
                        <tr>
                            <th>주문 시간</th>
                            <th>주문자</th>
                            <th>주문 상품</th>
                            <th>결제 금액</th>
                            <th>상태</th>
                            <th style={{ textAlign: 'right' }}>관리</th>
                        </tr>
                    </thead>
                    <tbody>
                        {[...orders].reverse().map(order => (
                            <tr key={order.id}>
                                <td style={{ fontSize: '0.85rem', color: '#64748b' }}>{order.timestamp}</td>
                                <td style={{ fontWeight: 700 }}>{order.customerName}</td>
                                <td>
                                    <div style={{ fontSize: '0.9rem' }}>
                                        {order.items.length > 2 ? (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span>{order.items[0].name} 외 {order.items.length - 1}건</span>
                                                <button
                                                    onClick={() => setSelectedOrder(order)}
                                                    style={{ padding: '2px 8px', fontSize: '0.7rem', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer' }}
                                                >
                                                    상세보기
                                                </button>
                                            </div>
                                        ) : (
                                            order.items.map((item, idx) => (
                                                <div key={idx} style={{ marginBottom: '2px', color: '#334155' }}>
                                                    • {item.name} {item.selectedOption ? <span style={{ color: '#64748b', fontSize: '0.8rem' }}>({item.selectedOption})</span> : ''}
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </td>
                                <td style={{ fontWeight: 800 }}>₩{order.totalAmount.toLocaleString()}</td>
                                <td>
                                    <select
                                        className="admin-input-small"
                                        style={{ width: '100px', padding: '4px', fontSize: '0.8rem', background: order.status === 'completed' ? '#f0fdf4' : order.status === 'cancelled' ? '#fef2f2' : 'white' }}
                                        value={order.status}
                                        onChange={(e) => updateOrderStatus(order.id, e.target.value)}
                                    >
                                        <option value="pending">대기 중</option>
                                        <option value="completed">처리 완료</option>
                                        <option value="cancelled">주문 취소</option>
                                    </select>
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                    <button className="action-btn delete" onClick={() => deleteOrder(order.id)}>삭제</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {orders.length === 0 && (
                    <div style={{ padding: '80px', textAlign: 'center', color: '#94a3b8', fontSize: '1.1rem' }}>
                        📦 새로운 주문이 들어오기를 기다리고 있습니다.
                    </div>
                )}
            </div>
        </div>
    );
};

export default OrderManagement;
