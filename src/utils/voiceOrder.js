import { getSearchMatchScore } from './search.js';
import { getOptionGroups, expandSelections, buildLineFromSelections } from './productOptions.js';

export function searchVoiceProducts(products, query) {
    if (typeof query !== 'string' || !query.trim() || query.length > 100) return [];
    return products.filter(p => !p.deletedAt).map(product => ({
        product,
        score: Math.min(...[product.name, ...(product.hashtags || []), product.gyu || '']
            .map(name => getSearchMatchScore(name, query.trim()))),
    })).filter(p => Number.isFinite(p.score)).sort((a, b) => a.score - b.score)
        .slice(0, 6).map(p => p.product);
}

export function voiceOptions(product) {
    const groups = getOptionGroups(product);
    const combos = (product.combinations || []).filter(c => !c.deleted);
    // Never generate a Cartesian product when ERP already supplies the valid combinations.
    if (combos.length) return combos.map(c => ({
        optionId: String(c.id), label: c.kioskName || c.name,
        line: { id: c.id, displayName: c.name, erpCode: c.erpCode || product.erpCode, price: c.price },
    }));
    const count = groups.reduce((n, g) => n * g.values.length, 1);
    if (count > 200) throw new Error('규격이 많습니다. 상품 화면에서 직접 선택해 주세요.');
    return expandSelections(groups, Object.fromEntries(groups.map(g => [g.name, g.values])))
        .map((selection, i) => {
            const line = buildLineFromSelections(product, groups, selection, 1);
            return { optionId: `legacy-${i}`, label: line.displayName,
                line: { id: line.comboId, displayName: line.displayName, erpCode: line.erpCode, price: line.price } };
        });
}

export function validateVoiceQuantity(quantity, allowZero = false) {
    if (!Number.isSafeInteger(quantity) || quantity < (allowZero ? 0 : 1) || quantity > 9999) {
        throw new Error(`수량은 ${allowZero ? 0 : 1}~9999 사이 정수로 말씀해 주세요.`);
    }
    return quantity;
}

/** Only catalog-derived lines reach the shared cart handler; model-supplied names/prices/codes are ignored. */
export function resolveVoiceLine(products, productId, optionId, quantity) {
    validateVoiceQuantity(quantity);
    const product = products.find(p => !p.deletedAt && String(p.id) === productId);
    if (!product) throw new Error('상품을 다시 검색해 주세요.');
    const option = voiceOptions(product).find(o => o.optionId === optionId);
    if (!option || !option.line.erpCode) throw new Error('실제 주문 가능한 규격을 선택해 주세요.');
    return { product, option };
}

export function publicVoiceCart(cart) {
    return cart.map(i => ({ cartId: String(i.cartId), name: i.name, option: i.selectedOption, quantity: i.quantity }));
}

/** Translate an actual option ID into the exact button values used by both existing detail views. */
export function voiceOptionSelections(product, optionId) {
    const groups = getOptionGroups(product);
    const combo = (product.combinations || []).find(c => !c.deleted && String(c.id) === optionId);
    let values;
    if (combo) values = groups.length === 1 ? [combo.name] : combo.name.split(' / ');
    else {
        if ((product.combinations || []).some(c => !c.deleted)) throw new Error('규격을 다시 선택해 주세요.');
        const rows = expandSelections(groups, Object.fromEntries(groups.map(g => [g.name, g.values])));
        const index = voiceOptions(product).findIndex(o => o.optionId === optionId);
        if (index < 0) throw new Error('규격을 다시 선택해 주세요.');
        values = groups.map(g => rows[index][g.name]);
    }
    if (values.length !== groups.length || groups.some((g, i) => !g.values.includes(values[i]))) {
        throw new Error('이 규격은 상품 화면에서 직접 확인해 주세요.');
    }
    return Object.fromEntries(groups.map((g, i) => [g.name, [values[i]]]));
}
