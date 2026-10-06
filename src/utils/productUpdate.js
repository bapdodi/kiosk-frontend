// 관리자 저장 요청에는 키오스크에서 관리하는 항목만 담는다.
const EDITABLE_FIELDS = [
    'description', 'categories', 'hashtags', 'images', 'optionImages', 'sortOrder'
];

export function buildProductUpdate(product, changes = {}) {
    const payload = { id: product.id };
    for (const field of EDITABLE_FIELDS) {
        if (changes[field] !== undefined) payload[field] = changes[field];
    }
    // 사진이나 카테고리만 저장할 때 규격 표시 설정까지 다시 보내지 않는다.
    if (Object.hasOwn(changes, 'combinations')) {
        payload.combinations = changes.combinations
            .filter(combo => combo.id_db != null)
            .map((combo, index) => ({
                id_db: combo.id_db,
                deleted: Boolean(combo.deleted),
                sortOrder: index
            }));
    }
    return payload;
}
