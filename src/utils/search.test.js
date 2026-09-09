import assert from 'node:assert/strict';
import test from 'node:test';
import { getSearchMatchScore, matchesSearchText } from './search.js';

test('한 글자 교체·삭제·순서 오타를 허용한다', () => {
  assert.equal(matchesSearchText('스텐 파이프 20A', '파이브'), true);
  assert.equal(matchesSearchText('스텐 파이프 20A', '스텐파프'), true);
  assert.equal(matchesSearchText('스텐 파이프 20A', '스텐이파프'), true);
});

test('짧은 검색어와 관계없는 단어는 너무 넓게 매칭하지 않는다', () => {
  assert.equal(matchesSearchText('밸브', '밸바'), false);
  assert.equal(matchesSearchText('스텐 파이프', '보온재'), false);
});

test('기존 초성·영문 발음 검색을 유지한다', () => {
  assert.equal(matchesSearchText('파이프 벨브', 'ㅍㅇㅍ'), true);
  assert.equal(matchesSearchText('PB파이프', '피비'), true);
});

test('정확 일치가 오타 일치보다 먼저 정렬될 점수를 받는다', () => {
  assert.equal(getSearchMatchScore('파이브', '파이브'), 0);
  assert.equal(getSearchMatchScore('파이프', '파이브'), 1);
});
