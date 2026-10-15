import test from 'node:test';
import assert from 'node:assert/strict';
import { getBuyerDisplayName } from './buyer.js';

test('구매자가 없으면 빈 문자열을 반환한다', () => {
    assert.equal(getBuyerDisplayName(null), '');
    assert.equal(getBuyerDisplayName(undefined), '');
});

test('ERP 코드 1 또는 이름 1은 비회원으로 표시한다', () => {
    assert.equal(getBuyerDisplayName({ customerName: '1', erpCustomerCode: '1' }), '비회원');
    assert.equal(getBuyerDisplayName({ customerName: '1', erpCustomerCode: '100' }), '비회원');
    assert.equal(getBuyerDisplayName({ customerName: '일반', erpCustomerCode: '1' }), '비회원');
    assert.equal(getBuyerDisplayName('1'), '비회원');
});

test('등록된 상호명은 그대로 표시한다', () => {
    assert.equal(getBuyerDisplayName({ customerName: '아람설비', erpCustomerCode: '1052' }), '아람설비');
    assert.equal(getBuyerDisplayName('대림바스'), '대림바스');
});
