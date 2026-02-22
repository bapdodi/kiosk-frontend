import { getImageUrl } from '../utils/imageUtils';

const ProductCard = ({ product, onAddClick, onTagClick }) => {
    const FALLBACK_IMAGE = '/no-image.png';

    const isSoldOut = product.stock <= 0;

    return (
        <div className={`product-card ${isSoldOut ? 'sold-out' : ''}`} onClick={() => !isSoldOut && onAddClick(product)} style={{ cursor: isSoldOut ? 'not-allowed' : 'pointer', position: 'relative', opacity: isSoldOut ? 0.7 : 1 }}>
            {/* Sold Out Overlay */}
            {isSoldOut && (
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(255,255,255,0.6)', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '24px' }}>
                    <div style={{ background: '#ef4444', color: 'white', padding: '10px 24px', borderRadius: '12px', fontWeight: 900, fontSize: '1.2rem', transform: 'rotate(-5deg)', boxShadow: '0 4px 12px rgba(239, 68, 68, 0.4)' }}>
                        품절
                    </div>
                </div>
            )}

            <div style={{ position: 'relative' }}>
                {(!product.images || product.images.length === 0) ? (
                    <div className="no-image-placeholder">이미지 준비 중</div>
                ) : (
                    <img
                        src={getImageUrl(product.images[0])}
                        alt={product.name}
                        className="product-image"
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
                <div style={{ marginBottom: '10px', display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                    {product.hashtags && product.hashtags.map((tag) => (
                        <span
                            key={tag}
                            className="hashtag"
                            onClick={(e) => {
                                e.stopPropagation();
                                onTagClick(tag);
                            }}
                        >
                            {tag}
                        </span>
                    ))}
                </div>
                <div className="product-footer">
                    <span className="product-price">₩{product.price.toLocaleString()}~</span>
                    <button
                        className="add-btn"
                        style={isSoldOut ? { background: '#cbd5e1', color: '#64748b', cursor: 'not-allowed' } : {}}
                        onClick={(e) => {
                            e.stopPropagation();
                            if (!isSoldOut) {
                                onAddClick(product);
                            }
                        }}
                        disabled={isSoldOut}
                    >
                        {isSoldOut ? '품절' : '담기'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ProductCard;
