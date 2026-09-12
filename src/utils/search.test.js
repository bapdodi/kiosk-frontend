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

test('여러 단어는 떨어져 있어도 모두 찾으면 가장 앞에 온다', () => {
  assert.equal(getSearchMatchScore('스텐 파이프 20A', '스텐 20A'), 0);
  assert.equal(getSearchMatchScore('스텐 파이프 20A', '20A 스텐'), 0);
});

test('일부 단어만 겹쳐도 결과에 남지만 뒤로 정렬된다', () => {
  const bothMatched = getSearchMatchScore('스텐 파이프 20A', '스텐 파이프');
  const oneMatched = getSearchMatchScore('스텐 엘보 20A', '스텐 파이프');

  assert.equal(matchesSearchText('스텐 엘보 20A', '스텐 파이프'), true);
  assert.ok(oneMatched > bothMatched);
});

test('겹치는 단어가 하나도 없으면 제외한다', () => {
  assert.equal(matchesSearchText('스텐 엘보 20A', '보온재 커버'), false);
});

test('한 글자 단어만 겹치는 경우는 제외한다', () => {
  assert.equal(matchesSearchText('PB 파이프', '보온재 b'), false);
});

test('여러 단어 중 하나에 오타가 있어도 찾는다', () => {
  assert.ok(Number.isFinite(getSearchMatchScore('스텐 파이프 20A', '스텐 파이브')));
  assert.ok(getSearchMatchScore('스텐 파이프 20A', '스텐 파이브') < 10);
});
