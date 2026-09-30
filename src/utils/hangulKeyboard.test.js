import assert from 'node:assert/strict';
import test from 'node:test';
import { looksLikeMistypedHangul, toHangul } from './hangulKeyboard.js';
import { matchesSearchText } from './search.js';

test('영문 자판 입력을 한글로 바꾼다', () => {
  assert.equal(toHangul('dpfqh'), '엘보');
  assert.equal(toHangul('vlql'), '피비');
  assert.equal(toHangul('thzpt'), '소켓');
  assert.equal(toHangul('ekfr'), '닭');
  assert.equal(toHangul('rkqtdl'), '값이');
  assert.equal(toHangul('xodmsvmffkwk'), '태은플라자');
  assert.equal(toHangul('Tkd 15'), '쌍 15');
});

test('영문 자판으로 친 검색어만 감지한다', () => {
  assert.equal(looksLikeMistypedHangul('xodms'), true);
  assert.equal(looksLikeMistypedHangul('태은'), false);
  assert.equal(looksLikeMistypedHangul('15'), false);
});

test('상호를 영문 자판으로 쳐도 찾는다', () => {
  assert.equal(matchesSearchText('(주)태은플라자', 'xodms'), true);
  assert.equal(matchesSearchText('(주)태은플라자', 'xodmsvmffkwk'), true);
  assert.equal(matchesSearchText('(주)한국닛플', 'xodms'), false);
});
