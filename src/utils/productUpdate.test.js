import assert from 'node:assert/strict';
import test from 'node:test';
import { buildProductUpdate } from './productUpdate.js';

const product = {
    id: 1, name: 'ERP 상품', erpCode: '100', gyu: '15A', stock: 30,
    priceA: 1000, priceB: 2000, priceC: 3000, brandName: '기존 브랜드', originAreaCode: '00',
    categories: [{ mainCategory: 'cat' }], images: ['old.jpg'],
    combinations: [{ id_db: 10, name: '15A', erpCode: '100', priceC: 3000, deleted: false }]
};

test('기존 상품을 넘겨도 ERP와 브랜드·원산지는 요청에 포함하지 않는다', () => {
    assert.deepEqual(buildProductUpdate(product, { ...product, images: ['new.jpg'] }), {
        id: 1, categories: product.categories, images: ['new.jpg'],
        combinations: [{ id_db: 10, deleted: false, sortOrder: 0 }]
    });
    assert.deepEqual(buildProductUpdate(product, { images: ['new.jpg'] }), {
        id: 1, images: ['new.jpg']
    });
});

test('분류만 바꿀 때 기존 사진이나 규격 설정을 다시 저장하지 않는다', () => {
    assert.deepEqual(buildProductUpdate(product, { categories: [] }), { id: 1, categories: [] });
});

test('규격 설정은 기존 ID와 순서·숨김만 보내고 새 규격은 만들지 않는다', () => {
    assert.deepEqual(buildProductUpdate(product, {
        combinations: [{ id_db: 20, priceA: 500, deleted: true }, { name: '수동 규격' }]
    }), {
        id: 1, combinations: [{ id_db: 20, deleted: true, sortOrder: 0 }]
    });
});
