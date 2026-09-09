import { getImageUrl } from '../utils/imageUtils';

const ProductCard = ({ product, onAddClick }) => {
    const FALLBACK_IMAGE = '/no-image.png';

    return (
        <div className="product-card" onClick={() => onAddClick(product)} style={{ position: 'relative', cursor: 'pointer' }}>
            <div style={{ position: 'relative' }}>
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
