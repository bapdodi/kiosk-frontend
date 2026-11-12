import './VoiceOrder.css';

/** The only added UI: one call toggle inside the original cart. */
export default function VoiceOrder({ control, compact = false }) {
    if (!control?.available) return null;
    const active = ['listening', 'finishing'].includes(control.state);
    const connecting = control.state === 'connecting';
    return <div className={`cart-voice-control${compact ? ' is-compact' : ''}`}>
        <button type="button" className="cart-voice-button" aria-pressed={active || connecting}
            title="통화 중 음성이 Google Gemini로 전송됩니다. 다시 누르면 종료합니다."
            onClick={control.toggle}>
            <span aria-hidden="true">{active ? '●' : '☎'}</span>{' '}
            {active ? 'AI 통화 종료' : connecting ? 'AI 연결 중 · 취소' : 'AI 통화'}
        </button>
        {control.error && <small className="cart-voice-error" role="alert">{control.error}</small>}
    </div>;
}
