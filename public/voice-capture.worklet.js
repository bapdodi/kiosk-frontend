// Runs outside the UI thread. Streaming resampling preserves fractional positions across blocks.
class VoiceCapture extends AudioWorkletProcessor {
    constructor() {
        super();
        this.sum = 0;
        this.count = 0;
        this.phase = 0;
        this.chunk = [];
    }
    process(inputs) {
        const samples = inputs[0]?.[0];
        if (!samples) return true;
        const step = sampleRate / 16000;
        for (const sample of samples) {
            this.sum += sample;
            this.count++;
            this.phase++;
            if (this.phase >= step) {
                const value = Math.max(-1, Math.min(1, this.sum / this.count));
                this.chunk.push(value < 0 ? value * 32768 : value * 32767);
                this.phase -= step;
                this.sum = 0;
                this.count = 0;
            }
            if (this.chunk.length === 1600) {
                const buffer = new ArrayBuffer(3200);
                const view = new DataView(buffer);
                this.chunk.forEach((value, i) => view.setInt16(i * 2, value, true));
                this.port.postMessage(buffer, [buffer]);
                this.chunk = [];
            }
        }
        return true;
    }
}
registerProcessor('voice-capture', VoiceCapture);
