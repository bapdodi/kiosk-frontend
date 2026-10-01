/**
 * 손님 화면의 가격 표시.
 *
 * 모든 손님은 같은 가격(서버가 내려주는 `price`, A단가)을 낸다. 상품과 규격(combination)이
 * 각각 price 를 갖고, 규격 가격이 없으면 상품 가격을 쓴다 — 서버가 주문 금액을 매기는 규칙과 같다.
 * 가격이 없는 품목(null/0)은 합계에서 빼고 화면에서도 숨긴다.
 */

export const formatWon = (n) => `${Number(n || 0).toLocaleString('ko-KR')}원`;

/** 규격 하나의 가격. 규격에 가격이 없으면 상품 가격. */
export function resolvePrice(product, combo) {
    const price = combo?.price ?? product?.price ?? null;
    return price > 0 ? price : null;
}

/** 규격을 고르기 전에 보여줄 가격 범위. 모든 규격이 같은 값이면 min === max. */
export function getPriceRange(product) {
    if (!product) return null;
    const combos = (product.combinations || []).filter(c => !c.deleted);
    const prices = (combos.length > 0 ? combos.map(c => resolvePrice(product, c)) : [resolvePrice(product, null)])
        .filter(p => p != null);
    if (prices.length === 0) return null;
    return { min: Math.min(...prices), max: Math.max(...prices) };
}

export function formatPriceRange(range) {
    if (!range) return null;
    return range.min === range.max ? formatWon(range.min) : `${formatWon(range.min)} ~ ${formatWon(range.max)}`;
}

/** 장바구니 품목 합계(수량 반영). 가격 없는 품목은 0 으로 센다. */
export function cartTotal(items) {
    return items.reduce((sum, item) => sum + (item.price > 0 ? item.price * (item.quantity || 1) : 0), 0);
}
