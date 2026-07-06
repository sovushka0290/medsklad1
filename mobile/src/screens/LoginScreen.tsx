import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { api } from '../services/api_service';
import { registerForPushNotificationsAsync } from '../services/push_service';

// Define props for navigation if using TypeScript
export default function LoginScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Ошибка', 'Введите email и пароль');
      return;
    }

    setLoading(true);
    try {
      // Assuming backend returns { token: '...', user: {...} }
      const response = await api.post('/auth/login', { email, password });
      
      if (response.data.data?.token) {
        await SecureStore.setItemAsync('accessToken', response.data.data.token);
        if (response.data.data.refreshToken) {
          await SecureStore.setItemAsync('refreshToken', response.data.data.refreshToken);
        }
        if (response.data.data.user?.role) {
          await SecureStore.setItemAsync('userRole', response.data.data.user.role);
        }
        
        // Register for push notifications after token is set
        await registerForPushNotificationsAsync();

        // Navigate to Main Tab Navigator
        navigation.replace('Main');
      } else {
        Alert.alert('Ошибка', 'Неверные данные для входа');
      }
    } catch (error: any) {
      const msg = error.response?.data?.message || 'Ошибка подключения к серверу';
      Alert.alert('Ошибка авторизации', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>МедСклад</Text>
      <Text style={styles.subtitle}>Вход в систему</Text>

      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          placeholder="Пароль"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity 
          style={styles.button} 
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Войти</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#F1F5F9', // Light Gray background
  },
  logo: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#0A2342', // Dark Blue
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 40,
  },
  form: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 16,
    marginBottom: 16,
    fontSize: 16,
    backgroundColor: '#f8fafc',
  },
  button: {
    backgroundColor: '#0891B2', // Turquoise
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});
