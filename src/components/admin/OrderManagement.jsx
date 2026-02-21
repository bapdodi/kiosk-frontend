
import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';

const OrderManagement = () => {
    const { orders = [], setOrders } = useOutletContext();
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [activeOrderTab, setActiveOrderTab] = useState('all'); // all, pending, completed, cancelled
    const today = new Date().toISOString().split('T')[0];
    const [startDate, setStartDate] = useState(today);
    const [endDate, setEndDate] = useState(today);
    const [orderSearchQuery, setOrderSearchQuery] = useState('');

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

    const formatTime = (isoString) => {
        if (!isoString) return '';
        const date = new Date(isoString);
        return date.toLocaleString('ko-KR', {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
    };

    const filteredOrders = [...orders]
        .filter(order => {
            // Status filter
            const matchStatus = activeOrderTab === 'all' ? true : order.status === activeOrderTab;

            // Name filter
            const matchName = order.customerName.toLowerCase().includes(orderSearchQuery.toLowerCase());

            // Date filter
            let matchDate = true;
            if (order.timestamp) {
                const orderDate = new Date(order.timestamp).toISOString().split('T')[0];
                if (startDate && orderDate < startDate) matchDate = false;
                if (endDate && orderDate > endDate) matchDate = false;
            }

            return matchStatus && matchName && matchDate;
        })
        .reverse();

    return (
        <div className="fade-in" style={{ paddingBottom: '40px' }}>
            {/* Order Detail Modal */}
            {selectedOrder && (
                <div className="modal-overlay" style={{ zIndex: 3000 }} onClick={() => setSelectedOrder(null)}>
                    <div className="modal-content glass-panel" style={{ maxWidth: '600px', width: '95%', padding: '0', borderRadius: '32px', border: '1px solid rgba(255,255,255,0.4)' }} onClick={e => e.stopPropagation()}>
                        <div style={{ padding: '30px', borderBottom: '1px solid rgba(0,0,0,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800 }} className="gradient-text">주문 상세 정보</h3>
                            <button onClick={() => setSelectedOrder(null)} style={{ background: '#f1f5f9', border: 'none', width: '40px', height: '40px', borderRadius: '50%', fontSize: '1.2rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}>×</button>
                        </div>
                        <div style={{ padding: '30px' }}>
                            <div style={{ marginBottom: '25px', padding: '20px', background: 'rgba(255,255,255,0.5)', borderRadius: '20px', border: '1px solid rgba(0,0,0,0.03)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                                    <span style={{ color: '#64748b', fontWeight: 600 }}>주문자</span>
                                    <span style={{ color: '#1e293b', fontWeight: 800 }}>{selectedOrder.customerName}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: '#64748b', fontWeight: 600 }}>주문 시간</span>
                                    <span style={{ color: '#1e293b', fontWeight: 600 }}>{selectedOrder.timestamp}</span>
                                </div>
                            </div>

                            <h4 style={{ marginBottom: '15px', fontSize: '1.1rem', fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                🛍️ 주문 상품 ({selectedOrder.items.length})
                            </h4>
                            <div style={{ maxHeight: '350px', overflowY: 'auto', paddingRight: '10px' }}>
                                {selectedOrder.items.map((item, idx) => (
                                    <div key={idx} style={{ padding: '15px', background: 'white', borderRadius: '16px', marginBottom: '10px', border: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div>
                                            <div style={{ fontWeight: 700, fontSize: '1rem', color: '#1e293b' }}>{item.name}</div>
                                            {item.selectedOption && (
                                                <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px', background: '#f1f5f9', padding: '2px 8px', borderRadius: '6px', display: 'inline-block' }}>
                                                    옵션: {item.selectedOption}
                                                </div>
                                            )}
                                        </div>
                                        <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#334155' }}>
                                            ₩{item.finalPrice.toLocaleString()}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div style={{ marginTop: '25px', padding: '25px', background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)', borderRadius: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'white', boxShadow: '0 10px 20px rgba(0,0,0,0.1)' }}>
                                <span style={{ fontSize: '1.1rem', fontWeight: 600, opacity: 0.8 }}>총 결제 금액</span>
                                <span style={{ fontSize: '1.8rem', fontWeight: 900 }}>₩{selectedOrder.totalAmount.toLocaleString()}</span>
                            </div>
                        </div>
                        <div style={{ padding: '0 30px 30px 30px' }}>
                            <button className="apply-btn" style={{ width: '100%', padding: '18px', borderRadius: '18px', fontSize: '1.1rem' }} onClick={() => setSelectedOrder(null)}>확인 및 닫기</button>
                        </div>
                    </div>
                </div>
            )}

            <div className="admin-header-title" style={{ marginBottom: '40px' }}>
                <div>
                    <h2 style={{ fontSize: '2.2rem', fontWeight: 900, marginBottom: '8px' }}>
                        <span style={{ marginRight: '12px' }}>🧾</span>
                        <span className="gradient-text">실시간 주문 내역</span>
                    </h2>
                    <p style={{ color: '#64748b', fontSize: '1rem', fontWeight: 500 }}>실시간으로 들어오는 주문을 관리하고 처리 상태를 업데이트하세요.</p>
                </div>
                <div style={{ display: 'flex', gap: '20px' }}>
                    <div className="admin-stat-card" style={{ padding: '15px 30px', display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: '220px' }}>
                        <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 700, marginBottom: '5px' }}>검색 결과 합계 금액</span>
                        <span style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--admin-primary)' }}>
                            ₩{filteredOrders.reduce((sum, o) => sum + (o.status !== 'cancelled' ? o.totalAmount : 0), 0).toLocaleString()}
                        </span>
                    </div>
                </div>
            </div>

            <div className="glass-panel" style={{ borderRadius: '30px', padding: '25px', marginBottom: '30px', display: 'flex', flexDirection: 'column', gap: '25px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
                    <div style={{ display: 'flex', gap: '10px', background: '#f1f5f9', padding: '6px', borderRadius: '100px' }}>
                        {[
                            { id: 'all', name: '전체', icon: '📋' },
                            { id: 'pending', name: '대기 중', icon: '⏳' },
                            { id: 'completed', name: '완료', icon: '✅' },
                            { id: 'cancelled', name: '취소', icon: '❌' }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveOrderTab(tab.id)}
                                style={{
                                    padding: '10px 22px',
                                    borderRadius: '100px',
                                    border: 'none',
                                    background: activeOrderTab === tab.id ? 'white' : 'transparent',
                                    color: activeOrderTab === tab.id ? '#1e293b' : '#64748b',
                                    fontWeight: 700,
                                    fontSize: '0.9rem',
                                    cursor: 'pointer',
                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                    boxShadow: activeOrderTab === tab.id ? '0 4px 12px rgba(0,0,0,0.08)' : 'none',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                }}
                            >
                                <span>{tab.icon}</span>
                                {tab.name}
                                <span style={{
                                    fontSize: '0.75rem',
                                    background: activeOrderTab === tab.id ? '#f1f5f9' : 'rgba(0,0,0,0.05)',
                                    padding: '2px 8px',
                                    borderRadius: '8px',
                                    marginLeft: '4px',
                                    opacity: 0.8
                                }}>
                                    {tab.id === 'all' ? orders.length : orders.filter(o => o.status === tab.id).length}
                                </span>
                            </button>
                        ))}
                    </div>

                    <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                        <div className="search-container" style={{ margin: 0, width: '280px' }}>
                            <input
                                className="search-input"
                                placeholder="주문자 이름 검색..."
                                value={orderSearchQuery}
                                onChange={(e) => setOrderSearchQuery(e.target.value)}
                                style={{ padding: '12px 15px 12px 45px', fontSize: '0.95rem', borderRadius: '15px', border: '1px solid #e2e8f0', background: 'white' }}
                            />
                            <span className="search-icon" style={{ left: '18px', fontSize: '1rem' }}>🔍</span>
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', background: 'white', padding: '15px 25px', borderRadius: '20px', border: '1px solid #f1f5f9' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '1.2rem' }}>📅</span>
                        <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#475569', marginRight: '10px' }}>기간 필터</span>
                        <input
                            type="date"
                            className="admin-input-small"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            style={{ width: '150px', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '8px 12px' }}
                        />
                        <span style={{ color: '#cbd5e1', fontWeight: 800 }}>~</span>
                        <input
                            type="date"
                            className="admin-input-small"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            style={{ width: '150px', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '8px 12px' }}
                        />
                        {(startDate || endDate) && (
                            <button
                                onClick={() => { setStartDate(''); setEndDate(''); }}
                                style={{ background: '#f1f5f9', border: 'none', borderRadius: '10px', padding: '8px 15px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 700, color: '#ef4444' }}
                            >
                                초기화 🔄
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <div className="admin-table-container" style={{ background: 'transparent', boxShadow: 'none' }}>
                <table className="premium-table">
                    <thead>
                        <tr>
                            <th>주문 시간</th>
                            <th>주문자</th>
                            <th>주문 내역</th>
                            <th>결제 금액</th>
                            <th style={{ textAlign: 'center' }}>상태 설정</th>
                            <th style={{ textAlign: 'right' }}>관리</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredOrders.map(order => (
                            <tr key={order.id} className="order-row">
                                <td style={{ color: '#64748b', fontWeight: 500 }}>
                                    <div style={{ fontSize: '0.9rem' }}>{formatTime(order.timestamp)}</div>
                                </td>
                                <td>
                                    <div style={{ fontWeight: 800, color: '#1e293b', fontSize: '1rem' }}>{order.customerName}</div>
                                </td>
                                <td>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <div style={{ fontSize: '0.95rem', color: '#475569', fontWeight: 600 }}>
                                            {order.items.length > 1 ? `${order.items[0].name} 외 ${order.items.length - 1}건` : order.items[0]?.name}
                                        </div>
                                        <button
                                            onClick={() => setSelectedOrder(order)}
                                            style={{ padding: '4px 10px', fontSize: '0.75rem', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 700 }}
                                        >
                                            자세히 ➔
                                        </button>
                                    </div>
                                </td>
                                <td>
                                    <div style={{ fontWeight: 900, fontSize: '1.1rem', color: '#1e293b' }}>
                                        ₩{order.totalAmount.toLocaleString()}
                                    </div>
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                    <div style={{ display: 'inline-flex', position: 'relative' }}>
                                        <select
                                            className={`status-badge status-${order.status}`}
                                            style={{
                                                appearance: 'none',
                                                cursor: 'pointer',
                                                padding: '8px 30px 8px 15px',
                                                outline: 'none',
                                                minWidth: '110px',
                                                backgroundImage: 'url(\"data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22currentColor%22%20stroke-width%3D%223%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E\")',
                                                backgroundRepeat: 'no-repeat',
                                                backgroundPosition: 'right 10px center'
                                            }}
                                            value={order.status}
                                            onChange={(e) => updateOrderStatus(order.id, e.target.value)}
                                        >
                                            <option value="pending">⏳ 대기 중</option>
                                            <option value="completed">✅ 처리 완료</option>
                                            <option value="cancelled">❌ 주문 취소</option>
                                        </select>
                                    </div>
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                    <button
                                        className="action-btn delete"
                                        onClick={() => deleteOrder(order.id)}
                                        style={{ border: 'none', background: '#fef2f2', color: '#ef4444', padding: '10px 18px', borderRadius: '12px' }}
                                    >
                                        🗑️ 삭제
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {filteredOrders.length === 0 && (
                    <div className="glass-panel" style={{ padding: '100px', textAlign: 'center', marginTop: '20px', borderRadius: '32px' }}>
                        <div style={{ fontSize: '4rem', marginBottom: '20px' }}>📦</div>
                        <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#1e293b', marginBottom: '8px' }}>
                            {activeOrderTab === 'all'
                                ? '아직 주문 내역이 없습니다'
                                : '검색 결과가 없습니다'}
                        </h3>
                        <p style={{ color: '#64748b', fontWeight: 500 }}>
                            {orderSearchQuery || startDate || endDate
                                ? '검색 조건을 변경하거나 초기화해 보세요.'
                                : '새로운 주문이 들어오면 여기에 실시간으로 표시됩니다.'}
                        </p>
                        {(orderSearchQuery || startDate || endDate || activeOrderTab !== 'all') && (
                            <button
                                onClick={() => { setOrderSearchQuery(''); setStartDate(''); setEndDate(''); setActiveOrderTab('all'); }}
                                style={{ marginTop: '25px', padding: '12px 25px', borderRadius: '15px', border: 'none', background: '#1e293b', color: 'white', fontWeight: 700, cursor: 'pointer' }}
                            >
                                모든 필터 초기화
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default OrderManagement;
