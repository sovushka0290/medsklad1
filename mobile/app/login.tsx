import { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useAuth } from '../src/context/AuthContext';
import { api } from '../src/api/api';
import { useRouter } from 'expo-router';

const ROLES = [
  { id: 'ADMIN', name: 'Администратор', email: 'admin@medsklad.kz', icon: '👑', color: 'bg-rose-500', text: 'text-rose-500' },
  { id: 'HEAD_NURSE', name: 'Старшая медсестра', email: 'headnurse@medsklad.kz', icon: '⭐', color: 'bg-purple-500', text: 'text-purple-500' },
  { id: 'NURSE', name: 'Медсестра', email: 'nurse@medsklad.kz', icon: '💉', color: 'bg-emerald-500', text: 'text-emerald-500' },
  { id: 'STOREKEEPER', name: 'Кладовщик', email: 'storekeeper@medsklad.kz', icon: '📦', color: 'bg-amber-500', text: 'text-amber-500' }
];

export default function LoginScreen() {
  const [loadingRole, setLoadingRole] = useState<string | null>(null);
  const { login } = useAuth();
  const router = useRouter();

  const handleRoleLogin = async (roleId: string, email: string) => {
    try {
      setLoadingRole(roleId);
      const response = await api.post('/auth/login', {
        email,
        password: 'password123',
      });
      if (response.data.success) {
        await login(response.data.data.token, response.data.data.user);
        router.replace('/(tabs)');
      } else {
        Alert.alert('Ошибка', response.data.error || 'Ошибка входа');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      Alert.alert('Ошибка сети', 'Не удалось подключиться к серверу');
    } finally {
      setLoadingRole(null);
    }
  };

  return (
    <View className="flex-1 bg-slate-50 relative">
      <View className="absolute top-0 left-0 right-0 h-[40%] bg-[#0A2342] rounded-b-[40px] items-center justify-center pt-10">
        <View className="bg-white/20 p-4 rounded-3xl mb-4">
          <Text className="text-white text-5xl">💊</Text>
        </View>
        <Text className="text-white text-3xl font-bold tracking-wider">MedSklad</Text>
        <Text className="text-blue-100 text-sm mt-2 opacity-80 uppercase tracking-widest font-medium">Режим тестирования</Text>
      </View>

      <View className="flex-1 mt-[45%] px-6">
        <View className="bg-white rounded-[32px] p-6 shadow-xl shadow-slate-200/50">
          <View className="mb-6 items-center">
            <Text className="text-2xl font-bold text-slate-800">Выберите роль</Text>
            <Text className="text-slate-500 text-center mt-2 leading-5 text-sm">
              Для быстрого тестирования системы выберите должность, под которой хотите войти:
            </Text>
          </View>

          <View className="space-y-3">
            {ROLES.map((role) => (
              <TouchableOpacity
                key={role.id}
                className="flex-row items-center p-3 rounded-2xl border border-slate-100 bg-slate-50 active:bg-slate-100 mb-3"
                onPress={() => handleRoleLogin(role.id, role.email)}
                disabled={loadingRole !== null}
              >
                <View className={`w-12 h-12 rounded-2xl ${role.color} items-center justify-center shadow-sm`}>
                  <Text className="text-xl">{role.icon}</Text>
                </View>
                <View className="flex-1 ml-4 justify-center">
                  <Text className="text-base font-bold text-slate-800">{role.name}</Text>
                  <Text className="text-slate-400 text-[10px] mt-0.5 font-medium uppercase tracking-wider">{role.id}</Text>
                </View>
                {loadingRole === role.id ? (
                  <ActivityIndicator color="#0891B2" />
                ) : (
                  <Text className="text-slate-300 text-2xl font-light mr-2">›</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}
