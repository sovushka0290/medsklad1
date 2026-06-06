import axios from 'axios';
import { Platform } from 'react-native';

// Умное переключение URL: для Android эмулятора нужен 10.0.2.2, для iOS и веба - 127.0.0.1
const baseURL = Platform.OS === 'android' ? 'http://10.0.2.2:3000/api' : 'http://127.0.0.1:3000/api';

export const api = axios.create({
  baseURL,
});
