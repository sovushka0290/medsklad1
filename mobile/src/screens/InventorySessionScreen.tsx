import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, TextInput, ScrollView } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../services/api_service';

export default function InventorySessionScreen({ navigation }: any) {
  const [permission, requestPermission] = useCameraPermissions();
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [scannedItem, setScannedItem] = useState<any>(null);
  const [actualQuantity, setActualQuantity] = useState('1');
  const [processing, setProcessing] = useState(false);
  
  const [scannedList, setScannedList] = useState<any[]>([]);

  useEffect(() => {
    startSession();
  }, []);

  const startSession = async () => {
    try {
      // 1 is default location. In a real app we'd let them pick
      const res = await api.post('/inventory/start', { locationId: 1 });
      setSessionId(res.data.data.id);
    } catch (e) {
      Alert.alert('Ошибка', 'Не удалось начать инвентаризацию');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const handleBarcodeScanned = async ({ type, data }: any) => {
    if (processing || scannedItem) return;
    setProcessing(true);
    
    try {
      // We don't have a direct /medication/barcode/:code but we can just use the scan endpoint
      // Actually we need to set the barcode in state and show quantity input
      setScannedItem(data);
      setActualQuantity('1');
    } catch (e) {
      Alert.alert('Ошибка', 'Штрих-код не распознан');
    } finally {
      setProcessing(false);
    }
  };

  const confirmScan = async () => {
    if (!sessionId || !scannedItem) return;
    const qty = parseInt(actualQuantity, 10);
    if (isNaN(qty) || qty < 0) {
      Alert.alert('Ошибка', 'Введите корректное количество');
      return;
    }

    setProcessing(true);
    try {
      await api.put(`/inventory/${sessionId}/scan`, {
        barcode: scannedItem,
        actualQuantity: qty
      });
      
      setScannedList(prev => [{ barcode: scannedItem, qty }, ...prev]);
      setScannedItem(null);
    } catch (e) {
      Alert.alert('Ошибка', 'Не удалось записать позицию');
      setScannedItem(null);
    } finally {
      setProcessing(false);
    }
  };

  const completeSession = async () => {
    if (!sessionId) return;
    setProcessing(true);
    try {
      await api.post(`/inventory/${sessionId}/complete`);
      Alert.alert('Готово', 'Инвентаризация завершена. Акт расхождений сформирован.');
      navigation.goBack();
    } catch (e) {
      Alert.alert('Ошибка', 'Не удалось завершить сессию');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0891B2" />
      </View>
    );
  }

  if (!permission?.granted) {
    return (
      <View style={styles.center}>
        <Text style={{ marginBottom: 20 }}>Нужен доступ к камере</Text>
        <TouchableOpacity style={styles.btnPrimary} onPress={requestPermission}>
          <Text style={styles.btnText}>Разрешить</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {!scannedItem ? (
        <View style={styles.cameraContainer}>
          <CameraView
            style={styles.camera}
            facing="back"
            onBarcodeScanned={handleBarcodeScanned}
            barcodeScannerSettings={{
              barcodeTypes: ["qr", "ean13", "ean8", "code128"],
            }}
          >
            <View style={styles.overlay}>
              <View style={styles.scanBox} />
              <Text style={styles.scanText}>Наведите на штрих-код товара</Text>
            </View>
          </CameraView>
        </View>
      ) : (
        <View style={styles.inputContainer}>
          <Text style={styles.title}>Товар найден</Text>
          <Text style={styles.subtitle}>ШК: {scannedItem}</Text>
          
          <Text style={styles.label}>Фактическое количество:</Text>
          <TextInput
            style={styles.input}
            value={actualQuantity}
            onChangeText={setActualQuantity}
            keyboardType="number-pad"
            autoFocus
          />
          
          <View style={styles.row}>
            <TouchableOpacity style={[styles.btnPrimary, { flex: 1, marginRight: 8 }]} onPress={confirmScan}>
              {processing ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Подтвердить</Text>}
            </TouchableOpacity>
            
            <TouchableOpacity style={[styles.btnDanger, { flex: 1, marginLeft: 8 }]} onPress={() => setScannedItem(null)}>
              <Text style={styles.btnText}>Отмена</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={styles.bottomPanel}>
        <Text style={styles.historyTitle}>Отсканировано ({scannedList.length}):</Text>
        <ScrollView style={styles.historyList}>
          {scannedList.map((item, idx) => (
            <View key={idx} style={styles.historyItem}>
              <Text>ШК: {item.barcode}</Text>
              <Text style={{ fontWeight: 'bold' }}>{item.qty} шт</Text>
            </View>
          ))}
        </ScrollView>
        <TouchableOpacity style={styles.completeBtn} onPress={completeSession} disabled={processing}>
          <Text style={styles.btnText}>Завершить инвентаризацию</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1, backgroundColor: '#F1F5F9' },
  cameraContainer: { flex: 1 },
  camera: { flex: 1 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  scanBox: { width: 250, height: 250, borderWidth: 2, borderColor: '#0891B2', backgroundColor: 'transparent' },
  scanText: { color: '#fff', marginTop: 20, fontSize: 16 },
  inputContainer: { flex: 1, padding: 20, justifyContent: 'center', backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#0A2342', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#64748b', marginBottom: 24 },
  label: { fontSize: 16, color: '#334155', marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 16, fontSize: 24, marginBottom: 24, textAlign: 'center' },
  row: { flexDirection: 'row' },
  btnPrimary: { backgroundColor: '#0891B2', padding: 16, borderRadius: 12, alignItems: 'center' },
  btnDanger: { backgroundColor: '#ef4444', padding: 16, borderRadius: 12, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  bottomPanel: { height: 250, backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 10 },
  historyTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 8 },
  historyList: { flex: 1, marginBottom: 12 },
  historyItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  completeBtn: { backgroundColor: '#0A2342', padding: 16, borderRadius: 12, alignItems: 'center' }
});
