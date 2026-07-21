import axios from 'axios';

const axiosInstance = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000',
    headers: {
        'Content-Type': 'application/json',
    },
    timeout: 15000,
});

// ── Request interceptor — attach token automatically ──────
axiosInstance.interceptors.request.use(
  (config) => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("token");

      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// ── Response interceptor — handle errors globally ──────────
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.code === "ERR_NETWORK") {
      // No response at all — backend unreachable, wrong URL, or CORS block
      console.error(
        `Could not reach the API at ${axiosInstance.defaults.baseURL}. ` +
        `Check that the backend is running and NEXT_PUBLIC_API_URL is set correctly.`
      );
    } else if (error.response?.status === 401) {
      // Clear stale auth data and redirect to login
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;