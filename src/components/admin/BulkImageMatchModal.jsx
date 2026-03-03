import { useState } from 'react';

const SearchableProductSelect = ({ value, products, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const selectedProduct = products.find(p => p.id === parseInt(value));
    const displayValue = selectedProduct ? selectedProduct.name : '';

    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().replace(/\s+/g, '').includes(searchTerm.toLowerCase().replace(/\s+/g, ''))
    );

    return (
        <div className="searchable-select" style={{ position: 'relative' }}>
            <input
                type="text"
                className="admin-input-small"
                placeholder="찾으실 상품명을 입력하세요..."
                value={isOpen ? searchTerm : (displayValue || '')}
                autoComplete="off"
                onFocus={() => {
                    setIsOpen(true);
                    setSearchTerm('');
                }}
                onBlur={() => {
                    // 클릭 이벤트 처리를 위해 약간의 지연 후 닫힘
                    setTimeout(() => setIsOpen(false), 200);
                }}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                    width: '100%',
                    padding: '10px 12px',
                    fontSize: '0.9rem',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    background: '#fff'
                }}
            />
            {isOpen && (
                <div style={{
                    position: 'absolute',
                    top: 'calc(100% + 5px)',
                    left: 0,
                    right: 0,
                    zIndex: 100,
                    background: 'white',
                    border: '1px solid #e2e8f0',
                    maxHeight: '200px',
                    overflowY: 'auto',
                    borderRadius: '10px',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                    animation: 'fadeIn 0.2s ease'
                }}>
                    <div
                        onClick={() => {
                            onChange("");
                            setIsOpen(false);
                        }}
                        style={{
                            padding: '10px 12px',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            color: '#94a3b8',
                            borderBottom: '1px solid #f1f5f9'
                        }}
                    >
                        -- 매칭 취소 (상품 미선택) --
                    </div>
                    {filteredProducts.map(p => (
                        <div
                            key={p.id}
                            onMouseDown={(e) => {
                                // onBlur보다 먼저 실행되도록 onMouseDown 사용
                                onChange(p.id);
                                setIsOpen(false);
                            }}
                            style={{
                                padding: '10px 12px',
                                cursor: 'pointer',
                                fontSize: '0.9rem',
                                color: '#1e293b',
                                borderBottom: '1px solid #f8fafc',
                                transition: 'background 0.2s'
                            }}
                            onMouseEnter={(e) => e.target.style.background = '#f1f5f9'}
                            onMouseLeave={(e) => e.target.style.background = 'transparent'}
                        >
                            {p.name}
                        </div>
                    ))}
                    {filteredProducts.length === 0 && (
                        <div style={{ padding: '15px', color: '#94a3b8', textAlign: 'center', fontSize: '0.85rem' }}>
                            검색 결과 없음
                        </div>
                    )}
                </div>
            )}
            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(-5px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
};

/**
 * BulkImageMatchModal
 * 사진 여러 장을 업로드하여 상품명과 자동 매칭하고 일괄 업데이트하는 모달
 */
const BulkImageMatchModal = ({ isOpen, onClose, products, onUpdateSuccess }) => {
    const [matches, setMatches] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    if (!isOpen) return null;

    const normalize = (name) => name.replace(/\s+/g, '').toLowerCase();
    // ... (logic remains same)

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

    const handleFileChange = (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        const newMatches = files.map(file => {
            const filename = file.name.split('.').slice(0, -1).join('.');
            const normalizedFilename = normalize(filename);
            const matchedProduct = products.find(p => normalize(p.name) === normalizedFilename);

            return {
                id: Math.random().toString(36).substr(2, 9),
                file,
                filename: file.name,
                productId: matchedProduct ? matchedProduct.id : '',
                previewUrl: URL.createObjectURL(file)
            };
        });

        setMatches([...matches, ...newMatches]);
    };

    const handleProductChange = (matchId, productId) => {
        setMatches(matches.map(m => m.id === matchId ? { ...m, productId: productId } : m));
    };

    const removeMatch = (id) => {
        setMatches(matches.filter(m => m.id !== id));
    };

    const handleSave = async () => {
        const validMatches = matches.filter(m => m.productId);
        if (validMatches.length === 0) return alert('매칭된 상품이 없습니다.');

        if (!window.confirm(`${validMatches.length}개의 상품 이미지를 업데이트 하시겠습니까?`)) return;

        setIsLoading(true);

        try {
            // 1. 각 파일 업로드
            const productsToUpdate = [];
            const productImageMap = {}; // { productId: [imageUrls] }

            for (const match of validMatches) {
                const processedFile = await compressImage(match.file);
                const formData = new FormData();
                formData.append('file', processedFile);

                const uploadRes = await fetch('/api/upload', {
                    method: 'POST',
                    body: formData
                });

                if (uploadRes.ok) {
                    const uploadData = await uploadRes.json();
                    const url = uploadData.fileUrl;

                    if (!productImageMap[match.productId]) {
                        productImageMap[match.productId] = [];
                    }
                    productImageMap[match.productId].push(url);
                }
            }

            // 2. 상품 데이터 구성 (기존 이미지 유지 여부? 일단 교체하는 것으로 구현, 필요시 기존 목록에 추가 가능)
            // 여기서는 사용자 요청에 따라 "자동 삽입"이므로 기존 이미지를 대체하거나 추가할 수 있음.
            // 보통은 한 상품당 하나의 메인 이미지를 바꾸는 경우가 많으므로 리스트를 업데이트함.

            for (const productId in productImageMap) {
                const product = products.find(p => p.id === parseInt(productId));
                if (product) {
                    productsToUpdate.push({
                        ...product,
                        images: productImageMap[productId] // 여기서는 업로드한 것들로 교체
                    });
                }
            }

            // 3. 벌크 업데이트 요청
            const updateRes = await fetch('/api/products/admin/bulk-update', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(productsToUpdate)
            });

            if (updateRes.ok) {
                alert('이미지 업데이트가 성공적으로 완료되었습니다.');
                onUpdateSuccess();
                onClose();
            } else {
                alert('업데이트 과정에서 오류가 발생했습니다.');
            }
        } catch (err) {
            console.error(err);
            alert('오류가 발생했습니다.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="modal-overlay" style={{ zIndex: 3000 }}>
            <div className="modal-content" style={{ maxWidth: '900px', width: '90%', height: '80vh', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>📸 이미지 일괄 매칭 및 업로드</h2>
                    <button className="modal-close-btn" onClick={onClose} style={{ position: 'relative', top: 0, right: 0 }}>×</button>
                </div>

                <div style={{ padding: '20px', flex: 1, overflowY: 'auto' }}>
                    <div style={{ marginBottom: '20px', padding: '15px', background: '#f8fafc', borderRadius: '12px', border: '2px dashed #cbd5e1', textAlign: 'center' }}>
                        <p style={{ marginBottom: '10px', color: '#64748b', fontWeight: 600 }}>사진 파일을 선택하거나 이곳으로 드래그하세요.</p>
                        <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '15px' }}>(파일명과 상품명이 일치하면 자동으로 매칭됩니다. 공백 무시)</p>
                        <input
                            type="file"
                            multiple
                            accept="image/*"
                            id="bulk-img-input"
                            onChange={handleFileChange}
                            style={{ display: 'none' }}
                        />
                        <label htmlFor="bulk-img-input" className="apply-btn" style={{ background: '#3b82f6', display: 'inline-block', cursor: 'pointer' }}>
                            📁 파일 선택하기
                        </label>
                    </div>

                    {matches.length > 0 && (
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th style={{ width: '80px' }}>미리보기</th>
                                    <th>파일명</th>
                                    <th>매칭 상품</th>
                                    <th style={{ width: '60px', textAlign: 'center' }}>삭제</th>
                                </tr>
                            </thead>
                            <tbody>
                                {matches.map((match) => (
                                    <tr key={match.id}>
                                        <td>
                                            <img src={match.previewUrl} style={{ width: '60px', height: '60px', borderRadius: '8px', objectFit: 'cover' }} alt="preview" />
                                        </td>
                                        <td style={{ fontSize: '0.85rem', color: '#475569' }}>{match.filename}</td>
                                        <td>
                                            <SearchableProductSelect
                                                value={match.productId}
                                                products={products}
                                                onChange={(productId) => handleProductChange(match.id, productId)}
                                            />
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            <button className="action-btn" onClick={() => removeMatch(match.id)} style={{ color: '#ef4444', border: 'none', background: 'none', fontSize: '1.2rem' }}>×</button>
                                        </td>
                                    </tr>
                                )).reverse()}
                            </tbody>
                        </table>
                    )}

                    {matches.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '50px', color: '#94a3b8' }}>
                            선택된 파일이 없습니다.
                        </div>
                    )}
                </div>

                <div style={{ padding: '20px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                    <button className="action-btn" onClick={onClose} disabled={isLoading}>취소</button>
                    <button
                        className="apply-btn"
                        onClick={handleSave}
                        disabled={isLoading || matches.filter(m => m.productId).length === 0}
                        style={{ minWidth: '150px' }}
                    >
                        {isLoading ? '업로드 중...' : `매칭된 ${matches.filter(m => m.productId).length}개 업데이트`}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BulkImageMatchModal;
