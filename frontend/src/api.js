import axios from 'axios';

// Use a relative baseURL when accessed from the same host (including localhost,
// LAN IPs, ngrok, or the production host over HTTP/HTTPS) so scheme/port
// mismatches never block credentialed API requests.
export const getApiBaseUrl = () => {
    const configuredUrl = import.meta.env.VITE_API_URL || '';
    if (typeof window === 'undefined') return configuredUrl;

    const hostname = window.location.hostname || '';
    const isSameOrLocal =
        hostname.includes('ngrok') ||
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname.startsWith('192.168.') ||
        hostname.startsWith('10.') ||
        hostname.startsWith('172.');

    if (isSameOrLocal) return '';

    if (configuredUrl) {
        try {
            if (new URL(configuredUrl).hostname === hostname) {
                return '';
            }
        } catch {
            // Fall back to configuredUrl if invalid
        }
    }

    return configuredUrl;
};

const api = axios.create({
    baseURL: getApiBaseUrl(),
    withCredentials: true,
});

export default api;
