import { pcm16Level, microphoneWarning } from './voiceInputStatus';

/** Owns every microphone/socket/audio resource for one customer; close() is safe during startup. */
export class LiveOrderSession {
    constructor({ onState, onTranscript, onTool, onError, onTurnComplete, onFinish, onInputStatus }) {
        Object.assign(this, { onState, onTranscript, onTool, onError, onTurnComplete, onFinish, onInputStatus });
        this.closed = false;
        this.sources = new Set();
        this.seenCalls = new Map();
        this.cancelledCalls = new Set();
        this.nextAudio = 0;
        this.muted = false;
        this.logged = false;
        this.sessionLog = {
            customerName: '',
            status: 'connecting',
            transcript: [],
            tools: [],
            errorMessage: null,
            orderId: null,
        };
    }

    recordTranscript(role, text) {
        if (!text) return;
        const roleLabel = role === 'user' ? '손님' : 'AI';
        console.log(`[AI통화:${roleLabel}]`, text);
        const last = this.sessionLog.transcript[this.sessionLog.transcript.length - 1];
        if (last && last.startsWith(`[${roleLabel}]`)) {
            this.sessionLog.transcript[this.sessionLog.transcript.length - 1] = `${last} ${text}`;
        } else {
            this.sessionLog.transcript.push(`[${roleLabel}] ${text}`);
        }
    }

    recordTool(name, args, result) {
        console.log('[AI통화:도구실행]', name, args, '→', result);
        this.sessionLog.tools.push(`${name}(${JSON.stringify(args || {})}) → ${JSON.stringify(result || {})}`);
        if (result?.name) this.sessionLog.customerName = result.name;
        if (result?.customerName) this.sessionLog.customerName = result.customerName;
        if (result?.orderNumber) {
            this.sessionLog.orderId = Number(result.orderNumber) || null;
            this.sessionLog.status = 'ordered';
        }
    }

    flushLog() {
        if (this.logged) return;
        this.logged = true;
        try {
            const payload = {
                customerName: this.sessionLog.customerName || null,
                status: this.sessionLog.status,
                transcript: this.sessionLog.transcript.join('\n'),
                tools: this.sessionLog.tools.join('\n'),
                errorMessage: this.sessionLog.errorMessage,
                orderId: this.sessionLog.orderId,
            };
            fetch('/api/order-voice/log', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                keepalive: true,
            }).catch(() => {});
        } catch { /* ignore logging errors */ }
    }

    async start() {
        try {
            if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
                throw new Error('음성 주문은 HTTPS 또는 localhost에서 사용할 수 있습니다.');
            }
            this.onState('connecting');
            // Prefer 16kHz context so browser native high-quality sinc resampling is used when supported
            try {
                this.audio = new AudioContext({ sampleRate: 16000 });
            } catch {
                this.audio = new AudioContext();
            }
            await this.audio.resume();
            let preferred = '';
            try { preferred = localStorage.getItem('kioskVoiceInputDevice') || ''; } catch { /* storage unavailable */ }
            const stream = await navigator.mediaDevices.getUserMedia({ audio: {
                ...(preferred ? { deviceId: { ideal: preferred } } : {}),
                echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1,
            } });
            this.stream = stream;
            if (this.closed) return this.close();
            const res = await fetch('/api/order-voice/session', { method: 'POST', signal: (this.abort = new AbortController()).signal });
            const credentials = await res.json();
            if (!res.ok) throw new Error(credentials.error || 'AI 주문을 시작하지 못했습니다.');
            if (this.closed) return;
            await this.audio.resume();
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
            this.capture.onprocessorerror = () => this.fail('마이크 음성 처리에 문제가 생겼습니다. 통화를 다시 시작해 주세요.');
            this.input = this.audio.createMediaStreamSource(stream);
            this.silence = this.audio.createGain();
            this.silence.gain.value = 0;
            this.input.connect(this.capture).connect(this.silence).connect(this.audio.destination);
            this.capture.port.onmessage = ({ data }) => {
                if (this.closed || this.muted) return;
                const now = performance.now();
                this.lastFrameAt = now;
                const rms = pcm16Level(data);
                if (rms > 0.002) this.lastSignalAt = now;
                if (!this.lastMeterAt || now - this.lastMeterAt >= 250) {
                    this.lastMeterAt = now;
                    this.onInputStatus?.({ level: Math.min(1, Math.sqrt(rms) * 3), warning: this.inputWarning(now) });
                }
                // Send short chunks; socket errors end capture instead of retrying old audio.
                try {
                    let binary = '';
                    new Uint8Array(data).forEach(byte => { binary += String.fromCharCode(byte); });
                    connection.sendRealtimeInput({ audio: { data: btoa(binary), mimeType: 'audio/pcm;rate=16000' } });
                } catch { this.fail('음성 전송이 끊겼습니다. 다시 시작해 주세요.'); }
            };
            this.deadline = setTimeout(() => this.fail('AI 대화 시간이 끝났습니다. 주문 내역을 확인하거나 다시 시작해 주세요.'),
                Math.max(1000, new Date(credentials.expiresAt).getTime() - Date.now()));
            this.startedAt = this.lastFrameAt = this.lastSignalAt = performance.now();
            await this.describeMicrophone();
            if (this.closed) return;
            this.healthCheck = setInterval(() => {
                if (!this.closed && !this.finishWhenTurnEnds) this.onInputStatus?.({ warning: this.inputWarning(performance.now()) });
            }, 1000);
            this.deviceChange = () => this.describeMicrophone();
            navigator.mediaDevices.addEventListener?.('devicechange', this.deviceChange);
            this.sessionLog.status = 'listening';
            this.onState('listening');
            connection.sendClientContent({ turns: [{ role: 'user', parts: [{ text: 'AI 음성 주문을 시작합니다. get_screen으로 현재 화면을 확인하고 상호 선택이 없으면 상호 또는 비회원 여부부터 물어보세요. 기존 화면을 조작하며 주문 완료까지 도와주세요.' }] }], turnComplete: true });
        } catch (error) {
            if (!this.closed) this.fail(error.name === 'NotAllowedError'
                ? '마이크 사용을 허용한 뒤 다시 시작해 주세요.'
                : error.name === 'NotFoundError' ? '사용 가능한 마이크가 없습니다. 마이크를 연결하고 다시 시작해 주세요.'
                : error.name === 'NotReadableError' ? '다른 프로그램이 마이크를 사용 중이거나 기기에서 입력을 차단했습니다. 마이크 설정을 확인해 주세요.'
                : (error.message || 'AI에 연결하지 못했습니다.'));
        }
    }
    inputWarning(now) {
        if (this.deviceWarning) return this.deviceWarning;
        const track = this.stream?.getAudioTracks()[0];
        return microphoneWarning({ now, startedAt: this.startedAt, lastFrameAt: this.lastFrameAt,
            lastSignalAt: this.lastSignalAt, muted: track?.muted, ended: !track || track.readyState === 'ended', audioState: this.audio?.state });
    }
    async describeMicrophone() {
        if (this.closed) return;
        let devices = [];
        try { devices = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'audioinput')
            .map(d => ({ deviceId: d.deviceId, label: d.label || '마이크' })); } catch { /* optional device labels */ }
        if (this.closed) return;
        const track = this.stream?.getAudioTracks()[0];
        this.onInputStatus?.({ devices, deviceId: track?.getSettings().deviceId || '', label: track?.label || '기본 마이크' });
    }
    async switchMicrophone(deviceId) {
        if (this.closed || this.finishWhenTurnEnds) return;
        const request = (this.inputRequest || 0) + 1;
        this.inputRequest = request;
        this.deviceWarning = '';
        this.onInputStatus?.({ changing: true, warning: '' });
        let next;
        try {
            await this.audio.resume();
            next = await navigator.mediaDevices.getUserMedia({ audio: {
                ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
                echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1,
            } });
            if (this.closed || request !== this.inputRequest) { next.getTracks().forEach(t => t.stop()); return; }
            const source = this.audio.createMediaStreamSource(next);
            source.connect(this.capture);
            this.input.disconnect();
            const previous = this.stream;
            this.stream = next;
            this.input = source;
            previous.getTracks().forEach(t => t.stop());
            this.startedAt = this.lastFrameAt = this.lastSignalAt = performance.now();
            try {
                if (deviceId) localStorage.setItem('kioskVoiceInputDevice', deviceId);
                else localStorage.removeItem('kioskVoiceInputDevice');
            } catch { /* storage unavailable */ }
            this.onInputStatus?.({ changing: false, level: 0, warning: '' });
            await this.describeMicrophone();
        } catch {
            next?.getTracks().forEach(t => t.stop());
            if (!this.closed && request === this.inputRequest) {
                this.deviceWarning = '선택한 마이크를 열지 못했습니다. 연결 상태와 Chrome 마이크 권한을 확인해 주세요.';
                this.onInputStatus?.({ changing: false, warning: this.deviceWarning });
            }
        }
    }
    finishUtterance() {
        if (this.closed || this.finishWhenTurnEnds || !this.connection) return;
        this.audio.resume().catch(() => {});
        try { this.connection.sendRealtimeInput({ audioStreamEnd: true }); }
        catch { this.fail('음성 전송이 끊겼습니다. 통화를 다시 시작해 주세요.'); }
    }
    receive(message) {
        try {
            for (const id of message.toolCallCancellation?.ids || []) this.cancelledCalls.add(id);
            const content = message.serverContent;
            if (content?.interrupted) { clearTimeout(this.turnEnd); this.stopAudio(); }
            for (const [role, transcript] of [['user', content?.inputTranscription], ['model', content?.outputTranscription]]) {
                if (transcript?.text || transcript?.finished === true) {
                    const text = transcript.text || '';
                    this.recordTranscript(role, text);
                    this.onTranscript(role, text, transcript.finished ?? true);
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
                        this.recordTool(call.name, call.args, result);
                        responses.push({ id: call.id, name: call.name, response: { result } });
                        if (result?.submitted === true || result?.endCall === true) {
                            this.beginCompletion();
                        }
                    }
                    if (!this.closed && responses.length) this.connection?.sendToolResponse({ functionResponses: responses });
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
        clearInterval(this.healthCheck);
        this.onInputStatus?.({ level: 0, warning: '' });
        clearTimeout(this.turnEnd);
        this.stream?.getTracks().forEach(track => track.stop());
        this.capture?.disconnect();
        this.onState('finishing');
        this.finishTimeout = setTimeout(() => this.finish(), 20000);
    }
    completeOrder(result) {
        if (this.closed || !this.connection) return;
        this.sessionLog.status = 'ordered';
        if (result?.orderNumber) this.sessionLog.orderId = Number(result.orderNumber) || null;
        if (result?.customerName) this.sessionLog.customerName = result.customerName;
        this.beginCompletion();
        this.connection.sendClientContent({ turns: [{ role: 'user', parts: [{ text:
            `손님이 화면에서 주문을 확정했고 실제 서버 접수가 완료되었습니다. 서버 결과: ${JSON.stringify(result)}. 주문번호를 안내하고 통화를 마무리하세요.` }] }], turnComplete: true });
    }
    finish() {
        if (this.closed) return;
        if (this.sessionLog.status !== 'ordered') this.sessionLog.status = 'completed';
        this.flushLog();
        this.close();
        this.onState('idle');
        this.onFinish?.();
    }
    fail(message) {
        if (this.closed) return;
        console.error('[AI통화:오류]', message);
        this.sessionLog.errorMessage = message;
        this.sessionLog.status = 'error';
        this.flushLog();
        this.close();
        this.onError(message);
        this.onState('error');
    }
    close() {
        this.flushLog();
        this.closed = true;
        clearTimeout(this.startup);
        clearTimeout(this.deadline);
        clearTimeout(this.turnEnd);
        clearTimeout(this.finishTimeout);
        clearInterval(this.healthCheck);
        if (this.deviceChange) navigator.mediaDevices?.removeEventListener?.('devicechange', this.deviceChange);
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
