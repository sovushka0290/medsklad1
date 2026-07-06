import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Alert } from 'react-native';

// Dynamic API URL for Expo to avoid hardcoding local IP addresses
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:3000/api';

export const api = axios.create({
  baseURL: API_URL,
  timeout: 10000, // 10-second timeout to prevent indefinite hangs
});

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
  const originalRequest = error.config;
  
  // Handle request timeouts and connection drops
  if (error.code === 'ECONNABORTED') {
    Alert.alert(
      'Превышено время ожидания',
      'Сервер не ответил вовремя. Проверьте интернет-соединение.'
    );
  } else if (!error.response) {
    Alert.alert(
      'Ошибка сети',
      'Не удалось связаться с сервером. Пожалуйста, убедитесь, что вы подключены к интернету.'
    );
  }
  
  if (error.response?.status === 401 && !originalRequest._retry && originalRequest.url !== '/auth/login' && originalRequest.url !== '/auth/refresh') {
    originalRequest._retry = true;
    
    try {
      const refreshToken = await SecureStore.getItemAsync('refreshToken');
      if (!refreshToken) {
        return Promise.reject(error);
      }

      const response = await axios.post(`${API_URL}/auth/refresh`, { refreshToken }, { timeout: 5000 });
      
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
