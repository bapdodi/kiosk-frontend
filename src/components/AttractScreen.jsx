import './AttractScreen.css';

/**
 * 키오스크 대기 화면. 처음 켰을 때와 한동안 아무도 안 만졌을 때 보여준다.
 * 화면 아무 곳이나 누르면 주문 화면으로 들어간다.
 */
const STEPS = [
    { icon: '👆', label: '화면터치' },
    { icon: '🛒', label: '상품선택' },
    { icon: '🧾', label: '결제/주문확인' },
    { icon: '✅', label: '주문완료' },
];

const AttractScreen = ({ onStart }) => (
    <div className="attract-screen" onClick={onStart} role="button" aria-label="화면을 터치해 주문 시작">
        <div className="attract-main">
            <div className="attract-gauge" aria-hidden="true">
                <svg viewBox="0 0 64 64" width="96" height="96">
                    <circle cx="32" cy="32" r="26" fill="none" stroke="#999" strokeWidth="4" />
                    <path d="M12 44 A 22 22 0 0 1 52 44" fill="none" stroke="#e5202e" strokeWidth="4" strokeLinecap="round" />
                    <line x1="32" y1="36" x2="44" y2="24" stroke="#e5202e" strokeWidth="4" strokeLinecap="round" />
                    <circle cx="32" cy="36" r="4" fill="#e5202e" />
                </svg>
            </div>
            <p className="attract-sub">기 다 리 지 말 고</p>
            <h1 className="attract-title">
                <span className="attract-accent">간편</span>하게<br />주문
            </h1>
            <p className="attract-touch">화면을 터치해 주세요</p>
        </div>
        <ol className="attract-steps">
            {STEPS.map((step, i) => (
                <li key={step.label} className="attract-step">
                    {i > 0 && <span className="attract-arrow" aria-hidden="true">›</span>}
                    <span className="attract-step-icon" aria-hidden="true">{step.icon}</span>
                    <span className="attract-step-label">{step.label}</span>
                </li>
            ))}
        </ol>
    </div>
);

export default AttractScreen;
