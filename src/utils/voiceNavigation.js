/** Only customer screens are reachable; navigation never clears the draft or submits it. */
export function resolveVoiceDestination(state, target) {
    if (!['products', 'cart', 'buyer', 'review', 'welcome', 'back'].includes(target)) throw new Error('이동할 주문 화면을 다시 말씀해 주세요.');
    if (target !== 'back') return target;
    if (state.welcomeOpen) return 'products';
    if (state.customerOpen) return state.reviewOpen ? 'review' : 'products';
    if (state.cartOpen) return state.productOpen ? 'product' : 'products';
    if (state.reviewOpen || state.buyerOpen || state.productOpen) return 'products';
    return state.query || state.mainCategory ? 'products' : 'welcome';
}

export function resolveVoiceCategory(mainCategories, subCategories, mainId, subId) {
    if (mainId === 'all') return { main: null, sub: null };
    const main = mainCategories.find(c => String(c.id) === mainId);
    if (!main) throw new Error('실제 상품 분류를 먼저 확인해 주세요.');
    if (!subId || subId === 'all') return { main: main.id, sub: null };
    const sub = (subCategories[main.id] || []).find(c => String(c.id) === subId);
    if (!sub) throw new Error('선택한 분류에 없는 하위 분류입니다.');
    return { main: main.id, sub: sub.id };
}

export function resolveVoiceImage(action, index, current, count) {
    if (!Number.isInteger(count) || count < 1) throw new Error('이 상품에는 등록된 사진이 없습니다.');
    if (action === 'next') return (current + 1) % count;
    if (action === 'previous') return (current - 1 + count) % count;
    if (action !== 'select' || !Number.isInteger(index) || index < 1 || index > count) throw new Error('실제 사진 번호를 선택해 주세요.');
    return index - 1;
}
