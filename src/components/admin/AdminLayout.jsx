import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';

import useOrderNotifications from '../../hooks/useOrderNotifications';

// NaverSyncPage 의 TABS 와 key 동일하게 유지
const NAVER_TABS = [
    { key: 'mapping', label: '카테고리 매핑' },
    { key: 'push', label: '상품' },
    { key: 'sync', label: '재고·가격 동기화' },
    { key: 'sales', label: '최근 판매 확인' },
];

const AdminLayout = ({
    products,
    setProducts,
    mainCategories,
    setMainCategories,
    subCategories,
    setSubCategories,
    refreshCategories,
    orders,
    setOrders,
    isRefreshing,
    onRefresh,
    activeMainCat,
    setActiveMainCat,
    activeSubCat,
    setActiveSubCat,
    searchQuery,
    setSearchQuery
}) => {
    const navigate = useNavigate();
    const location = useLocation();
    const onNaver = location.pathname.startsWith('/admin/naver');
    // 주문 감시는 어느 관리 탭에 있든 계속 돌아야 하므로 레이아웃에서 한 번만 건다.
    const orderNotifications = useOrderNotifications({ orders, setOrders });
    const { newOrderAlert, dismissAlert, isStreamConnected, fetchError } = orderNotifications;
    const naverTab = new URLSearchParams(location.search).get('tab') || 'mapping';

    return (
        <div className="admin-page-container">
            {newOrderAlert && (
                <div
                    role="status"
                    onClick={() => { dismissAlert(); navigate('/admin/orders'); }}
                    style={{
                        position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)',
                        zIndex: 4000, cursor: 'pointer', padding: '16px 28px', borderRadius: '18px',
                        background: 'linear-gradient(135deg, #ef4444 0%, #f97316 100%)', color: 'white',
                        fontWeight: 800, fontSize: '1.05rem', boxShadow: '0 12px 30px rgba(0,0,0,0.25)',
                        display: 'flex', alignItems: 'center', gap: '14px'
                    }}
                >
                    <span style={{ fontSize: '1.3rem' }}>🔔</span>
                    <span>
                        새로운 주문 {newOrderAlert.count}건
                        {newOrderAlert.customerName && ` — ${newOrderAlert.customerName}`}
                    </span>
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); dismissAlert(); }}
                        style={{
                            border: 'none', background: 'rgba(255,255,255,0.25)', color: 'white',
                            width: '28px', height: '28px', borderRadius: '50%', cursor: 'pointer', fontWeight: 800
                        }}
                    >
                        ×
                    </button>
                </div>
            )}
            <aside className="admin-sidebar">
                <div className="admin-sidebar-header">
                    <div style={{ color: 'white', fontSize: '0.7rem', opacity: 0.5, marginBottom: '5px', letterSpacing: '0.1em' }}>관리 서비스</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>매장 관리자</div>
                </div>
                <nav style={{ flex: 1, padding: '20px 10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <NavLink
                        to="/admin/products"
                        className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}
                        style={{ textDecoration: 'none' }}
                    >
                        <span style={{ fontSize: '1.2rem' }}>📦</span>
                        <span style={{ fontWeight: 600 }}>상품 통합 관리</span>
                    </NavLink>
                    <NavLink
                        to="/admin/categories"
                        className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}
                        style={{ textDecoration: 'none' }}
                    >
                        <span style={{ fontSize: '1.2rem' }}>📁</span>
                        <span style={{ fontWeight: 600 }}>카테고리 설정</span>
                    </NavLink>
                    <NavLink
                        to="/admin/orders"
                        className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}
                        style={{ textDecoration: 'none' }}
                    >
                        <span style={{ fontSize: '1.2rem' }}>🧾</span>
                        <span style={{ fontWeight: 600 }}>주문 내역 관리</span>
                    </NavLink>
                    <div className="admin-nav-group">
                        <NavLink
                            to="/admin/naver"
                            className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}
                            style={{ textDecoration: 'none' }}
                        >
                            <svg width="1.2rem" height="1.2rem" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <rect width="24" height="24" rx="5" fill="#03C75A" />
                                <path d="M14.13 12.32 9.86 6H6.4v12h3.7v-6.32L14.36 18h3.46V6h-3.7v6.32Z" fill="#fff" />
                            </svg>
                            <span style={{ fontWeight: 600 }}>네이버 스토어</span>
                            <span className="admin-nav-caret">›</span>
                        </NavLink>
                        <div className="admin-flyout">
                            <div className="admin-flyout-title">네이버 스토어</div>
                            {NAVER_TABS.map((t, i) => (
                                <NavLink
                                    key={t.key}
                                    to={t.key === 'mapping' ? '/admin/naver' : `/admin/naver?tab=${t.key}`}
                                    // 함수형 className: NavLink 자동 active 주입을 끄고, 실제 선택된 탭만 표시
                                    className={() => `admin-flyout-item ${onNaver && naverTab === t.key ? 'active' : ''}`}
                                    style={{ textDecoration: 'none' }}
                                >
                                    <span className="admin-flyout-num">{i + 1}</span>
                                    {t.label}
                                </NavLink>
                            ))}
                        </div>
                    </div>
                </nav>
            </aside>

            <main className="admin-content">
                <div style={{ position: 'absolute', top: '30px', right: '40px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span
                        title={isStreamConnected
                            ? '실시간 주문 알림 연결됨'
                            : '실시간 연결이 끊겨 예비 조회로 동작 중입니다'}
                        style={{
                            fontSize: '0.78rem', fontWeight: 700, padding: '6px 12px', borderRadius: '999px',
                            background: isStreamConnected ? '#ecfdf5' : '#fef2f2',
                            color: isStreamConnected ? '#047857' : '#b91c1c'
                        }}
                    >
                        {isStreamConnected ? '● 실시간 연결' : '● 예비 조회'}
                    </span>
                    {fetchError && (
                        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#b91c1c' }}>
                            {fetchError}
                        </span>
                    )}
                    <button className="back-to-kiosk" onClick={() => navigate('/')}>🏠 키오스크 화면으로 이동</button>
                </div>
                <div style={{ maxWidth: '1100px', margin: '60px auto 0 auto' }}>
                    <Outlet context={{
                        products, setProducts,
                        mainCategories, setMainCategories,
                        subCategories, setSubCategories, refreshCategories,
                        orders, setOrders,
                        isRefreshing, onRefresh,
                        activeMainCat, setActiveMainCat, activeSubCat, setActiveSubCat, searchQuery, setSearchQuery,
                        orderNotifications
                    }} />
                </div>
            </main>
        </div>
    );
};

export default AdminLayout;
