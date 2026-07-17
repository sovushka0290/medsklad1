import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Alert } from 'react-native';

// Use EXPO_PUBLIC_API_URL or fallback to vercel
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://backend-steel-sigma.vercel.app/api';

export const api = axios.create({
  baseURL: API_URL,
  timeout: 60000, // 60-second timeout for server cold starts
});

let isAlertShown = false;
const showAlert = (title: string, message: string) => {
  if (isAlertShown) return;
  isAlertShown = true;
  Alert.alert(title, message, [{ text: 'OK', onPress: () => { isAlertShown = false; } }]);
};

export const formatDetailedError = (error: any): string => {
  if (!error) return 'Неизвестная ошибка';
  
  let msg = '';
  
  // Extract main error text
  if (error.response) {
    const status = error.response.status;
    const statusText = error.response.statusText || '';
    const serverMsg = error.response.data?.error || error.response.data?.message;
    msg += `[HTTP ${status} ${statusText}]\n`;
    if (serverMsg) {
      msg += `Детали: ${serverMsg}\n`;
    }
  } else if (error.request) {
    msg += 'Запрос отправлен, но нет ответа от сервера.\n';
  } else {
    msg += `Ошибка инициализации запроса: ${error.message}\n`;
  }
  
  // Extract error code (Axios / network specific)
  if (error.code) {
    msg += `Код ошибки: ${error.code}\n`;
  }

  // Extract endpoint details
  if (error.config) {
    const url = error.config.url || '';
    const method = (error.config.method || '').toUpperCase();
    msg += `Метод/УРЛ: ${method} ${url}\n`;
  }

  return msg.trim();
};

api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

api.interceptors.response.use((response) => {
  return response;
}, async (error) => {
  const originalRequest = error?.config;
  const skipAlerts = originalRequest?.skipErrorAlerts;
  
  // Handle request timeouts and connection drops
  if (error.code === 'ECONNABORTED' || !error.response) {
    const isMutating = ['post', 'put', 'delete'].includes(originalRequest?.method?.toLowerCase() || '');
    
    if (originalRequest && isMutating && !originalRequest.headers['X-Sync-Retry']) {
      const { enqueueTransaction } = require('./offline_queue');
      
      // Parse data if it's a string (axios config.data is often stringified)
      let parsedData = originalRequest.data;
      try {
        if (typeof parsedData === 'string') {
          parsedData = JSON.parse(parsedData);
        }
      } catch (e) {}
      
      let mockResponseData: any = { success: true, offline: true };

      // Особый случай: создание инвентаризации offline (Ф-18)
      if (originalRequest.url?.includes('/inventory/start') || originalRequest.url?.includes('/inventory') && originalRequest.method?.toLowerCase() === 'post') {
        const localId = 'local_' + Date.now();
        parsedData = { ...parsedData, localId };
        mockResponseData = { success: true, offline: true, id: localId, status: 'ACTIVE', items: [], location: {} };
      }
      
      await enqueueTransaction(originalRequest.url, originalRequest.method, parsedData);
      
      if (!skipAlerts) {
        showAlert(
          'Отсутствует сеть',
          'Операция сохранена локально и будет отправлена при восстановлении сети.'
        );
      }
      
      // Resolve so UI thinks it succeeded
      return Promise.resolve({ data: mockResponseData });
    }

    if (!skipAlerts) {
      const detailedMsg = formatDetailedError(error);
      if (error.code === 'ECONNABORTED') {
        showAlert(
          'Превышено время ожидания',
          'Сервер загружается после простоя. Пожалуйста, попробуйте еще раз.\n\n' + detailedMsg
        );
      } else {
        showAlert(
          'Ошибка сети / соединения',
          'Не удалось связаться с сервером. Пожалуйста, убедитесь, что вы подключены к интернету.\n\n' + detailedMsg
        );
      }
    }
  }
  
  if (error.response?.status === 401 && !originalRequest._retry && originalRequest.url !== '/auth/login' && originalRequest.url !== '/auth/refresh') {
    originalRequest._retry = true;
    
    try {
      const refreshToken = await SecureStore.getItemAsync('refreshToken');
      if (!refreshToken) {
        await SecureStore.deleteItemAsync('accessToken');
        await SecureStore.deleteItemAsync('refreshToken');
        const { resetToLogin } = require('./navigation_ref');
        resetToLogin();
        return Promise.reject(error);
      }

      const response = await axios.post(`${API_URL}/auth/refresh`, { refreshToken }, { timeout: 60000 });
      
      if (response.data?.success) {
        const { token, refreshToken: newRefreshToken } = response.data.data;
        
        await SecureStore.setItemAsync('accessToken', token);
        if (newRefreshToken) {
          await SecureStore.setItemAsync('refreshToken', newRefreshToken);
        }
        
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return api(originalRequest);
      }
    } catch (refreshError) {
      await SecureStore.deleteItemAsync('accessToken');
      await SecureStore.deleteItemAsync('refreshToken');
      const { resetToLogin } = require('./navigation_ref');
      resetToLogin();
      return Promise.reject(refreshError);
    }
  }

  // Handle 4xx / 5xx HTTP errors with detailed diagnostics
  if (error.response && !skipAlerts) {
    const status = error.response.status;
    const detailedMsg = formatDetailedError(error);

    if (status === 400) {
      showAlert('Ошибка запроса [400]', `Неверные данные запроса.\n\n${detailedMsg}`);
    } else if (status === 403) {
      showAlert('Доступ запрещён [403]', `У вас нет прав для этой операции.\n\n${detailedMsg}`);
    } else if (status === 404) {
      showAlert('Не найдено [404]', `Запрошенный ресурс не существует.\n\n${detailedMsg}`);
    } else if (status === 409) {
      showAlert('Конфликт данных [409]', `Данные уже существуют или конфликт состояния.\n\n${detailedMsg}`);
    } else if (status === 422) {
      showAlert('Ошибка валидации [422]', `Данные не прошли проверку.\n\n${detailedMsg}`);
    } else if (status >= 500) {
      showAlert(`Ошибка сервера [${status}]`, `Произошла внутренняя ошибка сервера. Обратитесь к администратору.\n\n${detailedMsg}`);
    }
  }
  
  return Promise.reject(error);
});

