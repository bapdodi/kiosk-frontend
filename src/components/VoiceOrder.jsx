import { useSyncExternalStore } from 'react';
import './VoiceOrder.css';

function VoiceInputDetails({ control }) {
    const input = useSyncExternalStore(control.input.subscribe, control.input.getSnapshot, control.input.getSnapshot);
    return <div className="voice-input-panel">
        <div className="voice-input-level" role="meter" aria-label="마이크 입력량" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(input.level * 100)}>
            <span style={{ width: `${Math.round(input.level * 100)}%` }} />
        </div>
        <small className="voice-input-signal" role="status">{input.level > 0.05 ? '마이크 소리가 들어오고 있어요' : '말씀하시면 입력 표시가 움직입니다'}</small>
        {input.devices.length > 0 ? <label className="voice-input-device">마이크
            <select value={input.deviceId} disabled={input.changing} onChange={event => control.selectMicrophone(event.target.value)}>
                <option value="">기본 마이크</option>
                {!input.devices.some(d => d.deviceId === input.deviceId) && input.deviceId && <option value={input.deviceId}>{input.label}</option>}
                {input.devices.filter(d => d.deviceId).map(d => <option key={d.deviceId} value={d.deviceId}>{d.label}</option>)}
            </select>
        </label> : <small>{input.label || '마이크 확인 중'}</small>}
        <div className="voice-input-actions">
            <button type="button" disabled={input.changing} onClick={() => control.selectMicrophone(input.deviceId)}>{input.changing ? '입력 연결 중…' : '입력 다시 연결'}</button>
            <button type="button" title="말을 마쳤는데 AI가 기다릴 때 누르세요" onClick={control.finishUtterance}>말 끝내기</button>
        </div>
        {input.warning && <small className="cart-voice-error" role="status">{input.warning}</small>}
        {input.heard && <small className="voice-input-heard">들은 말: {input.heard}</small>}
    </div>;
}

export default function VoiceOrder({ control, compact = false }) {
    if (!control?.available) return null;
    const active = ['listening', 'finishing'].includes(control.state);
    const listening = control.state === 'listening';
    const connecting = control.state === 'connecting';
    return <div className={`cart-voice-control${compact ? ' is-compact' : ''}`}>
        <button type="button" className="cart-voice-button" aria-pressed={active || connecting}
            title="통화 중 음성이 Google Gemini로 전송됩니다. 다시 누르면 종료합니다."
            onClick={control.toggle}>
            <span aria-hidden="true">{active ? '●' : '☎'}</span>{' '}
            {active ? 'AI 통화 종료' : connecting ? 'AI 연결 중 · 취소' : 'AI 통화'}
        </button>
        {listening && control.input && (compact
            ? <details className="voice-input-compact"><summary>마이크 확인</summary><VoiceInputDetails control={control} /></details>
            : <VoiceInputDetails control={control} />)}
        {control.error && <small className="cart-voice-error" role="alert">{control.error}</small>}
    </div>;
}
