import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveVoiceDestination, resolveVoiceCategory, resolveVoiceImage } from './voiceNavigation.js';

test('back closes the visible cart before its underlying product, while explicit list navigation always leaves detail', () => {
    assert.equal(resolveVoiceDestination({ cartOpen: true, productOpen: true }, 'back'), 'product');
    assert.equal(resolveVoiceDestination({ productOpen: true }, 'back'), 'products');
    assert.equal(resolveVoiceDestination({ productOpen: true }, 'products'), 'products');
    assert.equal(resolveVoiceDestination({ reviewOpen: true }, 'back'), 'products');
    assert.equal(resolveVoiceDestination({}, 'back'), 'welcome');
    assert.throws(() => resolveVoiceDestination({}, 'admin'));
});

test('category selection preserves actual ID types and rejects IDs outside the selected parent', () => {
    const main = [{ id: 1, name: '배관' }, { id: 2, name: '공구' }];
    const sub = { 1: [{ id: 3, name: '엘보' }], 2: [{ id: 4, name: '장갑' }] };
    assert.deepEqual(resolveVoiceCategory(main, sub, '1', '3'), { main: 1, sub: 3 });
    assert.deepEqual(resolveVoiceCategory(main, sub, 'all'), { main: null, sub: null });
    assert.throws(() => resolveVoiceCategory(main, sub, '1', '4'));
    assert.throws(() => resolveVoiceCategory(main, sub, 'invented'));
});

test('photos wrap in either direction, use one-based spoken numbers and reject nonexistent photos', () => {
    assert.equal(resolveVoiceImage('next', undefined, 1, 2), 0);
    assert.equal(resolveVoiceImage('previous', undefined, 0, 2), 1);
    assert.equal(resolveVoiceImage('select', 2, 0, 2), 1);
    assert.throws(() => resolveVoiceImage('select', 3, 0, 2));
    assert.throws(() => resolveVoiceImage('next', undefined, 0, 0));
});
