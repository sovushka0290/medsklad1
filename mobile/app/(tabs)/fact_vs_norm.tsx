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
  actualTotal: number;
  isViolation: boolean;
  minAllowed: number;
  maxAllowed: number;
  tolerancePercent: number;
}

interface ProcedureComparison {
  procedureId: number;
  procedureName: string;
  timesPerformed: number;
  usage: NormUsage[];
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
            Сравнение нормативного расхода (План) с фактическими списаниями со склада (Факт). Нарушения (недорасход/перерасход) выделены красным.
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
              {(!item.usage || item.usage.length === 0) ? (
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
                    <Text className="text-[10px] font-bold text-slate-400 uppercase w-14 text-center">
                      План
                    </Text>
                    <Text className="text-[10px] font-bold text-slate-400 uppercase w-14 text-center">
                      Факт
                    </Text>
                    <Text className="text-[10px] font-bold text-slate-400 uppercase w-16 text-right">
                      Допуск
                    </Text>
                  </View>

                  {item.usage.map((norm, idx) => (
                    <View
                      key={idx}
                      className={`flex-row items-center py-2.5 ${
                        idx < item.usage.length - 1 ? 'border-b border-slate-50' : ''
                      }`}
                    >
                      <View className="flex-1 pr-2">
                        <Text className="text-sm text-[#0A2342] font-medium" numberOfLines={2}>
                          {norm.medicationName}
                        </Text>
                      </View>
                      <View className="w-14 items-center">
                        <Text className="text-slate-600 font-bold text-sm">
                          {norm.expectedTotal}
                        </Text>
                      </View>
                      <View className="w-14 items-center">
                        <View className={`px-2 py-0.5 rounded ${norm.isViolation ? 'bg-red-100' : 'bg-green-100'}`}>
                          <Text className={`font-bold text-sm ${norm.isViolation ? 'text-red-600' : 'text-green-600'}`}>
                            {norm.actualTotal}
                          </Text>
                        </View>
                      </View>
                      <View className="w-16 items-end">
                        <Text className="text-slate-400 text-xs font-medium">
                          ±{norm.tolerancePercent}%
                        </Text>
                      </View>
                    </View>
                  ))}
                </>
              )}
            </View>
          </View>
        )}
      />
    </View>
  );
}
