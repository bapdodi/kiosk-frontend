import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import AdminLayout from './components/admin/AdminLayout';
import CategoryManagement from './components/admin/CategoryManagement';
import ErpBakImportPage from './components/admin/ErpBakImportPage';
import NaverSyncPage from './components/admin/NaverSyncPage';
import OrderManagement from './components/admin/OrderManagement';
import ProductForm from './components/admin/ProductForm';
import ProductManagement from './components/admin/ProductManagement';
import Cart from './components/Cart';
import CartBar from './components/CartBar';
import CategoryNav from './components/CategoryNav';
import LoginPage from './components/LoginPage';
import OptionModal from './components/OptionModal';
import OrderReviewModal from './components/OrderReviewModal';
import ProductCard from './components/ProductCard';
import { getChosungChar, getSearchMatchScore, matchesSearchText, normalizeSearchText } from './utils/search';

// ... (KioskView & ProtectedRoute components)

function App() {
  const [products, setProducts] = useState([]);
  const [mainCategories, setMainCategories] = useState([]);
  const [subCategories, setSubCategories] = useState({});
  const [orders, setOrders] = useState([]);

  const [activeMainCat, setActiveMainCat] = useState(null);
  const [activeSubCat, setActiveSubCat] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const [isRefreshing, setIsRefreshing] = useState(false);

  const refreshCategories = useCallback(async () => {
    const res = await fetch('/api/categories');
    if (!res.ok) throw new Error('카테고리를 불러오는데 실패했습니다.');
    const catData = await res.json();

    const mainArr = catData.filter(c => c.level === 'main');
    const subObj = {};
    catData.filter(c => c.level === 'sub').forEach(c => {
      if (!subObj[c.parentId]) subObj[c.parentId] = [];
      subObj[c.parentId].push(c);
    });

    setMainCategories(mainArr);
    setSubCategories(subObj);
    return catData;
  }, []);

  useEffect(() => {
    // react-snap(prerender) 환경에서는 API 없이 즉시 SEO용 빈 상태로 렌더링
    const isPrerender = navigator.userAgent === 'ReactSnap';

    const checkAuth = async () => {
      try {
        const res = await fetch('/api/auth/check');
        setIsAuthenticated(res.ok);
        return res.ok;
      } catch (e) {
        console.error('Auth check failed');
        setIsAuthenticated(false);
        return false;
      }
    };

    const fetchInitialData = async () => {
      if (isPrerender) {
        // prerender 환경: API 호출 없이 바로 완료 처리
        setLoading(false);
        return;
      }

      try {
        const [isAuth] = await Promise.all([
          checkAuth(),
          refreshCategories()
        ]);

        await fetchProducts(true);

        if (isAuth) {
          await fetchOrders();
        }
      } catch (error) {
        console.error('Error fetching initial data:', error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();
  }, [refreshCategories]);


  const fetchOrders = async () => {
    try {
      const orderRes = await fetch('/api/orders/admin');
      if (orderRes.ok) {
        const orderData = await orderRes.json();
        setOrders(Array.isArray(orderData) ? orderData : []);
      }
    } catch (e) {
      console.warn('Could not fetch orders');
    }
  };

  // 상품은 1천 건 남짓이라 전체를 한 번에 받아 카테고리 필터와 검색을 모두 화면에서 처리한다.
  // 덕분에 검색은 항상 전체 상품이 대상이 되고, 서버 응답은 캐싱돼 있어 DB 를 다시 읽지 않는다.
  const fetchProducts = async (isInitial = false) => {
    try {
      if (!isInitial) setIsRefreshing(true);

      const res = await fetch('/api/products/all');
      if (!res.ok) throw new Error('상품 데이터를 불러오는데 실패했습니다.');

      const data = await res.json();
      setProducts(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Fetch products failed:', e);
      setError(e.message);
    } finally {
      setIsRefreshing(false);
    }
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontSize: '2rem' }}>로딩 중...</div>;
  if (error) return <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', padding: '20px', textAlign: 'center' }}>
    <h2 style={{ marginBottom: '10px', color: 'var(--admin-danger)' }}>오류 발생</h2>
    <p>{error}</p>
    <button onClick={() => window.location.reload()} style={{ marginTop: '20px', padding: '10px 20px', borderRadius: '10px', border: 'none', background: 'var(--accent-color)', color: 'white', fontWeight: 'bold' }}>다시 시도</button>
  </div>;

  window.isAuthenticated = isAuthenticated;

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={
          <KioskView
            products={products}
            mainCategories={mainCategories}
            subCategories={subCategories}
            cart={cart}
            setCart={setCart}
            orders={orders}
            setOrders={setOrders}
            activeMainCat={activeMainCat}
            setActiveMainCat={setActiveMainCat}
            activeSubCat={activeSubCat}
            setActiveSubCat={setActiveSubCat}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            isRefreshing={isRefreshing}
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
              refreshCategories={refreshCategories}
               orders={orders}
               setOrders={setOrders}
               isRefreshing={isRefreshing}
               onRefresh={() => fetchProducts()}
               activeMainCat={activeMainCat}
               setActiveMainCat={setActiveMainCat}
               activeSubCat={activeSubCat}
               setActiveSubCat={setActiveSubCat}
               searchQuery={searchQuery}
               setSearchQuery={setSearchQuery}
            />
          </ProtectedRoute>
        }>
          <Route index element={<Navigate to="products" replace />} />
          <Route path="products" element={<ProductManagement />} />
          <Route path="products/new" element={<ProductForm />} />
          <Route path="products/edit/:id" element={<ProductForm />} />
          <Route path="categories" element={<CategoryManagement />} />
          <Route path="orders" element={<OrderManagement />} />
          <Route path="naver" element={<NaverSyncPage />} />
          <Route path="erp-bak" element={<ErpBakImportPage />} />
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
  cart,
  setCart,
  orders,
  setOrders,
  activeMainCat,
  setActiveMainCat,
  activeSubCat,
  setActiveSubCat,
  searchQuery,
  setSearchQuery,
  isRefreshing
}) {
  const navigate = useNavigate();
  const [selectingProduct, setSelectingProduct] = useState(null);
  const [optionQuantities, setOptionQuantities] = useState({});
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [isNavVisible, setIsNavVisible] = useState(true);
  const [orderModal, setOrderModal] = useState({ isOpen: false, name: '' });
  const [customers, setCustomers] = useState([]);
  const lastScrollTop = useRef(0);
  // 주문 중복 전송 방지용 키. 전송 성공 전까지 같은 키를 유지해
  // 재시도/더블클릭이 서버에서 같은 주문으로 합쳐지게 한다.
  const pendingOrderRequestId = useRef(null);

  // 키오스크 장바구니 사이드바 폭 (드래그로 조절, localStorage에 저장해 새로고침 후에도 유지)
  const CART_WIDTH_STORAGE_KEY = 'kioskCartWidthPx';
  const [cartWidth, setCartWidth] = useState(() => {
    const saved = Number(localStorage.getItem(CART_WIDTH_STORAGE_KEY));
    return saved > 0 ? saved : null; // null이면 CSS 기본값(2/3 비율) 사용
  });
  const cartWidthRef = useRef(cartWidth);
  const kioskContainerRef = useRef(null);
  const isResizingCart = useRef(false);

  useEffect(() => {
    cartWidthRef.current = cartWidth;
  }, [cartWidth]);

  const handleCartResizeStart = (e) => {
    e.preventDefault();
    isResizingCart.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  useEffect(() => {
    const clampWidth = (raw) => {
      const rect = kioskContainerRef.current?.getBoundingClientRect();
      if (!rect) return raw;
      const min = 280;
      const max = rect.width - 320; // 상품 그리드가 최소한의 폭을 유지하도록
      return Math.min(Math.max(raw, min), Math.max(min, max));
    };

    const handleMove = (e) => {
      if (!isResizingCart.current || !kioskContainerRef.current) return;
      if (e.touches) e.preventDefault(); // 드래그 중 화면 스크롤 방지
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const rect = kioskContainerRef.current.getBoundingClientRect();
      setCartWidth(clampWidth(rect.right - clientX));
    };

    const handleUp = () => {
      if (!isResizingCart.current) return;
      isResizingCart.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      if (cartWidthRef.current != null) {
        localStorage.setItem(CART_WIDTH_STORAGE_KEY, String(cartWidthRef.current));
      }
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    window.addEventListener('touchmove', handleMove, { passive: false });
    window.addEventListener('touchend', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleUp);
    };
  }, []);

  // 초성 추출 유틸리티
  const getChosung = (str) => {
    if (!str) return '';
    return getChosungChar(str.trim().charAt(0));
  };

  const chosungTabs = ['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅅ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ', 'A-Z'];
  const [selectedChosung, setSelectedChosung] = useState('ㄱ');

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

  const isSearching = normalizeSearchText(searchQuery) !== "";

  const filteredProducts = useMemo(() => {
    return products.map((product) => {
      const searchScore = isSearching
        ? Math.min(
          getSearchMatchScore(product.name, searchQuery),
          ...(product.hashtags || []).map((tag) => getSearchMatchScore(tag, searchQuery)),
        )
        : 0;

      if (!Number.isFinite(searchScore)) return null;

      // If actively searching, ignore category filters for global search
      if (isSearching) return { product, searchScore };

      // 상품은 여러 카테고리에 속할 수 있으므로, 그 중 하나라도 현재 필터와 맞으면 노출한다.
      if (!activeMainCat) return { product, searchScore };
      const matchesCategory = (product.categories || []).some(c => {
        if (c.mainCategory !== activeMainCat) return false;
        if (!activeSubCat || activeSubCat === 'all') return true;
        return c.subCategory === activeSubCat;
      });
      return matchesCategory ? { product, searchScore } : null;
    }).filter(Boolean).sort((a, b) => {
      if (a.searchScore !== b.searchScore) return a.searchScore - b.searchScore;
      const aOrder = a.product.sortOrder || "";
      const bOrder = b.product.sortOrder || "";
      if (aOrder < bOrder) return -1;
      if (aOrder > bOrder) return 1;
      return a.product.id - b.product.id;
    }).map(({ product }) => product);
  }, [activeMainCat, activeSubCat, isSearching, products, searchQuery]);

  const handleMainCatChange = (id) => {
    setActiveMainCat(id);
    setActiveSubCat(null);
    setIsNavVisible(true); // 카테고리 변경 시 네비게이션 무조건 노출
  };

  const handleSubCatChange = (id) => {
    setActiveSubCat(id);
    setIsNavVisible(true); // 카테고리 변경 시 네비게이션 무조건 노출
  };

  const handleAddToCartClick = (product) => {
    setSelectingProduct(product);
    setOptionQuantities({});
  };

  // 장바구니의 항목을 누르면 해당 상품의 주문(옵션 선택) 화면을 다시 연다.
  const openProductFromCart = (item) => {
    const target = products.find(p => p.id === item.id) || item;
    setIsCartOpen(false);
    setSelectingProduct(target);
    setOptionQuantities({});
  };

  // 추천 상품을 누르면 지금 모달을 그 상품으로 바꿔 연다. 모달을 닫았다가 목록에서 다시 찾는
  // 왕복이 없어야 추천이 실제로 눌린다.
  const openRecommendedProduct = (product) => {
    setSelectingProduct(product);
    setOptionQuantities({});
  };

  const updateQty = (comboId, delta) => {
    setOptionQuantities(prev => ({
      ...prev,
      [comboId]: Math.max(0, (prev[comboId] || 0) + delta)
    }));
  };

  const confirmAddToCart = (product, combinations, quantities, stayOpen = false) => {
    setCart(previousCart => {
      const newCart = [...previousCart];
      Object.entries(quantities).forEach(([comboId, qty]) => {
        if (qty > 0) {
          const combo = combinations.find(c => String(c.id) === comboId);
          const finalPrice = (product.priceC || 0) + (combo ? (combo.totalExtra || combo.price || 0) : 0);
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
              erpCode: combo ? (combo.erpCode || combo.id) : product.erpCode,
              quantity: qty,
              cartId: Date.now() + Math.random()
            });
          }
        }
      });
      return newCart;
    });

    if (!stayOpen) setSelectingProduct(null);
    setOptionQuantities({});
  };

  const removeFromCart = (cartId) => {
    setCart(cart.filter(item => item.cartId !== cartId));
  };

  // 장바구니 전체 비우기. 실수로 눌러 주문을 날리는 일이 없게 한 번 확인한다.
  const clearCart = () => {
    if (cart.length === 0) return;
    if (!window.confirm('장바구니를 모두 비울까요?')) return;
    setCart([]);
  };

  const updateCartQuantity = (cartId, delta) => {
    setCart(prev => prev.map(item =>
      item.cartId === cartId
        ? { ...item, quantity: Math.max(1, (item.quantity || 1) + delta) }
        : item
    ));
  };

  // 결제하기 → 먼저 사진이 포함된 확인 팝업을 띄우고, 거기서 확정해야 상호 선택으로 넘어간다.
  const handleCheckout = () => {
    if (cart.length === 0) return alert('장바구니가 비어있습니다.');
    setIsCartOpen(false);
    setIsReviewOpen(true);
  };

  const handleReviewConfirm = () => {
    if (cart.length === 0) return;
    setIsReviewOpen(false);
    setOrderModal({ isOpen: true, name: '' });
  };

  const submitOrder = async (forcedName, forcedCode) => {
    let customerName = (typeof forcedName === 'string' ? forcedName : orderModal.name).trim();
    if (!customerName) return alert('상호를 입력하거나 선택해주세요.');

    // 고객 목록에서 입력된 이름과 공백을 제외하고 정확히 일치하는 고객을 찾음
    const matchedCustomer = customers.find(c => c.NAME?.trim() === customerName);

    if (!matchedCustomer && !forcedName) {
        return alert('목록에 있는 정확한 상호명을 입력하거나 선택해 주세요.');
    }

    let erpCustomerCode = forcedCode || (matchedCustomer ? String(matchedCustomer.CODE) : "1");

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
      if (!pendingOrderRequestId.current) {
        pendingOrderRequestId.current = crypto.randomUUID();
      }
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': pendingOrderRequestId.current
        },
        body: JSON.stringify(orderData)
      });

      if (response.ok) {
        const savedOrder = await response.json();
        setOrders([...orders, savedOrder]);
        alert(`${customerName}님, 주문이 완료되었습니다. 이용해주셔서 감사합니다!`);
        pendingOrderRequestId.current = null;
        setCart([]);
        setOrderModal({ isOpen: false, name: '' });
      } else {
        const errorText = await response.text();
        alert(errorText || '주문 처리 중 오류가 발생했습니다.');
      }
    } catch (e) {
      alert('서버 연결 오류가 발생했습니다.');
    }
  };

  const totalPrice = cart.reduce((sum, item) => sum + item.finalPrice * (item.quantity || 1), 0);

  return (
    <div
      className="kiosk-container"
      ref={kioskContainerRef}
      style={cartWidth != null ? { '--kiosk-cart-width': `${cartWidth}px` } : undefined}
    >
      <div className="nav-wrapper">
        <CategoryNav
          mainCategories={mainCategories}
          subCategories={subCategories}
          activeMainCat={activeMainCat}
          activeSubCat={activeSubCat}
          onMainCatChange={handleMainCatChange}
          onSubCatChange={handleSubCatChange}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
      </div>

      <div className="content-area">
        <main className="kiosk-main" onScroll={handleScroll}>
          {filteredProducts.map((product) => (
            <div key={product.id}>
              <ProductCard
                product={product}
                onAddClick={handleAddToCartClick}
              />
            </div>
          ))}
          {isRefreshing && (
            <div style={{ textAlign: 'center', gridColumn: '1/-1', padding: '20px', color: '#667085' }}>
              불러오는 중...
            </div>
          )}
          {filteredProducts.length === 0 && !isRefreshing && (
            <div className="empty-cart-message" style={{ textAlign: 'center', gridColumn: '1/-1', padding: '50px' }}>
              검색 결과가 없습니다.
            </div>
          )}
        </main>
      </div>

      {/* 큰 화면(키오스크)용 하단 주문내역 바 */}
      <CartBar
        items={cart}
        onRemove={removeFromCart}
        onQuantityChange={updateCartQuantity}
        onCheckout={handleCheckout}
        onClear={clearCart}
        onResizeStart={handleCartResizeStart}
        onSelectProduct={openProductFromCart}
      />

      {/* Floating Cart Button (작은 화면 전용) */}
      <div className="floating-cart-btn" onClick={() => setIsCartOpen(true)}>
        <span className="cart-icon">🛒</span>
        <span className="cart-count">{cart.length}</span>
      </div>

      {/* Cart Modal */}
      {isCartOpen && (
        <div className="modal-overlay" onClick={() => setIsCartOpen(false)}>
          <div className="cart-modal-content" onClick={(e) => e.stopPropagation()}>
            <Cart
              items={cart}
              onRemove={removeFromCart}
              onQuantityChange={updateCartQuantity}
              onCheckout={handleCheckout}
              onClear={clearCart}
              onSelectProduct={openProductFromCart}
            />
            <button className="modal-close-btn" onClick={() => setIsCartOpen(false)}>×</button>
          </div>
        </div>
      )}



      {/* 주문 내역 확인 팝업 (사진 포함) */}
      {isReviewOpen && (
        <OrderReviewModal
          items={cart}
          onRemove={removeFromCart}
          onQuantityChange={updateCartQuantity}
          onClose={() => setIsReviewOpen(false)}
          onConfirm={handleReviewConfirm}
        />
      )}

      {/* Order Name Input Modal */}
      {orderModal.isOpen && (() => {
        const customerSearchQuery = orderModal.name.trim();
        const filteredCustomers = customers.filter(c => {
          const name = c.NAME?.trim() || '';
          if (customerSearchQuery) {
            return matchesSearchText(name, customerSearchQuery);
          }

          if (selectedChosung === 'A-Z') {
            const firstChar = name.charAt(0).toUpperCase();
            return firstChar >= 'A' && firstChar <= 'Z';
          }
          if (selectedChosung === '기타') {
            return getChosung(name) === '기타';
          }
          return getChosung(name) === selectedChosung;
        });

        const isValidName = customers.some(c => c.NAME?.trim() === orderModal.name.trim());
        const defaultCustomer = customers.find(c => c.NAME?.trim() === "1");
        
        return (
          <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: '600px', width: '90%' }}>
              <div style={{ padding: '20px', textAlign: 'center', borderBottom: '1px solid #f1f5f9' }}>
                <h3 style={{ margin: 0, fontWeight: 900, fontSize: '1.4rem' }}>주문 확인</h3>
                <p style={{ color: '#64748b', marginTop: '8px', fontSize: '0.95rem' }}>주문하실 상호를 선택하거나 검색해주세요.</p>
              </div>
              
              <div style={{ padding: '20px' }}>
                {/* 1번 고객 버튼 */}
                <button
                  onClick={() => {
                    if (!defaultCustomer) {
                      alert('1번 고객 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
                      return;
                    }
                    submitOrder(defaultCustomer.NAME, String(defaultCustomer.CODE));
                  }}
                  style={{
                    width: '100%',
                    padding: '14px',
                    marginBottom: '15px',
                    borderRadius: '12px',
                    border: '2px solid #10b981',
                    background: '#ecfdf5',
                    color: '#065f46',
                    fontWeight: '800',
                    cursor: 'pointer',
                    fontSize: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px'
                  }}
                >
                  👤 비회원으로 주문하기
                </button>

                {/* 두 갈래(비회원 / 상호 선택)를 시각적으로 분리 */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  margin: '18px 0'
                }}>
                  <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }} />
                  <span style={{ color: '#94a3b8', fontWeight: 800, fontSize: '0.9rem' }}>또는</span>
                  <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }} />
                </div>

                {/* 상호명 직접 검색 - 비회원 버튼 바로 아래에 강조 배치 */}
                <div style={{
                  marginBottom: '15px',
                  padding: '14px',
                  background: '#fff7ed',
                  border: '2px solid var(--accent-color)',
                  borderRadius: '14px',
                  boxShadow: '0 2px 8px rgba(255, 107, 0, 0.15)'
                }}>
                  <div style={{
                    fontWeight: 900,
                    fontSize: '1.05rem',
                    color: '#9a3412',
                    marginBottom: '10px',
                    textAlign: 'center'
                  }}>
                    🔍 상호명 직접 검색
                  </div>
                  <div style={{ position: 'relative' }}>
                    <input
                      className="admin-input-small"
                      placeholder="상호명 직접 검색"
                      value={orderModal.name}
                      onChange={(e) => setOrderModal({ ...orderModal, name: e.target.value })}
                      onKeyDown={(e) => e.key === 'Enter' && isValidName && submitOrder()}
                      style={{
                        padding: '15px',
                        fontSize: '1rem',
                        textAlign: 'center',
                        borderRadius: '12px',
                        border: `2px solid ${orderModal.name.trim() === '' ? '#e2e8f0' : (isValidName ? '#10b981' : '#ef4444')}`,
                        width: '100%',
                        boxSizing: 'border-box'
                      }}
                    />
                    {orderModal.name.trim() !== '' && (
                      <div style={{ 
                        position: 'absolute', 
                        right: '15px', 
                        top: '50%', 
                        transform: 'translateY(-50%)',
                        fontSize: '1.1rem'
                      }}>
                        {isValidName ? '✅' : '❌'}
                      </div>
                    )}
                  </div>
                </div>

                {/* 초성 카테고리 탭 */}
                <div style={{ 
                  display: 'flex', 
                  overflowX: 'auto', 
                  gap: '8px', 
                  paddingBottom: '12px',
                  marginBottom: '15px',
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none'
                }} className="chosung-scroll">
                  {chosungTabs.map(tab => (
                    <button
                      key={tab}
                      onClick={() => setSelectedChosung(tab)}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '20px',
                        border: '1px solid #e2e8f0',
                        background: selectedChosung === tab ? 'var(--accent-color)' : 'white',
                        color: selectedChosung === tab ? 'white' : '#64748b',
                        fontWeight: 'bold',
                        whiteSpace: 'nowrap',
                        cursor: 'pointer',
                        flexShrink: 0
                      }}
                    >
                      {tab}
                    </button>
                  ))}
                  <button
                    onClick={() => setSelectedChosung('기타')}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '20px',
                      border: '1px solid #e2e8f0',
                      background: selectedChosung === '기타' ? 'var(--accent-color)' : 'white',
                      color: selectedChosung === '기타' ? 'white' : '#64748b',
                      fontWeight: 'bold',
                      whiteSpace: 'nowrap',
                      cursor: 'pointer',
                      flexShrink: 0
                    }}
                  >
                    기타
                  </button>
                </div>

                {/* 상호명 리스트 */}
                <div style={{ 
                  maxHeight: '250px', 
                  overflowY: 'auto', 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                  gap: '10px',
                  marginBottom: '20px',
                  padding: '10px',
                  background: '#f8fafc',
                  borderRadius: '12px'
                }}>
                  {filteredCustomers.length > 0 ? filteredCustomers.map(c => (
                    <button
                      key={c.CODE}
                      onClick={() => setOrderModal({ ...orderModal, name: c.NAME })}
                      style={{
                        padding: '12px 8px',
                        borderRadius: '10px',
                        border: orderModal.name === c.NAME ? '2px solid var(--accent-color)' : '1px solid #e2e8f0',
                        background: orderModal.name === c.NAME ? '#eff6ff' : 'white',
                        color: orderModal.name === c.NAME ? 'var(--accent-color)' : '#334155',
                        fontSize: '0.9rem',
                        fontWeight: orderModal.name === c.NAME ? 'bold' : 'normal',
                        cursor: 'pointer',
                        textAlign: 'center',
                        wordBreak: 'break-all'
                      }}
                    >
                      {c.NAME}
                    </button>
                  )) : (
                    <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '20px', color: '#94a3b8' }}>
                      해당하는 상호가 없습니다.
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    className="apply-btn"
                    style={{ 
                      flex: 2, 
                      padding: '15px', 
                      fontSize: '1rem', 
                      borderRadius: '12px',
                      opacity: isValidName ? 1 : 0.5,
                      cursor: isValidName ? 'pointer' : 'not-allowed'
                    }}
                    onClick={submitOrder}
                    disabled={!isValidName}
                  >
                    {isValidName ? '주문 완료하기' : '상호를 먼저 선택해주세요'}
                  </button>
                  <button
                    className="action-btn"
                    style={{ flex: 1, padding: '15px', borderRadius: '12px', height: 'auto' }}
                    onClick={() => setOrderModal({ ...orderModal, isOpen: false })}
                  >
                    취소
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      <OptionModal
        product={selectingProduct}
        cartItems={cart}
        products={products}
        onSelectProduct={openRecommendedProduct}
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
