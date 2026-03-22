/**
 * Handles image URLs to prevent Mixed Content errors.
 * Converts absolute backend URLs to relative paths that can be proxied by Vercel.
 */
export const getImageUrl = (url) => {
    if (!url) return '';
    
    // If it's a proxyable backend URL (either IP or localhost)
    // Common patterns: http://43.201.18.30, http://43.201.18.30:8080, http://localhost:8080, etc.
    if (url.includes('/uploads/')) {
        const parts = url.split('/uploads/');
        if (parts.length > 1) {
            return '/uploads/' + parts[parts.length - 1];
        }
    }
    
    return url;
};

export const compressImage = (file, maxWidth = 800, maxHeight = 800, quality = 0.8) => {
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

export const uploadImage = async (file) => {
    const isImage = file.type.startsWith('image/') || 
                    /\.(jpe?g|png|webp|avif|gif)$/i.test(file.name);
    const processedFile = isImage ? await compressImage(file) : file;

    const formData = new FormData();
    formData.append('file', processedFile);

    const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
    });

    if (res.ok) {
        return await res.json();
    } else {
        throw new Error('Upload failed');
    }
};
