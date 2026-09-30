// 한영키를 안 누르고 영문 자판으로 친 글자를 두벌식 한글로 되돌린다. ("dpfqh" → "엘보")
// 백엔드 HangulKeyboard.java 와 같은 규칙이다. 한쪽을 고치면 다른 쪽도 같이 고칠 것.

const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
const JUNG = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ';
const JONG = ' ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ';

const KEY_TO_JAMO = {
  r: 'ㄱ', R: 'ㄲ', s: 'ㄴ', e: 'ㄷ', E: 'ㄸ', f: 'ㄹ', a: 'ㅁ', q: 'ㅂ', Q: 'ㅃ',
  t: 'ㅅ', T: 'ㅆ', d: 'ㅇ', w: 'ㅈ', W: 'ㅉ', c: 'ㅊ', z: 'ㅋ', x: 'ㅌ', v: 'ㅍ', g: 'ㅎ',
  k: 'ㅏ', o: 'ㅐ', O: 'ㅒ', i: 'ㅑ', j: 'ㅓ', p: 'ㅔ', P: 'ㅖ', u: 'ㅕ', h: 'ㅗ', y: 'ㅛ',
  n: 'ㅜ', b: 'ㅠ', m: 'ㅡ', l: 'ㅣ',
};

const COMPOUND_VOWEL = {
  ㅗㅏ: 'ㅘ', ㅗㅐ: 'ㅙ', ㅗㅣ: 'ㅚ', ㅜㅓ: 'ㅝ', ㅜㅔ: 'ㅞ', ㅜㅣ: 'ㅟ', ㅡㅣ: 'ㅢ',
};
const COMPOUND_FINAL = {
  ㄱㅅ: 'ㄳ', ㄴㅈ: 'ㄵ', ㄴㅎ: 'ㄶ', ㄹㄱ: 'ㄺ', ㄹㅁ: 'ㄻ', ㄹㅂ: 'ㄼ',
  ㄹㅅ: 'ㄽ', ㄹㅌ: 'ㄾ', ㄹㅍ: 'ㄿ', ㄹㅎ: 'ㅀ', ㅂㅅ: 'ㅄ',
};

const jamoOf = (char) => {
  if (KEY_TO_JAMO[char]) return KEY_TO_JAMO[char];
  return KEY_TO_JAMO[char.toLowerCase()] || null;
};

const syllable = (cho, jung, jong) => {
  if (!cho && !jung) return '';
  if (!cho || !jung) return (cho || jung) + (jong || '');
  const ci = CHO.indexOf(cho);
  const ji = JUNG.indexOf(jung);
  const ki = jong ? JONG.indexOf(jong) : 0;
  if (ci < 0 || ji < 0 || ki < 0) return cho + jung + (jong || '');
  return String.fromCharCode(0xAC00 + (ci * 21 + ji) * 28 + ki);
};

/** 영문자가 있고 한글이 없는, 영문 자판으로 친 것처럼 보이는 문자열인가. */
export const looksLikeMistypedHangul = (text) => {
  if (!text) return false;
  let letter = false;
  for (const char of text) {
    if (char.charCodeAt(0) >= 0x1100) return false;
    if (/[a-z]/i.test(char)) letter = true;
  }
  return letter;
};

export const toHangul = (input) => {
  let out = '';
  let cho = null;
  let jung = null;
  let jong = null;
  const flush = (c, j, k) => { out += syllable(c, j, k); };

  for (const char of input || '') {
    const jamo = jamoOf(char);
    if (!jamo) {
      flush(cho, jung, jong);
      cho = null; jung = null; jong = null;
      out += char;
      continue;
    }
    const vowel = JUNG.includes(jamo);
    if (!vowel) {
      if (!cho) {
        cho = jamo;
      } else if (!jung) {
        flush(cho, null, null);
        cho = jamo;
      } else if (!jong) {
        if (JONG.includes(jamo)) {
          jong = jamo;
        } else {
          flush(cho, jung, null);
          cho = jamo; jung = null;
        }
      } else if (COMPOUND_FINAL[jong + jamo]) {
        jong = COMPOUND_FINAL[jong + jamo];
      } else {
        flush(cho, jung, jong);
        cho = jamo; jung = null; jong = null;
      }
    } else if (!cho) {
      out += jamo;
    } else if (!jung) {
      jung = jamo;
    } else if (!jong) {
      if (COMPOUND_VOWEL[jung + jamo]) {
        jung = COMPOUND_VOWEL[jung + jamo];
      } else {
        flush(cho, jung, null);
        out += jamo;
        cho = null; jung = null;
      }
    } else {
      // 받침이 다음 글자의 초성으로 넘어간다. 겹받침이면 뒤쪽만 넘어간다.
      let moved = jong;
      let stay = null;
      const split = Object.entries(COMPOUND_FINAL).find(([, value]) => value === jong);
      if (split) { stay = split[0][0]; moved = split[0][1]; }
      flush(cho, jung, stay);
      cho = moved; jung = jamo; jong = null;
    }
  }
  flush(cho, jung, jong);
  return out;
};
