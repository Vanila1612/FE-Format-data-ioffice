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

export async function downloadFile(path: string, fallbackName = 'ioffice-export.xlsx') {
  const response = await api.get<Blob>(path, { responseType: 'blob' });
  const contentDisposition = String(response.headers['content-disposition'] || '');
  const match = contentDisposition.match(/filename="?([^";]+)"?/i);
  const fileName = match?.[1] || fallbackName;
  const url = URL.createObjectURL(new Blob([response.data], { type: String(response.headers['content-type'] || 'application/octet-stream') }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
