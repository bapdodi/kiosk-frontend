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
const closestSubstringDistance = (text, query, maxDistance) => {
  if (!text || !query || maxDistance === 0) return Number.POSITIVE_INFINITY;

  const rows = query.length + 1;
  const columns = text.length + 1;
  const distance = Array.from({ length: rows }, () => Array(columns).fill(0));

  for (let row = 0; row < rows; row += 1) distance[row][0] = row;
  // 문장의 앞부분은 무료로 건너뛰어 모든 부분 문자열을 동시에 비교한다.
  for (let column = 0; column < columns; column += 1) distance[0][column] = 0;

  for (let row = 1; row < rows; row += 1) {
    for (let column = 1; column < columns; column += 1) {
      const substitutionCost = query[row - 1] === text[column - 1] ? 0 : 1;
      distance[row][column] = Math.min(
        distance[row - 1][column] + 1,
        distance[row][column - 1] + 1,
        distance[row - 1][column - 1] + substitutionCost,
      );

      if (
        row > 1 && column > 1 &&
        query[row - 1] === text[column - 2] &&
        query[row - 2] === text[column - 1]
      ) {
        distance[row][column] = Math.min(distance[row][column], distance[row - 2][column - 2] + 1);
      }
    }
  }

  return Math.min(...distance[query.length].slice(1));
};

const getSearchVariants = (name, query) => {
  const normalizedName = normalizeSearchText(name);
  const normalizedQuery = normalizeSearchText(query);
  const keyboardQuery = normalizeSearchText(convertEnglishKeyboardToKorean(query));
  const queryPhonetic = normalizeSearchText(expandEnglishToKoreanSound(query));

  return {
    haystacks: [...new Set([
      normalizedName,
      normalizeSearchText(getChosungText(name)),
      normalizeSearchText(expandEnglishToKoreanSound(name)),
      normalizeSearchText(expandEnglishToKoreanSound(name, EN_LETTER_ALT_SOUND)),
    ])],
    needles: [...new Set([normalizedQuery, keyboardQuery, queryPhonetic])],
    normalizedQuery,
  };
};

// 0은 정확/부분 일치, 1~3은 오타 개수, Infinity는 불일치다.
export const getSearchMatchScore = (name, query) => {
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
      best = Math.min(best, closestSubstringDistance(text, needle, needleMaxDistance));
    }
  }

  return best <= maxDistance ? best : Number.POSITIVE_INFINITY;
};

export const matchesSearchText = (name, query) => Number.isFinite(getSearchMatchScore(name, query));
