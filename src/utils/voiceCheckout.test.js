import test from 'node:test';
import assert from 'node:assert/strict';
import { VoiceCheckoutConfirmation, isVoiceOrderConfirmation } from './voiceCheckout.js';
const buyer = { customerName: '동광설비', erpCustomerCode: '10' };
const cart = [{ cartId: 1, erpCode: '101', name: '엘보', selectedOption: '15A', quantity: 2 }];
const read = gate => { gate.transcript('model', '동광설비 엘보 15A 두 개입니다. 주문 접수할까요?'); gate.assistantFinished(); };

test('requires a new human confirmation after spoken review, not a model tool call or an earlier yes', () => {
    const gate = new VoiceCheckoutConfirmation();
    gate.transcript('user', '네');
    const id = gate.prepare(buyer, cart);
    assert.throws(() => gate.confirm(id, buyer, cart));
    read(gate);
    assert.throws(() => gate.confirm(id, buyer, cart));
    gate.transcript('user', '네, ');
    gate.transcript('user', '주문해 주세요.');
    gate.confirm(id, buyer, cart);
    assert.throws(() => gate.confirm(id, buyer, cart));
});

test('rejects corrections, unclear answers, stale reviews and changed cart/buyer', () => {
    for (const utterance of ['아니요', '네 그런데 하나 빼주세요', '잠깐만요', '주문하지 마세요', '네 취소', '음', '다른 상호로']) {
        const gate = new VoiceCheckoutConfirmation();
        const id = gate.prepare(buyer, cart); read(gate); gate.transcript('user', utterance);
        assert.throws(() => gate.confirm(id, buyer, cart));
    }
    for (const [otherBuyer, otherCart, time] of [
        [{ ...buyer, erpCustomerCode: '11' }, cart, 1000],
        [buyer, [{ ...cart[0], quantity: 3 }], 1000],
        [buyer, cart, 121001],
    ]) {
        const gate = new VoiceCheckoutConfirmation();
        const id = gate.prepare(buyer, cart, 1000); read(gate); gate.transcript('user', '주문해주세요');
        assert.throws(() => gate.confirm(id, otherBuyer, otherCart, time));
    }
});

test('does not accept yes before readback finishes, and resetting ends authorization', () => {
    const gate = new VoiceCheckoutConfirmation();
    const id = gate.prepare(buyer, cart);
    gate.transcript('model', '주문 내역입니다.');
    gate.transcript('user', '네');
    gate.assistantFinished();
    assert.throws(() => gate.confirm(id, buyer, cart));
    gate.reset();
    assert.throws(() => gate.confirm(id, buyer, cart));
    assert.throws(() => gate.prepare(null, cart));
    assert.throws(() => gate.prepare(buyer, []));
    assert.equal(isVoiceOrderConfirmation('네, 그대로 주문해 주세요.'), true);
    assert.equal(isVoiceOrderConfirmation('네 맞아요 주문해 주세요'), true);
    assert.equal(isVoiceOrderConfirmation('네 그렇게 해주세요'), true);
    assert.equal(isVoiceOrderConfirmation('맞습니다 주문해주세요'), true);
    assert.equal(isVoiceOrderConfirmation('응 맞아 주문해줘'), true);
    assert.equal(isVoiceOrderConfirmation('네 진행해주세요'), true);
    assert.equal(isVoiceOrderConfirmation('네 확인했습니다'), true);
    assert.equal(isVoiceOrderConfirmation('네 부탁드립니다'), true);
    assert.equal(isVoiceOrderConfirmation('이대로 주문해주세요'), true);
    assert.equal(isVoiceOrderConfirmation('네 맞아요'), true);
});


test('a greeting or partial user transcript cannot authorize an order', () => {
    const gate = new VoiceCheckoutConfirmation();
    const id = gate.prepare(buyer, cart);
    gate.transcript('model', '안녕하세요'); gate.assistantFinished();
    gate.transcript('user', '네');
    assert.throws(() => gate.confirm(id, buyer, cart));
    read(gate);
    gate.transcript('user', '네', false);
    assert.throws(() => gate.confirm(id, buyer, cart));
    gate.transcript('user', '', true);
    gate.confirm(id, buyer, cart);
});


test('clearing a draft requires a separate fresh confirmation and never reuses an order confirmation', () => {
    const gate = new VoiceCheckoutConfirmation('cart');
    gate.transcript('user', '네');
    const id = gate.prepare(null, cart);
    gate.transcript('model', '장바구니를 모두 비울까요?');gate.assistantFinished();
    assert.throws(() => gate.confirm(id, null, cart));
    gate.transcript('user', '아니요');assert.throws(() => gate.confirm(id, null, cart));
    gate.transcript('model', '장바구니를 모두 비울까요?');gate.assistantFinished();
    gate.transcript('user', '네 비워주세요');gate.confirm(id, null, cart);
    assert.throws(() => gate.confirm(id, null, cart));
});
