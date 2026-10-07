const SPOTS = [
    { x: 78, y: 178, r: 14 },
    { x: 131, y: 121, r: 15 },
    { x: 194, y: 80, r: 15 },
    { x: 264, y: 111, r: 15 },
    { x: 339, y: 258, r: 15 },
];

export default function OrderStampGlove({ order }) {
    const count = order?.stampCount;
    if (!Number.isInteger(count) || count < 1 || count > 5) return null;
    const spot = SPOTS[count - 1];
    return (
        <section className="order-stamp" aria-label={`주문 도장 ${count}개 적립, 5개 중 ${count}개`}>
            <div className="order-stamp-heading">
                <span className="order-stamp-eyebrow">도장 +1</span>
                <h4>{order.stampRewardEarned ? '다섯 손가락 완성!' : '도장 하나 적립했어요!'}</h4>
                <div className="order-stamp-count"><b>{count}</b><span> / 5</span></div>
            </div>
            <div className="order-stamp-art">
            <svg className="order-stamp-glove" viewBox="0 0 400 520" aria-hidden="true">
                <image href="/images/stamp-glove.png" x="0" y="35" width="400" height="480" />
                {SPOTS.map((s, index) => (
                    <g key={index} transform={`translate(${s.x} ${s.y})`}>
                        {index >= count ? (
                            <circle r={s.r} className="order-stamp-slot" />
                        ) : (
                            <g className={index === count - 1 ? 'order-stamp-mark order-stamp-new' : 'order-stamp-mark'}>
                                <circle r={s.r} fill="#fffdf5" />
                                <circle r={s.r - 2.5} fill="none" stroke="#1e3a8a" strokeWidth="2.2" />
                                <text y={s.r * 0.36} textAnchor="middle" fontSize={s.r * 1.05} fontWeight="900" fill="#1e3a8a">★</text>
                            </g>
                        )}
                    </g>
                ))}
                <g transform={`translate(${spot.x} ${spot.y})`}>
                    <circle className="order-stamp-ring" r={spot.r} />
                    <g className="order-stamp-press">
                        <rect x={-spot.r} y="-22" width={spot.r * 2} height="22" rx="4" fill="#334155" />
                        <rect x={-spot.r + 3} y="-24" width={spot.r * 2 - 6} height="6" rx="3" fill="#1e3a8a" />
                        <rect x="-8" y="-62" width="16" height="40" rx="7" fill="#b45309" />
                        <ellipse cy="-64" rx="15" ry="8" fill="#d97706" />
                    </g>
                </g>
            </svg>
            </div>
            <div className="order-stamp-info" aria-live="polite">
                {order.stampRewardEarned ? (
                    <div className="order-stamp-reward">
                        <strong>🎁 빨간 코팅 목장갑을 받으세요</strong>
                    </div>
                ) : (
                    <p>앞으로 <b>{5 - count}번</b> 더 주문하면 빨간 코팅 목장갑을 드립니다.</p>
                )}
            </div>
        </section>
    );
}
