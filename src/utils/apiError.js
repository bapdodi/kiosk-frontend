/**
 * API 실패 원인을 사람이 읽을 문구로 바꾼다.
 *
 * 백엔드가 아예 꺼져 있어도 프런트는 그 사실을 직접 알 수 없다. 중간의 프록시가 대신 응답하기
 * 때문이다 - dev 의 vite 프록시는 본문 없는 500, 운영 nginx 는 502/503/504 를 내려준다.
 * 그래서 res.ok 만 보고 "카테고리를 불러오지 못했다"고 말하면, 실제로는 서버가 내려간 상황인데
 * 카테고리 데이터에 문제가 있는 것처럼 읽힌다. 원인을 갈라서 알려준다.
 */

const GATEWAY_STATUSES = [502, 503, 504];

const SERVER_DOWN_MESSAGE = '서버에 연결할 수 없습니다. 백엔드가 실행 중인지 확인해 주세요.';

/** fetch 자체가 던진 예외인가(네트워크 차단, DNS 실패, CORS 등). */
export const isNetworkError = (e) => e instanceof TypeError;

/**
 * 응답이 "백엔드에 닿지 못했다"는 뜻인가.
 * 502/503/504 는 게이트웨이가 백엔드에 못 닿은 것이고,
 * 본문이 빈 500 은 vite dev 프록시가 ECONNREFUSED 일 때 내는 응답이다.
 * (백엔드가 살아서 내는 500 은 우리 코드가 항상 본문을 실어 보낸다.)
 */
export const isBackendUnreachable = (res, body) =>
    GATEWAY_STATUSES.includes(res.status) || (res.status === 500 && !String(body || '').trim());

/**
 * 실패한 응답을 문구로. 서버가 안 잡히면 그 사실을, 아니면 서버가 준 메시지나 기본 문구를 쓴다.
 * @param {Response} res 실패한 응답
 * @param {string} fallback 이 API 고유의 실패 문구 (예: '카테고리를 불러오는데 실패했습니다.')
 */
export const describeResponseError = async (res, fallback) => {
    let body = '';
    try {
        body = await res.text();
    } catch {
        body = '';
    }

    if (isBackendUnreachable(res, body)) return SERVER_DOWN_MESSAGE;

    try {
        const parsed = JSON.parse(body);
        if (parsed?.error) return parsed.error;
        if (parsed?.message) return parsed.message;
    } catch {
        // JSON 이 아니면 본문을 그대로 쓴다.
    }
    const text = String(body || '').trim();
    if (text && text.length <= 200) return text;
    return `${fallback} (오류 ${res.status})`;
};

/** fetch 예외까지 포함해 문구로. try/catch 의 catch 에서 쓴다. */
export const describeError = (e, fallback) => {
    if (isNetworkError(e)) return SERVER_DOWN_MESSAGE;
    return e?.message || fallback;
};

/** GET 해서 JSON 을 돌려주고, 실패하면 원인이 담긴 Error 를 던진다. */
export const fetchJson = async (url, fallback) => {
    let res;
    try {
        res = await fetch(url);
    } catch (e) {
        throw new Error(describeError(e, fallback));
    }
    if (!res.ok) throw new Error(await describeResponseError(res, fallback));
    return res.json();
};

export { SERVER_DOWN_MESSAGE };
