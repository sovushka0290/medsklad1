import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Имитация SecureStore для React Native
const SecureStore = {
  getItemAsync: async (key: string) => {
    return await AsyncStorage.getItem(key);
  },
  setItemAsync: async (key: string, value: string) => {
    await AsyncStorage.setItem(key, value);
  },
  deleteItemAsync: async (key: string) => {
    await AsyncStorage.removeItem(key);
  }
};

const API_URL = 'http://localhost:3000/api';

export const api = axios.create({
  baseURL: API_URL,
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
  
  if (error.response?.status === 401 && !originalRequest._retry && originalRequest.url !== '/auth/login' && originalRequest.url !== '/auth/refresh') {
    originalRequest._retry = true;
    
    try {
      const refreshToken = await SecureStore.getItemAsync('refreshToken');
      if (!refreshToken) {
        return Promise.reject(error);
      }

      const response = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
      
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
