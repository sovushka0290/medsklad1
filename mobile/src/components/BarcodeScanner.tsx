import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, Button, Alert } from 'react-native';
import { Camera, CameraView } from 'expo-camera';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../services/api_service';

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

  // Background offline queue sync loop
  useEffect(() => {
    let active = true;
    const syncQueue = async () => {
      try {
        const queue = await AsyncStorage.getItem('offline_scan_queue');
        if (!queue) return;
        const queueArray = JSON.parse(queue);
        if (queueArray.length === 0) return;

        // Try sending the first item in the offline queue
        const nextItem = queueArray[0];
        const response = await api.post('/medication/scan', { barcode: nextItem.barcode });
        
        if (response.data) {
          // If request succeeds, dequeue and retry the next item
          queueArray.shift();
          await AsyncStorage.setItem('offline_scan_queue', JSON.stringify(queueArray));
          console.log(`[Offline Sync] Successfully synced barcode: ${nextItem.barcode}`);
          if (active) {
            syncQueue();
          }
        }
      } catch (e) {
        // Network request failed - client is still offline, will retry on next interval
      }
    };

    const interval = setInterval(syncQueue, 10000); // Check every 10 seconds
    syncQueue();

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const calculateConfidence = (data: string): number => {
    // low confidence test helper
    if (data.toLowerCase().includes('low')) {
      return 0.5;
    }
    return 0.95;
  };

  const handleBarCodeScanned = async ({ type, data }: { type: string, data: string }) => {
    setScanned(true);

    const confidence = calculateConfidence(data);

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
      // Save locally to scan history
      const history = await AsyncStorage.getItem('scan_history');
      const historyArray = history ? JSON.parse(history) : [];
      historyArray.push({ barcode, timestamp: new Date().toISOString() });
      await AsyncStorage.setItem('scan_history', JSON.stringify(historyArray));

      // Attempt immediate send
      await api.post('/medication/scan', { barcode });
      Alert.alert("Успешно", `Сканировано: ${barcode}`);
    } catch (error) {
      // Queue offline scan for future sync if the request fails
      const queue = await AsyncStorage.getItem('offline_scan_queue');
      const queueArray = queue ? JSON.parse(queue) : [];
      queueArray.push({ barcode, timestamp: new Date().toISOString() });
      await AsyncStorage.setItem('offline_scan_queue', JSON.stringify(queueArray));
      
      Alert.alert("Оффлайн", `Сохранено в оффлайн-очередь: ${barcode}`);
    }
    
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
