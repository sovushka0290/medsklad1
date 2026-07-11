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
  const [scannedItemName, setScannedItemName] = useState<string | null>(null);
  const [actualQuantity, setActualQuantity] = useState('1');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  
  const [scannedList, setScannedList] = useState<any[]>([]);

  useEffect(() => {
    startSession();
  }, []);

  const startSession = async () => {
    try {
      const res = await api.post('/inventory/start', { locationId: 1 });
      setSessionId(res.data.id);
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
    setError('');
    
    try {
      const res = await api.post('/medication/scan', { barcode: data });
      if (res.data?.success && res.data?.data?.name) {
        setScannedItem(data);
        setScannedItemName(res.data.data.name);
      } else {
        setScannedItem(data);
        setScannedItemName('Неизвестный препарат');
      }
      setActualQuantity('1');
    } catch (e: any) {
      setScannedItem(data);
      setScannedItemName('Препарат не найден в базе');
      setActualQuantity('1');
    } finally {
      setProcessing(false);
    }
  };

  const confirmScan = async () => {
    if (!sessionId || !scannedItem) return;
    const qty = parseInt(actualQuantity, 10);
    if (isNaN(qty) || qty < 0) {
      setError('Введите корректное количество');
      return;
    }

    setProcessing(true);
    setError('');
    try {
      await api.put(`/inventory/${sessionId}/scan`, {
        barcode: scannedItem,
        quantityToAdd: qty
      });
      
      setScannedList(prev => [{ barcode: scannedItem, name: scannedItemName, qty }, ...prev]);
      setScannedItem(null);
      setScannedItemName(null);
    } catch (e: any) {
      const errMsg = e.response?.data?.error || e.response?.data?.message || 'Не удалось записать позицию';
      setError(errMsg);
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
          <Text style={styles.title}>{scannedItemName || 'Товар найден'}</Text>
          <Text style={styles.subtitle}>ШК: {scannedItem}</Text>
          
          <Text style={styles.label}>Фактическое количество:</Text>
          <TextInput
            style={styles.input}
            value={actualQuantity}
            onChangeText={setActualQuantity}
            keyboardType="number-pad"
            autoFocus
          />

          {error ? (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle-outline" size={18} color="#EF4444" style={{ marginRight: 6 }} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}
          
          <View style={styles.row}>
            <TouchableOpacity style={[styles.btnPrimary, { flex: 1, marginRight: 8 }]} onPress={confirmScan}>
              {processing ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Подтвердить</Text>}
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.btnDanger, { flex: 1, marginLeft: 8 }]} 
              onPress={() => { setScannedItem(null); setScannedItemName(null); setError(''); }}
            >
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
              <View style={{ flex: 1 }}>
                <Text style={styles.historyItemName}>{item.name || 'Товар без названия'}</Text>
                <Text style={styles.historyItemBc}>ШК: {item.barcode}</Text>
              </View>
              <Text style={styles.historyItemQty}>{item.qty} шт</Text>
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
  inputContainer: { flex: 1, padding: 24, justifyContent: 'center', backgroundColor: '#fff', borderBottomLeftRadius: 24, borderBottomRightRadius: 24, shadowColor: '#0A2342', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 4 },
  title: { fontSize: 22, fontWeight: '800', color: '#0A2342', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#64748b', marginBottom: 24, fontWeight: '500' },
  label: { fontSize: 14, color: '#475569', marginBottom: 8, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 14, padding: 16, fontSize: 28, marginBottom: 24, textAlign: 'center', fontWeight: '800', color: '#0F172A', backgroundColor: '#F8FAFC' },
  row: { flexDirection: 'row' },
  btnPrimary: { backgroundColor: '#0891B2', padding: 16, borderRadius: 14, alignItems: 'center', shadowColor: '#0891B2', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
  btnDanger: { backgroundColor: '#ef4444', padding: 16, borderRadius: 14, alignItems: 'center', shadowColor: '#ef4444', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  bottomPanel: { height: 280, backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: -6 }, shadowOpacity: 0.06, shadowRadius: 16, elevation: 12 },
  historyTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A', marginBottom: 12 },
  historyList: { flex: 1, marginBottom: 16 },
  historyItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  historyItemName: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  historyItemBc: { fontSize: 12, color: '#64748B', marginTop: 2 },
  historyItemQty: { fontSize: 16, fontWeight: '800', color: '#0891B2' },
  completeBtn: { backgroundColor: '#0A2342', padding: 16, borderRadius: 14, alignItems: 'center', shadowColor: '#0A2342', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 10,
    padding: 10,
    marginBottom: 15,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
});
