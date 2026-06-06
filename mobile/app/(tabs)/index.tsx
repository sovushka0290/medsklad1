import { View, Text } from 'react-native';
import { MedicationList } from '../../src/components/MedicationList';

export default function HomeScreen() {
  return (
    <View className="flex-1 bg-slate-100 px-4 pt-12">
      <Text className="text-2xl font-bold text-[#0A2342] mb-6">Склад</Text>
      <MedicationList />
    </View>
  );
}
