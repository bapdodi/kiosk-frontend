import { toHangul } from './hangulKeyboard.js';

const CHOSUNG_LIST = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];

const EN_TO_KO_JAMO = {
  r: 'ㄱ', R: 'ㄲ', s: 'ㄴ', e: 'ㄷ', E: 'ㄸ', f: 'ㄹ', a: 'ㅁ', q: 'ㅂ', Q: 'ㅃ',
  t: 'ㅅ', T: 'ㅆ', d: 'ㅇ', w: 'ㅈ', W: 'ㅉ', c: 'ㅊ', z: 'ㅋ', x: 'ㅌ', v: 'ㅍ', g: 'ㅎ',
  k: 'ㅏ', o: 'ㅐ', O: 'ㅒ', i: 'ㅑ', j: 'ㅓ', p: 'ㅔ', P: 'ㅖ', u: 'ㅕ', h: 'ㅗ', y: 'ㅛ',
  n: 'ㅜ', b: 'ㅠ', m: 'ㅡ', l: 'ㅣ',
};

// 영문 알파벳의 한글 발음(예: PB → 피비, LED → 엘이디, PVC → 피브이씨)
const EN_LETTER_TO_KO_SOUND = {
  a: '에이', b: '비', c: '씨', d: '디', e: '이', f: '에프', g: '지',
  h: '에이치', i: '아이', j: '제이', k: '케이', l: '엘', m: '엠', n: '엔',
  o: '오', p: '피', q: '큐', r: '알', s: '에스', t: '티', u: '유',
  v: '브이', w: '더블유', x: '엑스', y: '와이', z: '지',
};

const EN_LETTER_ALT_SOUND = { v: '비', z: '제트' };

const expandEnglishToKoreanSound = (value, altMap = {}) => (value || '')
  .toLowerCase()
  .split('')
  .map((char) => altMap[char] ?? EN_LETTER_TO_KO_SOUND[char] ?? char)
  .join('');

export const normalizeSearchText = (value) => (value || '')
  .normalize('NFKC')
  .toLowerCase()
  .replace(/\s+/g, '');

export const getChosungChar = (char) => {
  if (!char) return '';
  const unicode = char.charCodeAt(0);

  if (unicode >= 0xAC00 && unicode <= 0xD7A3) {
    return CHOSUNG_LIST[Math.floor((unicode - 0xAC00) / 588)];
  }
  if (/[a-z]/i.test(char)) return char.toUpperCase();
  return '기타';
};

const getChosungText = (value) => (value || '')
  .split('')
  .map((char) => {
    const chosung = getChosungChar(char);
    return chosung === '기타' ? char : chosung;
  })
  .join('');

const convertEnglishKeyboardToKorean = (value) => (value || '')
  .split('')
  .map((char) => EN_TO_KO_JAMO[char] || char)
  .join('');

const allowedTypoCount = (length) => {
  if (length < 3) return 0;
  if (length <= 5) return 1;
  if (length <= 9) return 2;
  return 3;
};

// 문장 일부와 검색어 사이의 최소 오타 개수를 한 번의 행렬 계산으로 구한다.
// 삽입·삭제·교체와 인접한 두 글자의 순서가 바뀐 오타까지 처리한다.
// 검색 한 글자마다 상품 수 × 표기 조합만큼 불리므로 행렬 전체 대신 세 줄만 돌려 쓰고,
// cutoff 를 넘은 게 확정되면(연속 두 줄이 모두 cutoff 초과) 바로 Infinity 로 끝낸다.
const closestSubstringDistance = (text, query, maxDistance, cutoff = Number.POSITIVE_INFINITY) => {
  if (!text || !query || maxDistance === 0) return Number.POSITIVE_INFINITY;

  const columns = text.length + 1;
  // 문장의 앞부분은 무료로 건너뛰어 모든 부분 문자열을 동시에 비교한다(0번 줄은 전부 0).
  let twoBack = new Array(columns).fill(0);
  let previous = new Array(columns).fill(0);
  let current = new Array(columns).fill(0);
  let previousRowMin = 0;

  for (let row = 1; row <= query.length; row += 1) {
    current[0] = row;
    let rowMin = row;
    const queryChar = query[row - 1];
    for (let column = 1; column < columns; column += 1) {
      const substitutionCost = queryChar === text[column - 1] ? 0 : 1;
      let value = Math.min(
        previous[column] + 1,
        current[column - 1] + 1,
        previous[column - 1] + substitutionCost,
      );

      if (
        row > 1 && column > 1 &&
        queryChar === text[column - 2] &&
        query[row - 2] === text[column - 1]
      ) {
        value = Math.min(value, twoBack[column - 2] + 1);
      }
      current[column] = value;
      if (value < rowMin) rowMin = value;
    }

    // 다음 줄의 값은 바로 위 두 줄의 최솟값보다 작아질 수 없다.
    if (rowMin > cutoff && previousRowMin > cutoff) return Number.POSITIVE_INFINITY;
    previousRowMin = rowMin;
    [twoBack, previous, current] = [previous, current, twoBack];
  }

  let best = Number.POSITIVE_INFINITY;
  for (let column = 1; column < columns; column += 1) {
    if (previous[column] < best) best = previous[column];
  }
  return best;
};

// 같은 상품명·검색어의 변형(초성, 영문 발음, 자판 변환)을 키 입력마다 다시 만들지 않도록 기억한다.
// 상품·거래처 이름은 유한하지만, 혹시 모를 무한 증가를 막으려고 상한을 넘으면 비운다.
const VARIANT_CACHE_LIMIT = 50000;
const haystackCache = new Map();
const needleCache = new Map();

const remember = (cache, key, build) => {
  let value = cache.get(key);
  if (value === undefined) {
    if (cache.size >= VARIANT_CACHE_LIMIT) cache.clear();
    value = build(key);
    cache.set(key, value);
  }
  return value;
};

const buildHaystacks = (name) => [...new Set([
  normalizeSearchText(name),
  normalizeSearchText(getChosungText(name)),
  normalizeSearchText(expandEnglishToKoreanSound(name)),
  normalizeSearchText(expandEnglishToKoreanSound(name, EN_LETTER_ALT_SOUND)),
])];

const buildNeedles = (query) => {
  const normalizedQuery = normalizeSearchText(query);
  const keyboardQuery = normalizeSearchText(convertEnglishKeyboardToKorean(query));
  // 자모만 바꾼 것(초성 검색용)과 글자로 합친 것("xodms" → "태은") 둘 다 찾는다.
  const composedQuery = normalizeSearchText(toHangul(query));
  const queryPhonetic = normalizeSearchText(expandEnglishToKoreanSound(query));
  return {
    needles: [...new Set([normalizedQuery, keyboardQuery, composedQuery, queryPhonetic])],
    normalizedQuery,
  };
};

const getSearchVariants = (name, query) => ({
  haystacks: remember(haystackCache, name || '', buildHaystacks),
  ...remember(needleCache, query || '', buildNeedles),
});

// 검색어를 공백 단위 단어로 나눈다. 공백만 있으면 빈 배열이다.
const tokenizeQuery = (query) => (query || '')
  .split(/\s+/)
  .map((token) => token.trim())
  .filter((token) => normalizeSearchText(token) !== '');

// 단어 하나에 대한 점수다. 0은 정확/부분 일치, 1~3은 오타 개수, Infinity는 불일치다.
const getTokenMatchScore = (name, query) => {
  const { haystacks, needles, normalizedQuery } = getSearchVariants(name, query);
  if (!normalizedQuery) return 0;

  if (haystacks.some((text) => needles.some((needle) => needle && text.includes(needle)))) {
    return 0;
  }

  const maxDistance = allowedTypoCount(normalizedQuery.length);
  let best = Number.POSITIVE_INFINITY;

  for (const text of haystacks) {
    for (const needle of needles) {
      if (!needle) continue;
      const needleMaxDistance = Math.min(maxDistance, allowedTypoCount(needle.length));
      best = Math.min(best, closestSubstringDistance(text, needle, needleMaxDistance, Math.min(best, maxDistance)));
    }
  }

  return best <= maxDistance ? best : Number.POSITIVE_INFINITY;
};

// 놓친 단어 하나가 오타 penalty(최대 3)보다 항상 크도록 잡은 가중치다.
const MISSING_TOKEN_PENALTY = 10;

// 여러 단어로 검색하면 단어가 떨어져 있어도(예: "스텐 20A" → "스텐 파이프 20A") 찾고,
// 일부 단어만 겹쳐도 결과에 남긴다. 다만 모두 맞은 상품보다 뒤로 정렬된다.
// 0은 모든 단어가 정확히 일치, 클수록 오타·미일치가 많고, Infinity는 겹치는 단어가 없는 경우다.
export const getSearchMatchScore = (name, query) => {
  const tokens = tokenizeQuery(query);
  if (tokens.length === 0) return 0;

  const scores = tokens.map((token) => getTokenMatchScore(name, token));
  const matched = scores.filter((score) => Number.isFinite(score));
  if (matched.length === 0) return Number.POSITIVE_INFINITY;

  // 한 글자 단어는 거의 모든 상품에 걸리므로, 그것만 겹쳤을 때는 결과에 넣지 않는다.
  const hasMeaningfulMatch = tokens.some(
    (token, index) => Number.isFinite(scores[index]) && normalizeSearchText(token).length >= 2,
  );
  if (matched.length < tokens.length && !hasMeaningfulMatch) return Number.POSITIVE_INFINITY;

  const typoPenalty = matched.reduce((sum, score) => sum + score, 0) / matched.length;
  return (tokens.length - matched.length) * MISSING_TOKEN_PENALTY + typoPenalty;
};

export const matchesSearchText = (name, query) => Number.isFinite(getSearchMatchScore(name, query));

// 일반 검색이 실패했을 때만 사용한다. 한글 자모도 비교해 짧은 오타를 찾는다.
export const getSimilarProducts = (products, query, limit = 6) => {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return [];
  const similarity = (value) => {
    const name = normalizeSearchText(value);
    if (!name) return 0;
    return Math.max(...['NFC', 'NFD'].map((form) => {
      const needle = normalizedQuery.normalize(form);
      const text = name.normalize(form);
      const distance = closestSubstringDistance(text, needle, needle.length);
      return Math.max(0, 1 - distance / needle.length);
    }));
  };
  return products.map(product => ({
    product,
    score: Math.max(similarity(product.name), ...(product.hashtags || []).map(similarity)),
  }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || String(a.product.id).localeCompare(String(b.product.id)))
    .slice(0, limit)
    .map(({ product }) => product);
};
