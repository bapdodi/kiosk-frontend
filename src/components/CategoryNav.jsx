const CategoryNav = ({
    mainCategories,
    subCategories,
    detailCategories,
    activeMainCat,
    activeSubCat,
    activeDetailCat,
    onMainCatChange,
    onSubCatChange,
    onDetailCatChange,
    searchQuery,
    onSearchChange
}) => {
    return (
        <nav className="top-nav">
            <div className="header-top">
                <div className="logo">동관배관자제</div>
                <div className="search-container">
                    <span className="search-icon">🔍</span>
                    <input
                        type="text"
                        className="search-input"
                        placeholder="상품명 또는 해시태그 검색"
                        value={searchQuery}
                        onChange={(e) => onSearchChange(e.target.value)}
                    />
                </div>
            </div>

            <div className="categories-scroll" style={{ borderBottom: '1px solid #f1f3f5' }}>
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

                    {activeSubCat && detailCategories[activeSubCat] && (
                        <div className="categories-scroll sub-scroll" style={{ borderTop: '1px dashed #e2e8f0', paddingTop: '4px' }}>
                            <button
                                className={`category-tab detail-tab ${!activeDetailCat ? 'active' : ''}`}
                                onClick={() => onDetailCatChange(null)}
                            >
                                전체
                            </button>
                            {detailCategories[activeSubCat].map((detail) => (
                                <button
                                    key={detail.id}
                                    className={`category-tab detail-tab ${activeDetailCat === detail.id ? 'active' : ''}`}
                                    onClick={() => onDetailCatChange(detail.id)}
                                >
                                    {detail.name}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </nav>
    );
};

export default CategoryNav;
