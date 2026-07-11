import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ActivityIndicator, 
  Alert, 
  TextInput, 
  ScrollView,
  Platform,
  SafeAreaView,
  Animated,
  Easing,
  StatusBar
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../services/api_service';

export default function InventorySessionScreen({ navigation }: any) {
  const [permission, requestPermission] = useCameraPermissions();
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [locations, setLocations] = useState<any[]>([]);
  const [selectedLoc, setSelectedLoc] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  const [scannedItem, setScannedItem] = useState<any>(null);
  const [scannedItemName, setScannedItemName] = useState<string | null>(null);
  const [actualQuantity, setActualQuantity] = useState('1');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  
  const [scannedList, setScannedList] = useState<any[]>([]);

  // Animation for laser scan line
  const laserAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fetchLocations();
  }, []);

  useEffect(() => {
    if (sessionId && !scannedItem) {
      startLaserAnimation();
    }
  }, [sessionId, scannedItem]);

  const startLaserAnimation = () => {
    laserAnim.setValue(0);
    Animated.loop(
      Animated.timing(laserAnim, {
        toValue: 1,
        duration: 2000,
        easing: Easing.linear,
        useNativeDriver: true
      })
    ).start();
  };

  const fetchLocations = async () => {
    try {
      const res = await api.get('/locations');
      setLocations(res.data || []);
    } catch (e) {
      Alert.alert('Ошибка', 'Не удалось загрузить кабинеты/склады');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const startSession = async (location: any) => {
    setLoading(true);
    try {
      const res = await api.post('/inventory/start', { locationId: location.id });
      setSessionId(res.data.id);
      setSelectedLoc(location);
    } catch (e: any) {
      const errMsg = e.response?.data?.error || e.response?.data?.message || 'Не удалось начать инвентаризацию';
      Alert.alert('Ошибка', errMsg);
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

  const decreaseQty = () => {
    const val = parseInt(actualQuantity, 10);
    if (!isNaN(val) && val > 0) {
      setQuantityText(val - 1);
    }
  };

  const increaseQty = () => {
    const val = parseInt(actualQuantity, 10);
    if (!isNaN(val)) {
      setQuantityText(val + 1);
    } else {
      setQuantityText(1);
    }
  };

  const setQuantityText = (val: number) => {
    setActualQuantity(String(val));
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
    Alert.alert(
      'Завершение инвентаризации',
      'Вы действительно хотите завершить инвентаризацию и сформировать акт расхождений?',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Завершить',
          style: 'default',
          onPress: async () => {
            setProcessing(true);
            try {
              await api.post(`/inventory/${sessionId}/complete`);
              Alert.alert('Готово', 'Инвентаризация успешно завершена! Акт расхождений сформирован.');
              navigation.goBack();
            } catch (e) {
              Alert.alert('Ошибка', 'Не удалось завершить сессию инвентаризации');
            } finally {
              setProcessing(false);
            }
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0891B2" />
        <Text style={styles.loadingText}>Загрузка сессии инвентаризации...</Text>
      </View>
    );
  }

  // Location selector UI
  if (!sessionId) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.selectHeader}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#0A2342" />
          </TouchableOpacity>
          <Text style={styles.selectHeaderTitle}>Начало инвентаризации</Text>
        </View>

        <View style={styles.selectBody}>
          <Text style={styles.selectInstructions}>
            Выберите кабинет или склад, в котором хотите провести инвентаризацию остатков медикаментов:
          </Text>

          <ScrollView contentContainerStyle={styles.locationsList}>
            {locations.map((loc) => (
              <TouchableOpacity
                key={loc.id}
                style={styles.locationCard}
                onPress={() => startSession(loc)}
                activeOpacity={0.7}
              >
                <View style={styles.locCardIcon}>
                  <Ionicons 
                    name={loc.id === 1 ? "business-outline" : "git-branch-outline"} 
                    size={22} 
                    color="#0891B2" 
                  />
                </View>
                <View style={styles.locCardContent}>
                  <Text style={styles.locCardName}>{loc.name}</Text>
                  <Text style={styles.locCardSub}>Нажмите для запуска сессии</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </SafeAreaView>
    );
  }

  if (!permission?.granted) {
    return (
      <View style={styles.center}>
        <Ionicons name="camera-outline" size={64} color="#64748B" style={{ marginBottom: 16 }} />
        <Text style={styles.cameraTitle}>Требуется доступ к камере</Text>
        <Text style={styles.cameraDesc}>Разрешите доступ к камере для сканирования штрих-кодов медицинских препаратов.</Text>
        <TouchableOpacity style={styles.btnPrimary} onPress={requestPermission}>
          <Text style={styles.btnText}>Разрешить доступ</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const laserY = laserAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 240]
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Session Title Bar */}
      <View style={styles.sessionHeader}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.sessionBack}>
          <Ionicons name="close" size={24} color="#fff" />
        </TouchableOpacity>
        <View>
          <Text style={styles.sessionTitle}>Инвентаризация</Text>
          <Text style={styles.sessionSubtitle}>{selectedLoc?.name}</Text>
        </View>
        <View style={styles.sessionBadge}>
          <Text style={styles.sessionBadgeText}>ID {sessionId}</Text>
        </View>
      </View>

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
              <View style={styles.scanBox}>
                {/* Custom corners design */}
                <View style={[styles.corner, styles.cornerTL]} />
                <View style={[styles.corner, styles.cornerTR]} />
                <View style={[styles.corner, styles.cornerBL]} />
                <View style={[styles.corner, styles.cornerBR]} />

                {/* Animated laser line */}
                <Animated.View style={[styles.laser, { transform: [{ translateY: laserY }] }]} />
              </View>
              <Text style={styles.scanText}>Наведите на штрих-код товара</Text>
            </View>
          </CameraView>
        </View>
      ) : (
        <View style={styles.inputContainer}>
          <View style={styles.scannedProductHeader}>
            <Ionicons name="cube-outline" size={32} color="#0891B2" style={{ marginRight: 12 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.productTitle} numberOfLines={2}>{scannedItemName || 'Товар найден'}</Text>
              <Text style={styles.productSubtitle}>Штрих-код: {scannedItem}</Text>
            </View>
          </View>
          
          <Text style={styles.label}>Фактическое количество на складе:</Text>

          {/* Stepper Counter Component */}
          <View style={styles.stepperContainer}>
            <TouchableOpacity 
              style={styles.stepperBtn} 
              onPress={decreaseQty}
              activeOpacity={0.7}
            >
              <Ionicons name="remove" size={24} color="#0891B2" />
            </TouchableOpacity>
            
            <TextInput
              style={styles.stepperInput}
              value={actualQuantity}
              onChangeText={setActualQuantity}
              keyboardType="number-pad"
              textAlign="center"
            />

            <TouchableOpacity 
              style={styles.stepperBtn} 
              onPress={increaseQty}
              activeOpacity={0.7}
            >
              <Ionicons name="add" size={24} color="#0891B2" />
            </TouchableOpacity>
          </View>

          {error ? (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle-outline" size={18} color="#EF4444" style={{ marginRight: 6 }} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}
          
          <View style={styles.row}>
            <TouchableOpacity 
              style={[styles.btnPrimary, { flex: 1, marginRight: 8 }]} 
              onPress={confirmScan}
              disabled={processing}
              activeOpacity={0.8}
            >
              {processing ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Внести в опись</Text>}
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.btnDanger, { flex: 1, marginLeft: 8 }]} 
              onPress={() => { setScannedItem(null); setScannedItemName(null); setError(''); }}
              activeOpacity={0.8}
            >
              <Text style={styles.btnText}>Отмена</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* History and complete panel */}
      <View style={styles.bottomPanel}>
        <View style={styles.panelHeader}>
          <Text style={styles.historyTitle}>Отсканировано ({scannedList.length}):</Text>
          <Ionicons name="checkmark-circle-outline" size={18} color="#10B981" />
        </View>
        
        <ScrollView style={styles.historyList}>
          {scannedList.length === 0 ? (
            <View style={styles.emptyScanned}>
              <Text style={styles.emptyScannedText}>Список пуст. Отсканируйте первый препарат.</Text>
            </View>
          ) : (
            scannedList.map((item, idx) => (
              <View key={idx} style={styles.historyItem}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.historyItemName} numberOfLines={1}>{item.name || 'Товар без названия'}</Text>
                  <Text style={styles.historyItemBc}>ШК: {item.barcode}</Text>
                </View>
                <View style={styles.historyQtyBadge}>
                  <Text style={styles.historyQtyText}>{item.qty} шт</Text>
                </View>
              </View>
            ))
          )}
        </ScrollView>

        <TouchableOpacity 
          style={[styles.completeBtn, processing && { opacity: 0.7 }]} 
          onPress={completeSession} 
          disabled={processing}
          activeOpacity={0.8}
        >
          <Text style={styles.btnText}>Завершить инвентаризацию</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  container: { 
    flex: 1, 
    backgroundColor: '#F8FAFC' 
  },
  selectHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    marginRight: 16,
  },
  selectHeaderTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0A2342',
  },
  selectBody: {
    flex: 1,
    padding: 24,
  },
  selectInstructions: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
    marginBottom: 24,
    fontWeight: '500',
  },
  locationsList: {
    gap: 12,
  },
  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0A2342',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  locCardIcon: {
    backgroundColor: 'rgba(8, 145, 178, 0.08)',
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  locCardContent: {
    flex: 1,
  },
  locCardName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  locCardSub: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
    fontWeight: '500',
  },
  cameraTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
  },
  cameraDesc: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  sessionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0A2342',
    padding: 20,
    paddingTop: Platform.OS === 'ios' ? 56 : 40,
  },
  sessionBack: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  sessionTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#fff',
    textAlign: 'center',
  },
  sessionSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 2,
    fontWeight: '600',
  },
  sessionBadge: {
    backgroundColor: '#0891B2',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  sessionBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#fff',
  },
  cameraContainer: { 
    flex: 1,
  },
  camera: { 
    flex: 1,
  },
  overlay: { 
    flex: 1, 
    backgroundColor: 'rgba(9, 26, 46, 0.65)', 
    justifyContent: 'center', 
    alignItems: 'center',
  },
  scanBox: { 
    width: 240, 
    height: 240, 
    position: 'relative',
    backgroundColor: 'transparent',
  },
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: '#0891B2',
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
  },
  laser: {
    height: 3,
    backgroundColor: '#0891B2',
    width: '100%',
    shadowColor: '#0891B2',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  scanText: { 
    color: '#fff', 
    marginTop: 24, 
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  inputContainer: { 
    flex: 1, 
    padding: 24, 
    justifyContent: 'center', 
    backgroundColor: '#fff', 
    borderBottomLeftRadius: 24, 
    borderBottomRightRadius: 24, 
    shadowColor: '#0A2342', 
    shadowOffset: { width: 0, height: 8 }, 
    shadowOpacity: 0.08, 
    shadowRadius: 16, 
    elevation: 4,
  },
  scannedProductHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 24,
  },
  productTitle: { 
    fontSize: 16, 
    fontWeight: '800', 
    color: '#0F172A',
  },
  productSubtitle: { 
    fontSize: 12, 
    color: '#64748B', 
    marginTop: 4,
    fontWeight: '600',
  },
  label: { 
    fontSize: 12, 
    color: '#475569', 
    marginBottom: 10, 
    fontWeight: '800', 
    textTransform: 'uppercase', 
    letterSpacing: 0.5,
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 24,
    paddingVertical: 6,
  },
  stepperBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    marginHorizontal: 16,
  },
  stepperInput: { 
    flex: 1,
    fontSize: 24, 
    fontWeight: '900',
    color: '#0F172A',
    paddingHorizontal: 8,
  },
  row: { 
    flexDirection: 'row',
  },
  btnPrimary: { 
    backgroundColor: '#0891B2', 
    padding: 16, 
    borderRadius: 16, 
    alignItems: 'center', 
    shadowColor: '#0891B2', 
    shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: 0.2, 
    shadowRadius: 8, 
    elevation: 4,
  },
  btnDanger: { 
    backgroundColor: '#ef4444', 
    padding: 16, 
    borderRadius: 16, 
    alignItems: 'center', 
    shadowColor: '#ef4444', 
    shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: 0.2, 
    shadowRadius: 8, 
    elevation: 4,
  },
  btnText: { 
    color: '#fff', 
    fontSize: 15, 
    fontWeight: '800',
  },
  bottomPanel: { 
    height: 300, 
    backgroundColor: '#fff', 
    borderTopLeftRadius: 28, 
    borderTopRightRadius: 28, 
    padding: 24, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: -10 }, 
    shadowOpacity: 0.08, 
    shadowRadius: 20, 
    elevation: 12,
  },
  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  historyTitle: { 
    fontSize: 14, 
    fontWeight: '800', 
    color: '#0F172A',
  },
  historyList: { 
    flex: 1, 
    marginBottom: 16,
  },
  emptyScanned: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
  },
  emptyScannedText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  historyItem: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingVertical: 12, 
    borderBottomWidth: 1, 
    borderBottomColor: '#f1f5f9',
  },
  historyItemName: { 
    fontSize: 13, 
    fontWeight: '700', 
    color: '#0F172A',
  },
  historyItemBc: { 
    fontSize: 11, 
    color: '#94A3B8', 
    marginTop: 2,
    fontWeight: '600',
  },
  historyQtyBadge: {
    backgroundColor: 'rgba(8, 145, 178, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  historyQtyText: { 
    fontSize: 13, 
    fontWeight: '800', 
    color: '#0891B2',
  },
  completeBtn: { 
    backgroundColor: '#0A2342', 
    padding: 16, 
    borderRadius: 16, 
    alignItems: 'center', 
    shadowColor: '#0A2342', 
    shadowOffset: { width: 0, height: 6 }, 
    shadowOpacity: 0.25, 
    shadowRadius: 10, 
    elevation: 4,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
});
