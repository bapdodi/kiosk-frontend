import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { createRequestId } from './requestId.js';

test('HTTPS에서는 randomUUID를 사용한다', () => {
    assert.equal(createRequestId({ randomUUID: () => 'secure-request-id' }), 'secure-request-id');
});

test('내부망 HTTP처럼 randomUUID가 없어도 서로 다른 주문 키를 만든다', () => {
    const insecureCrypto = { getRandomValues: webcrypto.getRandomValues.bind(webcrypto) };
    const keys = Array.from({ length: 100 }, () => createRequestId(insecureCrypto));
    assert.equal(new Set(keys).size, keys.length);
    for (const key of keys) assert.match(key, /^[0-9a-f]{32}$/);
});
