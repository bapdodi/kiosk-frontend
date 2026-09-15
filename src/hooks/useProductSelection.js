import { useEffect, useRef, useState } from 'react';
import {
    buildLineFromSelections as buildLine,
    getDefaultSelections,
    getOptionGroups,
} from '../utils/productOptions';

// 복합옵션 상품은 규격이 수십 개일 수 있어, 추천 기준으로 보낼 ERP 코드 수를 제한한다.
const MAX_RECOMMENDATION_SOURCE_CODES = 30;
// 한 줄로 훑을 수 있는 개수. 더 늘리면 스크롤해야 보여서 눌리지 않는다.
const VISIBLE_RECOMMENDATIONS = 6;

/**
 * 상품 선택(규격·수량·사진·추천·장바구니 담기) 로직.
 *
 * 화면은 키오스크용(OptionModal)과 폰용(ProductPageMobile) 두 벌로 갈라져 있지만
 * 규격 해석과 담기 규칙은 한 벌이어야 한다. 그 공통분모가 이 파일이다.
 * 여기에는 DOM 배치나 CSS 에 대한 판단을 넣지 않는다.
 */
export function useProductSelection(product, { cartItems = [], products = [], onConfirm }) {
    // 규격 해석 규칙은 목록 카드와도 공유해야 해서 utils/productOptions.js 에 있다.
    const groups = getOptionGroups(product);

    const [selections, setSelections] = useState({});
    const [quantity, setQuantity] = useState(1);
    const [showProductPrompt, setShowProductPrompt] = useState(false);
    const optionSectionRef = useRef(null);

    // 모든 옵션 그룹이 선택되어야 담을 수 있다 (자동 디폴트가 없으므로 직접 선택 필수).
    const allOptionsSelected = groups.every(g => selections[g.name] != null);

    // ── 사진 ───────────────────────────────────────────────────────────────
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [failedImages, setFailedImages] = useState({});
    const touchStartX = useRef(null);

    const optionImages = product?.optionImages || [];

    // 현재 선택된 옵션값들에 등록된 사진을 모으고, 하나도 없으면 메인 사진으로 폴백한다.
    const matchedOptionImages = [];
    groups.forEach(g => {
        const sel = selections[g.name];
        if (!sel) return;
        optionImages
            .filter(oi => oi.groupName === g.name && oi.optionValue === sel)
            .forEach(oi => matchedOptionImages.push(oi.imageUrl));
    });
    const images = matchedOptionImages.length > 0 ? matchedOptionImages : (product?.images || []);
    const hasMultipleImages = images.length > 1;

    const moveImage = (dir) => {
        const count = images.length;
        if (count <= 1) return;
        setCurrentImageIndex(prev => (prev + dir + count) % count);
    };

    const handleImageTouchStart = (e) => {
        touchStartX.current = e.touches[0].clientX;
    };

    const handleImageTouchEnd = (e) => {
        if (touchStartX.current === null) return;
        const delta = e.changedTouches[0].clientX - touchStartX.current;
        if (Math.abs(delta) > 40) {
            moveImage(delta < 0 ? 1 : -1);
        }
        touchStartX.current = null;
    };

    // ── 수량 ───────────────────────────────────────────────────────────────
    const intervalRef = useRef(null);
    const timeoutRef = useRef(null);

    const handleQuantityChange = (delta) => {
        setQuantity(prev => {
            const val = typeof prev === 'number' ? prev : parseInt(prev || '0', 10);
            return Math.max(1, Math.min(val + delta, 9999));
        });
    };

    // 묶음 수량 버튼(+10/+50). 아직 수량을 정하지 않은 초기 상태(1)에서 누르면
    // 1+50=51 이 아니라 눌린 수량 그대로 맞춘다. 손님이 기대하는 "50개 담기"에 맞춘 동작.
    const handleBulkStep = (step) => {
        setQuantity(prev => {
            const val = typeof prev === 'number' ? prev : parseInt(prev || '0', 10);
            if (val === 1) return step;
            return Math.max(1, Math.min(val + step, 9999));
        });
    };

    const stopPress = () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        if (intervalRef.current) clearInterval(intervalRef.current);
    };

    const startPress = (delta) => {
        stopPress();
        handleQuantityChange(delta);
        timeoutRef.current = setTimeout(() => {
            intervalRef.current = setInterval(() => {
                handleQuantityChange(delta);
            }, 30);
        }, 400);
    };

    useEffect(() => () => stopPress(), []);

    // 상품이 바뀌면 초기화.
    // 옵션이 2개 이상인 그룹은 사용자가 직접 고르도록 디폴트 선택하지 않는다.
    // (값이 하나뿐인 그룹은 선택의 여지가 없으므로 그대로 선택해 둔다.)
    useEffect(() => {
        setSelections(getDefaultSelections(groups));
        setQuantity(1);
        setCurrentImageIndex(0);
        setFailedImages({});
        setShowProductPrompt(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [product]);

    // ── 동시구매 추천 ──────────────────────────────────────────────────────
    // 어떤 상품의 추천인지 함께 들고 있어야, 다른 상품으로 갈아탄 순간 이전 추천이 잠깐 비치지 않는다.
    const [recommendations, setRecommendations] = useState({ productId: null, items: [] });

    // 복합옵션 상품은 규격마다 ERP 코드가 달라서, 규격을 고르기 전에도 추천이 보이도록
    // 전 규격의 코드를 함께 보내고 서버가 합산한 결과를 돌려준다.
    useEffect(() => {
        const codes = (!product ? [] : [
            product.erpCode,
            ...(product.combinations || []).filter(c => !c.deleted).map(c => c.erpCode)
        ]).filter(Boolean).slice(0, MAX_RECOMMENDATION_SOURCE_CODES);

        if (codes.length === 0) return;

        let cancelled = false;
        const productId = product.id;
        fetch(`/api/recommendations?codes=${encodeURIComponent(codes.join(','))}&limit=8`)
            .then(res => (res.ok ? res.json() : []))
            .then(data => {
                if (!cancelled) {
                    setRecommendations({ productId, items: Array.isArray(data) ? data : [] });
                }
            })
            .catch(() => {
                // 추천은 주문에 필수가 아니므로 실패하면 조용히 숨긴다.
                if (!cancelled) setRecommendations({ productId, items: [] });
            });

        return () => { cancelled = true; };
    }, [product]);

    const safeQuantity = typeof quantity === 'number' ? quantity : parseInt(quantity || '0', 10);

    // 이 상품으로 이미 장바구니에 담긴 항목들. 화면을 다시 열어도 그대로 보이도록
    // 화면 내부 상태가 아니라 장바구니에서 직접 가져온다.
    const addedLines = (cartItems || []).filter(i => product && i.id === product.id);
    const addedTotalQuantity = addedLines.reduce((sum, line) => sum + (line.quantity || 1), 0);

    // 서버는 상품 id 만 돌려준다. 사진·이름은 이미 메모리에 있는 전체 상품 목록에서 찾아 쓰고,
    // 목록에 없는(삭제됐거나 아직 동기화 전인) 상품은 버린다.
    const recommendedProducts = (product && recommendations.productId === product.id ? recommendations.items : [])
        .map(reco => products.find(p => p.id === reco.productId))
        .filter(Boolean)
        .slice(0, VISIBLE_RECOMMENDATIONS);

    // 현재 선택값(selections)을 하나의 라인 객체로 변환
    const buildLineFromSelections = (sel, qty) => buildLine(product, groups, sel, qty);

    const focusMissingProduct = () => {
        setShowProductPrompt(true);
        const target = optionSectionRef.current?.querySelector('[data-option-missing="true"]');
        target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        target?.querySelector('button')?.focus({ preventScroll: true });
    };

    const handleConfirm = (stayOpen = false) => {
        if (!allOptionsSelected) {
            focusMissingProduct();
            return;
        }
        const qty = safeQuantity < 1 ? 1 : safeQuantity;
        const line = buildLineFromSelections(selections, qty);
        onConfirm(product, [{
            id: line.comboId,
            displayName: line.displayName,
            erpCode: line.erpCode
        }], { [line.comboId]: qty }, stayOpen);

        if (stayOpen) {
            setSelections(getDefaultSelections(groups));
            setQuantity(1);
            setShowProductPrompt(true);
        }
    };

    return {
        groups,
        selections, setSelections,
        allOptionsSelected,
        showProductPrompt, setShowProductPrompt,
        quantity, setQuantity, safeQuantity,
        handleQuantityChange, handleBulkStep, startPress, stopPress,
        images, currentImageIndex, setCurrentImageIndex, hasMultipleImages,
        failedImages, setFailedImages,
        moveImage, handleImageTouchStart, handleImageTouchEnd,
        recommendedProducts,
        addedLines, addedTotalQuantity,
        buildLineFromSelections,
        optionSectionRef, focusMissingProduct, handleConfirm,
    };
}
