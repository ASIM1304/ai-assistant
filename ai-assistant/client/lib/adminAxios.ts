import axios from 'axios';

/** Separate HTTP client for the admin portal: own cookie (asid), own CSRF token, own login page. */
let adminCsrf: string | null = null;
export const setAdminCsrf = (t: string | null) => { adminCsrf = t; };

const adminAxios = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000',
    headers: { 'Content-Type': 'application/json' },
    timeout: 30000,
    withCredentials: true,
});

adminAxios.interceptors.request.use((config) => {
    const m = (config.method || 'get').toLowerCase();
    if (adminCsrf && m !== 'get' && m !== 'head') config.headers['X-CSRF-Token'] = adminCsrf;
    return config;
});

adminAxios.interceptors.response.use(
    (r) => r,
    (error) => {
        const url: string = error.config?.url || '';
        if (error.response?.status === 401 && typeof window !== 'undefined' && !url.includes('/auth/')) {
            setAdminCsrf(null);
            window.location.href = '/admin/login?reason=expired';
        }
        return Promise.reject(error);
    },
);

export default adminAxios;
