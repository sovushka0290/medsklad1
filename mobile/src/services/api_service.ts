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
    if (
      originalRequest.method?.toLowerCase() === 'post' && 
      originalRequest.url?.includes('/transactions') &&
      !originalRequest.headers['X-Sync-Retry']
    ) {
      const { enqueueTransaction } = require('./offline_queue');
      
      // Parse data if it's a string (axios config.data is often stringified)
      let parsedData = originalRequest.data;
      try {
        if (typeof parsedData === 'string') {
          parsedData = JSON.parse(parsedData);
        }
      } catch (e) {}
      
      enqueueTransaction(originalRequest.url, originalRequest.method, parsedData);
      
      if (!skipAlerts) {
        showAlert(
          'Отсутствует сеть',
          'Операция сохранена локально и будет отправлена при появлении интернета.'
        );
      }
      
      // Resolve so UI thinks it succeeded
      return Promise.resolve({ data: { success: true, offline: true } });
    }

    if (!skipAlerts) {
      if (error.code === 'ECONNABORTED') {
        showAlert(
          'Превышено время ожидания',
          'Сервер загружается после простоя. Пожалуйста, попробуйте еще раз.'
        );
      } else {
        showAlert(
          'Ошибка сети',
          'Не удалось связаться с сервером. Пожалуйста, убедитесь, что вы подключены к интернету.'
        );
      }
    }
  }
  
  if (error.response?.status === 401 && !originalRequest._retry && originalRequest.url !== '/auth/login' && originalRequest.url !== '/auth/refresh') {
    originalRequest._retry = true;
    
    try {
      const refreshToken = await SecureStore.getItemAsync('refreshToken');
      if (!refreshToken) {
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
      return Promise.reject(refreshError);
    }
  }
  
  return Promise.reject(error);
});
