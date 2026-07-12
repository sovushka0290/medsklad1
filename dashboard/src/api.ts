import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export const api = axios.create({
  baseURL: API_URL,
});

// ─── Error Formatter ─────────────────────────────────────────────────────────

export interface DetailedError {
  title: string;
  message: string;
  code?: string | number;
}

export const formatDetailedError = (error: any): DetailedError => {
  if (!error) return { title: 'Неизвестная ошибка', message: 'Ошибка без деталей' };

  let title = 'Ошибка';
  let lines: string[] = [];
  let code: string | number | undefined;

  if (error.response) {
    const status: number = error.response.status;
    const statusText: string = error.response.statusText || '';
    const serverMsg: string =
      error.response.data?.error ||
      error.response.data?.message ||
      error.response.data?.details ||
      '';

    code = status;

    if (status === 400) title = `Ошибка запроса [400]`;
    else if (status === 401) title = `Не авторизован [401]`;
    else if (status === 403) title = `Доступ запрещён [403]`;
    else if (status === 404) title = `Не найдено [404]`;
    else if (status === 409) title = `Конфликт данных [409]`;
    else if (status === 422) title = `Ошибка валидации [422]`;
    else if (status >= 500) title = `Ошибка сервера [${status}]`;
    else title = `HTTP ${status} ${statusText}`;

    if (serverMsg) lines.push(`Детали: ${serverMsg}`);
  } else if (error.request) {
    title = 'Нет ответа от сервера';
    lines.push('Запрос отправлен, но сервер не ответил.');
  } else {
    title = 'Ошибка инициализации запроса';
    lines.push(error.message || 'Неизвестная ошибка');
  }

  if (error.code) {
    code = error.code;
    lines.push(`Код ошибки: ${error.code}`);
  }

  if (error.config) {
    const method = (error.config.method || '').toUpperCase();
    const url = error.config.url || '';
    lines.push(`Запрос: ${method} ${url}`);
  }

  return {
    title,
    message: lines.join('\n'),
    code,
  };
};

// ─── Toast Notification System ───────────────────────────────────────────────

type ToastType = 'error' | 'warning' | 'info';

const toastQueue: Array<{ type: ToastType; title: string; message: string }> = [];

export const showErrorToast = (title: string, message: string, type: ToastType = 'error') => {
  toastQueue.push({ type, title, message });
  // Dispatch custom DOM event for the ErrorToast component to consume
  const event = new CustomEvent('medsklad:toast', {
    detail: { type, title, message, id: Date.now() },
  });
  window.dispatchEvent(event);
};

// ─── Request Interceptor ──────────────────────────────────────────────────────

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ─── Response Interceptor ────────────────────────────────────────────────────

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const skipToast = error?.config?.skipErrorToast;

    if (!skipToast) {
      const { title, message } = formatDetailedError(error);

      const status: number | undefined = error.response?.status;

      if (!error.response) {
        // Network error / server unreachable
        showErrorToast(title, message || 'Проверьте интернет-соединение и доступность сервера.', 'error');
      } else if (status === 401) {
        // Redirect to login — don't spam toast for auth errors
        localStorage.removeItem('token');
        if (!window.location.pathname.includes('/login')) {
          window.location.href = '/login';
        }
      } else if (status === 403) {
        showErrorToast(title, message || 'Недостаточно прав для выполнения операции.', 'warning');
      } else if (status && status >= 400) {
        showErrorToast(title, message, status >= 500 ? 'error' : 'warning');
      }
    }

    return Promise.reject(error);
  }
);
