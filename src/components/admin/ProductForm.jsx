
import { useEffect, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { getImageUrl, uploadImage } from '../../utils/imageUtils';
import { COMBINATION_GROUP } from '../../utils/optionConstants';
import CategoryEditor from './CategoryEditor';

// 원산지 카테고리(네이버 originAreaInfo.originAreaCode).
// code 는 네이버가 요구하는 실제 원산지 코드다. 국산=00 은 라이브 스토어에서 검증됨
// (2026-07-04 기준 등록된 네이버 상품 31개 전부 국산/00, 수입산 없음).
// 수입산을 추가하려면: 스마트스토어센터에서 상품 원산지를 "수입산 > 해당 국가"로 고른 뒤
// 표시되는 코드를 확인해 아래에 { label:'중국산', code:'<확인한코드>' } 형태로 넣으면
// 즉시 드롭다운 카테고리로 노출된다. (네이버는 원산지 코드 조회 API를 제공하지 않음.)
// 목록에 없는 코드는 언제든 '직접 입력'으로 넣을 수 있다.
const ORIGIN_OPTIONS = [
    { label: '기본값 사용 (미지정)', code: '' },
    { label: '국산', code: '00' },
    // { label: '중국산', code: '' },  // ← 판매자센터에서 코드 확인 후 채워서 주석 해제
];

const ProductForm = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const {
        products, setProducts,
        mainCategories, setMainCategories,
        subCategories, setSubCategories
    } = useOutletContext();
    const isEditMode = Boolean(id);

    const [productData, setProductData] = useState({
        name: '',
        description: '',
        categories: [],
        price: 0,
        hashtags: '',
        images: []
    });

    const [optionGroups, setOptionGroups] = useState([]);
    const [combinations, setCombinations] = useState([]);
    // 옵션값 단위 사진. API 와 동일한 평면 배열: [{ groupName, optionValue, imageUrl }]
    const [optionImages, setOptionImages] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    // 어떤 옵션 행에서 "대표 이미지에서 선택" 패널이 열려 있는지: `${groupName}::${value}` 또는 null
    const [imgPickerKey, setImgPickerKey] = useState(null);
    // 원산지 "직접 입력(코드)" 모드가 사용자 조작으로 열려 있는지
    const [originCustomOpen, setOriginCustomOpen] = useState(false);

    useEffect(() => {
        if (isEditMode) {
            const product = products.find(p => p.id === parseInt(id));
            if (product) {
                setProductData(prev => ({
                    ...prev,
                    ...product,
                    categories: product.categories || [],
                    hashtags: product.hashtags ? product.hashtags.join(', ') : '',
                    images: product.images || (product.image ? [product.image] : [])
                }));
                const combos = product.combinations || [];
                // 활성 조합을 앞에, 삭제(소프트삭제)된 조합을 뒤에 모아 둔다.
                setCombinations([
                    ...combos.filter(c => !c.deleted),
                    ...combos.filter(c => c.deleted)
                ]);
                setOptionGroups(product.optionGroups?.map(g => ({
                    name: g.name,
                    values: g.values ? g.values.join(', ') : ''
                })) || []);
                setOptionImages(product.optionImages || []);
            }
        }
    }, [isEditMode, id, products]);

    useEffect(() => {
        // 신규 상품 등록 시, 카테고리가 비어 있으면 첫 번째 (대분류+중분류)로 한 개 기본 시드.
        if (!isEditMode && mainCategories.length > 0) {
            setProductData(prev => {
                if (prev.categories && prev.categories.length > 0) return prev;
                const mId = mainCategories[0].id;
                const sId = subCategories[mId]?.[0]?.id || '';
                return { ...prev, categories: [{ mainCategory: mId, subCategory: sId }] };
            });
        }
    }, [mainCategories, subCategories, isEditMode]);


    const handleImageUpload = async (eOrFiles) => {
        let files = [];
        if (eOrFiles.target && eOrFiles.target.files) {
            files = Array.from(eOrFiles.target.files);
        } else if (eOrFiles instanceof FileList || Array.isArray(eOrFiles)) {
            files = Array.from(eOrFiles);
        }

        if (files.length === 0) return;

        setIsLoading(true);
        const uploadedUrls = [];
        for (const file of files) {
            try {
                const data = await uploadImage(file);
                uploadedUrls.push(data.fileUrl);
            } catch (err) {
                console.error("Upload failed", err);
            }
        }
        setProductData(prev => ({
            ...prev,
            images: [...prev.images, ...uploadedUrls]
        }));
        setIsLoading(false);
    };

    const removeImage = (index) => {
        setProductData(prev => ({
            ...prev,
            images: prev.images.filter((_, i) => i !== index)
        }));
    };

    const getOptionImagesFor = (groupName, optionValue) =>
        optionImages.filter(oi => oi.groupName === groupName && oi.optionValue === optionValue);

    const handleOptionImageUpload = async (groupName, optionValue, eOrFiles) => {
        let files = [];
        if (eOrFiles.target && eOrFiles.target.files) {
            files = Array.from(eOrFiles.target.files);
        } else if (eOrFiles instanceof FileList || Array.isArray(eOrFiles)) {
            files = Array.from(eOrFiles);
        }
        if (files.length === 0) return;

        setIsLoading(true);
        const uploaded = [];
        for (const file of files) {
            try {
                const data = await uploadImage(file);
                uploaded.push({ groupName, optionValue, imageUrl: data.fileUrl });
            } catch (err) {
                console.error("Option image upload failed", err);
            }
        }
        setOptionImages(prev => [...prev, ...uploaded]);
        setIsLoading(false);
    };

    const removeOptionImage = (groupName, optionValue, imageUrl) => {
        setOptionImages(prev => prev.filter(oi =>
            !(oi.groupName === groupName && oi.optionValue === optionValue && oi.imageUrl === imageUrl)
        ));
    };

    // 대표 이미지(productData.images)에 이미 올라온 사진을 업로드 없이 옵션 사진으로 추가한다. 중복은 무시.
    const addOptionImageFromMain = (groupName, optionValue, imageUrl) => {
        setOptionImages(prev =>
            prev.some(oi => oi.groupName === groupName && oi.optionValue === optionValue && oi.imageUrl === imageUrl)
                ? prev
                : [...prev, { groupName, optionValue, imageUrl }]
        );
    };

    // 옵션값 한 행의 사진 편집기(업로드 + 대표에서 선택 + 등록된 사진 목록). 옵션그룹/조합 양쪽에서 공용으로 쓴다.
    const renderOptionImageEditor = (groupName, value, inputId) => {
        const imgs = getOptionImagesFor(groupName, value);
        const rowKey = `${groupName}::${value}`;
        const isPicking = imgPickerKey === rowKey;
        const mainImages = productData.images || [];
        return (
            <>
                <div className="img-horizontal-container">
                    <input
                        type="file"
                        id={inputId}
                        multiple
                        hidden
                        onChange={(e) => handleOptionImageUpload(groupName, value, e)}
                    />
                    <label htmlFor={inputId} className="img-add-square">
                        ＋ 사진 추가
                    </label>
                    {mainImages.length > 0 && (
                        <button
                            type="button"
                            className={`img-add-square as-btn ${isPicking ? 'active' : ''}`}
                            onClick={() => setImgPickerKey(isPicking ? null : rowKey)}
                        >
                            🖼️ 대표에서<br />선택
                        </button>
                    )}
                    <div className="img-preview-row">
                        {imgs.map((oi, i) => (
                            <div key={i} className="img-preview-thumb">
                                <img src={getImageUrl(oi.imageUrl)} alt={value} />
                                <button
                                    type="button"
                                    onClick={() => removeOptionImage(groupName, value, oi.imageUrl)}
                                    className="img-del-mini"
                                >
                                    ×
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
                {isPicking && (
                    <div className="existing-img-picker">
                        {mainImages.length === 0 ? (
                            <span className="picker-empty">대표 이미지가 없습니다. 위 ‘이미지 관리’에서 먼저 추가하세요.</span>
                        ) : (
                            mainImages.map((url, i) => {
                                const already = imgs.some(oi => oi.imageUrl === url);
                                return (
                                    <button
                                        key={i}
                                        type="button"
                                        className={`picker-thumb ${already ? 'picked' : ''}`}
                                        onClick={() => !already && addOptionImageFromMain(groupName, value, url)}
                                        title={already ? '이미 추가됨' : '이 사진을 옵션에 추가'}
                                    >
                                        <img src={getImageUrl(url)} alt="대표" />
                                        {already && <span className="picker-check">✓</span>}
                                    </button>
                                );
                            })
                        )}
                    </div>
                )}
            </>
        );
    };

    // "옵션값" 문자열(쉼표 구분)을 배열로 파싱
    const parseValues = (valuesStr) =>
        (valuesStr || '').split(',').map(v => v.trim()).filter(Boolean);

    const handleDragOver = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            handleImageUpload(files);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);

        // 현재 옵션 그룹에 존재하는 (그룹명, 값) 쌍만 남겨 고아 옵션 사진을 정리한다.
        const validPairs = new Set();
        optionGroups
            .filter(g => g.name.trim() && g.values.trim())
            .forEach(g => parseValues(g.values).forEach(v => validPairs.add(`${g.name.trim()} ${v}`)));
        // 조합(combinations) 기반 옵션 사진도 보존한다. 소프트삭제된 조합도 포함해 복구 시 사진이 살아있게 한다.
        combinations.forEach(c => validPairs.add(`${COMBINATION_GROUP} ${c.name}`));
        const cleanedOptionImages = optionImages.filter(oi =>
            validPairs.has(`${oi.groupName} ${oi.optionValue}`)
        );

        const payload = {
            ...productData,
            optionImages: cleanedOptionImages,
            price: parseInt(productData.price || 0),
            hashtags: typeof productData.hashtags === 'string'
                ? productData.hashtags.split(',').map(tag => {
                    const t = tag.trim();
                    return t.startsWith('#') ? t : `#${t}`;
                }).filter(t => t !== '#')
                : productData.hashtags,
            isComplexOptions: combinations.filter(c => !c.deleted).length > 0,
            optionGroups: optionGroups.filter(g => g.name.trim() && g.values.trim()).map(g => ({
                name: g.name.trim(),
                values: g.values.split(',').map(v => v.trim()).filter(v => v)
            })),
            combinations: combinations
        };

        const method = isEditMode ? 'PUT' : 'POST';
        const url = isEditMode ? `/api/products/admin/${id}` : '/api/products/admin';

        try {
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                const savedProduct = await res.json();
                if (isEditMode) {
                    setProducts(products.map(p => p.id === savedProduct.id ? savedProduct : p));
                } else {
                    setProducts([...products, savedProduct]);
                }
                navigate('/admin/products');
            } else {
                alert('저장에 실패했습니다.');
            }
        } catch (err) {
            console.error(err);
            alert('오류가 발생했습니다.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="admin-form-container">
            <div className="admin-form-content">
                <header className="admin-form-header">
                    <div className="header-info">
                        <h2>{isEditMode ? '상품 정보 수정' : '새로운 상품 등록'}</h2>
                        <p>{isEditMode ? '상품의 상세 정보를 관리하고 업데이트합니다.' : '키오스크 메뉴에 노출될 새로운 상품을 등록합니다.'}</p>
                    </div>
                    <button className="flat-btn gray" onClick={() => navigate('/admin/products')}>
                        목록으로 돌아가기
                    </button>
                </header>

                <form onSubmit={handleSubmit} className="admin-form-layout">
                    <section className="admin-section">
                        <div className="section-title">📁 카테고리 분류 <span style={{ fontSize: '0.8rem', fontWeight: 500, color: '#94a3b8' }}>(여러 카테고리에 동시에 넣을 수 있습니다)</span></div>
                        <div className="section-form">
                            <CategoryEditor
                                value={productData.categories}
                                onChange={(next) => setProductData(prev => ({ ...prev, categories: next }))}
                                mainCategories={mainCategories}
                                subCategories={subCategories}
                                setMainCategories={setMainCategories}
                                setSubCategories={setSubCategories}
                            />
                        </div>
                    </section>

                    <section className="admin-section">
                        <div className="section-title">📦 기본 정보</div>
                        <div className="section-form">
                            <div className="form-item">
                                <label>상품명 <span className="req">*</span></label>
                                <input
                                    required
                                    className="form-input"
                                    placeholder="상품명을 입력하세요"
                                    value={productData.name}
                                    onChange={(e) => setProductData({ ...productData, name: e.target.value })}
                                />
                            </div>
                            <div className="form-item">
                                <label>ERP 상품 코드</label>
                                <input
                                    className="form-input"
                                    placeholder="ERP 시스템의 상품 코드를 입력하세요 (예: 1001)"
                                    value={productData.erpCode || ''}
                                    onChange={(e) => setProductData({ ...productData, erpCode: e.target.value })}
                                />
                            </div>
                            <div className="form-item">
                                <label>규격 (단일 규격 상품)</label>
                                <input
                                    className="form-input"
                                    placeholder="단일 규격을 입력하세요 (예: 15A). 옵션이 여러 개면 비워두세요."
                                    value={productData.gyu || ''}
                                    onChange={(e) => setProductData({ ...productData, gyu: e.target.value })}
                                />
                            </div>
                            <div className="form-row">
                                <div className="form-item">
                                    <label>브랜드 (네이버 검색품질)</label>
                                    <input
                                        className="form-input"
                                        placeholder="브랜드명을 입력하세요. 비우면 '기타'로 등록됩니다."
                                        value={productData.brandName || ''}
                                        onChange={(e) => setProductData({ ...productData, brandName: e.target.value })}
                                    />
                                </div>
                                <div className="form-item">
                                    <label>원산지</label>
                                    {(() => {
                                        const code = productData.originAreaCode || '';
                                        const knownCodes = ORIGIN_OPTIONS.map(o => o.code);
                                        // 목록에 없는 코드(수입산 등 직접 입력분)거나 사용자가 직접입력을 연 경우
                                        const isCustom = originCustomOpen || (code && !knownCodes.includes(code));
                                        return (
                                            <>
                                                <select
                                                    className="form-input"
                                                    value={isCustom ? '__custom__' : code}
                                                    onChange={(e) => {
                                                        const v = e.target.value;
                                                        if (v === '__custom__') {
                                                            setOriginCustomOpen(true);
                                                        } else {
                                                            setOriginCustomOpen(false);
                                                            setProductData({ ...productData, originAreaCode: v });
                                                        }
                                                    }}
                                                >
                                                    {ORIGIN_OPTIONS.map(o => (
                                                        <option key={o.code || '__none__'} value={o.code}>
                                                            {o.label}{o.code ? ` (${o.code})` : ''}
                                                        </option>
                                                    ))}
                                                    <option value="__custom__">직접 입력 (수입산 등 코드)</option>
                                                </select>
                                                {isCustom && (
                                                    <input
                                                        className="form-input"
                                                        style={{ marginTop: '8px' }}
                                                        placeholder="네이버 원산지 코드 (예: 국산=00, 수입산=02…)"
                                                        value={code}
                                                        onChange={(e) => setProductData({ ...productData, originAreaCode: e.target.value })}
                                                    />
                                                )}
                                            </>
                                        );
                                    })()}
                                </div>
                            </div>
                            <div className="form-item">
                                <label>상품 설명</label>
                                <textarea
                                    className="form-textarea"
                                    placeholder="상품에 대한 상세 설명을 입력하세요"
                                    value={productData.description}
                                    onChange={(e) => setProductData({ ...productData, description: e.target.value })}
                                />
                            </div>
                            <div className="form-row">
                                <div className="form-item">
                                    <label>판매가 (원) <span className="req">*</span></label>
                                    <input
                                        type="number"
                                        required
                                        className="form-input"
                                        value={productData.price}
                                        onChange={(e) => setProductData({ ...productData, price: e.target.value })}
                                    />
                                </div>
                                <div className="form-item">
                                    <label>해시태그</label>
                                    <input
                                        className="form-input"
                                        placeholder="#태그 #입력"
                                        value={productData.hashtags}
                                        onChange={(e) => setProductData({ ...productData, hashtags: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>
                    </section>

                    <section className="admin-section">
                        <div className="section-title">🖼️ 이미지 관리</div>
                        <div className="section-form">
                            <div 
                                className={`img-upload-box ${isDragging ? 'dragging' : ''}`}
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                            >
                                <input
                                    type="file"
                                    id="img-input"
                                    multiple
                                    hidden
                                    onChange={handleImageUpload}
                                />
                                <div className="img-horizontal-container">
                                    <label htmlFor="img-input" className="img-add-square">
                                        ＋ 사진 추가
                                    </label>
                                    <div className="img-preview-row">
                                        {productData.images.map((url, idx) => (
                                            <div key={idx} className="img-preview-thumb">
                                                <img src={getImageUrl(url)} alt="product" />
                                                <button type="button" onClick={() => removeImage(idx)} className="img-del-mini">×</button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    <section className="admin-section">
                        <div className="section-title">⚙️ 옵션 설정</div>
                        <div className="section-form">
                            <div className="option-header">
                                <button
                                    type="button"
                                    className="flat-btn border"
                                    onClick={() => setOptionGroups([...optionGroups, { name: '', values: '' }])}
                                >
                                    ＋ 옵션 그룹 추가
                                </button>
                            </div>

                            {optionGroups.length > 0 ? (
                                <div className="option-group-wrapper">
                                    {optionGroups.map((group, idx) => (
                                        <div key={idx} className="option-group-item">
                                            <input
                                                placeholder="옵션명 (예: 색상)"
                                                value={group.name}
                                                onChange={(e) => {
                                                    const updated = [...optionGroups];
                                                    updated[idx].name = e.target.value;
                                                    setOptionGroups(updated);
                                                }}
                                                className="form-input small"
                                            />
                                            <input
                                                placeholder="옵션값 (쉼표 구분: 빨강, 파랑)"
                                                value={group.values}
                                                onChange={(e) => {
                                                    const updated = [...optionGroups];
                                                    updated[idx].values = e.target.value;
                                                    setOptionGroups(updated);
                                                }}
                                                className="form-input"
                                            />
                                            <div style={{ display: 'flex', gap: '4px' }}>
                                                <button
                                                    type="button"
                                                    className="mini-add-btn"
                                                    onClick={() => {
                                                        if (idx === 0) return;
                                                        const updated = [...optionGroups];
                                                        [updated[idx - 1], updated[idx]] = [updated[idx], updated[idx - 1]];
                                                        setOptionGroups(updated);
                                                    }}
                                                    title="위로 이동"
                                                >▲</button>
                                                <button
                                                    type="button"
                                                    className="mini-add-btn"
                                                    onClick={() => {
                                                        if (idx === optionGroups.length - 1) return;
                                                        const updated = [...optionGroups];
                                                        [updated[idx + 1], updated[idx]] = [updated[idx], updated[idx + 1]];
                                                        setOptionGroups(updated);
                                                    }}
                                                    title="아래로 이동"
                                                >▼</button>
                                            </div>
                                            <button
                                                type="button"
                                                className="icon-btn-del"
                                                onClick={() => setOptionGroups(optionGroups.filter((_, i) => i !== idx))}
                                            >
                                                삭제
                                            </button>
                                        </div>
                                    ))}
                                    <button
                                        type="button"
                                        className="flat-btn navy"
                                        style={{ marginTop: '10px' }}
                                        onClick={() => {
                                            const validGroups = optionGroups.filter(g => g.name.trim() && g.values.trim());
                                            if (validGroups.length === 0) return alert('옵션 명과 값을 입력해주세요.');
                                            const groupValues = validGroups.map(g => g.values.split(',').map(v => v.trim()).filter(v => v));
                                            const cartesian = (...a) => a.reduce((a, b) => a.flatMap(d => b.map(e => [d, e].flat())));
                                            const results = groupValues.length > 1 ? cartesian(...groupValues) : groupValues[0].map(v => [v]);
                                            setCombinations(results.map((res, i) => ({
                                                id: `c-${i}`,
                                                name: Array.isArray(res) ? res.join(' / ') : res,
                                                price: 0
                                            })));
                                        }}
                                    >
                                        옵션 조합 생성하기
                                    </button>
                                </div>
                            ) : (
                                <div className="empty-info">옵션이 없는 상품입니다.</div>
                            )}

                            {(optionGroups.some(g => g.name.trim() && parseValues(g.values).length > 0) || combinations.filter(c => !c.deleted).length > 1) && (
                                <div className="option-img-section">
                                    <div className="option-img-section-title">
                                        🖼️ 옵션별 사진
                                        <span>옵션값(또는 옵션 조합)마다 사진을 등록하면 키오스크에서 해당 옵션 선택 시 그 사진을 보여줍니다. 없으면 메인 사진이 표시됩니다.</span>
                                    </div>
                                    {optionGroups.map((group, gIdx) => {
                                        const name = group.name.trim();
                                        const values = parseValues(group.values);
                                        if (!name || values.length === 0) return null;
                                        return (
                                            <div key={gIdx} className="option-img-group">
                                                <div className="option-img-group-name">{name}</div>
                                                {values.map((val, vIdx) => {
                                                    const inputId = `opt-img-${gIdx}-${vIdx}`;
                                                    return (
                                                        <div key={vIdx} className="option-img-row">
                                                            <div className="option-img-value-label">{val}</div>
                                                            {renderOptionImageEditor(name, val, inputId)}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        );
                                    })}

                                    {/* 옵션 그룹이 없는 ERP 조합 상품: 조합 이름별로 사진을 등록한다. */}
                                    {!optionGroups.some(g => g.name.trim() && parseValues(g.values).length > 0)
                                        && combinations.filter(c => !c.deleted).length > 1 && (
                                        <div className="option-img-group">
                                            <div className="option-img-group-name">옵션 조합</div>
                                            {combinations.filter(c => !c.deleted).map((c, cIdx) => {
                                                const inputId = `opt-img-combo-${cIdx}`;
                                                return (
                                                    <div key={cIdx} className="option-img-row">
                                                        <div className="option-img-value-label">{c.name}</div>
                                                        {renderOptionImageEditor(COMBINATION_GROUP, c.name, inputId)}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}

                            {combinations.some(c => !c.deleted) && (
                                <div className="combo-table-wrap">
                                    <table className="admin-form-table">
                                        <thead>
                                            <tr>
                                                <th width="50">순서</th>
                                                <th>옵션 조합</th>
                                                <th width="150">추가 금액</th>
                                                <th width="60">삭제</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {combinations.map((c, i) => c.deleted ? null : (
                                                <tr key={i}>
                                                    <td>
                                                        <div style={{ display: 'flex', gap: '2px' }}>
                                                            <button
                                                                type="button"
                                                                className="mini-add-btn"
                                                                style={{ padding: '2px 4px' }}
                                                                onClick={() => {
                                                                    if (i === 0 || combinations[i - 1].deleted) return;
                                                                    const updated = [...combinations];
                                                                    [updated[i - 1], updated[i]] = [updated[i], updated[i - 1]];
                                                                    setCombinations(updated);
                                                                }}
                                                            >▲</button>
                                                            <button
                                                                type="button"
                                                                className="mini-add-btn"
                                                                style={{ padding: '2px 4px' }}
                                                                onClick={() => {
                                                                    if (i === combinations.length - 1 || combinations[i + 1].deleted) return;
                                                                    const updated = [...combinations];
                                                                    [updated[i + 1], updated[i]] = [updated[i], updated[i + 1]];
                                                                    setCombinations(updated);
                                                                }}
                                                            >▼</button>
                                                        </div>
                                                    </td>
                                                    <td>{c.name}</td>
                                                    <td>
                                                        <input
                                                            type="number"
                                                            className="form-input tiny"
                                                            value={c.price}
                                                            onChange={(e) => {
                                                                const updated = [...combinations];
                                                                updated[i].price = parseInt(e.target.value || 0);
                                                                setCombinations(updated);
                                                            }}
                                                        />
                                                    </td>
                                                    <td>
                                                        <button
                                                            type="button"
                                                            className="icon-btn-del"
                                                            title="이 옵션 조합 삭제 (소프트삭제: postgres에 보존되며 복구 가능)"
                                                            onClick={() => {
                                                                const target = combinations[i];
                                                                const rest = combinations.filter((_, idx) => idx !== i);
                                                                if (target.id_db) {
                                                                    // 이미 저장된 조합: 소프트삭제 플래그만 세우고 목록 끝으로 모은다.
                                                                    const active = rest.filter(x => !x.deleted);
                                                                    const removed = rest.filter(x => x.deleted);
                                                                    setCombinations([...active, ...removed, { ...target, deleted: true }]);
                                                                } else {
                                                                    // 아직 저장된 적 없는 조합: DB에 없으므로 그냥 제거.
                                                                    setCombinations(rest);
                                                                }
                                                            }}
                                                        >
                                                            삭제
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {combinations.some(c => c.deleted) && (
                                <div className="deleted-combo-wrap">
                                    <div className="deleted-combo-title">
                                        🗑️ 삭제된 옵션 조합 <span>저장하면 postgres에 보존됩니다 · 복구 가능</span>
                                    </div>
                                    {combinations.map((c, i) => c.deleted ? (
                                        <div key={i} className="deleted-combo-row">
                                            <span className="deleted-combo-name">{c.name}</span>
                                            <button
                                                type="button"
                                                className="flat-btn border"
                                                onClick={() => {
                                                    const target = combinations[i];
                                                    const rest = combinations.filter((_, idx) => idx !== i);
                                                    const active = rest.filter(x => !x.deleted);
                                                    const removed = rest.filter(x => x.deleted);
                                                    // 복구 시 활성 목록 맨 뒤에 끼워 넣어 활성/삭제 구역을 분리 유지.
                                                    setCombinations([...active, { ...target, deleted: false }, ...removed]);
                                                }}
                                            >
                                                복구
                                            </button>
                                        </div>
                                    ) : null)}
                                </div>
                            )}
                        </div>
                    </section>

                    <div className="admin-form-footer">
                        <div className="footer-content">
                            <span className="status-msg">{isLoading ? '데이터를 처리 중입니다...' : '모든 정보를 입력하셨나요?'}</span>
                            <div className="footer-btns">
                                <button type="button" className="flat-btn border large" onClick={() => navigate('/admin/products')}>취소</button>
                                <button type="submit" className="flat-btn navy large" disabled={isLoading}>
                                    {isEditMode ? '수정 내용 저장' : '새 상품 등록하기'}
                                </button>
                            </div>
                        </div>
                    </div>
                </form>
            </div>

            <style>{`
                .admin-form-container {
                    padding: 20px 20px 140px;
                    display: flex;
                    justify-content: center;
                    background: #f8fafc;
                    min-height: 100vh;
                }
                .admin-form-content { width: 100%; max-width: 800px; }

                .admin-form-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 30px;
                }
                .admin-form-header h2 { font-size: 1.8rem; font-weight: 800; color: #011e29; margin-bottom: 5px; }
                .admin-form-header p { color: #64748b; font-size: 0.95rem; }

                .admin-form-layout {
                    display: flex;
                    flex-direction: column;
                    gap: 20px;
                }

                .admin-section {
                    background: white;
                    border: 1px solid #e2e8f0;
                    border-radius: 12px;
                    padding: 24px;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.02);
                }
                .section-title {
                    font-size: 1.1rem;
                    font-weight: 800;
                    color: #1e293b;
                    margin-bottom: 20px;
                    padding-bottom: 12px;
                    border-bottom: 1px solid #f1f5f9;
                }

                .section-form { display: flex; flex-direction: column; gap: 20px; }
                .section-form.compact-row { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; }
                
                .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
                .form-item { display: flex; flex-direction: column; gap: 8px; }
                .form-item label { font-size: 0.9rem; font-weight: 700; color: #475569; }
                .req { color: #ef4444; }

                .form-input, .form-textarea, .form-select {
                    padding: 12px 15px;
                    border: 1px solid #dee2e6;
                    border-radius: 8px;
                    font-size: 0.95rem;
                    background: #fff;
                    transition: border-color 0.2s;
                }
                .form-input:focus, .form-textarea:focus { outline: none; border-color: #00c73c; }
                .form-textarea { height: 120px; resize: none; }
                .form-input.small { width: 180px; }
                .form-input.tiny { padding: 8px; text-align: right; }

                .flat-btn {
                    padding: 10px 20px;
                    border-radius: 8px;
                    font-weight: 700;
                    cursor: pointer;
                    border: none;
                    font-size: 0.9rem;
                    transition: all 0.2s;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                }
                .flat-btn.navy { background: #1e293b; color: white; }
                .flat-btn.navy:hover { background: #0f172a; }
                .flat-btn.border { background: white; border: 1px solid #e2e8f0; color: #64748b; }
                .flat-btn.border:hover { background: #f8fafc; }
                .flat-btn.gray { background: #f1f5f9; color: #64748b; }
                .flat-btn.large { padding: 15px 35px; font-size: 1rem; }

                .img-upload-box { display: flex; flex-direction: column; gap: 15px; }
                .img-horizontal-container { display: flex; gap: 15px; overflow-x: auto; padding-bottom: 10px; }
                .img-add-square {
                    width: 100px;
                    height: 100px;
                    min-width: 100px;
                    background: #f8fafc;
                    border: 2px dashed #cbd5e1;
                    border-radius: 10px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #94a3b8;
                    font-size: 0.85rem;
                    font-weight: 700;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .img-add-square:hover { border-color: #94a3b8; background: #f1f5f9; }
                
                .img-upload-box.dragging {
                    background: #f0fdf4;
                    border: 2px dashed #22c55e;
                    border-radius: 12px;
                    padding: 10px;
                }

                .img-upload-box.dragging .img-add-square {
                    border-color: #22c55e;
                    color: #22c55e;
                }

                .img-preview-row { display: flex; gap: 10px; }
                .img-preview-thumb {
                    position: relative;
                    width: 100px;
                    height: 100px;
                    min-width: 100px;
                    border-radius: 10px;
                    overflow: hidden;
                    border: 1px solid #e2e8f0;
                }
                .img-preview-thumb img { width: 100%; height: 100%; object-fit: cover; }
                .img-del-mini {
                    position: absolute;
                    top: 5px;
                    right: 5px;
                    width: 20px;
                    height: 20px;
                    background: rgba(0,0,0,0.5);
                    color: white;
                    border: none;
                    border-radius: 50%;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 14px;
                }

                .option-img-section { margin-top: 18px; padding: 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; display: flex; flex-direction: column; gap: 16px; }
                .option-img-section-title { font-size: 0.95rem; font-weight: 800; color: #334155; }
                .option-img-section-title span { display: block; font-weight: 500; font-size: 0.78rem; color: #94a3b8; margin-top: 4px; }
                .option-img-group { background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; display: flex; flex-direction: column; gap: 12px; }
                .option-img-group-name { font-size: 0.9rem; font-weight: 800; color: #1e293b; }
                .option-img-row { display: flex; flex-direction: column; gap: 8px; }
                .option-img-value-label { font-size: 0.85rem; font-weight: 700; color: #475569; }
                .img-add-square.as-btn { line-height: 1.2; text-align: center; gap: 0; }
                .img-add-square.as-btn.active { border-color: #6366f1; color: #6366f1; background: #eef2ff; }
                .existing-img-picker {
                    display: flex; flex-wrap: wrap; gap: 8px; padding: 12px;
                    background: #fff; border: 1px dashed #c7d2fe; border-radius: 10px;
                }
                .picker-empty { font-size: 0.8rem; color: #94a3b8; }
                .picker-thumb {
                    position: relative; width: 72px; height: 72px; padding: 0; cursor: pointer;
                    border: 2px solid #e2e8f0; border-radius: 8px; overflow: hidden; background: #fff;
                }
                .picker-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
                .picker-thumb:hover { border-color: #6366f1; }
                .picker-thumb.picked { border-color: #22c55e; cursor: default; opacity: 0.85; }
                .picker-check {
                    position: absolute; top: 2px; right: 2px; width: 18px; height: 18px;
                    background: #22c55e; color: #fff; border-radius: 50%; font-size: 12px;
                    display: flex; align-items: center; justify-content: center;
                }

                .option-group-wrapper { display: flex; flex-direction: column; gap: 10px; padding: 15px; background: #f8fafc; border-radius: 10px; }
                .option-group-item { display: flex; gap: 10px; align-items: center; }
                .icon-btn-del { width: 32px; height: 32px; border-radius: 6px; border: none; background: #fee2e2; color: #ef4444; cursor: pointer; }
                .mini-add-btn { 
                    padding: 2px 8px; 
                    font-size: 0.75rem; 
                    border-radius: 4px; 
                    background: #f1f5f9; 
                    color: #64748b; 
                    border: none; 
                    cursor: pointer; 
                }
                .mini-add-btn:hover { background: #e2e8f0; color: #475569; }

                .combo-table-wrap { margin-top: 15px; border-radius: 10px; overflow: hidden; border: 1px solid #f1f5f9; }
                .admin-form-table { width: 100%; border-collapse: collapse; }
                .admin-form-table th { background: #f1f5f9; padding: 12px; font-size: 0.8rem; text-align: left; color: #64748b; }
                .admin-form-table td { padding: 10px 12px; border-bottom: 1px solid #f8fafc; font-size: 0.9rem; font-weight: 600; }

                .deleted-combo-wrap { margin-top: 15px; padding: 15px; background: #fff7ed; border: 1px dashed #fdba74; border-radius: 10px; display: flex; flex-direction: column; gap: 8px; }
                .deleted-combo-title { font-size: 0.85rem; font-weight: 800; color: #c2410c; }
                .deleted-combo-title span { font-weight: 500; font-size: 0.75rem; color: #ea8a4f; margin-left: 6px; }
                .deleted-combo-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: white; border-radius: 8px; border: 1px solid #fed7aa; }
                .deleted-combo-name { font-size: 0.9rem; font-weight: 600; color: #9a3412; text-decoration: line-through; }

                .admin-form-footer {
                    position: fixed;
                    bottom: 0;
                    left: 260px;
                    right: 0;
                    background: white;
                    padding: 20px 40px;
                    border-top: 1px solid #e2e8f0;
                    box-shadow: 0 -10px 20px rgba(0,0,0,0.03);
                    z-index: 1000;
                }
                .footer-content {
                    max-width: 800px;
                    margin: 0 auto;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .status-msg { color: #64748b; font-weight: 600; }
                .footer-btns { display: flex; gap: 15px; }

                .empty-info { text-align: center; padding: 20px; color: #94a3b8; font-size: 0.9rem; font-weight: 500; }

                @media (max-width: 1024px) {
                    .admin-form-footer { left: 0; }
                }
                @media (max-width: 600px) {
                    .section-form.compact-row { grid-template-columns: 1fr; }
                    .form-row { grid-template-columns: 1fr; }
                }
            `}</style>
        </div>
    );
};

export default ProductForm;
