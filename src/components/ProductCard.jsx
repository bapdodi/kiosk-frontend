import { getImageUrl } from '../utils/imageUtils';
import { countOptionValues, getSingleOptionLabel, needsOptionChoice } from '../utils/productOptions';

/**
 * 목록의 상품 카드.
 *
 * 단골은 아는 물건을 빠르게 여러 건 집고, 처음 온 손님은 사진·설명을 확인하고 싶어 한다.
 * 그래서 카드 하나가 두 갈래를 모두 연다.
 *   - 사진/이름을 누르면 → 상세 화면 (천천히 보기)
 *   - 어떤 상품이든 상세 화면으로 들어가 수량을 정하고 담는다. 규격이 하나뿐인 상품도
 *     같은 길을 쓴다(그 규격은 상세에서 이미 선택된 상태로 열린다). 카드에서만 바로 담기던
 *     시절에는 같은 상품이 화면마다 다르게 동작해 손님이 순서를 익히지 못했다.
 */
const ProductCard = ({ product, onOpenDetail }) => {
    const mustChoose = needsOptionChoice(product);
    const optionCount = countOptionValues(product);
    // 규격이 하나뿐이라 고를 것이 없어도, 무엇인지는 카드에서 보여 준다.
    // '기본' 은 규격 데이터가 없는 상품의 자리표시자라 목록에서는 감춘다(상세에서는 보여 준다).
    const label = mustChoose ? null : getSingleOptionLabel(product);
    const singleOption = label === '기본' ? null : label;

    // 카드 안 버튼 클릭이 카드 전체 클릭으로 번지지 않게 막는다.
    const stop = (e) => e.stopPropagation();

    return (
        <div className="product-card" onClick={() => onOpenDetail(product)}>
            <div className="product-card-thumb">
                {(!product.images || product.images.length === 0) ? (
                    <div className="no-image-placeholder">이미지 준비 중</div>
                ) : (
                    <img
                        src={getImageUrl(product.images[0])}
                        alt={product.name}
                        className="product-image"
                        loading="lazy"
                        decoding="async"
                        onError={(e) => {
                            e.target.style.display = 'none';
                            const parent = e.target.parentNode;
                            const placeholder = document.createElement('div');
                            placeholder.className = 'no-image-placeholder';
                            placeholder.innerText = '이미지 준비 중';
                            parent.appendChild(placeholder);
                        }}
                    />
                )}
            </div>

            <div className="product-info">
                <h3 className="product-name">{product.name}</h3>
                {singleOption && (
                    <div className="product-single-option">규격 {singleOption}</div>
                )}
            </div>

            <button
                type="button"
                className="card-choose-btn"
                onClick={(e) => { stop(e); onOpenDetail(product); }}
            >
                {mustChoose ? `규격 ${optionCount}종 선택 →` : '주문하기 →'}
            </button>
        </div>
    );
};

export default ProductCard;
