import { COMBINATION_GROUP } from './optionConstants';

/**
 * 규격(옵션) 해석과 가격 계산 규칙.
 *
 * 이 규칙을 쓰는 곳이 세 군데로 늘었다.
 *   - 목록 카드(ProductCard)  : 규격을 골라야 하는 상품인지 판단해 바로 담기/선택하기를 가른다
 *   - 상세 화면(OptionModal)  : 규격을 고르고 가격을 보여준다
 *   - 폰 화면(ProductPageMobile)
 * 세 곳이 서로 다른 판단을 하면 "카드에서는 바로 담겼는데 상세에서는 규격을 고르라고 한다"
 * 같은 어긋남이 생긴다. 그래서 판단 근거는 전부 여기 한 곳에만 둔다.
 *
 * 화면 배치나 CSS 에 대한 판단은 여기에 넣지 않는다.
 */

/**
 * 데이터 구조가 여러 갈래(optionGroups / sizes+origins / combinations)라 한 형태로 모은다.
 * displayLabel 은 손님에게 보여줄 이름. COMBINATION_GROUP 은 내부용 sentinel 이라
 * 그대로 쓰면 화면에 "__combination__" 이 노출된다.
 */
export function getOptionGroups(product) {
    if (!product) return [];

    const groups = [];

    if (product.optionGroups && product.optionGroups.length > 0) {
        groups.push(...product.optionGroups.map(g => ({ ...g, values: g.values || [] })));
    } else {
        if (product.sizes && product.sizes.length > 0) {
            groups.push({ name: '규격 (Size)', values: product.sizes.map(s => s.name), legacySource: 'sizes' });
        }
        if (product.origins && product.origins.length > 0) {
            groups.push({ name: '원산지 (Origin)', values: product.origins.map(o => o.name), legacySource: 'origins' });
        }

        // ERP 로 묶여 들어온 상품은 규격 하나짜리 선택지로 다룬다.
        const activeCombos = (product.combinations || []).filter(c => !c.deleted);
        if (groups.length === 0 && activeCombos.length > 1) {
            groups.push({
                name: COMBINATION_GROUP,
                label: '',
                values: activeCombos.map(c => c.name),
                legacySource: 'combinations'
            });
        }
    }

    return groups.map(g => ({
        ...g,
        displayLabel: g.label || (g.name === COMBINATION_GROUP ? '규격' : g.name),
    }));
}

/**
 * 값이 하나뿐인 그룹은 고를 여지가 없으므로 미리 선택해 둔다.
 * 상세 화면의 초기 상태이자, 카드에서 바로 담을 때 쓰는 선택값이기도 하다.
 */
export function getDefaultSelections(groups) {
    const initial = {};
    groups.forEach(g => {
        if (g.values.length === 1) initial[g.name] = g.values[0];
    });
    return initial;
}

/**
 * 손님이 직접 골라야 하는 규격이 있는 상품인가.
 *
 * 값이 하나뿐인 그룹만 있으면(또는 그룹이 없으면) 고를 것이 없으므로
 * 목록 카드에서 수량만 정해 바로 담을 수 있다.
 */
export function needsOptionChoice(product) {
    return getOptionGroups(product).some(g => g.values.length > 1);
}

/** 규격을 고를 필요가 없는 상품의 "규격 N종" 안내에 쓸 개수 */
export function countOptionValues(product) {
    return getOptionGroups(product).reduce((max, g) => Math.max(max, g.values.length), 0);
}

/** 선택된 규격에 따른 기본가 대비 추가금 */
export function getPriceForSelections(product, groups, selections) {
    if (!product) return 0;

    const activeCombos = (product.combinations || []).filter(c => !c.deleted);
    if (activeCombos.length > 0) {
        const comboName = groups.map(g => selections[g.name]).join(' / ');
        const combo = activeCombos.find(c => c.name === comboName);
        // ERP 로 들어온 조합은 combo.priceC 가 그 자체로 단가라,
        // 기본가와의 차액(extra)으로 환산해서 돌려준다.
        if (combo) return combo.priceC - product.priceC;
        return 0;
    }

    let extra = 0;
    groups.forEach(g => {
        const val = selections[g.name];
        if (g.legacySource === 'sizes') {
            const s = product.sizes.find(sz => sz.name === val);
            if (s) extra += s.price;
        }
        if (g.legacySource === 'origins') {
            const o = product.origins.find(og => og.name === val);
            if (o) extra += o.price;
        }
    });
    return extra;
}

/** 현재 선택값(selections)을 장바구니 한 줄로 변환 */
export function buildLineFromSelections(product, groups, selections, qty) {
    const comboName = groups.map(g => selections[g.name]).join(' / ');
    const foundCombo = (product.combinations || []).filter(c => !c.deleted).find(c => c.name === comboName);
    const extra = getPriceForSelections(product, groups, selections);
    const comboId = foundCombo ? foundCombo.id : comboName;
    return {
        lineId: comboId,
        comboId,
        displayName: comboName,
        totalExtra: extra,
        unitPrice: (product.priceC || 0) + extra,
        erpCode: foundCombo ? foundCombo.erpCode : (product.erpCode || null),
        quantity: Math.max(1, qty)
    };
}

/**
 * 규격을 고를 필요가 없는 상품을 목록에서 바로 담을 때 쓸 인자.
 * confirmAddToCart(product, combinations, quantities) 와 같은 모양으로 돌려준다.
 */
export function buildQuickAddArgs(product, qty) {
    const groups = getOptionGroups(product);
    const line = buildLineFromSelections(product, groups, getDefaultSelections(groups), qty);
    return {
        combinations: [{
            id: line.comboId,
            displayName: line.displayName,
            totalExtra: line.totalExtra,
            erpCode: line.erpCode,
        }],
        quantities: { [line.comboId]: Math.max(1, qty) },
    };
}
