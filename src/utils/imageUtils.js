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
