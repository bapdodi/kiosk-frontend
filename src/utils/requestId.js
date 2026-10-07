/** HTTPS/localhost뿐 아니라 내부망 HTTP에서도 주문 재시도용 키를 만든다. */
export function createRequestId(cryptoProvider = globalThis.crypto) {
    if (typeof cryptoProvider.randomUUID === 'function') {
        return cryptoProvider.randomUUID();
    }
    // getRandomValues는 내부망 HTTP에서도 사용 가능하다. 128비트 난수 키.
    const bytes = cryptoProvider.getRandomValues(new Uint8Array(16));
    return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}
