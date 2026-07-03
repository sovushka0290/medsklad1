import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ActivityIndicator, FlatList, RefreshControl, Alert } from 'react-native';
import { api } from '../../src/api/api';
import { MedicationCard } from '../../src/components/MedicationCard';
import { IncomeModal } from '../../src/components/IncomeModal';
import { WriteOffModal } from '../../src/components/WriteOffModal';

export default function CriticalScreen() {
  const [medications, setMedications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Состояние модалок
  const [incomeModal, setIncomeModal] = useState<{ visible: boolean; medId: number; medName: string; locationId: number }>({ visible: false, medId: 0, medName: '', locationId: 0 });
  const [writeOffModal, setWriteOffModal] = useState<{ visible: boolean; medId: number; medName: string; locationId: number }>({ visible: false, medId: 0, medName: '', locationId: 0 });

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

  const handleIncomeSubmit = async (data: { quantity: number; expirationDate?: string; price?: number }) => {
    await api.post('/transactions', {
      type: 'INCOME',
      quantity: data.quantity,
      medicationId: incomeModal.medId,
      locationId: incomeModal.locationId,
      expirationDate: data.expirationDate,
      price: data.price
    });
    fetchCritical();
  };

  const handleWriteOffSubmit = async (data: { quantity: number; reason: string }) => {
    await api.post('/transactions', {
      type: 'WRITE_OFF',
      quantity: data.quantity,
      medicationId: writeOffModal.medId,
      locationId: writeOffModal.locationId,
      reason: data.reason
    });
    fetchCritical();
  };

  const handleIncomeClick = useCallback((medicationId: number, medicationName: string, locationId: number) => {
    setIncomeModal({ visible: true, medId: medicationId, medName: medicationName, locationId });
  }, []);

  const handleWriteOffClick = useCallback((medicationId: number, medicationName: string, locationId: number) => {
    setWriteOffModal({ visible: true, medId: medicationId, medName: medicationName, locationId });
  }, []);

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
            Здесь показаны товары, чей общий остаток опустился ниже лимита, либо у которых истекает срок годности (в течение 30 дней).
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
          <MedicationCard 
            item={item} 
            onIncomeClick={handleIncomeClick} 
            onWriteOffClick={handleWriteOffClick} 
          />
        )}
        ListEmptyComponent={
          <View className="py-10 items-center justify-center">
            <Text className="text-slate-400 text-3xl mb-2">🎉</Text>
            <Text className="text-slate-500 text-base text-center font-medium">
              Все товары на складе в достаточном количестве и со свежими сроками.
            </Text>
          </View>
        }
        contentContainerStyle={{ paddingBottom: 20 }}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={fetchCritical} colors={['#0891B2']} />
        }
      />

      <IncomeModal 
        visible={incomeModal.visible}
        medicationName={incomeModal.medName}
        onClose={() => setIncomeModal(prev => ({ ...prev, visible: false }))}
        onSubmit={handleIncomeSubmit}
      />

      <WriteOffModal 
        visible={writeOffModal.visible}
        medicationName={writeOffModal.medName}
        onClose={() => setWriteOffModal(prev => ({ ...prev, visible: false }))}
        onSubmit={handleWriteOffSubmit}
      />
    </View>
  );
}
