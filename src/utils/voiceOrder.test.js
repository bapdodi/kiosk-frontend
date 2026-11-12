import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveVoiceLine, searchVoiceProducts, validateVoiceQuantity, voiceOptions, publicVoiceCart, voiceOptionSelections } from './voiceOrder.js';

const product = { id: 10, name: '동 엘보', erpCode: '100', combinations: [
    { id: 20, name: '15A / 국산', kioskName: '15미리 국산', erpCode: '101' },
    { id: 21, name: '20A / 수입', erpCode: '102' },
    { id: 22, name: '25A / 국산', erpCode: '103', deleted: true },
], sizes: [{ name: '15A' }, { name: '20A' }], origins: [{ name: '국산' }, { name: '수입' }] };

test('voice only offers actual ERP combinations, including display aliases, never fabricated cross products', () => {
    const options = voiceOptions(product);
    assert.deepEqual(options.map(o => o.optionId), ['20', '21']);
    assert.equal(options[0].label, '15미리 국산');
    assert.equal(options[0].line.displayName, '15A / 국산');
});

test('rejects invented products/options, deleted options, and invalid quantities before cart changes', () => {
    for (const args of [['999','20',1], ['10','22',1], ['10','fake',1], ['10','20',0], ['10','20',1.5], ['10','20','2'], ['10','20',Infinity]]) {
        assert.throws(() => resolveVoiceLine([product], ...args));
    }
    assert.equal(resolveVoiceLine([product], '10', '20', 2).option.line.erpCode, '101');
    assert.throws(() => resolveVoiceLine([{ ...product, deletedAt: 'today' }], '10', '20', 1));
    assert.equal(validateVoiceQuantity(0, true), 0);
});

test('single and legacy products use the same option names and ERP codes as touch orders', () => {
    const single = { id: 1, name: '테이프', gyu: '1롤', erpCode: '5' };
    const option = voiceOptions(single)[0];
    assert.equal(option.line.displayName, '1롤');
    assert.equal(resolveVoiceLine([single], '1', option.optionId, 3).option.line.erpCode, '5');
});

test('catalog and cart tool results omit private prices and customer information', () => {
    assert.deepEqual(publicVoiceCart([{ cartId: 1, name: '엘보', selectedOption: '15A', quantity: 5, priceC: 999, price: 123, erpCode: '12' }]),
        [{ cartId: '1', name: '엘보', option: '15A', quantity: 5 }]);
    assert.equal(searchVoiceProducts([product, { ...product, id: 99, deletedAt: 'today' }], '엘보').length, 1);
    assert.deepEqual(searchVoiceProducts([product], ''), []);
});


test('voice option selection lights the exact existing UI buttons, never guesses split specifications', () => {
    assert.deepEqual(voiceOptionSelections(product, '20'), { '규격 (Size)': ['15A'], '원산지 (Origin)': ['국산'] });
    assert.throws(() => voiceOptionSelections(product, '22'));
    const singleGroup = { id: 1, combinations: [{ id: 2, name: '15A / 특수', erpCode: '1' }] };
    assert.deepEqual(Object.values(voiceOptionSelections(singleGroup, '2')), [['15A / 특수']]);
});
