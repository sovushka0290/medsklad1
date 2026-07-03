import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, FlatList, RefreshControl, Alert } from 'react-native';
import { api } from '../../src/api/api';
import { MedicationCard } from '../../src/components/MedicationCard';

export default function CriticalScreen() {
  const [medications, setMedications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchCritical = () => {
    setLoading(true);
    api.get('/medications/critical')
      .then(response => {
        const raw = response.data;
        setMedications(Array.isArray(raw) ? raw : (raw.data ?? []));
        setError('');
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setError('Не удалось загрузить данные критических остатков');
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchCritical();
  }, []);

  // Выполнение транзакции прямо из списка критических остатков
  const handleTransaction = async (type: 'INCOME' | 'OUTFLOW', medicationId: number, locationId: number) => {
    try {
      await api.post('/transactions', {
        type,
        quantity: 1,
        medicationId,
        locationId,
      }, {
        headers: {
          'x-api-key': 'MedSkladSecretKey123', // Передаем API ключ
        },
      });

      // Перезапрашиваем список дефицита (товар может исчезнуть из списка, если остаток восстановится!)
      const response = await api.get('/medications/critical');
      const raw = response.data;
      setMedications(Array.isArray(raw) ? raw : (raw.data ?? []));
    } catch (err: any) {
      console.error(err);
      const errMsg = err.response?.data?.error || 'Произошла ошибка при транзакции';
      Alert.alert('Ошибка', errMsg);
    }
  };

  if (loading && medications.length === 0) {
    return (
      <View className="flex-1 justify-center items-center bg-[#F1F5F9]">
        <ActivityIndicator size="large" color="#0891B2" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#F1F5F9] px-4 pt-4">
      <View className="bg-red-50 border border-red-200 p-4 rounded-xl mb-4 flex-row items-center">
        <Text className="text-2xl mr-3">⚠️</Text>
        <View className="flex-1">
          <Text className="text-red-800 font-bold text-sm">Внимание!</Text>
          <Text className="text-red-700 text-xs mt-0.5">
            Здесь показаны товары, чей общий остаток опустился ниже установленного лимита.
          </Text>
        </View>
      </View>

      {error ? (
        <View className="bg-red-100 p-4 rounded-xl border border-red-200 mb-4">
          <Text className="text-red-700 text-center text-sm font-semibold">{error}</Text>
        </View>
      ) : null}

      <FlatList
        data={medications}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <MedicationCard item={item} onTransaction={handleTransaction} />
        )}
        ListEmptyComponent={
          <View className="py-10 items-center justify-center">
            <Text className="text-slate-400 text-3xl mb-2">🎉</Text>
            <Text className="text-slate-500 text-base text-center font-medium">
              Все товары на складе в достаточном количестве.
            </Text>
          </View>
        }
        contentContainerStyle={{ paddingBottom: 20 }}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={fetchCritical} colors={['#0891B2']} />
        }
      />
    </View>
  );
}
