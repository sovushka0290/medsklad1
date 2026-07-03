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
      className={`bg-white mb-4 rounded-3xl shadow-lg border-l-[6px] overflow-hidden ${
        isCritical ? 'border-l-rose-500 shadow-rose-100' : 'border-l-emerald-500 shadow-slate-200/60'
      }`}
    >
      <View className="p-5">
        {/* Шапка карточки */}
        <View className="flex-row justify-between items-start">
          <View className="flex-1 pr-3">
            <Text className="text-lg font-extrabold text-slate-800 leading-tight mb-1">
              {item.name}
            </Text>
            <View className="flex-row items-center bg-slate-50 self-start px-2 py-1 rounded-md mt-1">
              <MaterialIcons name="qr-code-scanner" size={12} color="#64748B" />
              <Text className="text-slate-500 text-xs ml-1 font-medium">
                {item.barcode || 'Нет штрихкода'}
              </Text>
            </View>
          </View>
          
          {/* Индикатор остатка */}
          <View className="items-end ml-2">
            <View className={`px-3 py-1.5 rounded-2xl border ${
              isCritical ? 'bg-rose-50 border-rose-100' : 'bg-emerald-50 border-emerald-100'
            }`}>
              <Text className={`font-black text-lg ${
                isCritical ? 'text-rose-600' : 'text-emerald-600'
              }`}>
                {totalStock} <Text className="text-xs font-bold">шт</Text>
              </Text>
            </View>
            <Text className="text-[11px] text-slate-400 mt-1.5 font-bold uppercase tracking-wider">
              Мин: {item.minQuantity}
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
                    className={`w-10 h-10 rounded-xl items-center justify-center border shadow-sm ${
                      batch.quantity <= 0 
                        ? 'bg-slate-50 border-slate-200 shadow-transparent' 
                        : 'bg-rose-50 border-rose-200 active:bg-rose-100 shadow-rose-100/50'
                    }`}
                  >
                    <MaterialIcons 
                      name="remove" 
                      size={24} 
                      color={batch.quantity <= 0 ? '#CBD5E1' : '#E11D48'} 
                    />
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    onPress={() => onTransaction('INCOME', item.id, batch.locationId)}
                    className="w-10 h-10 rounded-xl items-center justify-center bg-emerald-50 border border-emerald-200 active:bg-emerald-100 shadow-sm shadow-emerald-100/50 ml-2"
                  >
                    <MaterialIcons name="add" size={24} color="#059669" />
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
