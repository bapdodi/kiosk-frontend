import { getImageUrl } from '../utils/imageUtils';

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
    // 카드는 사진과 이름만 보여 주고, 규격·수량은 모두 상세에서 정한다.
    // 목록에 규격과 버튼을 같이 얹으면 카드 높이가 제각각이라 눈이 걸렸다.

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
            </div>
        </div>
    );
};

export default ProductCard;
