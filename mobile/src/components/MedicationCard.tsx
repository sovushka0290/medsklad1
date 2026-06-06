import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

export interface MedicationCardProps {
  item: {
    id: number;
    name: string;
    barcode: string;
    minQuantity: number;
    batches?: Array<{
      id: number;
      quantity: number;
      locationId: number;
      location?: {
        name: string;
      };
    }>;
  };
  onTransaction: (type: 'INCOME' | 'OUTFLOW', medicationId: number, locationId: number) => void;
}

export const MedicationCard: React.FC<MedicationCardProps> = ({ item, onTransaction }) => {
  const totalStock = item.batches?.reduce((acc, b) => acc + b.quantity, 0) || 0;
  const isCritical = totalStock < item.minQuantity;

  return (
    <View 
      className={`bg-white mb-3 rounded-2xl shadow-sm border-l-4 overflow-hidden border ${
        isCritical ? 'border-l-red-500 border-red-100' : 'border-l-green-500 border-slate-100'
      }`}
    >
      <View className="p-4">
        {/* Шапка карточки */}
        <View className="flex-row justify-between items-start">
          <View className="flex-1 pr-2">
            <Text className="text-base font-bold text-[#0A2342] leading-tight">
              {item.name}
            </Text>
            <Text className="text-slate-400 text-xs mt-1">
              ШК: {item.barcode || 'Не привязан'}
            </Text>
          </View>
          
          {/* Индикатор остатка */}
          <View className="items-end">
            <View className={`px-2.5 py-1.5 rounded-xl ${
              isCritical ? 'bg-red-50' : 'bg-green-50'
            }`}>
              <Text className={`font-bold text-sm ${
                isCritical ? 'text-red-600' : 'text-green-600'
              }`}>
                {totalStock} шт
              </Text>
            </View>
            <Text className="text-[10px] text-slate-400 mt-1 font-semibold">
              Лимит: {item.minQuantity} шт
            </Text>
          </View>
        </View>

        {/* Секция партий по складам с быстрыми кнопками */}
        {item.batches && item.batches.length > 0 ? (
          <View className="mt-3 pt-3 border-t border-slate-100">
            <Text className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2">
              Остатки по складам:
            </Text>
            {item.batches.map((batch) => (
              <View key={batch.id} className="flex-row justify-between items-center py-1.5">
                <Text className="text-slate-600 text-sm flex-1">
                  {batch.location?.name || `Кабинет #${batch.locationId}`}
                </Text>
                
                <View className="flex-row items-center space-x-3">
                  <Text className="text-[#0A2342] font-semibold text-sm mr-2">
                    {batch.quantity} шт
                  </Text>
                  
                  {/* Кнопки Быстрого списания/прихода */}
                  <TouchableOpacity
                    onPress={() => onTransaction('OUTFLOW', item.id, batch.locationId)}
                    disabled={batch.quantity <= 0}
                    className={`w-7 h-7 rounded-lg items-center justify-center border ${
                      batch.quantity <= 0 
                        ? 'bg-slate-50 border-slate-200' 
                        : 'bg-red-50 border-red-200 active:bg-red-100'
                    }`}
                  >
                    <MaterialIcons 
                      name="remove" 
                      size={16} 
                      color={batch.quantity <= 0 ? '#CBD5E1' : '#DC2626'} 
                    />
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    onPress={() => onTransaction('INCOME', item.id, batch.locationId)}
                    className="w-7 h-7 rounded-lg items-center justify-center bg-green-50 border border-green-200 active:bg-green-100"
                  >
                    <MaterialIcons name="add" size={16} color="#16A34A" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View className="mt-3 pt-3 border-t border-slate-100 flex-row justify-between items-center">
            <Text className="text-slate-400 text-xs italic">Нет в наличии</Text>
          </View>
        )}
      </View>
    </View>
  );
};
