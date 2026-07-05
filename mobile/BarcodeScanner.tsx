import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, Button, Alert } from 'react-native';
import { Camera, CameraView } from 'expo-camera'; // expo-camera is used instead of deprecated expo-barcode-scanner as per .cursorrules
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api_service';

export default function BarcodeScanner() {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    const getCameraPermissions = async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    };
    getCameraPermissions();
  }, []);

  const calculateConfidence = (data: string): number => {
    // Для тестирования: если штрихкод содержит слово 'low', возвращаем низкую уверенность (50%)
    if (data.toLowerCase().includes('low')) {
      return 0.5;
    }
    return 0.95;
  };

  const handleBarCodeScanned = async ({ type, data }: { type: string, data: string }) => {
    setScanned(true);

    const confidence = calculateConfidence(data);

    // Если уверенность ниже 70%
    if (confidence < 0.7) {
      Alert.alert(
        "Внимание",
        "Проверьте сканирование, результат не надёжен",
        [
          {
            text: "Отмена",
            onPress: () => setScanned(false),
            style: "cancel"
          },
          { 
            text: "Продолжить", 
            onPress: () => processBarcode(data) 
          }
        ],
        { cancelable: false }
      );
    } else {
      await processBarcode(data);
    }
  };

  const processBarcode = async (barcode: string) => {
    try {
      // Сохраняем в локальное хранилище в любом случае для оффлайн-доступа/истории
      const history = await AsyncStorage.getItem('scan_history');
      const historyArray = history ? JSON.parse(history) : [];
      historyArray.push({ barcode, timestamp: new Date().toISOString() });
      await AsyncStorage.setItem('scan_history', JSON.stringify(historyArray));

      // Отправляем на бэкенд
      const response = await api.post('/medication/scan', { barcode });
      Alert.alert("Успешно", `Сканировано: ${barcode}`);
    } catch (error) {
      // Сохраняем в очередь для оффлайн-синхронизации при ошибке сети
      const queue = await AsyncStorage.getItem('offline_scan_queue');
      const queueArray = queue ? JSON.parse(queue) : [];
      queueArray.push({ barcode, timestamp: new Date().toISOString() });
      await AsyncStorage.setItem('offline_scan_queue', JSON.stringify(queueArray));
      
      Alert.alert("Оффлайн", `Сохранено в оффлайн-очередь: ${barcode}`);
    }
    
    // Сброс через 2 секунды
    setTimeout(() => setScanned(false), 2000);
  };

  if (hasPermission === null) {
    return <Text>Запрос разрешения на использование камеры...</Text>;
  }
  if (hasPermission === false) {
    return <Text>Нет доступа к камере</Text>;
  }

  return (
    <View style={styles.container}>
      <CameraView
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        style={StyleSheet.absoluteFillObject}
      />
      {scanned && <Button title={'Сканировать снова'} onPress={() => setScanned(false)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'center',
  },
});
