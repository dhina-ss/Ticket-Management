import axios from 'axios';

// Use a relative baseURL when accessed via ngrok, localhost, or 127.0.0.1
// to avoid mixed-content (HTTPS page → HTTP API) blocks on mobile.
const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
const isNgrokOrLocal =
    hostname.includes('ngrok') ||
    hostname === 'localhost' ||
    hostname === '127.0.0.1';

const api = axios.create({
    baseURL: isNgrokOrLocal ? '' : (import.meta.env.VITE_API_URL || ''),
    withCredentials: true,
});

export default api;
