import assert from 'node:assert/strict';
import test from 'node:test';
import { getOptionGroups, getOptionPriceRange, getPriceSortedOptionGroups } from './productOptions.js';

test('options sort by ascending price, keep equal-price order and place missing prices last', () => {
    const product = { combinations: [
        { name: '150A', price: 219000 },
        { name: '가격 없음', price: 0 },
        { name: '50A', price: 45000 },
        { name: '50A 수입', price: 45000 },
        { name: '삭제 규격', price: 100, deleted: true },
    ] };
    assert.deepEqual(getPriceSortedOptionGroups(product)[0].values, ['50A', '50A 수입', '150A', '가격 없음']);
    assert.deepEqual(product.combinations.map(c => c.name), ['150A', '가격 없음', '50A', '50A 수입', '삭제 규격']);
});

test('an ERP specification containing a slash retains its exact price', () => {
    const product = { combinations: [{ name: '50A / 수입', price: 45000 }] };
    const groups = getOptionGroups(product);
    assert.deepEqual(getOptionPriceRange(product, groups, groups[0].name, '50A / 수입'), { min: 45000, max: 45000 });
});

test('multiple option groups show a range and narrow it to the other selection', () => {
    const product = {
        sizes: [{ name: '50A' }, { name: '65A' }],
        origins: [{ name: '수입' }, { name: '국산' }],
        combinations: [
            { name: '50A / 수입', price: 45000 },
            { name: '50A / 국산', price: 55000 },
            { name: '65A / 수입', price: 65000 },
        ],
    };
    const groups = getOptionGroups(product);
    const [sizeGroup, originGroup] = groups;
    assert.deepEqual(getOptionPriceRange(product, groups, sizeGroup.name, '50A'), { min: 45000, max: 55000 });
    assert.deepEqual(getOptionPriceRange(product, groups, sizeGroup.name, '50A', { [originGroup.name]: ['국산'] }), { min: 55000, max: 55000 });
    assert.equal(getOptionPriceRange(product, groups, sizeGroup.name, '65A', { [originGroup.name]: ['국산'] }), null);
});

test('options use the product price fallback and ignore deleted combinations', () => {
    const product = { price: 1200, combinations: [{ name: '기본', price: null }, { name: '삭제', price: 1, deleted: true }] };
    const groups = getOptionGroups(product);
    assert.deepEqual(getOptionPriceRange(product, groups, groups[0].name, '기본'), { min: 1200, max: 1200 });
    assert.equal(getOptionPriceRange(product, groups, groups[0].name, '삭제'), null);
});
