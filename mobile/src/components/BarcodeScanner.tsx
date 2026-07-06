import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, Alert, Modal, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { Camera, CameraView } from 'expo-camera';
import { api } from '../services/api_service';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';

type TransactionType = 'INCOME' | 'OUTFLOW' | 'RETURN' | 'WRITE_OFF';

export default function BarcodeScanner() {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [barcode, setBarcode] = useState<string>('');
  const [role, setRole] = useState<string>('NURSE');
  
  const [medication, setMedication] = useState<any>(null);
  const [loadingMed, setLoadingMed] = useState(false);
  
  const [quantity, setQuantity] = useState('1');
  const [type, setType] = useState<TransactionType>('OUTFLOW');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const init = async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
      
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
      const defaultLocId = locResponse.data.data[0]?.id || 1;

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

  if (hasPermission === null) {
    return <Text>Запрос разрешения на использование камеры...</Text>;
  }
  if (hasPermission === false) {
    return <Text>Нет доступа к камере</Text>;
  }

  const allowIncome = ['ADMIN', 'STOREKEEPER', 'HEAD_NURSE'].includes(role);
  const allowOutflow = ['ADMIN', 'STOREKEEPER', 'NURSE', 'HEAD_NURSE'].includes(role);
  const allowReturn = ['ADMIN', 'STOREKEEPER', 'HEAD_NURSE'].includes(role);
  const allowWriteOff = ['ADMIN', 'HEAD_NURSE', 'NURSE'].includes(role);

  const cameraRef = React.useRef<any>(null);
  const [recognizing, setRecognizing] = useState(false);

  const takePhotoAndRecognize = async () => {
    if (!cameraRef.current) return;
    setRecognizing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.5 });
      const base64 = `data:image/jpeg;base64,${photo.base64}`;
      
      const response = await api.post('/ai/recognize', { image: base64 });
      const { text, confidence, medication } = response.data.data;
      
      if (medication) {
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
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        style={StyleSheet.absoluteFill}
      >
        <View style={styles.cameraOverlay}>
          <TouchableOpacity 
            style={styles.aiButton} 
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
    flexDirection: 'column',
    justifyContent: 'center',
    backgroundColor: '#000',
  },
  cameraOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 40,
  },
  aiButton: {
    backgroundColor: '#0891B2',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 30,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  aiButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    minHeight: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0A2342',
  },
  barcodeText: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 12,
  },
  loader: {
    marginVertical: 20,
  },
  medicationBox: {
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  medName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
  },
  medInfo: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 4,
  },
  notFound: {
    color: '#ef4444',
    marginBottom: 16,
    fontStyle: 'italic',
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#334155',
    marginBottom: 8,
  },
  typeSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 8,
  },
  typeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    alignItems: 'center',
  },
  typeBtnActive: {
    backgroundColor: '#0891B2',
    borderColor: '#0891B2',
  },
  typeBtnText: {
    color: '#475569',
    fontWeight: '500',
  },
  typeBtnTextActive: {
    color: '#fff',
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    padding: 12,
    fontSize: 18,
    marginBottom: 24,
    backgroundColor: '#fff',
  },
  newMedBox: {
    backgroundColor: '#fff1f2',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#fecdd3',
  },
  inputSmall: {
    borderWidth: 1,
    borderColor: '#fecdd3',
    borderRadius: 8,
    padding: 8,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  submitBtn: {
    backgroundColor: '#0A2342',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitBtnDisabled: {
    backgroundColor: '#94a3b8',
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});
