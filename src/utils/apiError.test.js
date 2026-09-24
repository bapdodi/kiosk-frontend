import assert from 'node:assert/strict';
import test from 'node:test';
import { describeError, describeResponseError, SERVER_DOWN_MESSAGE } from './apiError.js';

const response = (status, body = '') => ({
    status,
    ok: status >= 200 && status < 300,
    text: async () => body,
});

test('nginx 가 내는 502/503/504 는 서버 다운으로 안내한다', async () => {
    for (const status of [502, 503, 504]) {
        assert.equal(await describeResponseError(response(status), '카테고리 실패'), SERVER_DOWN_MESSAGE);
    }
});

test('vite dev 프록시의 본문 없는 500 도 서버 다운으로 안내한다', async () => {
    assert.equal(await describeResponseError(response(500, ''), '카테고리 실패'), SERVER_DOWN_MESSAGE);
});

test('백엔드가 살아서 낸 500 은 서버 다운으로 오진하지 않는다', async () => {
    const msg = await describeResponseError(response(500, JSON.stringify({ error: 'ERP 접속 실패' })), '입고 실패');
    assert.equal(msg, 'ERP 접속 실패');
});

test('4xx 는 서버가 준 메시지를 그대로 보여준다', async () => {
    const msg = await describeResponseError(response(400, JSON.stringify({ error: '수량은 1 이상이어야 합니다' })), '입고 실패');
    assert.equal(msg, '수량은 1 이상이어야 합니다');
});

test('본문이 없으면 해당 API 의 실패 문구와 상태코드를 보여준다', async () => {
    assert.equal(await describeResponseError(response(404), '카테고리를 불러오는데 실패했습니다.'),
        '카테고리를 불러오는데 실패했습니다. (오류 404)');
});

test('fetch 가 던지는 TypeError 는 서버 다운으로 안내한다', () => {
    assert.equal(describeError(new TypeError('Failed to fetch'), '카테고리 실패'), SERVER_DOWN_MESSAGE);
});

test('그 밖의 예외는 원래 메시지를 살린다', () => {
    assert.equal(describeError(new Error('이미 취소된 전표입니다.'), '입고 실패'), '이미 취소된 전표입니다.');
});
