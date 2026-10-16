import axios from 'axios';
import { getCsrfToken, setCsrfToken } from '@/lib/auth';

const axiosInstance = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000',
    headers: { 'Content-Type': 'application/json' },
    timeout: 45000,
    withCredentials: true, // send the httpOnly session cookie
});

axiosInstance.interceptors.request.use((config) => {
    const method = (config.method || 'get').toLowerCase();
    const token = getCsrfToken();
    if (token && method !== 'get' && method !== 'head') {
        config.headers['X-CSRF-Token'] = token;
    }
    return config;
});

// Endpoints where a 401 is an expected answer, not an expired session.
const AUTH_PROBES = ['/api/auth/login', '/api/auth/me', '/api/auth/register'];

axiosInstance.interceptors.response.use(
    (response) => response,
    (error) => {
        const status = error.response?.status;
        const url: string = error.config?.url || '';
        if (status === 401 && typeof window !== 'undefined' && !AUTH_PROBES.some((p) => url.includes(p))) {
            setCsrfToken(null);
            const here = window.location.pathname;
            if (here !== '/login') window.location.href = `/login?reason=expired&next=${encodeURIComponent(here)}`;
        }
        return Promise.reject(error);
    },
);

export default axiosInstance;
