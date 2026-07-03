import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/api/api';

export default function LogProcedureScreen() {
  const [procedures, setProcedures] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [procRes, locRes] = await Promise.all([
        api.get('/procedures'),
        api.get('/locations'),
      ]);

      const procs = procRes.data?.data ?? procRes.data;
      const locs = locRes.data?.data ?? locRes.data;

      setProcedures(Array.isArray(procs) ? procs : []);
      setLocations(Array.isArray(locs) ? locs : []);

      if (Array.isArray(locs) && locs.length > 0 && !selectedLocationId) {
        // Пытаемся найти первый CABINET (не MAIN_STORAGE)
        const cabinet = locs.find((l: any) => l.type === 'CABINET');
        setSelectedLocationId(cabinet?.id ?? locs[0].id);
      }
    } catch (err) {
      console.error('Ошибка загрузки данных:', err);
      Alert.alert('Ошибка', 'Не удалось загрузить справочники процедур');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleLogProcedure = async (procedureId: number, procedureName: string) => {
    if (!selectedLocationId) {
      Alert.alert('Ошибка', 'Сначала выберите кабинет');
      return;
    }

    const locationName = locations.find((l) => l.id === selectedLocationId)?.name || '';

    Alert.alert(
      'Подтверждение процедуры',
      `Зафиксировать выполнение:\n\n«${procedureName}»\nКабинет: ${locationName}`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Подтвердить',
          onPress: async () => {
            setSubmitting(true);
            try {
              await api.post('/procedures/log', {
                procedureId,
                locationId: selectedLocationId,
              });
              Alert.alert(
                '✅ Готово',
                'Процедура зафиксирована. Нормативный расход будет учтён автоматически.'
              );
            } catch (err: any) {
              const msg =
                err.response?.data?.error || 'Не удалось зафиксировать процедуру';
              Alert.alert('Ошибка', msg);
            } finally {
              setSubmitting(false);
            }
          },
        },
      ]
    );
  };

  const selectedLocationName =
    locations.find((l) => l.id === selectedLocationId)?.name || 'Выберите кабинет';

  if (loading) {
    return (
      <View className="flex-1 bg-[#F1F5F9] justify-center items-center">
        <ActivityIndicator size="large" color="#0891B2" />
        <Text className="text-slate-500 mt-3">Загрузка процедур...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#F1F5F9]">
      {/* Выбор кабинета */}
      <View className="px-4 pt-4 pb-2">
        <Text className="text-xs font-bold text-slate-500 uppercase mb-1.5 tracking-wide">
          Кабинет
        </Text>
        <TouchableOpacity
          className="bg-white px-4 py-3.5 rounded-xl border border-slate-200 flex-row justify-between items-center shadow-sm"
          onPress={() => setShowLocationModal(true)}
        >
          <View className="flex-row items-center">
            <Ionicons name="business-outline" size={18} color="#0891B2" />
            <Text className="text-[#0A2342] text-base font-semibold ml-2.5">
              {selectedLocationName}
            </Text>
          </View>
          <Ionicons name="chevron-down" size={18} color="#94A3B8" />
        </TouchableOpacity>
      </View>

      {/* Список процедур */}
      <FlatList
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        data={procedures}
        keyExtractor={(item) => item.id.toString()}
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
          <View className="py-16 items-center">
            <Ionicons name="clipboard-outline" size={56} color="#CBD5E1" />
            <Text className="text-slate-400 mt-4 text-base text-center">
              Справочник процедур пуст
            </Text>
            <Text className="text-slate-400 text-sm text-center mt-1">
              Обратитесь к администратору для добавления процедур
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View className="bg-white p-4 rounded-2xl shadow-sm mb-4 border border-slate-100">
            {/* Заголовок процедуры */}
            <View className="flex-row items-center mb-2">
              <View className="w-8 h-8 bg-cyan-50 rounded-lg items-center justify-center mr-3">
                <Ionicons name="medical" size={16} color="#0891B2" />
              </View>
              <View className="flex-1">
                <Text className="text-base font-bold text-[#0A2342]">{item.name}</Text>
                {item.description ? (
                  <Text className="text-slate-500 text-xs mt-0.5">{item.description}</Text>
                ) : null}
              </View>
            </View>

            {/* Нормативный расход */}
            {item.norms && item.norms.length > 0 && (
              <View className="bg-slate-50 p-3 rounded-xl mb-3 border border-slate-100">
                <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Нормативный расход на 1 процедуру
                </Text>
                {item.norms.map((norm: any, idx: number) => (
                  <View key={idx} className="flex-row justify-between items-center mb-1">
                    <Text className="text-sm text-[#0A2342] flex-1 mr-2" numberOfLines={1}>
                      {norm.medication?.name || 'Препарат'}
                    </Text>
                    <Text className="text-sm font-bold text-[#0891B2]">
                      {norm.expectedQuantity} шт
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Кнопка фиксации */}
            <TouchableOpacity
              onPress={() => handleLogProcedure(item.id, item.name)}
              disabled={submitting}
              className={`py-3 rounded-xl flex-row items-center justify-center ${
                submitting ? 'bg-slate-300' : 'bg-[#0891B2] active:bg-[#0E7490]'
              }`}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <>
                  <Ionicons name="checkmark-done" size={18} color="white" />
                  <Text className="text-white font-bold text-sm ml-2">
                    Зафиксировать процедуру
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      />

      {/* Модальное окно выбора кабинета */}
      <Modal visible={showLocationModal} animationType="slide" transparent>
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-3xl max-h-[60%] p-6">
            <View className="flex-row justify-between items-center mb-5">
              <Text className="text-xl font-bold text-[#0A2342]">Выберите кабинет</Text>
              <TouchableOpacity
                onPress={() => setShowLocationModal(false)}
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
                    setShowLocationModal(false);
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
                    <Text
                      className={`ml-3 text-base ${
                        selectedLocationId === item.id
                          ? 'font-bold text-[#0891B2]'
                          : 'font-medium text-[#0A2342]'
                      }`}
                    >
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
