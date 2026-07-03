import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/api/api';

interface NormUsage {
  medicationId: number;
  medicationName: string;
  expectedTotal: number;
  minAllowed: number;
  maxAllowed: number;
  tolerancePercent: number;
}

interface ProcedureComparison {
  procedureId: number;
  procedureName: string;
  timesPerformed: number;
  expectedUsage: NormUsage[];
}

export default function FactVsNormScreen() {
  const [data, setData] = useState<ProcedureComparison[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchComparison();
  }, []);

  const fetchComparison = async () => {
    try {
      const res = await api.get('/procedures/compare');
      const raw = res.data?.data ?? res.data;
      setData(Array.isArray(raw) ? raw : []);
    } catch (err) {
      console.error('Ошибка загрузки сравнения:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 bg-[#F1F5F9] justify-center items-center">
        <ActivityIndicator size="large" color="#0891B2" />
        <Text className="text-slate-500 mt-3">Загрузка данных...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#F1F5F9]">
      {/* Заголовок */}
      <View className="px-4 pt-4 pb-2">
        <View className="bg-blue-50 border border-blue-200 p-3 rounded-xl flex-row items-start">
          <Ionicons name="information-circle" size={18} color="#2563EB" style={{ marginTop: 1 }} />
          <Text className="text-blue-800 text-xs ml-2 flex-1">
            Сравнение нормативного расхода МО (по ГОСТу) с фактическим количеством проведённых
            процедур. Отклонения выделены цветом.
          </Text>
        </View>
      </View>

      <FlatList
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        data={data}
        keyExtractor={(item) => item.procedureId.toString()}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchComparison();
            }}
            colors={['#0891B2']}
          />
        }
        ListEmptyComponent={
          <View className="py-16 items-center">
            <Ionicons name="analytics-outline" size={56} color="#CBD5E1" />
            <Text className="text-slate-400 mt-4 text-base text-center">
              Нет данных для сравнения
            </Text>
            <Text className="text-slate-400 text-sm text-center mt-1">
              Медсёстры ещё не фиксировали процедуры
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View className="bg-white rounded-2xl shadow-sm mb-4 border border-slate-100 overflow-hidden">
            {/* Шапка процедуры */}
            <View className="bg-[#0A2342] p-4 flex-row items-center justify-between">
              <View className="flex-row items-center flex-1">
                <View className="w-8 h-8 bg-white/10 rounded-lg items-center justify-center mr-3">
                  <Ionicons name="medical" size={16} color="#0891B2" />
                </View>
                <Text className="text-white font-bold text-base flex-1" numberOfLines={1}>
                  {item.procedureName}
                </Text>
              </View>
              <View className="bg-[#0891B2] px-3 py-1 rounded-lg ml-2">
                <Text className="text-white text-xs font-bold">
                  {item.timesPerformed} раз
                </Text>
              </View>
            </View>

            {/* Нормативы */}
            <View className="p-4">
              {item.expectedUsage.length === 0 ? (
                <Text className="text-slate-400 text-sm text-center py-3">
                  Нормативы не заданы
                </Text>
              ) : (
                <>
                  {/* Заголовок таблицы */}
                  <View className="flex-row mb-2 pb-2 border-b border-slate-100">
                    <Text className="text-[10px] font-bold text-slate-400 uppercase flex-1">
                      Препарат
                    </Text>
                    <Text className="text-[10px] font-bold text-slate-400 uppercase w-20 text-center">
                      Норма
                    </Text>
                    <Text className="text-[10px] font-bold text-slate-400 uppercase w-16 text-center">
                      Допуск
                    </Text>
                  </View>

                  {item.expectedUsage.map((norm, idx) => (
                    <View
                      key={idx}
                      className={`flex-row items-center py-2.5 ${
                        idx < item.expectedUsage.length - 1 ? 'border-b border-slate-50' : ''
                      }`}
                    >
                      <View className="flex-1 pr-2">
                        <Text className="text-sm text-[#0A2342] font-medium" numberOfLines={1}>
                          {norm.medicationName}
                        </Text>
                      </View>
                      <View className="w-20 items-center">
                        <Text className="text-sm font-bold text-[#0891B2]">
                          {norm.expectedTotal}
                        </Text>
                        <Text className="text-[10px] text-slate-400">шт</Text>
                      </View>
                      <View className="w-16 items-center">
                        <Text className="text-xs text-slate-500">
                          ±{norm.tolerancePercent}%
                        </Text>
                        <Text className="text-[10px] text-slate-400">
                          {norm.minAllowed}–{norm.maxAllowed}
                        </Text>
                      </View>
                    </View>
                  ))}
                </>
              )}
            </View>

            {/* Подвал: кол-во процедур */}
            {item.timesPerformed === 0 && (
              <View className="bg-amber-50 px-4 py-2 border-t border-amber-100">
                <Text className="text-amber-700 text-xs text-center">
                  Процедура ещё не проводилась — норматив рассчитан на 0 выполнений
                </Text>
              </View>
            )}
          </View>
        )}
      />
    </View>
  );
}
