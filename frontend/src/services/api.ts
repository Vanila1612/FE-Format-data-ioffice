import axios from 'axios';
import type { ApiResponse } from '../types/api';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api'
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('ioffice.token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const payload = error.response?.data as ApiResponse<unknown> | undefined;
    const message = payload && !payload.success ? payload.error.message : error.message;
    return Promise.reject(new Error(message));
  }
);

export function unwrap<T>(response: { data: ApiResponse<T> }): T {
  if (!response.data.success) throw new Error(response.data.error.message);
  return response.data.data;
}

export function downloadUrl(path: string) {
  const base = import.meta.env.VITE_API_BASE_URL || '/api';
  return `${base}${path}`;
}
