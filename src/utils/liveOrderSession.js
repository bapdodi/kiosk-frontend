
/** Owns every microphone/socket/audio resource for one customer; close() is safe during startup. */
export class LiveOrderSession {
    constructor({ onState, onTranscript, onTool, onActivity, onError, onTurnComplete, onFinish }) {
        Object.assign(this, { onState, onTranscript, onTool, onActivity, onError, onTurnComplete, onFinish });
        this.closed = false;
        this.sources = new Set();
        this.seenCalls = new Map();
        this.cancelledCalls = new Set();
        this.nextAudio = 0;
        this.muted = false;
    }
    async start() {
        try {
            if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
                throw new Error('음성 주문은 HTTPS 또는 localhost에서 사용할 수 있습니다.');
            }
            this.onState('connecting');
            // Resume synchronously from the user's click, before any network await (Safari autoplay).
            this.audio = new AudioContext();
            await this.audio.resume();
            const stream = await navigator.mediaDevices.getUserMedia({ audio: {
                echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1,
            } });
            this.stream = stream;
            if (this.closed) return this.close();
            const res = await fetch('/api/order-voice/session', { method: 'POST', signal: (this.abort = new AbortController()).signal });
            const credentials = await res.json();
            if (!res.ok) throw new Error(credentials.error || 'AI 주문을 시작하지 못했습니다.');
            if (this.closed) return;
            await this.audio.audioWorklet.addModule('/voice-capture.worklet.js');
            if (this.closed) return;
            const { GoogleGenAI } = await import('@google/genai');
            if (this.closed) return;
            const client = new GoogleGenAI({ apiKey: credentials.token, httpOptions: { apiVersion: 'v1beta' } });
            this.startup = setTimeout(() => this.fail('AI 연결 시간이 초과되었습니다. 다시 시작해 주세요.'), 25000);
            const connection = await client.live.connect({
                model: credentials.model,
                config: { responseModalities: ['AUDIO'] },
                callbacks: {
                    onmessage: message => { if (!this.closed) this.receive(message); },
                    onerror: () => this.fail('AI 연결에 문제가 생겼습니다. 담은 상품은 유지됩니다.'),
                    onclose: () => { if (!this.closed) this.fail('AI 대화가 종료되었습니다. 다시 시작하거나 주문 내역을 확인해 주세요.'); },
                },
            });
            this.connection = connection;
            if (this.closed) return this.close();
            clearTimeout(this.startup);
            this.capture = new AudioWorkletNode(this.audio, 'voice-capture');
            this.input = this.audio.createMediaStreamSource(stream);
            this.silence = this.audio.createGain();
            this.silence.gain.value = 0;
            this.input.connect(this.capture).connect(this.silence).connect(this.audio.destination);
            this.capture.port.onmessage = ({ data }) => {
                if (this.closed || this.muted) return;
                // Send short chunks; socket errors end capture instead of retrying old audio.
                try {
                    let binary = '';
                    new Uint8Array(data).forEach(byte => { binary += String.fromCharCode(byte); });
                    connection.sendRealtimeInput({ audio: { data: btoa(binary), mimeType: 'audio/pcm;rate=16000' } });
                } catch { this.fail('음성 전송이 끊겼습니다. 다시 시작해 주세요.'); }
            };
            this.deadline = setTimeout(() => this.fail('AI 대화 시간이 끝났습니다. 주문 내역을 확인하거나 다시 시작해 주세요.'),
                Math.max(1000, new Date(credentials.expiresAt).getTime() - Date.now()));
            this.onState('listening');
            connection.sendClientContent({ turns: [{ role: 'user', parts: [{ text: 'AI 음성 주문을 시작합니다. get_screen으로 현재 화면을 확인하고 상호 선택이 없으면 상호 또는 비회원 여부부터 물어보세요. 기존 화면을 조작하며 주문 완료까지 도와주세요.' }] }], turnComplete: true });
        } catch (error) {
            if (!this.closed) this.fail(error.name === 'NotAllowedError'
                ? '마이크 사용을 허용한 뒤 다시 시작해 주세요.' : (error.message || 'AI에 연결하지 못했습니다.'));
        }
    }
    receive(message) {
        try {
            for (const id of message.toolCallCancellation?.ids || []) this.cancelledCalls.add(id);
            const content = message.serverContent;
            if (content?.interrupted) { clearTimeout(this.turnEnd); this.stopAudio(); }
            for (const [role, transcript] of [['user', content?.inputTranscription], ['model', content?.outputTranscription]]) {
                if (transcript?.text || transcript?.finished === true) {
                    this.onTranscript(role, transcript.text || '', transcript.finished);
                    this.onActivity();
                }
            }
            for (const part of content?.modelTurn?.parts || []) {
                if (part.inlineData?.mimeType?.startsWith('audio/pcm')) this.play(part.inlineData);
            }
            if (content?.turnComplete) {
                clearTimeout(this.turnEnd);
                this.turnEnd = setTimeout(() => {
                    if (this.closed) return;
                    this.onTurnComplete?.();
                    if (this.finishWhenTurnEnds) this.finish();
                }, Math.max(0, (this.nextAudio - this.audio.currentTime) * 1000) + 100);
            }
            if (message.toolCall) {
                // Serialize async tool batches while continuing to receive speech/cancellations.
                this.toolQueue = (this.toolQueue || Promise.resolve()).then(async () => {
                    const responses = [];
                    for (const call of message.toolCall.functionCalls || []) {
                        if (this.closed || this.cancelledCalls.has(call.id)) continue;
                        let pending = this.seenCalls.get(call.id);
                        if (!pending) {
                            pending = Promise.resolve().then(() => this.onTool(call.name, call.args || {}))
                                .catch(error => ({ error: error.message }));
                            if (call.id) this.seenCalls.set(call.id, pending);
                        }
                        const result = await pending;
                        if (this.closed || this.cancelledCalls.has(call.id)) continue;
                        responses.push({ id: call.id, name: call.name, response: { result } });
                        if (result?.submitted === true) {
                            this.beginCompletion();
                        }
                    }
                    if (!this.closed && responses.length) this.connection?.sendToolResponse({ functionResponses: responses });
                    this.onActivity();
                }).catch(() => this.fail('AI 응답을 처리하지 못했습니다. 주문 화면을 확인해 주세요.'));
            }
        } catch { this.fail('AI 응답을 처리하지 못했습니다. 담은 상품을 확인해 주세요.'); }
    }
    play(data) {
        const bytes = Uint8Array.from(atob(data.data), c => c.charCodeAt(0));
        const view = new DataView(bytes.buffer);
        const rate = Number(data.mimeType.match(/rate=(\d+)/)?.[1] || 24000);
        const buffer = this.audio.createBuffer(1, bytes.length / 2, rate);
        const samples = buffer.getChannelData(0);
        for (let i = 0; i < samples.length; i++) samples[i] = view.getInt16(i * 2, true) / 32768;
        const source = this.audio.createBufferSource();
        source.buffer = buffer;
        source.connect(this.audio.destination);
        this.sources.add(source);
        source.onended = () => { this.sources.delete(source); source.disconnect(); };
        this.nextAudio = Math.max(this.nextAudio, this.audio.currentTime);
        source.start(this.nextAudio);
        this.nextAudio += buffer.duration;
    }
    sendText(text) {
        if (!this.closed && this.connection) {
            this.connection.sendClientContent({ turns: [{ role: 'user', parts: [{ text }] }], turnComplete: true });
            this.onActivity();
        }
    }
    setMuted(muted) {
        this.muted = muted;
        this.stream?.getAudioTracks().forEach(track => { track.enabled = !muted; });
        if (muted) this.connection?.sendRealtimeInput({ audioStreamEnd: true });
    }
    stopAudio() {
        this.sources.forEach(source => { try { source.stop(); } catch { /* already ended */ } });
        this.sources.clear();
        this.nextAudio = 0;
    }
    beginCompletion() {
        if (this.finishWhenTurnEnds) return;
        this.finishWhenTurnEnds = true;
        clearTimeout(this.turnEnd);
        this.stream?.getTracks().forEach(track => track.stop());
        this.capture?.disconnect();
        this.onState('finishing');
        this.finishTimeout = setTimeout(() => this.finish(), 20000);
    }
    completeOrder(result) {
        if (this.closed || !this.connection) return;
        this.beginCompletion();
        this.connection.sendClientContent({ turns: [{ role: 'user', parts: [{ text:
            `손님이 화면에서 주문을 확정했고 실제 서버 접수가 완료되었습니다. 서버 결과: ${JSON.stringify(result)}. 주문번호를 안내하고 통화를 마무리하세요.` }] }], turnComplete: true });
    }
    finish() {
        if (this.closed) return;
        this.close();
        this.onState('idle');
        this.onFinish?.();
    }
    fail(message) {
        if (this.closed) return;
        this.close();
        this.onError(message);
        this.onState('error');
    }
    close() {
        this.closed = true;
        clearTimeout(this.startup);
        clearTimeout(this.deadline);
        clearTimeout(this.turnEnd);
        clearTimeout(this.finishTimeout);
        this.abort?.abort();
        this.stream?.getTracks().forEach(track => track.stop());
        this.capture?.disconnect();
        if (this.capture) this.capture.port.onmessage = null;
        this.input?.disconnect();
        this.silence?.disconnect();
        this.stopAudio();
        this.connection?.close();
        if (this.audio?.state !== 'closed') this.audio?.close().catch(() => {});
    }
}
