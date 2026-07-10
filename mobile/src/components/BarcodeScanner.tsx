import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, Alert, Modal, TouchableOpacity, TextInput, ActivityIndicator, Animated, Platform } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { api } from '../services/api_service';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';

type TransactionType = 'INCOME' | 'OUTFLOW' | 'RETURN' | 'WRITE_OFF';

export default function BarcodeScanner() {
  // 1. All hooks defined strictly at the top of the component
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [barcode, setBarcode] = useState<string>('');
  const [role, setRole] = useState<string>('NURSE');
  
  const [medication, setMedication] = useState<any>(null);
  const [loadingMed, setLoadingMed] = useState(false);
  
  const [quantity, setQuantity] = useState('1');
  const [type, setType] = useState<TransactionType>('OUTFLOW');
  const [submitting, setSubmitting] = useState(false);
  
  const cameraRef = useRef<any>(null);
  const [recognizing, setRecognizing] = useState(false);
  const [torch, setTorch] = useState(false);

  const scanLineAnim = useRef(new Animated.Value(0)).current;

  // Running the scanner laser line animation
  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(scanLineAnim, {
          toValue: 270,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(scanLineAnim, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [scanLineAnim]);

  useEffect(() => {
    const init = async () => {
      try {
        const userRole = await SecureStore.getItemAsync('userRole');
        if (userRole) setRole(userRole);
      } catch (e) {
        console.log(e);
      }
    };
    init();
  }, []);

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    setScanned(true);
    setBarcode(data);
    setModalVisible(true);
    setLoadingMed(true);
    
    try {
      // Find medication by barcode
      const response = await api.post('/medication/scan', { barcode: data });
      if (response.data.data) {
        setMedication(response.data.data);
      } else {
        setMedication(null);
      }
    } catch (e: any) {
      setMedication(null);
      if (e.response?.status === 404) {
        Alert.alert("Новый товар", "Штрих-код не найден в базе. Обратитесь к администратору для создания карточки товара.");
      }
    } finally {
      setLoadingMed(false);
    }
  };

  const submitTransaction = async () => {
    if (!medication || medication.isNew) {
      Alert.alert('Ошибка', 'Сначала нужно завести товар в базу.');
      return;
    }
    
    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty <= 0) {
      Alert.alert('Ошибка', 'Введите корректное количество');
      return;
    }

    setSubmitting(true);
    try {
      const locResponse = await api.get('/locations');
      const defaultLocId = locResponse.data[0]?.id || 1;

      await api.post('/transactions', {
        type,
        quantity: qty,
        medicationId: medication.id,
        locationId: defaultLocId,
        reason: type === 'WRITE_OFF' ? 'Списание через мобильное приложение' : undefined
      });
      
      Alert.alert('Успех', 'Операция успешно проведена!');
      closeModal();
    } catch (e: any) {
      Alert.alert('Ошибка', e.response?.data?.message || 'Не удалось провести операцию');
    } finally {
      setSubmitting(false);
    }
  };

  const submitNewMedication = async () => {
    const minQty = parseInt(quantity, 10) || 0;
    if (!medication?.name) {
      Alert.alert('Ошибка', 'Введите название товара');
      return;
    }
    setSubmitting(true);
    try {
      // Find default group
      const groupsRes = await api.get('/groups');
      const defaultGroupId = groupsRes.data.data[0]?.id || 1;

      await api.post('/medication', {
        name: medication.name,
        barcode: medication.barcode,
        minQuantity: minQty,
        groupId: defaultGroupId
      });
      
      Alert.alert('Успех', 'Товар успешно создан!');
      closeModal();
    } catch (e: any) {
      Alert.alert('Ошибка', e.response?.data?.message || 'Не удалось создать товар');
    } finally {
      setSubmitting(false);
    }
  };

  const closeModal = () => {
    setModalVisible(false);
    setQuantity('1');
    setType('OUTFLOW');
    setMedication(null);
    setTimeout(() => setScanned(false), 500); 
  };

  // 2. Conditional returns after all hook declarations
  if (!permission) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#0891B2" />
        <Text style={styles.permissionText}>Загрузка разрешений камеры...</Text>
      </View>
    );
  }
  
  if (!permission.granted) {
    return (
      <View style={[styles.container, { padding: 20, alignItems: 'center', justifyContent: 'center' }]}>
        <Ionicons name="camera-outline" size={64} color="#64748b" style={{ marginBottom: 16 }} />
        <Text style={styles.permissionText}>
          Для сканирования штрих-кодов и распознавания препаратов требуется доступ к камере.
        </Text>
        <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}>
          <Text style={styles.permissionBtnText}>Предоставить доступ</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const allowIncome = ['ADMIN', 'STOREKEEPER', 'HEAD_NURSE'].includes(role);
  const allowOutflow = ['ADMIN', 'STOREKEEPER', 'NURSE', 'HEAD_NURSE'].includes(role);
  const allowReturn = ['ADMIN', 'STOREKEEPER', 'HEAD_NURSE'].includes(role);
  const allowWriteOff = ['ADMIN', 'HEAD_NURSE', 'NURSE'].includes(role);

  const takePhotoAndRecognize = async () => {
    if (!cameraRef.current) return;
    setRecognizing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.5 });
      const base64 = `data:image/jpeg;base64,${photo.base64}`;
      
      const response = await api.post('/ai/recognize', { image: base64 });
      const { text, confidence, medication } = response.data.data;
      
      if (confidence < 80) {
        Alert.alert(
          'Низкая уверенность ИИ', 
          `Распознано: ${text}\nУверенность: ${confidence}%\n\nИИ не уверен в результате. Пожалуйста, введите данные вручную.`,
          [{ text: 'Понятно', onPress: () => {
             setMedication({ isNew: true, name: text, barcode: 'Распознано ИИ (низкая уверенность)' });
             setBarcode('Распознано ИИ (низкая уверенность)');
             setModalVisible(true);
          }}]
        );
      } else if (medication) {
        setMedication(medication);
        setBarcode(medication.barcode || 'Распознано ИИ');
        setModalVisible(true);
      } else {
        Alert.alert('Распознано:', `${text}\nУверенность: ${confidence}%\nТовар не найден в базе.`);
      }
    } catch (e) {
      Alert.alert('Ошибка', 'Не удалось распознать изображение');
    } finally {
      setRecognizing(false);
    }
  };

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        enableTorch={torch}
        barcodeScannerSettings={{
          barcodeTypes: ['qr', 'ean13', 'ean8', 'code128', 'code39', 'upc_a', 'upc_e'],
        }}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        style={StyleSheet.absoluteFill}
      >
        {/* Premium Dark Overlay Mask */}
        <View style={styles.overlayContainer}>
          <View style={styles.topBar}>
            <Text style={styles.topBarTitle}>Сканирование</Text>
            <TouchableOpacity 
              style={[styles.torchButton, torch && styles.torchButtonActive]} 
              onPress={() => setTorch(!torch)}
            >
              <Ionicons name={torch ? "flash" : "flash-outline"} size={22} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={styles.middleRow}>
            <View style={styles.sideOverlay} />
            <View style={styles.scannerTarget}>
              {/* Corner borders for the target box */}
              <View style={[styles.corner, styles.topLeft]} />
              <View style={[styles.corner, styles.topRight]} />
              <View style={[styles.corner, styles.bottomLeft]} />
              <View style={[styles.corner, styles.bottomRight]} />
              
              {/* Red laser line animation */}
              <Animated.View
                style={[
                  styles.scanLine,
                  {
                    transform: [{ translateY: scanLineAnim }]
                  }
                ]}
              />
            </View>
            <View style={styles.sideOverlay} />
          </View>

          <View style={styles.bottomBar}>
            <Text style={styles.scanInstructions}>
              Наведите камеру на штрих-код или воспользуйтесь ИИ
            </Text>
            
            <TouchableOpacity 
              style={[styles.aiButton, recognizing && styles.aiButtonDisabled]} 
              onPress={takePhotoAndRecognize}
              disabled={recognizing}
            >
              {recognizing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="camera" size={24} color="#fff" />
                  <Text style={styles.aiButtonText}>Распознать по фото (ИИ)</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </CameraView>

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Новая операция</Text>
              <TouchableOpacity onPress={closeModal}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <Text style={styles.barcodeText}>Штрих-код: {barcode}</Text>

            {loadingMed ? (
              <ActivityIndicator size="small" color="#0891B2" style={styles.loader} />
            ) : medication ? (
              <View style={styles.medicationBox}>
                <Text style={styles.medName}>{medication.name}</Text>
                <Text style={styles.medInfo}>Мин. остаток: {medication.minQuantity}</Text>
              </View>
            ) : (
              <View style={styles.newMedBox}>
                <Text style={styles.notFound}>Товар не найден. Создать новый?</Text>
                <TextInput
                  style={styles.inputSmall}
                  placeholder="Название (МНН)"
                  onChangeText={(val) => setMedication({ ...medication, isNew: true, name: val, barcode })}
                />
              </View>
            )}

            {!medication?.isNew && (
              <>
                <Text style={styles.label}>Тип операции:</Text>
                <View style={styles.typeSelector}>
                  {allowIncome && (
                    <TouchableOpacity 
                      style={[styles.typeBtn, type === 'INCOME' && styles.typeBtnActive]} 
                      onPress={() => setType('INCOME')}
                    >
                      <Text style={[styles.typeBtnText, type === 'INCOME' && styles.typeBtnTextActive]}>Приёмка</Text>
                    </TouchableOpacity>
                  )}
                  {allowOutflow && (
                    <TouchableOpacity 
                      style={[styles.typeBtn, type === 'OUTFLOW' && styles.typeBtnActive]} 
                      onPress={() => setType('OUTFLOW')}
                    >
                      <Text style={[styles.typeBtnText, type === 'OUTFLOW' && styles.typeBtnTextActive]}>Выдача</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <View style={styles.typeSelector}>
                  {allowReturn && (
                    <TouchableOpacity 
                      style={[styles.typeBtn, type === 'RETURN' && styles.typeBtnActive]} 
                      onPress={() => setType('RETURN')}
                    >
                      <Text style={[styles.typeBtnText, type === 'RETURN' && styles.typeBtnTextActive]}>Возврат</Text>
                    </TouchableOpacity>
                  )}
                  {allowWriteOff && (
                    <TouchableOpacity 
                      style={[styles.typeBtn, type === 'WRITE_OFF' && styles.typeBtnActive]} 
                      onPress={() => setType('WRITE_OFF')}
                    >
                      <Text style={[styles.typeBtnText, type === 'WRITE_OFF' && styles.typeBtnTextActive]}>Списание</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </>
            )}

            <Text style={styles.label}>Количество {medication?.isNew ? '(Мин. остаток)' : ''}:</Text>
            <TextInput
              style={styles.input}
              value={quantity}
              onChangeText={setQuantity}
              keyboardType="number-pad"
              placeholder="1"
            />

            <TouchableOpacity 
              style={[styles.submitBtn, submitting && styles.submitBtnDisabled]} 
              onPress={medication?.isNew ? submitNewMedication : submitTransaction}
              disabled={submitting || (!medication && !medication?.isNew)}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitBtnText}>{medication?.isNew ? 'Создать товар' : 'Подтвердить'}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  overlayContainer: {
    flex: 1,
    justifyContent: 'space-between',
    backgroundColor: 'rgba(9, 26, 46, 0.3)',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 60 : 44,
    paddingHorizontal: 24,
    paddingBottom: 16,
    backgroundColor: 'rgba(9, 26, 46, 0.75)',
  },
  topBarTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  torchButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  torchButtonActive: {
    backgroundColor: '#0891B2',
    borderColor: '#0891B2',
  },
  middleRow: {
    flexDirection: 'row',
    height: 280,
    width: '100%',
  },
  sideOverlay: {
    flex: 1,
    backgroundColor: 'rgba(9, 26, 46, 0.75)',
  },
  scannerTarget: {
    width: 280,
    height: 280,
    position: 'relative',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: '#0891B2',
    borderWidth: 4,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderTopLeftRadius: 8,
  },
  topRight: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
    borderTopRightRadius: 8,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
    borderBottomLeftRadius: 8,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderBottomRightRadius: 8,
  },
  scanLine: {
    position: 'absolute',
    left: 4,
    right: 4,
    height: 3,
    backgroundColor: '#00F0FF',
    shadowColor: '#00F0FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 8,
    elevation: 8,
  },
  bottomBar: {
    backgroundColor: 'rgba(9, 26, 46, 0.75)',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 44 : 24,
    alignItems: 'center',
    width: '100%',
  },
  scanInstructions: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  aiButton: {
    backgroundColor: '#0891B2',
    paddingHorizontal: 28,
    paddingVertical: 16,
    borderRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0891B2',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
    width: '100%',
    maxWidth: 300,
  },
  aiButtonDisabled: {
    backgroundColor: '#475569',
    shadowOpacity: 0,
    elevation: 0,
  },
  aiButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 10,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(9, 26, 46, 0.6)',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 44 : 24,
    minHeight: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0A2342',
    letterSpacing: 0.3,
  },
  barcodeText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
    marginBottom: 16,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  loader: {
    marginVertical: 24,
  },
  medicationBox: {
    backgroundColor: 'rgba(8, 145, 178, 0.04)',
    padding: 16,
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(8, 145, 178, 0.15)',
  },
  medName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  medInfo: {
    fontSize: 14,
    color: '#475569',
    marginTop: 6,
    fontWeight: '500',
  },
  notFound: {
    color: '#EF4444',
    fontWeight: '600',
    marginBottom: 12,
  },
  label: {
    fontSize: 15,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 10,
  },
  typeSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
    gap: 10,
  },
  typeBtn: {
    flex: 1,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  typeBtnActive: {
    backgroundColor: '#0891B2',
    borderColor: '#0891B2',
  },
  typeBtnText: {
    color: '#64748B',
    fontWeight: '700',
    fontSize: 14,
  },
  typeBtnTextActive: {
    color: '#fff',
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 14,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 24,
    backgroundColor: '#F8FAFC',
    color: '#0F172A',
  },
  newMedBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.04)',
    padding: 16,
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.15)',
  },
  inputSmall: {
    borderWidth: 1.5,
    borderColor: '#FCA5A5',
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
    color: '#0F172A',
    marginTop: 8,
  },
  submitBtn: {
    backgroundColor: '#0A2342',
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0A2342',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  submitBtnDisabled: {
    backgroundColor: '#cbd5e1',
    shadowOpacity: 0,
    elevation: 0,
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  permissionText: {
    color: '#64748B',
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
    fontWeight: '500',
  },
  permissionBtn: {
    backgroundColor: '#0891B2',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 16,
    shadowColor: '#0891B2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  permissionBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
