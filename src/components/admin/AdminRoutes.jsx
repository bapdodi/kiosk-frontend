import { Navigate, Route, Routes } from 'react-router-dom';
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
        <Route path="products" element={<ProductManagement />} />
        <Route path="products/new" element={<Navigate to="/admin/products" replace />} />
        <Route path="products/edit/:id" element={<ProductForm />} />
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
