import CheckoutShell from './CheckoutShell';
import { matchesSearchText } from '../utils/search';

/**
 * 주문 마무리 2단계: 상호 선택.
 *
 * 예전에는 App.jsx 안에 인라인으로 박혀 있던 팝업이다. 화면 전환으로 바꾸면서
 * 껍데기(팝업/화면)만 갈아끼울 수 있도록 떼어냈다. 안쪽 배치는 그대로다.
 */
const CustomerSelect = ({
    variant,
    customers,
    name,
    onNameChange,
    chosungTabs,
    selectedChosung,
    onChosungChange,
    getChosung,
    onSubmit,
    onCancel,
}) => {
    const customerSearchQuery = name.trim();
    const filteredCustomers = customers.filter(c => {
        const customerName = c.NAME?.trim() || '';
        if (customerSearchQuery) {
            return matchesSearchText(customerName, customerSearchQuery);
        }

        if (selectedChosung === 'A-Z') {
            const firstChar = customerName.charAt(0).toUpperCase();
            return firstChar >= 'A' && firstChar <= 'Z';
        }
        if (selectedChosung === '기타') {
            return getChosung(customerName) === '기타';
        }
        return getChosung(customerName) === selectedChosung;
    });

    const isValidName = customers.some(c => c.NAME?.trim() === name.trim());
    const defaultCustomer = customers.find(c => c.NAME?.trim() === '1');

    return (
        <CheckoutShell variant={variant}>
            <div style={{ padding: '20px', textAlign: 'center', borderBottom: '1px solid #f1f5f9' }}>
                <h3 style={{ margin: 0, fontWeight: 900, fontSize: '2.2rem' }}>주문 확인</h3>
                <p style={{ color: '#64748b', marginTop: '8px', fontSize: '1.35rem' }}>주문하실 상호를 선택하거나 검색해주세요.</p>
            </div>

            <div style={{ padding: '20px' }}>
                {/* 1번 고객 버튼 */}
                <button
                    onClick={() => {
                        if (!defaultCustomer) {
                            alert('1번 고객 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
                            return;
                        }
                        onSubmit(defaultCustomer.NAME, String(defaultCustomer.CODE));
                    }}
                    style={{
                        width: '100%',
                        padding: '22px',
                        marginBottom: '15px',
                        borderRadius: '12px',
                        border: '2px solid #10b981',
                        background: '#ecfdf5',
                        color: '#065f46',
                        fontWeight: '800',
                        cursor: 'pointer',
                        fontSize: '1.5rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '10px'
                    }}
                >
                    👤 비회원으로 주문하기
                </button>

                {/* 두 갈래(비회원 / 상호 선택)를 시각적으로 분리 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '18px 0' }}>
                    <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }} />
                    <span style={{ color: '#94a3b8', fontWeight: 800, fontSize: '1.2rem' }}>또는</span>
                    <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }} />
                </div>

                {/* 상호명 직접 검색 - 비회원 버튼 바로 아래에 강조 배치 */}
                <div style={{
                    marginBottom: '15px',
                    padding: '14px',
                    background: '#fff7ed',
                    border: '2px solid var(--accent-color)',
                    borderRadius: '14px',
                    boxShadow: '0 2px 8px rgba(255, 107, 0, 0.15)'
                }}>
                    <div style={{
                        fontWeight: 900,
                        fontSize: '1.55rem',
                        color: '#9a3412',
                        marginBottom: '10px',
                        textAlign: 'center'
                    }}>
                        🔍 상호명 직접 검색
                    </div>
                    <div style={{ position: 'relative' }}>
                        <input
                            className="admin-input-small"
                            placeholder="상호명 직접 검색"
                            value={name}
                            onChange={(e) => onNameChange(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && isValidName && onSubmit()}
                            style={{
                                padding: '20px',
                                fontSize: '1.5rem',
                                textAlign: 'center',
                                borderRadius: '12px',
                                border: `2px solid ${name.trim() === '' ? '#e2e8f0' : (isValidName ? '#10b981' : '#ef4444')}`,
                                width: '100%',
                                boxSizing: 'border-box'
                            }}
                        />
                        {name.trim() !== '' && (
                            <div style={{
                                position: 'absolute',
                                right: '15px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                fontSize: '1.6rem'
                            }}>
                                {isValidName ? '✅' : '❌'}
                            </div>
                        )}
                    </div>
                </div>

                {/* 초성 카테고리 탭 */}
                <div
                    className="chosung-scroll"
                    style={{
                        display: 'flex',
                        overflowX: 'auto',
                        gap: '8px',
                        paddingBottom: '12px',
                        marginBottom: '15px',
                        scrollbarWidth: 'none',
                        msOverflowStyle: 'none'
                    }}
                >
                    {[...chosungTabs, '기타'].map(tab => (
                        <button
                            key={tab}
                            onClick={() => onChosungChange(tab)}
                            style={{
                                padding: '11px 20px',
                                fontSize: '1.15rem',
                                borderRadius: '24px',
                                border: '1px solid #e2e8f0',
                                background: selectedChosung === tab ? 'var(--accent-color)' : 'white',
                                color: selectedChosung === tab ? 'white' : '#64748b',
                                fontWeight: 'bold',
                                whiteSpace: 'nowrap',
                                cursor: 'pointer',
                                flexShrink: 0
                            }}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                {/* 상호명 리스트 */}
                <div className="customer-list" style={{
                    overflowY: 'auto',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '10px',
                    marginBottom: '20px',
                    padding: '10px',
                    background: '#f8fafc',
                    borderRadius: '12px'
                }}>
                    {filteredCustomers.length > 0 ? filteredCustomers.map(c => (
                        <button
                            key={c.CODE}
                            onClick={() => onNameChange(c.NAME)}
                            style={{
                                padding: '18px 10px',
                                borderRadius: '10px',
                                border: name === c.NAME ? '2px solid var(--accent-color)' : '1px solid #e2e8f0',
                                background: name === c.NAME ? '#eff6ff' : 'white',
                                color: name === c.NAME ? 'var(--accent-color)' : '#334155',
                                fontSize: '1.35rem',
                                fontWeight: name === c.NAME ? 'bold' : 'normal',
                                cursor: 'pointer',
                                textAlign: 'center',
                                wordBreak: 'break-all'
                            }}
                        >
                            {c.NAME}
                        </button>
                    )) : (
                        <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '20px', color: '#94a3b8', fontSize: '1.1rem' }}>
                            해당하는 상호가 없습니다.
                        </div>
                    )}
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                    {/* 상호를 아직 안 고른 상태는 "못 누르는 상태"다.
                        예전에는 연두색이라 눌리는 것처럼 보였다. */}
                    <button
                        className="checkout-submit-btn"
                        onClick={() => onSubmit()}
                        disabled={!isValidName}
                    >
                        {isValidName ? '주문 완료하기' : '상호를 먼저 선택해주세요'}
                    </button>
                    <button className="checkout-cancel-btn" onClick={onCancel}>
                        취소
                    </button>
                </div>
            </div>
        </CheckoutShell>
    );
};

export default CustomerSelect;
