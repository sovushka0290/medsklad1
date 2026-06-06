import React, { useState, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

export interface InventoryModalProps {
  visible: boolean;
  medication: {
    id: number;
    name: string;
    barcode: string;
    batches?: Array<{
      id: number;
      quantity: number;
      locationId: number;
      location?: {
        name: string;
      };
    }>;
  } | null;
  locations: Array<{ id: number; name: string }>;
  onClose: () => void;
  onConfirm: (type: 'INCOME' | 'OUTFLOW', locationId: number, quantity: number) => Promise<void>;
}

export const InventoryModal: React.FC<InventoryModalProps> = ({
  visible,
  medication,
  locations,
  onClose,
  onConfirm,
}) => {
  const [type, setType] = useState<'INCOME' | 'OUTFLOW'>('OUTFLOW');
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);

  // Сброс состояния при открытии модалки с новым товаром
  useEffect(() => {
    if (visible && medication) {
      setType('OUTFLOW');
      setQuantity(1);
      
      // По умолчанию выбираем первый склад, где есть этот товар
      if (medication.batches && medication.batches.length > 0) {
        setSelectedLocationId(medication.batches[0].locationId);
      } else if (locations.length > 0) {
        setSelectedLocationId(locations[0].id);
      }
    }
  }, [visible, medication, locations]);

  if (!medication) return null;

  const currentBatch = medication.batches?.find(b => b.locationId === selectedLocationId);
  const currentQuantity = currentBatch ? currentBatch.quantity : 0;

  const handleConfirm = async () => {
    if (selectedLocationId === null) return;
    setLoading(true);
    try {
      await onConfirm(type, selectedLocationId, quantity);
      onClose();
    } catch (err) {
      // Ошибка обрабатывается снаружи (выводится Alert)
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end bg-black/60">
        <View className="bg-white rounded-t-3xl p-6 min-h-[50%] max-h-[90%] shadow-2xl">
          <View className="w-16 h-1 bg-slate-200 rounded-full mx-auto mb-4" />
          
          <Text className="text-xl font-bold text-[#0A2342] mb-1">
            {medication.name}
          </Text>
          <Text className="text-slate-400 text-xs mb-5">
            Штрихкод: {medication.barcode}
          </Text>

          {/* Переключатель типа транзакции */}
          <View className="flex-row bg-slate-100 p-1 rounded-xl mb-5">
            <TouchableOpacity
              onPress={() => setType('OUTFLOW')}
              className={`flex-1 flex-row justify-center items-center py-2.5 rounded-lg ${
                type === 'OUTFLOW' ? 'bg-[#0A2342]' : ''
              }`}
            >
              <MaterialIcons 
                name="remove-circle-outline" 
                size={18} 
                color={type === 'OUTFLOW' ? 'white' : '#64748B'} 
              />
              <Text className={`font-semibold text-sm ml-2 ${
                type === 'OUTFLOW' ? 'text-white' : 'text-slate-500'
              }`}>
                Списание
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setType('INCOME')}
              className={`flex-1 flex-row justify-center items-center py-2.5 rounded-lg ${
                type === 'INCOME' ? 'bg-[#0891B2]' : ''
              }`}
            >
              <MaterialIcons 
                name="add-circle-outline" 
                size={18} 
                color={type === 'INCOME' ? 'white' : '#64748B'} 
              />
              <Text className={`font-semibold text-sm ml-2 ${
                type === 'INCOME' ? 'text-white' : 'text-slate-500'
              }`}>
                Приемка
              </Text>
            </TouchableOpacity>
          </View>

          {/* Выбор локации */}
          <Text className="text-slate-500 font-bold text-xs uppercase tracking-wider mb-2">
            Склад / Кабинет:
          </Text>
          <View className="flex-row flex-wrap mb-5">
            {locations.map((loc) => {
              const isSelected = selectedLocationId === loc.id;
              const hasStock = medication.batches?.find(b => b.locationId === loc.id);
              return (
                <TouchableOpacity
                  key={loc.id}
                  onPress={() => setSelectedLocationId(loc.id)}
                  className={`mr-2 mb-2 px-3 py-2 rounded-lg border ${
                    isSelected
                      ? type === 'INCOME' ? 'bg-[#0891B2] border-[#0891B2]' : 'bg-[#0A2342] border-[#0A2342]'
                      : 'bg-white border-slate-200'
                  }`}
                >
                  <Text className={`text-xs font-semibold ${
                    isSelected ? 'text-white' : 'text-slate-600'
                  }`}>
                    {loc.name} {hasStock ? `(${hasStock.quantity} шт)` : ''}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Корректировка количества */}
          <Text className="text-slate-500 font-bold text-xs uppercase tracking-wider mb-2">
            Количество для изменения:
          </Text>
          <View className="flex-row items-center justify-between bg-slate-50 border border-slate-100 p-4 rounded-xl mb-6">
            <View>
              <Text className="text-xs text-slate-400 font-medium">Остаток на складе:</Text>
              <Text className="text-[#0A2342] font-bold text-base mt-0.5">{currentQuantity} шт</Text>
            </View>
            
            <View className="flex-row items-center space-x-4">
              <TouchableOpacity
                onPress={() => setQuantity(prev => Math.max(1, prev - 1))}
                className="w-10 h-10 rounded-full bg-white border border-slate-200 items-center justify-center active:bg-slate-50"
              >
                <MaterialIcons name="remove" size={20} color="#0A2342" />
              </TouchableOpacity>
              
              <Text className="text-xl font-bold text-[#0A2342] min-w-[30px] text-center">
                {quantity}
              </Text>
              
              <TouchableOpacity
                onPress={() => setQuantity(prev => prev + 1)}
                className="w-10 h-10 rounded-full bg-white border border-slate-200 items-center justify-center active:bg-slate-50"
              >
                <MaterialIcons name="add" size={20} color="#0A2342" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Кнопки подтверждения / отмены */}
          <View className="space-y-3">
            <TouchableOpacity
              onPress={handleConfirm}
              disabled={loading || selectedLocationId === null || (type === 'OUTFLOW' && currentQuantity < quantity)}
              className={`py-3.5 rounded-xl items-center shadow-sm flex-row justify-center ${
                selectedLocationId === null || (type === 'OUTFLOW' && currentQuantity < quantity)
                  ? 'bg-slate-200'
                  : type === 'INCOME' ? 'bg-[#0891B2]' : 'bg-[#0A2342]'
              }`}
            >
              {loading ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <>
                  <MaterialIcons 
                    name={type === 'INCOME' ? 'check' : 'local-shipping'} 
                    size={20} 
                    color="white" 
                    style={{ marginRight: 6 }} 
                  />
                  <Text className="text-white font-bold text-base">
                    {type === 'INCOME' ? 'Оприходовать' : 'Списать'} {quantity} шт.
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {type === 'OUTFLOW' && currentQuantity < quantity && selectedLocationId !== null && (
              <Text className="text-red-500 text-xs text-center font-medium mt-1">
                Недостаточно остатка на выбранном складе
              </Text>
            )}

            <TouchableOpacity
              onPress={onClose}
              className="bg-slate-100 py-3 rounded-xl items-center"
            >
              <Text className="text-slate-600 font-bold text-base">Отмена</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};
