import assert from 'node:assert/strict';
import test from 'node:test';
import { getSearchMatchScore, matchesCustomerSearch, matchesSearchText } from './search.js';

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

test('검색 결과가 없는 짧은 한글 오타에 가까운 상품을 먼저 추천한다', async () => {
  const { getSimilarProducts } = await import('./search.js');
  const products = [{ id: 1, name: '보온재' }, { id: 2, name: '밸브' }];
  assert.equal(matchesSearchText('밸브', '밸바'), false);
  assert.equal(getSimilarProducts(products, '밸바')[0].id, 2);
});

test('유사 상품은 태그를 비교하고 개수를 제한하며 빈 검색어는 추천하지 않는다', async () => {
  const { getSimilarProducts } = await import('./search.js');
  const products = Array.from({ length: 10 }, (_, id) => ({ id, name: '제품', hashtags: ['밸브'] }));
  assert.equal(getSimilarProducts(products, '밸바').length, 6);
  assert.deepEqual(getSimilarProducts(products, '  '), []);
  assert.deepEqual(getSimilarProducts([], '밸바'), []);
});

test('상호명 초성 검색 시 앞에서부터(두 글자면 앞 두 글자) 일치하는 것만 필터링한다', () => {
  // 'ㅅㅇ' 및 'ㅅ ㅇ' 검색 시 앞 두 글자의 초성이 'ㅅ', 'ㅇ'인 거래처만 일치
  const positiveCases = [
    '서윤석사장님',
    '삼일벤드(주)',
    '상일인테리어(정발산)',
    '성원설비',
    '신우밸브판매(주)',
    '(주)삼우상사',
  ];

  // 중간에 'ㅅㅇ'이 나오는 경우는 제외되어야 함
  const negativeCases = [
    '고산에너지(가스업체)',
    '기산실업',
    '김자현사장님(욕실을 바꾸다)',
    '다산산업',
    '디자인스왑',
    '베스트디자인(우성인테리어)',
  ];

  for (const query of ['ㅅㅇ', 'ㅅ ㅇ']) {
    for (const name of positiveCases) {
      assert.equal(matchesCustomerSearch(name, query), true, `${name} should match ${query}`);
    }
    for (const name of negativeCases) {
      assert.equal(matchesCustomerSearch(name, query), false, `${name} should NOT match ${query}`);
    }
  }

  // 영문 자판 'td', 't d'
  assert.equal(matchesCustomerSearch('서윤석사장님', 'td'), true);
  assert.equal(matchesCustomerSearch('고산에너지(가스업체)', 'td'), false);

  // 초성 한 글자 'ㅅ'
  assert.equal(matchesCustomerSearch('서윤석사장님', 'ㅅ'), true);
  assert.equal(matchesCustomerSearch('고산에너지(가스업체)', 'ㅅ'), false);

  // 초성 세 글자 'ㅅㅇㅅ' -> 앞 세 글자만
  assert.equal(matchesCustomerSearch('서윤석사장님', 'ㅅㅇㅅ'), true);
  assert.equal(matchesCustomerSearch('신우밸브판매(주)', 'ㅅㅇㅅ'), false);

  // 음절 + 초성 '서ㅇ'
  assert.equal(matchesCustomerSearch('서윤석사장님', '서ㅇ'), true);
  assert.equal(matchesCustomerSearch('삼일벤드(주)', '서ㅇ'), false);

  // 초성이 아닌 일반 단어 검색(부분 일치) 지원
  assert.equal(matchesCustomerSearch('고산에너지(가스업체)', '에너지'), true);
  assert.equal(matchesCustomerSearch('(주)태은플라자', 'xodms'), true);
});
