import { useEffect, useRef, useState } from 'react';
import { useIsMobile } from '../hooks/useIsMobile';
import { getBuyerDisplayName } from '../utils/buyer';

const CategoryNav = ({
    mainCategories,
    subCategories,
    activeMainCat,
    activeSubCat,
    onMainCatChange,
    onSubCatChange,
    searchQuery,
    onSearchChange,
    buyer,
    onChangeBuyer
}) => {
    const recognitionRef = useRef(null);
    const mainCatScrollRef = useRef(null);
    const [isListening, setIsListening] = useState(false);
    const [voiceSupported, setVoiceSupported] = useState(false);
    const [voiceError, setVoiceError] = useState('');
    // 폰에서는 안내 문구가 입력칸을 넘쳐 글자가 잘리므로 짧은 문구로 바꿔 준다.
    const isNarrow = useIsMobile();
    const buyerName = getBuyerDisplayName(buyer);

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

    const scrollMainCats = (dir) => {
        const el = mainCatScrollRef.current;
        if (!el) return;

        const pageWidth = el.clientWidth;
        if (!pageWidth) return;

        // 대분류는 3행 × 3열씩 표시한다. 마지막 열 수가 세 칸보다 적어도
        // 실제 scrollWidth가 아니라 페이지 수를 기준으로 움직여 이전 열을 겹치지 않게 한다.
        const rowCount = 3;
        const columnsPerPage = 3;
        const columnCount = Math.ceil(el.children.length / rowCount);
        const pageCount = Math.ceil(columnCount / columnsPerPage);
        const currentPage = Math.min(
            pageCount - 1,
            Math.max(0, Math.round(el.scrollLeft / pageWidth))
        );
        const nextPage = (currentPage + dir + pageCount) % pageCount;

        el.scrollTo({ left: nextPage * pageWidth, behavior: 'smooth' });
    };

    return (
        <nav className="top-nav">
            <div className="header-top">
                <div className="logo" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <div>
                        <span className="logo-name">동광배관자재</span>{' '}
                        <span className="logo-phone">010-7612-6524</span>
                    </div>
                    {buyer && (
                        <button
                            type="button"
                            className="header-buyer-pill"
                            onClick={onChangeBuyer}
                            title="주문 상호 변경"
                        >
                            <span className="header-buyer-label">주문 상호</span>
                            <span className="header-buyer-name">{buyerName}</span>
                            <span className="header-buyer-action">변경</span>
                        </button>
                    )}
                </div>
                <div className="search-container">
                    <span className="search-icon">🔍</span>
                    <input
                        type="text"
                        className="search-input"
                        placeholder={isListening
                            ? (isNarrow ? '듣고 있어요…' : '듣고 있어요… 말씀해주세요')
                            : (isNarrow ? '상품명·초성 검색' : '초성·상품명 검색 (오타도 괜찮아요)')}
                        value={searchQuery}
                        onChange={(e) => onSearchChange(e.target.value)}
                    />
                    {searchQuery && (
                        <button
                            type="button"
                            className="search-clear-btn"
                            onClick={() => onSearchChange('')}
                            aria-label="검색어 지우기"
                        >
                            ×
                        </button>
                    )}
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

            <label className="mobile-main-category-picker">
                <span>대분류</span>
                <select
                    value={activeMainCat || ''}
                    onChange={(e) => onMainCatChange(e.target.value || null)}
                    aria-label="대분류 선택"
                >
                    <option value="">전체 상품</option>
                    {mainCategories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                            {cat.name}
                        </option>
                    ))}
                </select>
            </label>

            {/* 키오스크·PC: 두 줄로 놓고 양옆 화살표로 넘긴다. 폰은 위의 대분류 선택창을 쓴다. */}
            <div className="main-cat-row">
                <button type="button" className="main-cat-arrow" onClick={() => scrollMainCats(-1)} aria-label="이전 분류">◀</button>
                <div ref={mainCatScrollRef} className="categories-scroll main-categories" style={{ borderBottom: '1px solid #f1f3f5' }}>
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
                <button type="button" className="main-cat-arrow" onClick={() => scrollMainCats(1)} aria-label="다음 분류">▶</button>
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
