import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  TextInput,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/api/api';
import { useAuth } from '../../src/context/AuthContext';

export default function NurseDashboardScreen() {
  const { user } = useAuth();

  // Состояния
  const [transactions, setTransactions] = useState<any[]>([]);
  const [medications, setMedications] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Быстрое списание
  const [showWriteOffModal, setShowWriteOffModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedMed, setSelectedMed] = useState<any>(null);
  const [quantity, setQuantity] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [txRes, locRes] = await Promise.all([
        api.get('/transactions?limit=50'),
        api.get('/locations'),
      ]);

      const txRaw = txRes.data?.data ?? txRes.data;
      const txArr = Array.isArray(txRaw) ? txRaw : [];
      // Показываем только OUTFLOW за сегодня
      const today = new Date().toISOString().split('T')[0];
      const todayOutflows = txArr.filter(
        (t: any) => t.type === 'OUTFLOW' && t.createdAt?.startsWith(today)
      );
      setTransactions(todayOutflows);

      const locs = locRes.data?.data ?? locRes.data;
      setLocations(Array.isArray(locs) ? locs : []);
      if (Array.isArray(locs) && locs.length > 0 && !selectedLocationId) {
        const cabinet = locs.find((l: any) => l.type === 'CABINET');
        setSelectedLocationId(cabinet?.id ?? locs[0].id);
      }
    } catch (err) {
      console.error('Ошибка загрузки:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Поиск препаратов для списания
  const handleSearch = async (text: string) => {
    setSearchQuery(text);
    if (text.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    try {
      const res = await api.get(`/medications/search?q=${encodeURIComponent(text)}`);
      const raw = res.data?.data ?? res.data;
      setSearchResults(Array.isArray(raw) ? raw : []);
    } catch (err) {
      console.error('Ошибка поиска:', err);
    }
  };

  // Списание
  const handleWriteOff = async () => {
    if (!selectedMed || !selectedLocationId || quantity <= 0) return;

    setSubmitting(true);
    try {
      await api.post('/transactions', {
        type: 'OUTFLOW',
        quantity,
        medicationId: selectedMed.id,
        locationId: selectedLocationId,
      });
      Alert.alert('✅ Списано', `${selectedMed.name} — ${quantity} шт`);
      setShowWriteOffModal(false);
      setSelectedMed(null);
      setSearchQuery('');
      setSearchResults([]);
      setQuantity(1);
      // Обновляем историю
      setRefreshing(true);
      fetchData();
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Ошибка при списании';
      Alert.alert('Ошибка', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const selectedLocationName =
    locations.find((l) => l.id === selectedLocationId)?.name || 'Кабинет';

  // Подсчёт итогов за сегодня
  const totalWrittenOff = transactions.reduce((sum, t) => sum + (t.quantity || 0), 0);
  const uniqueMeds = new Set(transactions.map((t) => t.medicationId)).size;

  if (loading) {
    return (
      <View className="flex-1 bg-[#F1F5F9] justify-center items-center">
        <ActivityIndicator size="large" color="#0891B2" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#F1F5F9]">
      {/* Сводка за сегодня */}
      <View className="px-4 pt-4">
        <View className="flex-row mb-3">
          <View className="flex-1 bg-white p-3 rounded-xl mr-2 border border-slate-100 shadow-sm">
            <Text className="text-[10px] font-bold text-slate-400 uppercase">Списано</Text>
            <Text className="text-2xl font-bold text-[#0A2342] mt-1">{totalWrittenOff}</Text>
            <Text className="text-xs text-slate-400">единиц сегодня</Text>
          </View>
          <View className="flex-1 bg-white p-3 rounded-xl ml-2 border border-slate-100 shadow-sm">
            <Text className="text-[10px] font-bold text-slate-400 uppercase">Препаратов</Text>
            <Text className="text-2xl font-bold text-[#0891B2] mt-1">{uniqueMeds}</Text>
            <Text className="text-xs text-slate-400">наименований</Text>
          </View>
        </View>

        {/* Выбор кабинета */}
        <TouchableOpacity
          onPress={() => setShowLocationPicker(true)}
          className="bg-white px-4 py-3 rounded-xl border border-slate-200 flex-row items-center justify-between mb-3 shadow-sm"
        >
          <View className="flex-row items-center">
            <Ionicons name="business-outline" size={16} color="#0891B2" />
            <Text className="text-[#0A2342] font-semibold ml-2">{selectedLocationName}</Text>
          </View>
          <Ionicons name="chevron-down" size={16} color="#94A3B8" />
        </TouchableOpacity>

        {/* Кнопка быстрого списания */}
        <TouchableOpacity
          onPress={() => setShowWriteOffModal(true)}
          className="bg-[#0891B2] py-4 rounded-xl flex-row items-center justify-center shadow-md mb-2"
        >
          <Ionicons name="remove-circle" size={22} color="white" />
          <Text className="text-white font-bold text-base ml-2">Быстрое списание</Text>
        </TouchableOpacity>
      </View>

      {/* История списаний за сегодня */}
      <View className="px-4 pt-2 pb-1">
        <Text className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          История за сегодня
        </Text>
      </View>

      <FlatList
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
        data={transactions}
        keyExtractor={(item) => item.id?.toString() || Math.random().toString()}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchData();
            }}
            colors={['#0891B2']}
          />
        }
        ListEmptyComponent={
          <View className="py-12 items-center">
            <Ionicons name="checkmark-circle-outline" size={48} color="#CBD5E1" />
            <Text className="text-slate-400 mt-3 text-base">
              Сегодня ещё нет списаний
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View className="bg-white p-3 rounded-xl mb-2 border border-slate-100 flex-row items-center">
            <View className="w-8 h-8 bg-red-50 rounded-lg items-center justify-center mr-3">
              <Ionicons name="arrow-down" size={16} color="#EF4444" />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-semibold text-[#0A2342]" numberOfLines={1}>
                {item.medication?.name || `Препарат #${item.medicationId}`}
              </Text>
              <Text className="text-xs text-slate-400">
                {item.location?.name || ''} • {new Date(item.createdAt).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
            <View className="bg-red-50 px-2.5 py-1 rounded-lg">
              <Text className="text-red-600 font-bold text-sm">−{item.quantity}</Text>
            </View>
          </View>
        )}
      />

      {/* Модалка быстрого списания */}
      <Modal visible={showWriteOffModal} animationType="slide" onRequestClose={() => setShowWriteOffModal(false)}>
        <View className="flex-1 bg-[#F1F5F9] px-4 pt-12">
          <View className="flex-row justify-between items-center mb-5">
            <Text className="text-xl font-bold text-[#0A2342]">Списание МО</Text>
            <TouchableOpacity
              onPress={() => {
                setShowWriteOffModal(false);
                setSelectedMed(null);
                setSearchQuery('');
                setSearchResults([]);
              }}
              className="bg-slate-200 px-4 py-2 rounded-lg"
            >
              <Text className="text-slate-600 font-bold text-sm">Закрыть</Text>
            </TouchableOpacity>
          </View>

          {!selectedMed ? (
            <>
              {/* Поиск */}
              <TextInput
                className="bg-white px-4 py-3.5 rounded-xl border border-slate-200 text-[#0A2342] text-base shadow-sm mb-4"
                placeholder="Введите название препарата..."
                placeholderTextColor="#94A3B8"
                value={searchQuery}
                onChangeText={handleSearch}
                autoFocus
              />
              <FlatList
                data={searchResults}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => {
                  const totalStock = item.batches?.reduce((s: number, b: any) => s + b.quantity, 0) ?? 0;
                  return (
                    <TouchableOpacity
                      onPress={() => setSelectedMed(item)}
                      className="bg-white p-4 mb-2 rounded-xl border border-slate-100 flex-row justify-between items-center"
                    >
                      <View className="flex-1 pr-2">
                        <Text className="text-base font-bold text-[#0A2342]">{item.name}</Text>
                        <Text className="text-xs text-slate-400 mt-0.5">
                          Остаток: {totalStock} шт
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                    </TouchableOpacity>
                  );
                }}
                ListEmptyComponent={
                  <View className="py-8 items-center">
                    <Text className="text-slate-400">
                      {searchQuery.length > 1 ? 'Ничего не найдено' : 'Начните вводить название'}
                    </Text>
                  </View>
                }
              />
            </>
          ) : (
            /* Подтверждение списания */
            <View className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
              <View className="flex-row items-center mb-4">
                <View className="w-10 h-10 bg-red-50 rounded-xl items-center justify-center mr-3">
                  <Ionicons name="arrow-down" size={20} color="#EF4444" />
                </View>
                <View className="flex-1">
                  <Text className="text-lg font-bold text-[#0A2342]">{selectedMed.name}</Text>
                  <Text className="text-xs text-slate-400">
                    Кабинет: {selectedLocationName}
                  </Text>
                </View>
              </View>

              {/* Счётчик количества */}
              <Text className="text-xs font-bold text-slate-400 uppercase mb-2">Количество</Text>
              <View className="flex-row items-center justify-center mb-6 bg-slate-50 rounded-xl p-3">
                <TouchableOpacity
                  onPress={() => setQuantity(Math.max(1, quantity - 1))}
                  className="w-12 h-12 bg-white rounded-xl items-center justify-center border border-slate-200"
                >
                  <Text className="text-xl font-bold text-[#0A2342]">−</Text>
                </TouchableOpacity>
                <Text className="text-3xl font-bold text-[#0A2342] mx-8">{quantity}</Text>
                <TouchableOpacity
                  onPress={() => setQuantity(quantity + 1)}
                  className="w-12 h-12 bg-white rounded-xl items-center justify-center border border-slate-200"
                >
                  <Text className="text-xl font-bold text-[#0A2342]">+</Text>
                </TouchableOpacity>
              </View>

              {/* Кнопки */}
              <TouchableOpacity
                onPress={handleWriteOff}
                disabled={submitting}
                className={`py-4 rounded-xl flex-row items-center justify-center mb-3 ${
                  submitting ? 'bg-slate-300' : 'bg-red-500 active:bg-red-600'
                }`}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={20} color="white" />
                    <Text className="text-white font-bold text-base ml-2">
                      Списать {quantity} шт
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setSelectedMed(null);
                  setQuantity(1);
                }}
                className="py-3 rounded-xl items-center bg-slate-100"
              >
                <Text className="text-slate-600 font-bold text-sm">Выбрать другой</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>

      {/* Модалка выбора кабинета */}
      <Modal visible={showLocationPicker} animationType="slide" transparent>
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-3xl max-h-[50%] p-6">
            <View className="flex-row justify-between items-center mb-5">
              <Text className="text-xl font-bold text-[#0A2342]">Выберите кабинет</Text>
              <TouchableOpacity
                onPress={() => setShowLocationPicker(false)}
                className="w-8 h-8 bg-slate-100 rounded-full items-center justify-center"
              >
                <Ionicons name="close" size={18} color="#64748B" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={locations}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => {
                    setSelectedLocationId(item.id);
                    setShowLocationPicker(false);
                  }}
                  className={`p-4 rounded-xl mb-3 flex-row items-center justify-between border ${
                    selectedLocationId === item.id
                      ? 'border-[#0891B2] bg-cyan-50'
                      : 'border-slate-100 bg-white'
                  }`}
                >
                  <View className="flex-row items-center">
                    <Ionicons
                      name={item.type === 'MAIN_STORAGE' ? 'cube' : 'business'}
                      size={20}
                      color={selectedLocationId === item.id ? '#0891B2' : '#94A3B8'}
                    />
                    <Text className={`ml-3 text-base ${selectedLocationId === item.id ? 'font-bold text-[#0891B2]' : 'font-medium text-[#0A2342]'}`}>
                      {item.name}
                    </Text>
                  </View>
                  {selectedLocationId === item.id && (
                    <Ionicons name="checkmark-circle" size={22} color="#0891B2" />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}
