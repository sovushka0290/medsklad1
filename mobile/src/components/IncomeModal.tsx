import React, { useState } from 'react';
import { View, Text, Modal, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';

interface IncomeModalProps {
  visible: boolean;
  medicationName: string;
  onClose: () => void;
  onSubmit: (data: { quantity: number; expirationDate?: string; price?: number }) => Promise<void>;
}

export const IncomeModal: React.FC<IncomeModalProps> = ({ visible, medicationName, onClose, onSubmit }) => {
  const [quantity, setQuantity] = useState('1');
  const [expirationDate, setExpirationDate] = useState('');
  const [price, setPrice] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty <= 0) {
      Alert.alert('Ошибка', 'Введите корректное количество');
      return;
    }

    let isoDate: string | undefined = undefined;
    if (expirationDate.trim()) {
      // Поддержка простого ввода ГГГГ-ММ-ДД для MVP
      const date = new Date(expirationDate);
      if (isNaN(date.getTime())) {
        Alert.alert('Ошибка', 'Некорректный формат даты. Используйте ГГГГ-ММ-ДД');
        return;
      }
      isoDate = date.toISOString();
    }

    const prc = price.trim() ? parseFloat(price) : undefined;

    try {
      setLoading(true);
      await onSubmit({ quantity: qty, expirationDate: isoDate, price: prc });
      // Reset
      setQuantity('1');
      setExpirationDate('');
      setPrice('');
      onClose();
    } catch (err: any) {
      Alert.alert('Ошибка', err.message || 'Ошибка при сохранении');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/50">
        <View className="bg-white rounded-t-3xl p-6">
          <Text className="text-xl font-bold text-gray-900 mb-2">Приёмка товара</Text>
          <Text className="text-sm text-gray-500 mb-6">{medicationName}</Text>

          <Text className="text-sm font-semibold text-gray-700 mb-1">Количество</Text>
          <TextInput
            className="bg-gray-100 rounded-2xl p-4 text-gray-900 mb-4"
            keyboardType="numeric"
            value={quantity}
            onChangeText={setQuantity}
            placeholder="1"
          />

          <Text className="text-sm font-semibold text-gray-700 mb-1">Срок годности (ГГГГ-ММ-ДД)</Text>
          <TextInput
            className="bg-gray-100 rounded-2xl p-4 text-gray-900 mb-4"
            value={expirationDate}
            onChangeText={setExpirationDate}
            placeholder="Опционально"
          />

          <Text className="text-sm font-semibold text-gray-700 mb-1">Цена за единицу (₸)</Text>
          <TextInput
            className="bg-gray-100 rounded-2xl p-4 text-gray-900 mb-6"
            keyboardType="numeric"
            value={price}
            onChangeText={setPrice}
            placeholder="Опционально"
          />

          <View className="flex-row space-x-4">
            <TouchableOpacity 
              className="flex-1 p-4 rounded-2xl bg-gray-200"
              onPress={onClose}
              disabled={loading}
            >
              <Text className="text-center font-bold text-gray-700">Отмена</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              className="flex-1 p-4 rounded-2xl bg-blue-500 flex-row justify-center items-center"
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-center font-bold text-white">Принять</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};
