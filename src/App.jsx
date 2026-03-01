import { useEffect, useMemo, useRef, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import AdminLayout from './components/admin/AdminLayout';
import CategoryManagement from './components/admin/CategoryManagement';
import OrderManagement from './components/admin/OrderManagement';
import ProductForm from './components/admin/ProductForm';
import ProductManagement from './components/admin/ProductManagement';
import Cart from './components/Cart';
import CategoryNav from './components/CategoryNav';
import LoginPage from './components/LoginPage';
import OptionModal from './components/OptionModal';
import ProductCard from './components/ProductCard';

// ... (KioskView & ProtectedRoute components)

function App() {
  const [products, setProducts] = useState([]);
  const [mainCategories, setMainCategories] = useState([]);
  const [subCategories, setSubCategories] = useState({});
  const [detailCategories, setDetailCategories] = useState({});
  const [orders, setOrders] = useState([]);

  const [activeMainCat, setActiveMainCat] = useState(null);
  const [activeSubCat, setActiveSubCat] = useState(null);
  const [activeDetailCat, setActiveDetailCat] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/auth/check');
        if (res.ok) setIsAuthenticated(true);
      } catch (e) {
        console.error('Auth check failed');
      }
    };

    const fetchData = async (isAuth) => {
      try {
        const prodRes = await fetch('/api/products');
        const catRes = await fetch('/api/categories');
        const prodData = await prodRes.json();
        const catData = await catRes.json();

        setProducts(Array.isArray(prodData) ? prodData : []);

        if (isAuth) {
          try {
            const orderRes = await fetch('/api/orders/admin');
            if (orderRes.ok) {
              const orderData = await orderRes.json();
              setOrders(Array.isArray(orderData) ? orderData : []);
            }
          } catch (e) {
            console.warn('Could not fetch orders initially');
          }
        }

        const mainArr = catData.filter(c => c.level === 'main');
        const subObj = {};
        const detailObj = {};

        catData.filter(c => c.level === 'sub').forEach(c => {
          if (!subObj[c.parentId]) subObj[c.parentId] = [];
          subObj[c.parentId].push(c);
        });

        catData.filter(c => c.level === 'detail').forEach(c => {
          if (!detailObj[c.parentId]) detailObj[c.parentId] = [];
          detailObj[c.parentId].push(c);
        });

        setMainCategories(mainArr);
        setSubCategories(subObj);
        setDetailCategories(detailObj);

        if (mainArr.length > 0) {
          const firstMainId = mainArr[0].id;
          setActiveMainCat(firstMainId);
          const firstSubId = subObj[firstMainId]?.[0]?.id;
          if (firstSubId) {
            setActiveSubCat(firstSubId);
            setActiveDetailCat(detailObj[firstSubId]?.[0]?.id);
          }
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    checkAuth().then((isAuth) => fetchData(isAuth));

    /*
    // Poll products every 5 seconds for real-time stock updates
    const stockInterval = setInterval(() => {
      fetch('/api/products')
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            setProducts(data);
          }
        })
        .catch(err => console.error('Failed to poll products for stock updates', err));
    }, 5000);

    return () => clearInterval(stockInterval);
    */
  }, []);

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontSize: '2rem' }}>로딩 중...</div>;
  window.isAuthenticated = isAuthenticated;

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={
          <KioskView
            products={products}
            mainCategories={mainCategories}
            subCategories={subCategories}
            detailCategories={detailCategories}
            cart={cart}
            setCart={setCart}
            orders={orders}
            setOrders={setOrders}
            activeMainCat={activeMainCat}
            setActiveMainCat={setActiveMainCat}
            activeSubCat={activeSubCat}
            setActiveSubCat={setActiveSubCat}
            activeDetailCat={activeDetailCat}
            setActiveDetailCat={setActiveDetailCat}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
          />
        } />
        <Route path="/login" element={<LoginPage />} />

        {/* Admin Routes with Nested Routing */}
        <Route path="/admin" element={
          <ProtectedRoute isAuthenticated={isAuthenticated}>
            <AdminLayout
              products={products}
              setProducts={setProducts}
              mainCategories={mainCategories}
              setMainCategories={setMainCategories}
              subCategories={subCategories}
              setSubCategories={setSubCategories}
              detailCategories={detailCategories}
              setDetailCategories={setDetailCategories}
              orders={orders}
              setOrders={setOrders}
            />
          </ProtectedRoute>
        }>
          <Route index element={<Navigate to="products" replace />} />
          <Route path="products" element={<ProductManagement />} />
          <Route path="products/new" element={<ProductForm />} />
          <Route path="products/edit/:id" element={<ProductForm />} />
          <Route path="categories" element={<CategoryManagement />} />
          <Route path="orders" element={<OrderManagement />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
//...
function KioskView({
  products,
  mainCategories,
  subCategories,
  detailCategories,
  cart,
  setCart,
  orders,
  setOrders,
  activeMainCat,
  setActiveMainCat,
  activeSubCat,
  setActiveSubCat,
  activeDetailCat,
  setActiveDetailCat,
  searchQuery,
  setSearchQuery
}) {
  const navigate = useNavigate();
  const [selectingProduct, setSelectingProduct] = useState(null);
  const [optionQuantities, setOptionQuantities] = useState({});
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isNavVisible, setIsNavVisible] = useState(true);
  const [orderModal, setOrderModal] = useState({ isOpen: false, name: '' });
  const [customers, setCustomers] = useState([]);
  const lastScrollTop = useRef(0);

  useEffect(() => {
    fetch('/api/customers')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setCustomers(data);
        } else {
          console.error('Expected array for customers, got:', data);
          setCustomers([]);
        }
      })
      .catch(err => {
        console.error('Failed to load customers:', err);
        setCustomers([]);
      });
  }, []);

  const handleScroll = (e) => {
    const currentScrollTop = e.currentTarget.scrollTop;
    const diff = currentScrollTop - lastScrollTop.current;

    // 1. 최상단 근처에서는 무조건 표시
    if (currentScrollTop < 10) {
      if (!isNavVisible) setIsNavVisible(true);
      lastScrollTop.current = currentScrollTop;
      return;
    }

    // 2. 급격한 변화나 미세한 변화(30px 미만)는 무시하여 깜빡임 방지
    if (Math.abs(diff) < 30) return;

    if (diff > 0 && isNavVisible && currentScrollTop > 150) {
      // 내려갈 때: 150px 이상 내려온 상태에서만 숨김
      setIsNavVisible(false);
    } else if (diff < 0 && !isNavVisible) {
      // 올라갈 때: 즉시 표시
      setIsNavVisible(true);
    }

    lastScrollTop.current = currentScrollTop;
  };

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const searchLower = searchQuery.toLowerCase().trim();
      const matchSearch = searchLower === "" ||
        product.name.toLowerCase().includes(searchLower) ||
        product.hashtags.some(tag => tag.toLowerCase().includes(searchLower));

      if (!matchSearch) return false;

      // If actively searching, ignore category filters for global search
      if (searchLower !== "") return true;

      const matchMain = product.mainCategory === activeMainCat;
      const matchSub = !activeSubCat ? true : product.subCategory === activeSubCat;
      const matchDetail = !activeDetailCat ? true : product.detailCategory === activeDetailCat;

      return matchMain && matchSub && matchDetail;
    });
  }, [activeMainCat, activeSubCat, activeDetailCat, searchQuery, products]);

  const handleMainCatChange = (id) => {
    setActiveMainCat(id);
    setActiveSubCat(null);
    setActiveDetailCat(null);
    setIsNavVisible(true); // 카테고리 변경 시 네비게이션 무조건 노출
  };

  const handleSubCatChange = (id) => {
    setActiveSubCat(id);
    setActiveDetailCat(null);
    setIsNavVisible(true); // 카테고리 변경 시 네비게이션 무조건 노출
  };

  const handleAddToCartClick = (product) => {
    setSelectingProduct(product);
    setOptionQuantities({});
  };

  const updateQty = (comboId, delta) => {
    setOptionQuantities(prev => ({
      ...prev,
      [comboId]: Math.max(0, (prev[comboId] || 0) + delta)
    }));
  };

  const confirmAddToCart = (product, combinations, quantities) => {
    let newCart = [...cart];
    Object.entries(quantities).forEach(([comboId, qty]) => {
      if (qty > 0) {
        const combo = combinations.find(c => c.id === comboId);
        const finalPrice = product.price + (combo ? (combo.totalExtra || combo.price || 0) : 0);
        const selectedOption = combo ? (combo.displayName || combo.name) : null;

        const existingIndex = newCart.findIndex(i => i.id === product.id && i.selectedOption === selectedOption);
        if (existingIndex > -1) {
          newCart[existingIndex] = {
            ...newCart[existingIndex],
            quantity: (newCart[existingIndex].quantity || 1) + qty
          };
        } else {
          newCart.push({
            ...product,
            selectedOption,
            finalPrice,
            erpCode: combo ? (combo.erpCode || combo.id) : product.erpCode, // use specific erpCode from combo
            quantity: qty,
            cartId: Date.now() + Math.random()
          });
        }
      }
    });

    setCart(newCart);
    setSelectingProduct(null);
    setOptionQuantities({});
  };

  const removeFromCart = (cartId) => {
    setCart(cart.filter(item => item.cartId !== cartId));
  };

  const handleCheckout = () => {
    if (cart.length === 0) return alert('장바구니가 비어있습니다.');
    setIsCartOpen(false);
    setOrderModal({ isOpen: true, name: '' });
  };

  const submitOrder = async () => {
    if (!orderModal.name.trim()) return alert('상호를 입력하거나 선택해주세요.');

    const customerString = orderModal.name.trim();
    const codeMatch = customerString.match(/^\[(.*?)\] (.*)/);
    let erpCustomerCode = "1";
    let customerName = customerString;
    if (codeMatch) {
      erpCustomerCode = codeMatch[1];
      customerName = codeMatch[2];
    }

    const orderData = {
      customerName,
      erpCustomerCode,
      items: cart.map(item => ({
        name: item.name,
        erpCode: item.erpCode, // Include ERP code for backend sync
        quantity: item.quantity || 1, // Store the actual quantity mapping
        selectedOption: item.selectedOption,
        finalPrice: item.finalPrice
      })),
      totalAmount: cart.reduce((sum, item) => sum + item.finalPrice * (item.quantity || 1), 0),
      status: 'pending'
    };

    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData)
      });

      if (response.ok) {
        const savedOrder = await response.json();
        setOrders([...orders, savedOrder]);
        alert(`${customerName}님, 주문이 완료되었습니다. 이용해주셔서 감사합니다!`);
        setCart([]);
        setOrderModal({ isOpen: false, name: '' });
      } else {
        alert('주문 처리 중 오류가 발생했습니다.');
      }
    } catch (e) {
      alert('서버 연결 오류가 발생했습니다.');
    }
  };

  const totalPrice = cart.reduce((sum, item) => sum + item.finalPrice * (item.quantity || 1), 0);

  return (
    <div className="kiosk-container">
      <div className="nav-wrapper">
        <CategoryNav
          mainCategories={mainCategories}
          subCategories={subCategories}
          detailCategories={detailCategories}
          activeMainCat={activeMainCat}
          activeSubCat={activeSubCat}
          activeDetailCat={activeDetailCat}
          onMainCatChange={handleMainCatChange}
          onSubCatChange={handleSubCatChange}
          onDetailCatChange={setActiveDetailCat}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
      </div>

      <div className="content-area">
        <main className="kiosk-main" onScroll={handleScroll}>
          {filteredProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onAddClick={handleAddToCartClick}
              onTagClick={setSearchQuery}
            />
          ))}
          {filteredProducts.length === 0 && (
            <div className="empty-cart-message" style={{ textAlign: 'center', gridColumn: '1/-1', padding: '50px' }}>
              검색 결과가 없습니다.
            </div>
          )}
        </main>
      </div>

      {/* Floating Cart Button */}
      <div className="floating-cart-btn" onClick={() => setIsCartOpen(true)}>
        <span className="cart-icon">🛒</span>
        <span className="cart-count">{cart.reduce((sum, item) => sum + (item.quantity || 1), 0)}</span>
        <span className="cart-total">₩{totalPrice.toLocaleString()}</span>
      </div>

      {/* Cart Modal */}
      {isCartOpen && (
        <div className="modal-overlay" onClick={() => setIsCartOpen(false)}>
          <div className="cart-modal-content" onClick={(e) => e.stopPropagation()}>
            <Cart
              items={cart}
              onRemove={removeFromCart}
              onCheckout={handleCheckout}
            />
            <button className="modal-close-btn" onClick={() => setIsCartOpen(false)}>×</button>
          </div>
        </div>
      )}



      {/* Order Name Input Modal */}
      {orderModal.isOpen && (
        <div className="modal-overlay" style={{ zIndex: 5000 }}>
          <div className="modal-content" style={{ maxWidth: '400px', padding: '0', borderRadius: '24px' }}>
            <div style={{ padding: '25px', textAlign: 'center', borderBottom: '1px solid #f1f5f9' }}>
              <h3 style={{ margin: 0, fontWeight: 900, fontSize: '1.4rem' }}>주문 확인</h3>
              <p style={{ color: '#64748b', marginTop: '8px', fontSize: '0.95rem' }}>주문하실 상호를 검색하거나 선택해주세요.</p>
            </div>
            <div style={{ padding: '30px' }}>
              <input
                autoFocus
                className="admin-input-small"
                list="customer-list"
                placeholder="상호명 검색/선택"
                value={orderModal.name}
                onChange={(e) => setOrderModal({ ...orderModal, name: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && submitOrder()}
                style={{
                  padding: '18px',
                  fontSize: '1.1rem',
                  textAlign: 'center',
                  borderRadius: '16px',
                  marginBottom: '20px',
                  border: '2px solid #e2e8f0',
                  width: '100%',
                  boxSizing: 'border-box'
                }}
              />
              <datalist id="customer-list">
                {customers.map(c => (
                  <option key={c.CODE} value={`[${c.CODE}] ${c.NAME}`} />
                ))}
              </datalist>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  className="apply-btn"
                  style={{ flex: 2, padding: '18px', fontSize: '1.1rem', borderRadius: '16px' }}
                  onClick={submitOrder}
                >
                  주문 완료하기
                </button>
                <button
                  className="action-btn"
                  style={{ flex: 1, padding: '18px', borderRadius: '16px', height: 'auto' }}
                  onClick={() => setOrderModal({ ...orderModal, isOpen: false })}
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <OptionModal
        product={selectingProduct}
        quantities={optionQuantities}
        onUpdateQty={updateQty}
        onConfirm={confirmAddToCart}
        onCancel={() => setSelectingProduct(null)}
      />
    </div>
  );
}
const ProtectedRoute = ({ children, isAuthenticated }) => {
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
};



export default App;
