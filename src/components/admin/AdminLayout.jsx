import { NavLink, Outlet, useNavigate } from 'react-router-dom';

const AdminLayout = ({
    products,
    setProducts,
    mainCategories,
    setMainCategories,
    subCategories,
    setSubCategories,
    orders,
    setOrders,
    page,
    hasMore,
    isFetchingMore,
    onLoadMore,
    onRefresh,
    activeMainCat,
    setActiveMainCat,
    activeSubCat,
    setActiveSubCat,
    searchQuery,
    setSearchQuery
}) => {
    const navigate = useNavigate();

    return (
        <div className="admin-page-container">
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
                    </NavLink>
                </nav>
            </aside>

            <main className="admin-content">
                <div style={{ position: 'absolute', top: '30px', right: '40px' }}>
                    <button className="back-to-kiosk" onClick={() => navigate('/')}>🏠 키오스크 화면으로 이동</button>
                </div>
                <div style={{ maxWidth: '1100px', margin: '60px auto 0 auto' }}>
                    <Outlet context={{
                        products, setProducts,
                        mainCategories, setMainCategories,
                        subCategories, setSubCategories,
                        orders, setOrders,
                        page, hasMore, isFetchingMore, onLoadMore, onRefresh,
                        activeMainCat, setActiveMainCat, activeSubCat, setActiveSubCat, searchQuery, setSearchQuery
                    }} />
                </div>
            </main>
        </div>
    );
};

export default AdminLayout;
