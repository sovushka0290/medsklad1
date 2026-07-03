import React, { useState } from 'react';
import { View, Text, Modal, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';

interface WriteOffModalProps {
  visible: boolean;
  medicationName: string;
  onClose: () => void;
  onSubmit: (data: { quantity: number; reason: string }) => Promise<void>;
}

export const WriteOffModal: React.FC<WriteOffModalProps> = ({ visible, medicationName, onClose, onSubmit }) => {
  const [quantity, setQuantity] = useState('1');
  const [reason, setReason] = useState('Истёк срок годности');
  const [loading, setLoading] = useState(false);

  const REASONS = ['Истёк срок годности', 'Брак/Бой', 'Использовано вне процедуры', 'Иная причина'];

  const handleSubmit = async () => {
    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty <= 0) {
      Alert.alert('Ошибка', 'Введите корректное количество');
      return;
    }

    try {
      setLoading(true);
      await onSubmit({ quantity: qty, reason });
      setQuantity('1');
      setReason(REASONS[0]);
      onClose();
    } catch (err: any) {
      Alert.alert('Ошибка', err.message || 'Ошибка при списании');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/50">
        <View className="bg-white rounded-t-3xl p-6">
          <Text className="text-xl font-bold text-red-600 mb-2">Списание товара</Text>
          <Text className="text-sm text-gray-500 mb-6">{medicationName}</Text>

          <Text className="text-sm font-semibold text-gray-700 mb-1">Количество</Text>
          <TextInput
            className="bg-gray-100 rounded-2xl p-4 text-gray-900 mb-4"
            keyboardType="numeric"
            value={quantity}
            onChangeText={setQuantity}
            placeholder="1"
          />

          <Text className="text-sm font-semibold text-gray-700 mb-2">Причина списания</Text>
          <View className="flex-row flex-wrap mb-6">
            {REASONS.map(r => (
              <TouchableOpacity
                key={r}
                onPress={() => setReason(r)}
                className={`px-4 py-2 rounded-full border m-1 ${reason === r ? 'bg-red-500 border-red-500' : 'bg-white border-gray-300'}`}
              >
                <Text className={reason === r ? 'text-white font-bold' : 'text-gray-700'}>{r}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View className="flex-row space-x-4">
            <TouchableOpacity 
              className="flex-1 p-4 rounded-2xl bg-gray-200"
              onPress={onClose}
              disabled={loading}
            >
              <Text className="text-center font-bold text-gray-700">Отмена</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              className="flex-1 p-4 rounded-2xl bg-red-500 flex-row justify-center items-center"
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-center font-bold text-white">Списать</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};
