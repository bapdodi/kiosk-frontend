import { NavLink, Outlet, useNavigate } from 'react-router-dom';

const AdminLayout = ({
    products,
    setProducts,
    mainCategories,
    setMainCategories,
    subCategories,
    setSubCategories,
    detailCategories,
    setDetailCategories,
    orders,
    setOrders
}) => {
    const navigate = useNavigate();

    return (
        <div className="admin-page-container">
            <aside className="admin-sidebar">
                <div className="admin-sidebar-header">
                    <div style={{ color: 'white', fontSize: '0.7rem', opacity: 0.5, marginBottom: '5px', letterSpacing: '0.1em' }}>관리 서비스</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>매장 관리자</div>
                </div>
                <nav style={{ flex: 1, padding: '20px 0', display: 'flex', flexDirection: 'column' }}>
                    <NavLink
                        to="/admin/products"
                        className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}
                    >
                        <span>📦</span> 상품 통합 관리
                    </NavLink>
                    <NavLink
                        to="/admin/categories"
                        className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}
                    >
                        <span>📁</span> 카테고리 설정
                    </NavLink>
                    <NavLink
                        to="/admin/orders"
                        className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}
                    >
                        <span>🧾</span> 주문 내역 관리
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
                        detailCategories, setDetailCategories,
                        orders, setOrders
                    }} />
                </div>
            </main>
        </div>
    );
};

export default AdminLayout;
