import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, ActivityIndicator, FlatList, TextInput, Alert } from 'react-native';
import { api } from '../api/api';
import { MedicationCard } from './MedicationCard';
import { IncomeModal } from './IncomeModal';
import { WriteOffModal } from './WriteOffModal';

export const MedicationList = () => {
  const [medications, setMedications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const searchQueryRef = useRef(searchQuery);

  // Состояние модалок
  const [incomeModal, setIncomeModal] = useState<{ visible: boolean; medId: number; medName: string; locationId: number }>({ visible: false, medId: 0, medName: '', locationId: 0 });
  const [writeOffModal, setWriteOffModal] = useState<{ visible: boolean; medId: number; medName: string; locationId: number }>({ visible: false, medId: 0, medName: '', locationId: 0 });

  useEffect(() => {
    searchQueryRef.current = searchQuery;
  }, [searchQuery]);

  const fetchMedications = (query: string = '') => {
    setLoading(true);
    const endpoint = query ? `/medications/search?q=${encodeURIComponent(query)}` : '/medications';
    api.get(endpoint)
      .then(response => {
        // /medications returns { data: [], total, ... } when no barcode filter
        // /medications/search returns a plain array
        const raw = response.data;
        const list = Array.isArray(raw) ? raw : (raw.data ?? raw);
        setMedications(Array.isArray(list) ? list : []);
        setError('');
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setError('Ошибка при загрузке данных: ' + err.message);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchMedications();
  }, []);

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    fetchMedications(text);
  };

  // Выполнение транзакции прямо из списка (быстрый приход/расход)
  const handleIncomeSubmit = async (data: { quantity: number; expirationDate?: string; price?: number }) => {
    await api.post('/transactions', {
      type: 'INCOME',
      quantity: data.quantity,
      medicationId: incomeModal.medId,
      locationId: incomeModal.locationId,
      expirationDate: data.expirationDate,
      price: data.price
    });
    // Перезапрашиваем список
    const endpoint = searchQueryRef.current ? `/medications/search?q=${encodeURIComponent(searchQueryRef.current)}` : '/medications';
    const response = await api.get(endpoint);
    const raw2 = response.data;
    const list2 = Array.isArray(raw2) ? raw2 : (raw2.data ?? raw2);
    setMedications(Array.isArray(list2) ? list2 : []);
  };

  const handleWriteOffSubmit = async (data: { quantity: number; reason: string }) => {
    await api.post('/transactions', {
      type: 'WRITE_OFF',
      quantity: data.quantity,
      medicationId: writeOffModal.medId,
      locationId: writeOffModal.locationId,
      reason: data.reason
    });
    // Перезапрашиваем список
    const endpoint = searchQueryRef.current ? `/medications/search?q=${encodeURIComponent(searchQueryRef.current)}` : '/medications';
    const response = await api.get(endpoint);
    const raw2 = response.data;
    const list2 = Array.isArray(raw2) ? raw2 : (raw2.data ?? raw2);
    setMedications(Array.isArray(list2) ? list2 : []);
  };

  const handleIncomeClick = useCallback((medicationId: number, medicationName: string, locationId: number) => {
    setIncomeModal({ visible: true, medId: medicationId, medName: medicationName, locationId });
  }, []);

  const handleWriteOffClick = useCallback((medicationId: number, medicationName: string, locationId: number) => {
    setWriteOffModal({ visible: true, medId: medicationId, medName: medicationName, locationId });
  }, []);

  const renderItem = useCallback(({ item }: { item: any }) => (
    <MedicationCard 
      item={item} 
      onIncomeClick={handleIncomeClick} 
      onWriteOffClick={handleWriteOffClick} 
    />
  ), [handleIncomeClick, handleWriteOffClick]);

  return (
    <View className="flex-1 w-full bg-[#F1F5F9]">
      {/* Строка поиска */}
      <View className="mb-4">
        <TextInput
          className="bg-white px-4 py-3 rounded-xl border border-slate-200 text-[#0A2342] text-base shadow-sm focus:border-[#0891B2]"
          placeholder="Поиск по названию или штрихкоду..."
          placeholderTextColor="#94A3B8"
          value={searchQuery}
          onChangeText={handleSearch}
          clearButtonMode="while-editing"
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

      {error ? (
        <View className="bg-red-50 p-4 rounded-xl border border-red-100 mb-4">
          <Text className="text-red-600 text-center text-sm font-medium">{error}</Text>
        </View>
      ) : null}

      {loading && medications.length === 0 ? (
        <ActivityIndicator size="large" color="#0891B2" className="mt-10" />
      ) : (
        <FlatList
          data={medications}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
          ListEmptyComponent={
            <View className="py-20 items-center justify-center">
              <Text className="text-5xl mb-4">📭</Text>
              <Text className="text-slate-500 text-lg font-bold">Медикаменты не найдены</Text>
              <Text className="text-slate-400 text-sm mt-1 text-center px-10">Попробуйте изменить поисковой запрос или отсканируйте другой штрихкод</Text>
            </View>
          }
          contentContainerStyle={{ paddingBottom: 20 }}
          refreshing={loading}
          onRefresh={() => fetchMedications(searchQuery)}
        />
      )}
    </View>
  );
};
