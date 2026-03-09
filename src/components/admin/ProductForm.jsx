
import { useEffect, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { getImageUrl } from '../../utils/imageUtils';

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
        mainCategory: '',
        subCategory: '',
        price: 0,
        hashtags: '',
        images: []
    });

    const [optionGroups, setOptionGroups] = useState([]);
    const [combinations, setCombinations] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (isEditMode) {
            const product = products.find(p => p.id === parseInt(id));
            if (product) {
                setProductData(prev => ({
                    ...prev,
                    ...product,
                    hashtags: product.hashtags ? product.hashtags.join(', ') : '',
                    images: product.images || (product.image ? [product.image] : [])
                }));
                setCombinations(product.combinations || []);
                setOptionGroups(product.optionGroups?.map(g => ({
                    name: g.name,
                    values: g.values ? g.values.join(', ') : ''
                })) || []);
            }
        }
    }, [isEditMode, id, products]);

    useEffect(() => {
        if (mainCategories.length > 0) {
            setProductData(prev => {
                // 현재 설정된 대분류가 없거나, 유효하지 않은 항목이면 첫 번째 대분류로 초기화
                const mId = prev.mainCategory && mainCategories.some(c => c.id === prev.mainCategory)
                    ? prev.mainCategory
                    : mainCategories[0].id;

                const currentSubs = subCategories[mId] || [];
                // 현재 선택된 중분류가 해당 대분류 목록에 없는 항목이거나 비어있으면 첫 번째 중분류로 초기화
                const sId = prev.subCategory && currentSubs.some(s => s.id === prev.subCategory)
                    ? prev.subCategory
                    : (currentSubs.length > 0 ? currentSubs[0].id : '');

                if (prev.mainCategory !== mId || prev.subCategory !== sId) {
                    return { ...prev, mainCategory: mId, subCategory: sId };
                }
                return prev;
            });
        }
    }, [mainCategories, subCategories, productData.mainCategory, productData.subCategory]);

    const compressImage = (file, maxWidth = 800, maxHeight = 800, quality = 0.8) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = event => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > maxWidth) {
                            height = Math.round((height * maxWidth) / width);
                            width = maxWidth;
                        }
                    } else {
                        if (height > maxHeight) {
                            width = Math.round((width * maxHeight) / height);
                            height = maxHeight;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    canvas.toBlob((blob) => {
                        resolve(new File([blob], file.name, {
                            type: 'image/jpeg',
                            lastModified: Date.now()
                        }));
                    }, 'image/jpeg', quality);
                };
                img.onerror = error => reject(error);
            };
            reader.onerror = error => reject(error);
        });
    };

    const handleImageUpload = async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        setIsLoading(true);
        const uploadedUrls = [];
        for (const file of files) {
            try {
                // 압축 적용 (최대 폭/높이 800px, 80% 화질)
                const isImage = file.type.startsWith('image/');
                const processedFile = isImage ? await compressImage(file) : file;

                const formData = new FormData();
                formData.append('file', processedFile);
                try {
                    const res = await fetch('/api/upload', {
                        method: 'POST',
                        body: formData
                    });
                    if (res.ok) {
                        const data = await res.json();
                        uploadedUrls.push(data.fileUrl);
                    }
                } catch (err) {
                    console.error("Upload failed", err);
                }
            } catch (err) {
                console.error("Image processing/upload failed", err);
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

    const addMainCategory = async () => {
        const name = prompt('새 대분류 이름을 입력하세요:');
        if (!name) return;
        const id = 'cat_' + Date.now();
        const catData = { id, name, level: 'main' };
        try {
            const res = await fetch('/api/categories/admin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(catData)
            });
            if (res.ok) {
                const saved = await res.json();
                setMainCategories([...mainCategories, saved]);
                setSubCategories({ ...subCategories, [saved.id]: [] });
                setProductData(prev => ({
                    ...prev,
                    mainCategory: saved.id,
                    subCategory: ''
                }));
            }
        } catch (err) { alert('오류 발생'); }
    };

    const addSubCategory = async () => {
        if (!productData.mainCategory) return alert('대분류를 먼저 선택해주세요.');
        const name = prompt('새 중분류 이름을 입력하세요:');
        if (!name) return;
        const id = 'sub_' + Date.now();
        const parentId = productData.mainCategory;
        const catData = { id, name, parentId, level: 'sub' };
        try {
            const res = await fetch('/api/categories/admin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(catData)
            });
            if (res.ok) {
                const saved = await res.json();
                setSubCategories({
                    ...subCategories,
                    [parentId]: [...(subCategories[parentId] || []), saved]
                });
                setProductData(prev => ({
                    ...prev,
                    subCategory: saved.id
                }));
            }
        } catch (err) { alert('오류 발생'); }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);

        const payload = {
            ...productData,
            price: parseInt(productData.price || 0),
            hashtags: typeof productData.hashtags === 'string'
                ? productData.hashtags.split(',').map(tag => {
                    const t = tag.trim();
                    return t.startsWith('#') ? t : `#${t}`;
                }).filter(t => t !== '#')
                : productData.hashtags,
            isComplexOptions: combinations.length > 0,
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
                        <div className="section-title">📁 카테고리 분류</div>
                        <div className="section-form compact-row">
                            <div className="form-item">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <label>대분류</label>
                                    <button type="button" onClick={addMainCategory} className="mini-add-btn">＋ 추가</button>
                                </div>
                                <select
                                    className="form-select"
                                    value={productData.mainCategory}
                                    onChange={(e) => {
                                        const mId = e.target.value;
                                        const sId = subCategories[mId]?.[0]?.id;
                                        setProductData({
                                            ...productData,
                                            mainCategory: mId,
                                            subCategory: sId || ''
                                        });
                                    }}
                                >
                                    {mainCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                            <div className="form-item">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <label>중분류</label>
                                    <button type="button" onClick={addSubCategory} className="mini-add-btn">＋ 추가</button>
                                </div>
                                <select
                                    className="form-select"
                                    value={productData.subCategory}
                                    onChange={(e) => {
                                        const sId = e.target.value;
                                        setProductData({
                                            ...productData,
                                            subCategory: sId
                                        });
                                    }}
                                >
                                    {subCategories[productData.mainCategory]?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>
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
                            <div className="img-upload-box">
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

                            {combinations.length > 0 && (
                                <div className="combo-table-wrap">
                                    <table className="admin-form-table">
                                        <thead>
                                            <tr>
                                                <th width="50">순서</th>
                                                <th>옵션 조합</th>
                                                <th width="150">추가 금액</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {combinations.map((c, i) => (
                                                <tr key={i}>
                                                    <td>
                                                        <div style={{ display: 'flex', gap: '2px' }}>
                                                            <button
                                                                type="button"
                                                                className="mini-add-btn"
                                                                style={{ padding: '2px 4px' }}
                                                                onClick={() => {
                                                                    if (i === 0) return;
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
                                                                    if (i === combinations.length - 1) return;
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
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
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
