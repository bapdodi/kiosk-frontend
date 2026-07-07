import { useEffect, useRef, useState } from 'react';

const CategoryNav = ({
    mainCategories,
    subCategories,
    activeMainCat,
    activeSubCat,
    onMainCatChange,
    onSubCatChange,
    searchQuery,
    onSearchChange
}) => {
    const recognitionRef = useRef(null);
    const [isListening, setIsListening] = useState(false);
    const [voiceSupported, setVoiceSupported] = useState(false);
    const [voiceError, setVoiceError] = useState('');

    const describeVoiceError = (code) => {
        switch (code) {
            case 'not-allowed':
            case 'service-not-allowed':
                return 'http 주소에서는 음성 인식이 차단됩니다. https 또는 localhost 로 접속해주세요.';
            case 'network':
                return '음성 인식 서버에 연결할 수 없습니다. 인터넷 연결을 확인해주세요.';
            case 'no-speech':
                return '음성이 감지되지 않았습니다. 다시 시도해주세요.';
            case 'audio-capture':
                return '마이크를 찾을 수 없습니다.';
            default:
                return `음성 인식 오류: ${code || '알 수 없음'}`;
        }
    };

    useEffect(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            setVoiceSupported(false);
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.lang = 'ko-KR';
        recognition.interimResults = true;
        recognition.continuous = false;
        recognition.maxAlternatives = 1;

        recognition.onresult = (event) => {
            const transcript = Array.from(event.results)
                .map((result) => result[0].transcript)
                .join('');
            onSearchChange(transcript);
        };

        recognition.onend = () => setIsListening(false);
        recognition.onerror = (event) => {
            console.error('SpeechRecognition error:', event.error, event);
            setVoiceError(describeVoiceError(event.error));
            setIsListening(false);
        };

        recognitionRef.current = recognition;
        setVoiceSupported(true);

        return () => {
            recognition.onresult = null;
            recognition.onend = null;
            recognition.onerror = null;
            try {
                recognition.stop();
            } catch {
                /* noop */
            }
        };
        // onSearchChange는 부모에서 setSearchQuery로 전달되어 안정적이므로 1회만 초기화한다.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const toggleVoiceSearch = () => {
        const recognition = recognitionRef.current;
        if (!recognition) return;

        if (isListening) {
            recognition.stop();
            setIsListening(false);
            return;
        }

        try {
            setVoiceError('');
            onSearchChange('');
            recognition.start();
            setIsListening(true);
        } catch (err) {
            // 이미 시작된 경우 등 InvalidStateError 방지
            console.error('SpeechRecognition start failed:', err);
            setVoiceError(describeVoiceError(err && err.name));
            setIsListening(false);
        }
    };

    return (
        <nav className="top-nav">
            <div className="header-top">
                <div className="logo">동광배관자재 010-7612-6524</div>
                <div className="search-container">
                    <span className="search-icon">🔍</span>
                    <input
                        type="text"
                        className="search-input"
                        placeholder={isListening ? '듣고 있어요… 말씀해주세요' : '초성 또는 상품명으로 검색해주셔요'}
                        value={searchQuery}
                        onChange={(e) => onSearchChange(e.target.value)}
                    />
                    {voiceSupported && (
                        <button
                            type="button"
                            className={`voice-search-btn ${isListening ? 'listening' : ''}`}
                            onClick={toggleVoiceSearch}
                            aria-label="음성으로 검색"
                            title="음성으로 검색"
                        >
                            🎤
                        </button>
                    )}
                    {voiceError && (
                        <div className="voice-error-toast" role="alert">
                            {voiceError}
                        </div>
                    )}
                </div>
            </div>

            <div className="categories-scroll" style={{ borderBottom: '1px solid #f1f3f5' }}>
                <button
                    className={`category-tab ${!activeMainCat ? 'active' : ''}`}
                    onClick={() => onMainCatChange(null)}
                >
                    전체
                </button>
                {mainCategories.map((cat) => (
                    <button
                        key={cat.id}
                        className={`category-tab ${activeMainCat === cat.id ? 'active' : ''}`}
                        onClick={() => onMainCatChange(cat.id)}
                    >
                        {cat.name}
                    </button>
                ))}
            </div>

            {activeMainCat && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', background: '#f8fafc', padding: '8px', borderRadius: '12px' }}>
                    <div className="categories-scroll sub-scroll">
                        <button
                            className={`category-tab sub-tab ${!activeSubCat ? 'active' : ''}`}
                            onClick={() => onSubCatChange(null)}
                        >
                            전체
                        </button>
                        {(subCategories[activeMainCat] || []).map((sub) => (
                            <button
                                key={sub.id}
                                className={`category-tab sub-tab ${activeSubCat === sub.id ? 'active' : ''}`}
                                onClick={() => onSubCatChange(sub.id)}
                            >
                                {sub.name}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </nav>
    );
};

export default CategoryNav;
