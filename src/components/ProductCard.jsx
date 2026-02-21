const ProductCard = ({ product, onAddClick, onTagClick }) => {
    const FALLBACK_IMAGE = '/no-image.png';

    return (
        <div className="product-card" onClick={() => onAddClick(product)} style={{ cursor: 'pointer' }}>
            {(!product.images || product.images.length === 0) ? (
                <div className="no-image-placeholder">이미지 준비 중</div>
            ) : (
                <img
                    src={product.images[0]}
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
                        onClick={(e) => {
                            e.stopPropagation();
                            onAddClick(product);
                        }}
                    >
                        담기
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ProductCard;
