import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  ActivityIndicator, 
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { api } from '../services/api_service';
import { registerForPushNotificationsAsync } from '../services/push_service';
import { Ionicons } from '@expo/vector-icons';

export default function LoginScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isEmailFocused, setIsEmailFocused] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Ошибка', 'Введите email и пароль');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/auth/login', { email, password });
      
      if (response.data.data?.token) {
        await SecureStore.setItemAsync('accessToken', response.data.data.token);
        if (response.data.data.refreshToken) {
          await SecureStore.setItemAsync('refreshToken', response.data.data.refreshToken);
        }
        if (response.data.data.user?.role) {
          await SecureStore.setItemAsync('userRole', response.data.data.user.role);
        }
        
        await registerForPushNotificationsAsync();
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
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        <View style={styles.headerArea}>
          <View style={styles.iconWrapper}>
            <Ionicons name="shield-checkmark" size={40} color="#fff" />
          </View>
          <Text style={styles.logo}>МедСклад</Text>
          <Text style={styles.subtitle}>Система мобильной отчетности</Text>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.cardTitle}>Авторизация</Text>
          
          <View style={styles.inputWrapper}>
            <Text style={styles.inputLabel}>Email</Text>
            <View style={[
              styles.inputContainer, 
              isEmailFocused && styles.inputFocused
            ]}>
              <Ionicons name="mail-outline" size={20} color={isEmailFocused ? '#0891B2' : '#94a3b8'} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="example@med.kz"
                placeholderTextColor="#94A3B8"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                onFocus={() => setIsEmailFocused(true)}
                onBlur={() => setIsEmailFocused(false)}
              />
            </View>
          </View>

          <View style={styles.inputWrapper}>
            <Text style={styles.inputLabel}>Пароль</Text>
            <View style={[
              styles.inputContainer, 
              isPasswordFocused && styles.inputFocused
            ]}>
              <Ionicons name="lock-closed-outline" size={20} color={isPasswordFocused ? '#0891B2' : '#94a3b8'} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor="#94A3B8"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                onFocus={() => setIsPasswordFocused(true)}
                onBlur={() => setIsPasswordFocused(false)}
              />
            </View>
          </View>

          <TouchableOpacity 
            style={[styles.button, loading && styles.buttonDisabled]} 
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Войти</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  headerArea: {
    alignItems: 'center',
    marginBottom: 32,
  },
  iconWrapper: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: '#0891B2',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0891B2',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
    marginBottom: 16,
  },
  logo: {
    fontSize: 32,
    fontWeight: '900',
    color: '#0A2342',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 6,
    fontWeight: '500',
  },
  formCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 28,
    padding: 24,
    shadowColor: '#0A2342',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
    elevation: 4,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 24,
    textAlign: 'center',
  },
  inputWrapper: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    height: 52,
    paddingHorizontal: 16,
  },
  inputFocused: {
    borderColor: '#0891B2',
    backgroundColor: '#ffffff',
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    color: '#0F172A',
    fontSize: 16,
    height: '100%',
  },
  button: {
    backgroundColor: '#0891B2',
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    shadowColor: '#0891B2',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
