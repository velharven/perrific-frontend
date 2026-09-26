import axios from 'axios';

const TOKEN_KEY = 'task_manager_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export const api = axios.create({
  baseURL: '/api',
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    // Hanya request non-auth yang 401 boleh mengakhiri sesi; panggilan auth
    // sendiri (/auth/me saat boot, login, dsb.) ditangani pemanggilnya agar
    // gangguan sesaat (network/5xx) tidak membuang token yang masih valid.
    const url = String(error.config?.url ?? '');
    const isAuthCall = url === '/auth/me' || url.endsWith('/auth/me') || url.includes('/auth/login') || url.includes('/auth/register') || url.includes('/auth/google');
    const isCalendarCall = url.includes('/calendar/google');
    if (error.response?.status === 401 && !isAuthCall && !isCalendarCall && !window.location.pathname.startsWith('/login')) {
      clearToken();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);

export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? 'http://localhost:4000';
