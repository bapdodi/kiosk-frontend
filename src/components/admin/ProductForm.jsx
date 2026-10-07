
import { useEffect, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { getImageUrl, uploadImage } from '../../utils/imageUtils';
import { COMBINATION_GROUP } from '../../utils/optionConstants';
import { buildProductUpdate } from '../../utils/productUpdate';
import CategoryEditor from './CategoryEditor';

const ProductForm = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const {
        products, setProducts,
        mainCategories,
        subCategories, refreshCategories
    } = useOutletContext();
    const product = products.find(p => p.id === Number(id));

    const [productData, setProductData] = useState({
        name: '',
        description: '',
        categories: [],
        hashtags: '',
        images: []
    });

    const [combinations, setCombinations] = useState([]);
    const [combinationSettingsChanged, setCombinationSettingsChanged] = useState(false);
    // 옵션값 단위 사진. API 와 동일한 평면 배열: [{ groupName, optionValue, imageUrl }]
    const [optionImages, setOptionImages] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [dragState, setDragState] = useState(null);
    // 어떤 옵션 행에서 "대표 이미지에서 선택" 패널이 열려 있는지: `${groupName}::${value}` 또는 null
    const [imgPickerKey, setImgPickerKey] = useState(null);

    useEffect(() => {
        if (!product) return;
        setProductData({
            name: product.name || '',
            description: product.description || '',
            categories: product.categories || [],
            hashtags: (product.hashtags || []).join(', '),
            images: product.images || (product.image ? [product.image] : [])
        });
        const combos = product.combinations || [];
        setCombinations([
            ...combos.filter(c => !c.deleted),
            ...combos.filter(c => c.deleted)
        ]);
        setCombinationSettingsChanged(false);
        setOptionImages(product.optionImages || []);
    }, [product]);

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

    // 대표 이미지 순서 변경. direction: -1(앞으로) / +1(뒤로). 첫 번째가 대표 사진이다.
    const moveImage = (index, direction) => {
        setProductData(prev => {
            const target = index + direction;
            if (target < 0 || target >= prev.images.length) return prev;
            const images = [...prev.images];
            [images[index], images[target]] = [images[target], images[index]];
            return { ...prev, images };
        });
    };

    const handleReorderDragStart = (type, index) => setDragState({ type, index });

    const handleReorderDrop = (type, targetIndex) => {
        if (!dragState || dragState.type !== type || dragState.index === targetIndex) {
            setDragState(null);
            return;
        }
        const moveItem = (items, from, to) => {
            const next = [...items];
            const [item] = next.splice(from, 1);
            next.splice(to, 0, item);
            return next;
        };

        if (type === 'images') {
            setProductData(prev => ({ ...prev, images: moveItem(prev.images, dragState.index, targetIndex) }));
        } else if (type === 'combinations') {
            setCombinationSettingsChanged(true);
            setCombinations(prev => {
                const active = prev.filter(c => !c.deleted);
                const deleted = prev.filter(c => c.deleted);
                return [...moveItem(active, dragState.index, targetIndex), ...deleted];
            });
        }
        setDragState(null);
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

    // 규격별 사진 편집기(업로드 + 대표에서 선택 + 등록된 사진 목록).
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
        if (!product) return;
        setIsLoading(true);

        // 숨긴 규격도 포함해 복구할 때 사진 연결이 유지되도록 한다.
        const validPairs = new Set(combinations.map(c => `${COMBINATION_GROUP} ${c.name}`));
        const cleanedOptionImages = optionImages.filter(oi =>
            validPairs.has(`${oi.groupName} ${oi.optionValue}`)
        );

        const payload = buildProductUpdate(product, {
            ...productData,
            optionImages: cleanedOptionImages,
            hashtags: productData.hashtags.split(',').map(tag => {
                const t = tag.trim();
                return t.startsWith('#') ? t : `#${t}`;
            }).filter(t => t !== '#'),
            ...(combinationSettingsChanged ? { combinations } : {})
        });

        try {
            const res = await fetch(`/api/products/admin/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                const savedProduct = await res.json();
                setProducts(products.map(p => p.id === savedProduct.id ? savedProduct : p));
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
                        <h2>상품 정보 수정</h2>
                        <p>{product?.name || '상품 정보를 불러오는 중입니다.'}</p>
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
                                refreshCategories={refreshCategories}
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
                                    placeholder="키오스크에 표시할 상품명"
                                    value={productData.name}
                                    onChange={(e) => setProductData({ ...productData, name: e.target.value })}
                                />
                                {product?.name !== productData.name && (
                                    <small style={{ color: '#94a3b8' }}>기존: {product?.name}</small>
                                )}
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
                                            <div key={idx} className="img-preview-thumb"
                                                draggable="true"
                                                onDragStart={() => handleReorderDragStart('images', idx)}
                                                onDragOver={(e) => e.preventDefault()}
                                                onDrop={() => handleReorderDrop('images', idx)}
                                                style={{ cursor: 'grab' }}>
                                                <img src={getImageUrl(url)} alt="product" />
                                                {idx === 0 && <span className="img-main-badge">대표</span>}
                                                <button type="button" onClick={() => removeImage(idx)} className="img-del-mini">×</button>
                                                <div className="img-move-bar">
                                                    <button
                                                        type="button"
                                                        className="img-move-btn"
                                                        onClick={() => moveImage(idx, -1)}
                                                        disabled={idx === 0}
                                                        title="앞으로 이동"
                                                    >◀</button>
                                                    <span className="img-move-pos">{idx + 1}</span>
                                                    <button
                                                        type="button"
                                                        className="img-move-btn"
                                                        onClick={() => moveImage(idx, 1)}
                                                        disabled={idx === productData.images.length - 1}
                                                        title="뒤로 이동"
                                                    >▶</button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                {productData.images.length > 1 && (
                                    <p className="img-order-hint">◀ ▶ 또는 드래그로 순서를 바꿀 수 있습니다. 맨 앞(1번)이 대표 사진입니다.</p>
                                )}
                            </div>
                        </div>
                    </section>

                    <section className="admin-section">
                        <div className="section-title">⚙️ 규격 설정</div>
                        <div className="section-form">
                            {combinations.filter(c => !c.deleted).length > 1 && (
                                <div className="option-img-section">
                                    <div className="option-img-section-title">
                                        🖼️ 규격별 사진
                                        <span>규격마다 사진을 등록하면 키오스크에서 해당 규격 선택 시 보여줍니다. 등록된 사진이 없으면 대표 사진이 표시됩니다.</span>
                                    </div>
                                    <div className="option-img-group">
                                        {combinations.filter(c => !c.deleted).map((c, cIdx) => (
                                            <div key={cIdx} className="option-img-row">
                                                <div className="option-img-value-label">{c.name}</div>
                                                {renderOptionImageEditor(COMBINATION_GROUP, c.name, `opt-img-combo-${cIdx}`)}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {!combinations.length && (
                                <div className="empty-info">등록된 규격이 없습니다.</div>
                            )}

                            {combinations.some(c => !c.deleted) && (
                                <div className="combo-table-wrap">
                                    <table className="admin-form-table">
                                        <thead>
                                            <tr>
                                                <th width="50">순서</th>
                                                <th>규격 (ERP 원본)</th>
                                                <th>키오스크용 이름</th>
                                                <th width="60">표시</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {combinations.map((c, i) => c.deleted ? null : (
                                                <tr key={i}
                                                    draggable="true"
                                                    onDragStart={() => handleReorderDragStart('combinations', combinations.filter(x => !x.deleted).findIndex(x => x === c))}
                                                    onDragOver={(e) => e.preventDefault()}
                                                    onDrop={() => handleReorderDrop('combinations', combinations.filter(x => !x.deleted).findIndex(x => x === c))}
                                                    style={{ cursor: 'grab' }}>
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
                                                                    setCombinationSettingsChanged(true);
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
                                                                    setCombinationSettingsChanged(true);
                                                                    setCombinations(updated);
                                                                }}
                                                            >▼</button>
                                                        </div>
                                                    </td>
                                                    <td>{c.name}</td>
                                                    <td>
                                                        <input
                                                            type="text"
                                                            style={{ width: '100%', padding: '6px 8px', border: '1px solid #d5dbe5', borderRadius: 6 }}
                                                            value={c.kioskName || ''}
                                                            placeholder={c.name}
                                                            maxLength={255}
                                                            draggable="false"
                                                            onChange={(e) => {
                                                                const value = e.target.value;
                                                                setCombinationSettingsChanged(true);
                                                                setCombinations(prev => prev.map((x, idx) => idx === i ? { ...x, kioskName: value } : x));
                                                            }}
                                                        />
                                                    </td>
                                                    <td>
                                                        <button
                                                            type="button"
                                                            className="icon-btn-del"
                                                            title="이 규격 숨기기 (복구 가능)"
                                                            onClick={() => {
                                                                const target = combinations[i];
                                                                const rest = combinations.filter((_, idx) => idx !== i);
                                                                const active = rest.filter(x => !x.deleted);
                                                                const removed = rest.filter(x => x.deleted);
                                                                setCombinationSettingsChanged(true);
                                                                setCombinations([...active, ...removed, { ...target, deleted: true }]);
                                                            }}
                                                        >
                                                            숨김
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
                                        🗑️ 숨긴 규격 <span>복구할 수 있습니다</span>
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
                                                    setCombinationSettingsChanged(true);
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
                                <button type="submit" className="flat-btn navy large" disabled={isLoading || !product}>
                                    수정 내용 저장
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
                .img-main-badge {
                    position: absolute;
                    top: 5px;
                    left: 5px;
                    padding: 2px 7px;
                    background: #00c73c;
                    color: #fff;
                    font-size: 0.7rem;
                    font-weight: 800;
                    border-radius: 6px;
                    z-index: 1;
                }
                .img-move-bar {
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    height: 26px;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 0 4px;
                    background: rgba(0,0,0,0.55);
                }
                .img-move-btn {
                    width: 22px;
                    height: 22px;
                    border: none;
                    background: transparent;
                    color: #fff;
                    cursor: pointer;
                    font-size: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 4px;
                }
                .img-move-btn:hover:not(:disabled) { background: rgba(255,255,255,0.25); }
                .img-move-btn:disabled { opacity: 0.3; cursor: default; }
                .img-move-pos { color: #fff; font-size: 0.75rem; font-weight: 700; }
                .img-order-hint { font-size: 0.8rem; color: #94a3b8; margin-top: 4px; }

                .option-img-section { margin-top: 18px; padding: 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; display: flex; flex-direction: column; gap: 16px; }
                .option-img-section-title { font-size: 0.95rem; font-weight: 800; color: #334155; }
                .option-img-section-title span { display: block; font-weight: 500; font-size: 0.78rem; color: #94a3b8; margin-top: 4px; }
                .option-img-group { background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; display: flex; flex-direction: column; gap: 12px; }
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
                @media (max-width: 767.98px) {
                    .section-form.compact-row { grid-template-columns: 1fr; }
                    .form-row { grid-template-columns: 1fr; }
                    .admin-form-header { flex-direction: column; align-items: stretch; gap: 12px; }
                    .admin-form-header h2 { font-size: 1.4rem; }
                    .admin-form-footer { padding: 12px 14px; }
                    .footer-content { flex-direction: column; align-items: stretch; gap: 10px; }
                    .status-msg { display: none; }
                    .footer-btns { gap: 10px; }
                    .footer-btns .flat-btn { flex: 1; white-space: nowrap; }
                    .flat-btn.large { padding: 14px 10px; font-size: 0.95rem; }
                    .form-input.small { width: 100%; }
                }
            `}</style>
        </div>
    );
};

export default ProductForm;
