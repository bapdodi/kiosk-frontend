import test from 'node:test';
import assert from 'node:assert/strict';
import { pcm16Level, microphoneWarning, VoiceInputStatus, EMPTY_VOICE_INPUT } from './voiceInputStatus.js';

test('measures real signed little-endian PCM and silence without confusing transmitted frames with speech', () => {
    assert.equal(pcm16Level(new ArrayBuffer(3200)), 0);
    const data = new ArrayBuffer(8), view = new DataView(data);
    [16384, -16384, 16384, -16384].forEach((n, i) => view.setInt16(i * 2, n, true));
    assert.equal(pcm16Level(data), 0.5);
});

test('distinguishes absent microphone input, stalled capture, muted track, suspended audio and actual signal', () => {
    const healthy = { now: 12000, startedAt: 0, lastFrameAt: 11900, lastSignalAt: 11900, audioState: 'running', muted: false, ended: false };
    assert.equal(microphoneWarning(healthy), '');
    assert.match(microphoneWarning({ ...healthy, lastSignalAt: 0 }), /소리가 들어오지/);
    assert.match(microphoneWarning({ ...healthy, lastFrameAt: 0 }), /처리하지 못/);
    assert.match(microphoneWarning({ ...healthy, muted: true }), /일시 중지/);
    assert.match(microphoneWarning({ ...healthy, ended: true }), /연결이 끊/);
    assert.match(microphoneWarning({ ...healthy, audioState: 'suspended' }), /음성 처리가 멈/);
    assert.equal(microphoneWarning({ ...healthy, now: 100, lastSignalAt: 0 }), '');
});

test('input updates notify only subscribed call controls, preserve device info and clear on hangup', () => {
    const input = new VoiceInputStatus();let notifications = 0;
    const unsubscribe = input.subscribe(() => notifications++);
    input.update({ label: 'USB 마이크', deviceId: 'usb' });input.update({ level: 0.7 });
    assert.equal(input.getSnapshot().deviceId, 'usb');assert.equal(notifications, 2);
    input.reset();assert.equal(input.getSnapshot(), EMPTY_VOICE_INPUT);
    unsubscribe();input.update({ level: 0.1 });assert.equal(notifications, 3);
});
