import { getApiBaseUrl } from '../api';

/**
 * Compress an image File using an offscreen canvas.
 * Downscales to max 1024px on the longest side and exports as JPEG at 0.75 quality.
 * @param {File} file
 * @returns {Promise<string>} Compressed base64 data URL.
 */
export const compressImage = (file) =>
    new Promise((resolve, reject) => {
        const MAX_PX = 1024;
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('Failed to read image file.'));
        reader.onload = (evt) => {
            const img = new Image();
            img.onerror = () => reject(new Error('Invalid or unsupported image format.'));
            img.onload = () => {
                let { width, height } = img;
                if (width > MAX_PX || height > MAX_PX) {
                    if (width >= height) {
                        height = Math.round((height * MAX_PX) / width);
                        width = MAX_PX;
                    } else {
                        width = Math.round((width * MAX_PX) / height);
                        height = MAX_PX;
                    }
                }
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    reject(new Error('Canvas 2D context unavailable.'));
                    return;
                }
                // Fill white background so transparent PNGs/WEBPs do not turn black in JPEG
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, width, height);
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', 0.75));
            };
            img.src = evt.target.result;
        };
        reader.readAsDataURL(file);
    });

/**
 * Resolve an asset image src (base64 data URL, absolute HTTP URL, or relative API path).
 * @param {string} img
 * @returns {string}
 */
export const resolveAssetImageUrl = (img) => {
    if (!img) return '';
    if (img.startsWith('data:image') || img.startsWith('http://') || img.startsWith('https://')) {
        return img;
    }
    return `${getApiBaseUrl()}${img}`;
};
