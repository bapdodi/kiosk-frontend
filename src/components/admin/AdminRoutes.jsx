import { useEffect } from 'react';
import { Navigate, Route, Routes, useOutletContext } from 'react-router-dom';
import AdminLayout from './AdminLayout';
import CategoryManagement from './CategoryManagement';
import ErpBakImportPage from './ErpBakImportPage';
import ErpReceivingPage from './ErpReceivingPage';
import NaverSyncPage from './NaverSyncPage';
import OrderManagement from './OrderManagement';
import ProductForm from './ProductForm';
import ProductManagement from './ProductManagement';

/**
 * 관리자 화면 전체. 손님 화면(키오스크·폰) 번들에서 떼어 내려고 App 이 lazy 로 한 번에 불러온다.
 *
 * 페이지마다 나누지 않는 이유: 관리자 탭은 주문 알림 때문에 하루 종일 켜 두는데, 그 사이 새 버전이
 * 배포되면 아직 열지 않은 페이지의 옛 청크가 사라져 화면이 열리지 않는다. 한 덩어리면 처음 열 때 다 받아 둔다.
 */
export default function AdminRoutes(layoutProps) {
  return (
    <Routes>
      <Route element={<AdminLayout {...layoutProps} />}>
        <Route index element={<Navigate to="orders" replace />} />
        <Route path="products" element={<AdminProductsGate><ProductManagement /></AdminProductsGate>} />
        <Route path="products/new" element={<Navigate to="/admin/products" replace />} />
        <Route path="products/edit/:id" element={<AdminProductsGate><ProductForm /></AdminProductsGate>} />
        <Route path="categories" element={<CategoryManagement />} />
        <Route path="orders" element={<OrderManagement />} />
        <Route path="naver" element={<NaverSyncPage />} />
        <Route path="erp-bak" element={<ErpBakImportPage />} />
        <Route path="erp-receiving" element={<ErpReceivingPage />} />
        <Route path="erp-order" element={<ErpReceivingPage mode="order" />} />
      </Route>
    </Routes>
  );
}

function AdminProductsGate({ children }) {
  const { adminProductsStatus, fetchAdminProducts } = useOutletContext();

  useEffect(() => {
    if (adminProductsStatus === 'idle') fetchAdminProducts();
  }, [adminProductsStatus, fetchAdminProducts]);

  if (adminProductsStatus === 'idle' || adminProductsStatus === 'loading') {
    return (
      <div role="status" style={{ minHeight: '50vh', display: 'grid', placeItems: 'center', fontSize: '1.2rem', fontWeight: 700 }}>
        상품 정보를 불러오는 중…
      </div>
    );
  }

  if (adminProductsStatus === 'error') {
    return (
      <div role="alert" style={{ minHeight: '50vh', display: 'grid', placeContent: 'center', gap: '12px', textAlign: 'center' }}>
        <p>상품 정보를 불러오지 못했습니다.</p>
        <button type="button" onClick={() => fetchAdminProducts(true)}>다시 불러오기</button>
      </div>
    );
  }

  return children;
}
