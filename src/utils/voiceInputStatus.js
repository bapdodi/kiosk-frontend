export const EMPTY_VOICE_INPUT = Object.freeze({ level: 0, devices: [], deviceId: '', label: '', warning: '', heard: '', changing: false });

/** Audio meters update only the small call controls, not the entire product catalog. */
export class VoiceInputStatus {
    constructor() { this.value = EMPTY_VOICE_INPUT; this.listeners = new Set(); }
    getSnapshot = () => this.value;
    subscribe = listener => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
    update = patch => {
        this.value = { ...this.value, ...patch };
        this.listeners.forEach(listener => listener());
    };
    reset = () => { this.value = EMPTY_VOICE_INPUT; this.listeners.forEach(listener => listener()); };
}

export function pcm16Level(buffer) {
    const samples = new DataView(buffer);
    if (!samples.byteLength) return 0;
    let sum = 0;
    const length = Math.floor(samples.byteLength / 2);
    for (let i = 0; i < length; i++) { const sample = samples.getInt16(i * 2, true) / 32768; sum += sample * sample; }
    return Math.sqrt(sum / length);
}

export function microphoneWarning({ now, startedAt, lastFrameAt, lastSignalAt, muted, ended, audioState }) {
    if (ended) return '마이크 연결이 끊겼습니다. 다른 마이크를 선택해 주세요.';
    if (muted) return '마이크 입력이 일시 중지됐습니다. 기기의 음소거 상태를 확인해 주세요.';
    if (audioState !== 'running') return '음성 처리가 멈췄습니다. 아래 입력 다시 연결을 눌러 주세요.';
    if (now - startedAt < 7000) return '';
    if (now - lastFrameAt > 3000) return '마이크 소리를 처리하지 못하고 있습니다. 입력 다시 연결을 눌러 주세요.';
    if (now - lastSignalAt > 7000) return '마이크에 소리가 들어오지 않습니다. 마이크를 바꾸거나 기기의 입력 음소거를 확인해 주세요.';
    return '';
}
