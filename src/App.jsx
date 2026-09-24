import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import AdminLayout from './components/admin/AdminLayout';
import CategoryManagement from './components/admin/CategoryManagement';
import ErpBakImportPage from './components/admin/ErpBakImportPage';
import ErpReceivingPage from './components/admin/ErpReceivingPage';
import NaverSyncPage from './components/admin/NaverSyncPage';
import OrderManagement from './components/admin/OrderManagement';
import ProductForm from './components/admin/ProductForm';
import ProductManagement from './components/admin/ProductManagement';
import Cart from './components/Cart';
import CartBar from './components/CartBar';
import CategoryNav from './components/CategoryNav';
import LoginPage from './components/LoginPage';
import ProductDetailView from './components/ProductDetailView';
import OrderReview from './components/OrderReview';
import CustomerSelect from './components/CustomerSelect';
import OrderDone from './components/OrderDone';
import ProductCard from './components/ProductCard';
import { getChosungChar, getSearchMatchScore, normalizeSearchText } from './utils/search';
import { describeError, fetchJson } from './utils/apiError';
import { useMobileBackClose } from './hooks/useMobileBackClose';
import { useIsMobile } from './hooks/useIsMobile';
import ProductPageMobile from './components/ProductPageMobile';

// ... (KioskView & ProtectedRoute components)

function App() {
  // 손님 화면용 목록(단가 없음)과 관리자용 목록(단가 포함)은 서버에서 서로 다른 API 로 온다.
  // 한 벌로 쓰면 관리자 화면이 단가 없는 목록으로 상품을 저장해 가격을 0 으로 덮어쓴다.
  const [products, setProducts] = useState([]);
  const [adminProducts, setAdminProducts] = useState([]);
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
    const catData = await fetchJson('/api/categories', '카테고리를 불러오는데 실패했습니다.');

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
          await Promise.all([fetchOrders(), fetchAdminProducts()]);
        }
      } catch (error) {
        console.error('Error fetching initial data:', error);
        setError(describeError(error, '초기 데이터를 불러오지 못했습니다.'));
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

      const data = await fetchJson('/api/products/all', '상품 데이터를 불러오는데 실패했습니다.');
      setProducts(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Fetch products failed:', e);
      setError(describeError(e, '상품 데이터를 불러오는데 실패했습니다.'));
    } finally {
      setIsRefreshing(false);
    }
  };

  // 관리자 목록은 단가가 들어 있어 로그인한 관리자만 받을 수 있다.
  const fetchAdminProducts = async () => {
    try {
      setIsRefreshing(true);
      const res = await fetch('/api/products/admin/all');
      if (!res.ok) throw new Error('상품 데이터를 불러오는데 실패했습니다.');

      const data = await res.json();
      setAdminProducts(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Fetch admin products failed:', e);
    } finally {
      setIsRefreshing(false);
    }
  };

  // 관리자 화면에서 상품을 고치면 손님 화면 목록도 곧 달라진다.
  // 관리자 목록만 갱신해 두면 키오스크가 옛 목록을 들고 있게 되므로 함께 다시 받는다.
  const updateAdminProducts = (next) => {
    setAdminProducts(next);
    fetchProducts();
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
              products={adminProducts}
              setProducts={updateAdminProducts}
              mainCategories={mainCategories}
              setMainCategories={setMainCategories}
              subCategories={subCategories}
              setSubCategories={setSubCategories}
              refreshCategories={refreshCategories}
               orders={orders}
               setOrders={setOrders}
               isRefreshing={isRefreshing}
               onRefresh={() => { fetchAdminProducts(); fetchProducts(); }}
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
          <Route path="erp-receiving" element={<ErpReceivingPage />} />
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
  const [cartToast, setCartToast] = useState(null);
  const cartToastTimer = useRef(null);
  // 주문 전송에 성공한 직후의 내역. 완료 화면에서 주문번호와 무엇을 넣었는지 보여준다.
  // 장바구니는 비우지만 이 값은 남겨 두어야 "내가 넣은 게 맞나" 를 확인할 수 있다.
  const [completedOrder, setCompletedOrder] = useState(null);
  const [customers, setCustomers] = useState([]);
  const lastScrollTop = useRef(0);

  const isMobile = useIsMobile();

  // 폰 뒤로가기: 화면을 덮는 것들을 연 순서대로 한 단계씩 닫는다.
  // 상품 페이지 → 장바구니 → 주문확인 → 상호 입력 순으로 쌓이고,
  // 뒤로가기를 누르면 가장 위에 있는 것부터 닫힌다. 사이트를 떠나지 않는다.
  useMobileBackClose([
    { open: selectingProduct != null, close: () => setSelectingProduct(null) },
    { open: isCartOpen, close: () => setIsCartOpen(false) },
    { open: isReviewOpen, close: () => setIsReviewOpen(false) },
    { open: orderModal.isOpen, close: () => setOrderModal(prev => ({ ...prev, isOpen: false })) },
    { open: completedOrder != null, close: () => setCompletedOrder(null) },
  ]);
  // 주문 중복 전송 방지용 키. 전송 성공 전까지 같은 키를 유지해
  // 재시도/더블클릭이 서버에서 같은 주문으로 합쳐지게 한다.
  const pendingOrderRequestId = useRef(null);

  useEffect(() => () => {
    if (cartToastTimer.current) clearTimeout(cartToastTimer.current);
  }, []);

  const showCartToast = (productName, quantity) => {
    if (cartToastTimer.current) clearTimeout(cartToastTimer.current);
    setCartToast({ productName, quantity, key: Date.now() });
    cartToastTimer.current = setTimeout(() => setCartToast(null), 2200);
  };

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

  // 카테고리 트리에 실제로 존재하는 메인 카테고리 id. ERP 동기화나 카테고리 삭제로
  // 상품이 없어진 분류(erp-100-0-0 등)를 가리키는 경우가 있는데, 그런 상품은 어느 탭에도
  // 걸리지 않아 '전체'에서만 보인다. 목록 중간에 섞이면 분류된 상품을 밀어내므로 맨 뒤로 보낸다.
  const knownMainCatIds = useMemo(
    () => new Set(mainCategories.map(c => c.id)),
    [mainCategories]
  );

  const isUncategorized = useCallback((product) => {
    // 카테고리를 아직 못 받아온 첫 렌더에서는 전부 미분류로 취급하지 않는다.
    if (knownMainCatIds.size === 0) return false;
    return !(product.categories || []).some(c => knownMainCatIds.has(c.mainCategory));
  }, [knownMainCatIds]);

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
      // 분류가 꼬인 상품은 검색 결과가 아닌 한 항상 맨 뒤.
      if (!isSearching) {
        const aOrphan = isUncategorized(a.product) ? 1 : 0;
        const bOrphan = isUncategorized(b.product) ? 1 : 0;
        if (aOrphan !== bOrphan) return aOrphan - bOrphan;
      }
      const aOrder = a.product.sortOrder || "";
      const bOrder = b.product.sortOrder || "";
      if (aOrder < bOrder) return -1;
      if (aOrder > bOrder) return 1;
      return a.product.id - b.product.id;
    }).map(({ product }) => product);
  }, [activeMainCat, activeSubCat, isSearching, isUncategorized, products, searchQuery]);

  // 검색은 항상 전체 범위이므로 한 글자라도 입력되면 '전체' 탭으로 옮겨 준다.
  // CategoryNav 의 음성인식 콜백이 첫 렌더 함수를 붙잡고 있으므로 참조를 고정한다.
  const handleSearchChange = useCallback((value) => {
    setSearchQuery(value);
    if (normalizeSearchText(value) !== "") {
      setActiveMainCat(null);
      setActiveSubCat(null);
    }
  }, [setSearchQuery, setActiveMainCat, setActiveSubCat]);

  const handleMainCatChange = (id) => {
    setSearchQuery(''); // 다른 카테고리를 고르면 검색어는 지운다
    setActiveMainCat(id);
    setActiveSubCat(null);
    setIsNavVisible(true); // 카테고리 변경 시 네비게이션 무조건 노출
  };

  const handleSubCatChange = (id) => {
    setSearchQuery('');
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
    setIsReviewOpen(false);
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
    const addedQuantity = Object.values(quantities).reduce(
      (total, qty) => total + (Number(qty) > 0 ? Number(qty) : 0),
      0
    );

    setCart(previousCart => {
      const newCart = [...previousCart];
      Object.entries(quantities).forEach(([comboId, qty]) => {
        if (qty > 0) {
          const combo = combinations.find(c => String(c.id) === comboId);
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
              erpCode: combo ? (combo.erpCode || combo.id) : product.erpCode,
              quantity: qty,
              cartId: Date.now() + Math.random()
            });
          }
        }
      });
      return newCart;
    });

    if (addedQuantity > 0) showCartToast(product.name, addedQuantity);

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
      // 금액은 보내지 않는다. 손님 화면은 단가를 모르고, 서버가 ERP 코드로 직접 계산한다.
      items: cart.map(item => ({
        name: item.name,
        erpCode: item.erpCode, // Include ERP code for backend sync
        quantity: item.quantity || 1, // Store the actual quantity mapping
        selectedOption: item.selectedOption
      })),
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
        pendingOrderRequestId.current = null;
        // 장바구니를 비우기 전에 넣은 내역을 완료 화면으로 넘긴다.
        setCompletedOrder({ order: savedOrder, customerName, items: cart });
        setCart([]);
        setIsReviewOpen(false);
        setOrderModal({ isOpen: false, name: '' });
      } else {
        const errorText = await response.text();
        alert(errorText || '주문 처리 중 오류가 발생했습니다.');
      }
    } catch (e) {
      alert('서버 연결 오류가 발생했습니다.');
    }
  };


  // 주문 마무리 단계(내역 확인 → 상호 선택 → 완료).
  // 세 단계 모두 같은 내용을 쓰고, 키오스크·PC 는 화면으로 폰은 팝업으로만 껍데기가 갈린다.
  const checkoutStage = completedOrder ? 'done'
    : orderModal.isOpen ? 'customer'
    : isReviewOpen ? 'review'
    : null;

  // 주문을 끝내고 "처음으로" 를 누르면 진짜 첫 화면이어야 한다.
  // 완료 화면만 닫으면 주문 직전에 보던 상품 상세가 그대로 남아 있어서
  // 다음 손님이 앞사람이 산 물건 페이지에서 시작하게 된다.
  const goHome = () => {
    setCompletedOrder(null);
    setSelectingProduct(null);
    setSearchQuery('');
    setActiveMainCat(null);
    setActiveSubCat(null);
  };

  const renderCheckout = (variant) => {
    if (checkoutStage === 'review') {
      return (
        <OrderReview
          variant={variant}
          items={cart}
          onRemove={removeFromCart}
          onQuantityChange={updateCartQuantity}
          onClose={() => setIsReviewOpen(false)}
          onConfirm={handleReviewConfirm}
          onSelectProduct={openProductFromCart}
        />
      );
    }
    if (checkoutStage === 'customer') {
      return (
        <CustomerSelect
          variant={variant}
          customers={customers}
          name={orderModal.name}
          onNameChange={(name) => setOrderModal(prev => ({ ...prev, name }))}
          chosungTabs={chosungTabs}
          selectedChosung={selectedChosung}
          onChosungChange={setSelectedChosung}
          getChosung={getChosung}
          onSubmit={submitOrder}
          onCancel={() => setOrderModal(prev => ({ ...prev, isOpen: false }))}
        />
      );
    }
    if (checkoutStage === 'done') {
      return (
        <OrderDone
          variant={variant}
          order={completedOrder.order}
          customerName={completedOrder.customerName}
          items={completedOrder.items}
          onHome={goHome}
        />
      );
    }
    return null;
  };

  const showCheckout = !isMobile && checkoutStage != null;

  // 키오스크·PC 는 상세를 팝업이 아니라 화면 전환으로 연다.
  // 목록 자리를 상세가 차지하고, 오른쪽 장바구니 레일은 그대로 남는다.
  // (팝업이 뒤 화면을 덮던 시절에는 팝업 안에 장바구니를 하나 더 둬야 했다.)
  const showDetail = !isMobile && selectingProduct != null;
  const cartItemCount = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);

  return (
    <div
      className="kiosk-container"
      ref={kioskContainerRef}
      style={cartWidth != null ? { '--kiosk-cart-width': `${cartWidth}px` } : undefined}
    >
      {!showDetail && !showCheckout && (
        <div className="nav-wrapper">
          <CategoryNav
            mainCategories={mainCategories}
            subCategories={subCategories}
            activeMainCat={activeMainCat}
            activeSubCat={activeSubCat}
            onMainCatChange={handleMainCatChange}
            onSubCatChange={handleSubCatChange}
            searchQuery={searchQuery}
            onSearchChange={handleSearchChange}
          />
        </div>
      )}

      <div className="content-area">
        {showCheckout ? renderCheckout('screen') : showDetail ? (
          <ProductDetailView
            product={selectingProduct}
            cartItems={cart}
            products={products}
            onSelectProduct={openRecommendedProduct}
            quantities={optionQuantities}
            onUpdateQty={updateQty}
            onConfirm={confirmAddToCart}
            onCancel={() => setSelectingProduct(null)}
          />
        ) : (<>
        <div className="mobile-result-summary" aria-live="polite">
          <strong>{isSearching ? `‘${searchQuery.trim()}’ 검색` : '상품'}</strong>
          <span>{filteredProducts.length.toLocaleString('ko-KR')}개</span>
        </div>
        <main
          className="kiosk-main"
          onScroll={handleScroll}
          ref={(el) => { if (el) el.scrollTop = lastScrollTop.current; }}
        >
          {filteredProducts.map((product) => (
            <div key={product.id}>
              <ProductCard
                product={product}
                onOpenDetail={handleAddToCartClick}
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
        </>)}
      </div>

      {/* 큰 화면(키오스크·PC)용 오른쪽 장바구니 레일 */}
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
      <button type="button" className="floating-cart-btn" onClick={() => setIsCartOpen(true)} aria-label={`장바구니 열기, 총 ${cartItemCount}개`}>
        <span className="cart-icon">🛒</span>
        <span className="cart-label">장바구니</span>
        <span className="cart-count">{cartItemCount}</span>
      </button>

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



      {/* 폰은 기존대로 팝업으로 띄운다. 키오스크·PC 는 위 content-area 안에서 화면이 바뀐다. */}
      {isMobile && renderCheckout('modal')}

      {/* 폰과 키오스크는 화면을 아예 따로 쓴다. 규격·수량·가격 규칙만
          useProductSelection 으로 공유하므로 계산이 갈라질 일은 없다.
          키오스크·PC 의 상세는 위 content-area 안에서 목록을 대신한다. */}
      {isMobile && selectingProduct && (
        <ProductPageMobile
          product={selectingProduct}
          cartItems={cart}
          products={products}
          onSelectProduct={openRecommendedProduct}
          onConfirm={confirmAddToCart}
          onCancel={() => setSelectingProduct(null)}
          onOpenCart={() => {
            setSelectingProduct(null);
            setIsCartOpen(true);
          }}
        />
      )}

      {cartToast && (
        <div
          key={cartToast.key}
          className="cart-added-toast"
          role="status"
          aria-live="polite"
        >
          <span className="cart-added-toast-icon" aria-hidden="true">✓</span>
          <span className="cart-added-toast-copy">
            <strong>장바구니에 담았어요</strong>
            <span>{cartToast.productName} · {cartToast.quantity.toLocaleString('ko-KR')}개</span>
          </span>
        </div>
      )}
    </div>
  );
}
const ProtectedRoute = ({ children, isAuthenticated }) => {
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
};



export default App;
