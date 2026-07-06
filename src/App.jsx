import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import AdminLayout from './components/admin/AdminLayout';
import CategoryManagement from './components/admin/CategoryManagement';
import NaverSyncPage from './components/admin/NaverSyncPage';
import OrderManagement from './components/admin/OrderManagement';
import ProductForm from './components/admin/ProductForm';
import ProductManagement from './components/admin/ProductManagement';
import Cart from './components/Cart';
import CartBar from './components/CartBar';
import CategoryNav from './components/CategoryNav';
import LoginPage from './components/LoginPage';
import OptionModal from './components/OptionModal';
import ProductCard from './components/ProductCard';

// ... (KioskView & ProtectedRoute components)

const CHOSUNG_LIST = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
const EN_TO_KO_JAMO = {
  r: 'ㄱ', R: 'ㄲ', s: 'ㄴ', e: 'ㄷ', E: 'ㄸ', f: 'ㄹ', a: 'ㅁ', q: 'ㅂ', Q: 'ㅃ',
  t: 'ㅅ', T: 'ㅆ', d: 'ㅇ', w: 'ㅈ', W: 'ㅉ', c: 'ㅊ', z: 'ㅋ', x: 'ㅌ', v: 'ㅍ', g: 'ㅎ',
  k: 'ㅏ', o: 'ㅐ', O: 'ㅒ', i: 'ㅑ', j: 'ㅓ', p: 'ㅔ', P: 'ㅖ', u: 'ㅕ', h: 'ㅗ', y: 'ㅛ',
  n: 'ㅜ', b: 'ㅠ', m: 'ㅡ', l: 'ㅣ'
};

// 영문 알파벳의 한글 발음(예: PB → 피비, LED → 엘이디, PVC → 피브이씨)
const EN_LETTER_TO_KO_SOUND = {
  a: '에이', b: '비', c: '씨', d: '디', e: '이', f: '에프', g: '지',
  h: '에이치', i: '아이', j: '제이', k: '케이', l: '엘', m: '엠', n: '엔',
  o: '오', p: '피', q: '큐', r: '알', s: '에스', t: '티', u: '유',
  v: '브이', w: '더블유', x: '엑스', y: '와이', z: '지',
};

// 읽는 법이 두 가지인 글자의 구어 발음(예: TV → 티비, CCTV → 씨씨티비)
const EN_LETTER_ALT_SOUND = { v: '비', z: '제트' };

// 문자열 안의 영문 알파벳을 한글 발음으로 펼친다. ("PB파이프" → "피비파이프")
const expandEnglishToKoreanSound = (value, altMap = {}) => (value || '')
  .toLowerCase()
  .split('')
  .map((char) => altMap[char] ?? EN_LETTER_TO_KO_SOUND[char] ?? char)
  .join('');

const normalizeSearchText = (value) => (value || '').toLowerCase().replace(/\s+/g, '');

const getChosungChar = (char) => {
  if (!char) return '';
  const unicode = char.charCodeAt(0);

  if (unicode >= 0xAC00 && unicode <= 0xD7A3) {
    const index = Math.floor((unicode - 0xAC00) / 588);
    return CHOSUNG_LIST[index];
  }

  if ((unicode >= 65 && unicode <= 90) || (unicode >= 97 && unicode <= 122)) {
    return char.toUpperCase();
  }

  return '기타';
};

const getChosungText = (value) => (value || '')
  .split('')
  .map((char) => {
    const chosung = getChosungChar(char);
    return chosung === '기타' ? char : chosung;
  })
  .join('');

const convertEnglishKeyboardToKorean = (value) => (value || '')
  .split('')
  .map((char) => EN_TO_KO_JAMO[char] || char)
  .join('');

const matchesCustomerSearch = (name, query) => {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return true;

  const normalizedName = normalizeSearchText(name);
  const nameChosung = normalizeSearchText(getChosungText(name));
  const keyboardQuery = normalizeSearchText(convertEnglishKeyboardToKorean(query));

  // 알파벳↔한글 발음 매칭: "PB파이프"를 "피비"로, "피비파이프"를 "pb"로 검색 가능
  // 정식 발음(PVC→피브이씨)과 구어 발음(TV→티비) 두 변형을 모두 검사한다.
  const namePhonetic = normalizeSearchText(expandEnglishToKoreanSound(name));
  const namePhoneticAlt = normalizeSearchText(expandEnglishToKoreanSound(name, EN_LETTER_ALT_SOUND));
  const queryPhonetic = normalizeSearchText(expandEnglishToKoreanSound(query));

  return normalizedName.includes(normalizedQuery) ||
    nameChosung.includes(normalizedQuery) ||
    normalizedName.includes(keyboardQuery) ||
    nameChosung.includes(keyboardQuery) ||
    namePhonetic.includes(normalizedQuery) ||
    namePhoneticAlt.includes(normalizedQuery) ||
    normalizedName.includes(queryPhonetic) ||
    namePhonetic.includes(queryPhonetic);
};

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

  // Pagination states
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);

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
        const [isAuth, catRes] = await Promise.all([
          checkAuth(),
          fetch('/api/categories')
        ]);

        if (!catRes.ok) throw new Error('카테고리를 불러오는데 실패했습니다.');
        const catData = await catRes.json();

        const mainArr = catData.filter(c => c.level === 'main');
        const subObj = {};
        catData.filter(c => c.level === 'sub').forEach(c => {
          if (!subObj[c.parentId]) subObj[c.parentId] = [];
          subObj[c.parentId].push(c);
        });

        setMainCategories(mainArr);
        setSubCategories(subObj);

        // Fetch first page of products
        await fetchProducts(0, null, null, true);

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
  }, []);


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

  const fetchProducts = async (pageNumber, mainCat, subCat, query = '', isInitial = false) => {
    try {
      if (!isInitial) setIsFetchingMore(true);
      
      let url = `/api/products?page=${pageNumber}&size=2000`;
      if (mainCat) url += `&mainCategory=${mainCat}`;
      if (subCat && subCat !== 'all') url += `&subCategory=${subCat}`;
      // search is handled client-side only (backend does not support search param)

      const res = await fetch(url);
      if (!res.ok) throw new Error('상품 데이터를 불러오는데 실패했습니다.');
      
      const data = await res.json();
      const newProducts = data.content || [];

      if (isInitial || pageNumber === 0) {
        setProducts(newProducts);
      } else {
        setProducts(prev => [...prev, ...newProducts]);
      }

      setHasMore(!data.last);
      setPage(pageNumber);
    } catch (e) {
      console.error('Fetch products failed:', e);
      setError(e.message);
    } finally {
      setIsFetchingMore(false);
    }
  };

  // Reset and fetch when category filter changes (search is handled client-side)
  useEffect(() => {
    if (!loading) {
        fetchProducts(0, activeMainCat, activeSubCat, '', true);
    }
  }, [activeMainCat, activeSubCat]);

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
            page={page}
            hasMore={hasMore}
            isFetchingMore={isFetchingMore}
            onLoadMore={() => fetchProducts(page + 1, activeMainCat, activeSubCat, searchQuery)}
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
               orders={orders}
               setOrders={setOrders}
               page={page}
               hasMore={hasMore}
               onLoadMore={() => fetchProducts(page + 1, activeMainCat, activeSubCat, searchQuery)}
               onRefresh={() => fetchProducts(0, activeMainCat, activeSubCat, searchQuery, true)}
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
  page,
  hasMore,
  isFetchingMore,
  onLoadMore
}) {
  const navigate = useNavigate();
  const [selectingProduct, setSelectingProduct] = useState(null);
  const [optionQuantities, setOptionQuantities] = useState({});
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isNavVisible, setIsNavVisible] = useState(true);
  const [orderModal, setOrderModal] = useState({ isOpen: false, name: '' });
  const [customers, setCustomers] = useState([]);
  const lastScrollTop = useRef(0);
  const observer = useRef();

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

  const lastProductElementRef = useCallback(node => {
    if (isFetchingMore) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        onLoadMore();
      }
    });
    if (node) observer.current.observe(node);
  }, [isFetchingMore, hasMore, onLoadMore]);

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
      const isSearching = normalizeSearchText(searchQuery) !== "";
      const matchSearch = !isSearching ||
        matchesCustomerSearch(product.name, searchQuery) ||
        product.hashtags.some(tag => matchesCustomerSearch(tag, searchQuery));

      if (!matchSearch) return false;

      // If actively searching, ignore category filters for global search
      if (isSearching) return true;

      // 상품은 여러 카테고리에 속할 수 있으므로, 그 중 하나라도 현재 필터와 맞으면 노출한다.
      if (!activeMainCat) return true;
      return (product.categories || []).some(c => {
        if (c.mainCategory !== activeMainCat) return false;
        if (!activeSubCat || activeSubCat === 'all') return true;
        return c.subCategory === activeSubCat;
      });
    }).sort((a, b) => {
      const aOrder = a.sortOrder || "";
      const bOrder = b.sortOrder || "";
      if (aOrder < bOrder) return -1;
      if (aOrder > bOrder) return 1;
      return a.id - b.id;
    });
  }, [activeMainCat, activeSubCat, products, searchQuery]);

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

  const updateCartQuantity = (cartId, delta) => {
    setCart(prev => prev.map(item =>
      item.cartId === cartId
        ? { ...item, quantity: Math.max(1, (item.quantity || 1) + delta) }
        : item
    ));
  };

  const handleCheckout = () => {
    if (cart.length === 0) return alert('장바구니가 비어있습니다.');
    setIsCartOpen(false);
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
          {filteredProducts.map((product, index) => (
            <div key={product.id} ref={index === filteredProducts.length - 1 ? lastProductElementRef : null}>
              <ProductCard
                product={product}
                onAddClick={handleAddToCartClick}
                onTagClick={setSearchQuery}
              />
            </div>
          ))}
          {isFetchingMore && (
            <div style={{ textAlign: 'center', gridColumn: '1/-1', padding: '20px', color: '#667085' }}>
              더 불러오는 중...
            </div>
          )}
          {filteredProducts.length === 0 && !isFetchingMore && (
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
        onResizeStart={handleCartResizeStart}
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
            />
            <button className="modal-close-btn" onClick={() => setIsCartOpen(false)}>×</button>
          </div>
        </div>
      )}



      {/* Order Name Input Modal */}
      {orderModal.isOpen && (() => {
        const customerSearchQuery = orderModal.name.trim();
        const filteredCustomers = customers.filter(c => {
          const name = c.NAME?.trim() || '';
          if (customerSearchQuery) {
            return matchesCustomerSearch(name, customerSearchQuery);
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
                  👤 1번 고객으로 주문하기
                </button>

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

                <div style={{ position: 'relative', marginBottom: '20px' }}>
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
                    주문 완료하기
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
