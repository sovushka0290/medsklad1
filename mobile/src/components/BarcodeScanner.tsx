import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, Alert, Modal, TouchableOpacity, TextInput, ActivityIndicator, Animated, Platform, ScrollView, KeyboardAvoidingView } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { api } from '../services/api_service';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';

type TransactionType = 'INCOME' | 'OUTFLOW' | 'RETURN' | 'WRITE_OFF';

const GROUPS = [
  { id: 1, name: 'Анестетики' },
  { id: 2, name: 'Расходники' },
  { id: 3, name: 'Медикаменты' },
  { id: 4, name: 'Композиты' },
  { id: 5, name: 'Цементы' }
];

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
  const [selectedGroupId, setSelectedGroupId] = useState<number>(1);
  
  // Расширенные поля для операций
  const [batchNumber, setBatchNumber] = useState('');
  const [serialNumber, setSerialNumberField] = useState('');
  const [purposeField, setPurposeField] = useState('');
  const [receiverField, setReceiverField] = useState('');
  const [reasonField, setReasonField] = useState('');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const handleSearchMedication = async (q: string) => {
    if (q.trim().length < 2) return;
    setSearchLoading(true);
    try {
      const res = await api.get(`/medications/search?q=${encodeURIComponent(q)}`);
      setSearchResults(res.data || []);
    } catch (e) {
      console.log(e);
      Alert.alert('Ошибка', 'Не удалось выполнить поиск препаратов');
    } finally {
      setSearchLoading(false);
    }
  };
  
  const cameraRef = useRef<any>(null);
  const [recognizing, setRecognizing] = useState(false);
  const [torch, setTorch] = useState(false);
  const [aiResult, setAiResult] = useState<{
    manufacturer?: string;
    dosage?: string;
    expirationDate?: string;
    serialNumber?: string;
    ocrText?: string;
    confidence?: number;
  } | null>(null);

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

  const canCreateMedication = ['ADMIN', 'STOREKEEPER'].includes(role);

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    setScanned(true);
    setBarcode(data);
    setLoadingMed(true);
    
    try {
      // Find medication by barcode
      const response = await api.post('/medication/scan', { barcode: data });
      if (response.data.data) {
        setMedication(response.data.data);
        setModalVisible(true);
      } else {
        setMedication(null);
      }
    } catch (e: any) {
      setMedication(null);
      if (e.response?.status === 404) {
        if (canCreateMedication) {
          setMedication({ isNew: true, name: '', barcode: data });
          setModalVisible(true);
        } else {
          Alert.alert("Товар не найден", "Данный штрих-код отсутствует в базе. Пожалуйста, обратитесь к кладовщику или администратору.");
          setTimeout(() => setScanned(false), 2000);
        }
      } else {
        Alert.alert("Ошибка", "Не удалось проверить штрих-код.");
        setTimeout(() => setScanned(false), 2000);
      }
    } finally {
      setLoadingMed(false);
    }
  };



  // Load locations on mount for batch filtering
  const [locations, setLocations] = useState<any[]>([]);
  const [selectedLocId, setSelectedLocId] = useState<number | null>(null);

  // Expiration Date pickers states for scan sheet
  const [expDay, setExpDay] = useState('');
  const [expMonth, setExpMonth] = useState('');
  const [expYear, setExpYear] = useState('');
  const [dayPickerVisible, setDayPickerVisible] = useState(false);
  const [monthPickerVisible, setMonthPickerVisible] = useState(false);
  const [yearPickerVisible, setYearPickerVisible] = useState(false);

  // Price & Supplier inputs for scan sheet
  const [priceField, setPriceField] = useState('');
  const [supplierField, setSupplierField] = useState('');

  // Selected batch for OUTFLOW
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);
  const [batchPickerVisible, setBatchPickerVisible] = useState(false);

  // Reason checklist states
  const [selectedReasonType, setSelectedReasonType] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [reasonPickerVisible, setReasonPickerVisible] = useState(false);

  const days = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'));
  const months = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
  const years = Array.from({ length: 11 }, (_, i) => String(new Date().getFullYear() + i));

  const standardReasons = type === 'WRITE_OFF'
    ? ['Истек срок годности', 'Брак / Повреждение упаковки', 'Испорчено в кабинете', 'Другое']
    : ['Излишки кабинета', 'Отмена процедуры', 'Ошибка при получении', 'Другое'];

  useEffect(() => {
    fetchLocations();
  }, []);

  const fetchLocations = async () => {
    try {
      const res = await api.get('/locations');
      const locs = res.data || [];
      setLocations(locs);
      if (locs.length > 0) {
        setSelectedLocId(locs[0].id);
      }
    } catch (e) {
      console.log('Failed to fetch locations in scanner', e);
    }
  };

  const availableBatches = React.useMemo(() => {
    if (!medication || medication.isNew || !medication.batches || !selectedLocId) return [];
    return medication.batches.filter((b: any) => b.locationId === selectedLocId && b.quantity > 0);
  }, [medication, selectedLocId]);

  const selectedBatch = availableBatches.find((b: any) => b.id === selectedBatchId);

  const takePhotoAndRecognize = async () => {
    if (!cameraRef.current) return;
    setRecognizing(true);
    setAiResult(null);
    try {
      const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.6 });
      const base64 = `data:image/jpeg;base64,${photo.base64}`;
      
      const response = await api.post('/ai/recognize', { image: base64 });
      const { text, confidence, medication: foundMed, manufacturer, dosage, expirationDate, serialNumber, ocrText } = response.data.data;

      const ocrData = { manufacturer, dosage, expirationDate, serialNumber, ocrText, confidence };
      setAiResult(ocrData);
      
      if (confidence < 80) {
        Alert.alert(
          'ИИ не уверен. Заполните данные вручную',
          `Уверенность распознавания ИИ: ${confidence}%. Пожалуйста, введите данные или выполните поиск препарата вручную.`,
          [
            {
              text: 'Снять заново',
              style: 'cancel',
              onPress: () => {
                setAiResult(null);
                setScanned(false);
              }
            },
            {
              text: 'Ввести вручную',
              onPress: () => {
                if (canCreateMedication) {
                  setMedication({ isNew: true, name: text || '', barcode: 'Распознано ИИ (низкая уверенность)' });
                } else {
                  setMedication(null);
                  setSearchQuery(text || '');
                  handleSearchMedication(text || '');
                }
                setBarcode('Распознано ИИ');
                setModalVisible(true);
              }
            }
          ]
        );
      } else if (foundMed) {
        setMedication(foundMed);
        setBarcode(foundMed.barcode || 'Распознано ИИ');
        setModalVisible(true);
        // Pre-fill parsed fields if INCOME
        if (expirationDate) {
          const parts = expirationDate.split('-');
          if (parts.length === 3) {
            setExpYear(parts[0]);
            setExpMonth(parts[1]);
            setExpDay(parts[2]);
          } else if (parts.length === 2) {
            setExpYear(parts[0]);
            setExpMonth(parts[1]);
            setExpDay('01');
          }
        }
        if (serialNumber) setSerialNumberField(serialNumber);
      } else {
        if (canCreateMedication) {
          setMedication({ isNew: true, name: text || '', barcode: 'Распознано ИИ' });
          setBarcode('Распознано ИИ');
          setModalVisible(true);
        } else {
          setMedication(null);
          setSearchQuery(text || '');
          handleSearchMedication(text || '');
          setBarcode('Распознано ИИ');
          setModalVisible(true);
        }
      }
    } catch (e) {
      Alert.alert('Ошибка', 'Не удалось распознать изображение. Попробуйте ещё раз.');
    } finally {
      setRecognizing(false);
    }
  };

  const sendTransaction = async () => {
    setSubmitting(true);
    try {
      const finalReason = (type === 'WRITE_OFF' || type === 'RETURN')
        ? (selectedReasonType === 'Другое' ? customReason : selectedReasonType)
        : reasonField;

      const payload: any = {
        type,
        quantity: parseInt(quantity, 10),
        medicationId: medication.id,
        locationId: selectedLocId || 1,
        reason: finalReason.trim() || undefined,
        allowOverdraft: type === 'OUTFLOW',
      };

      if (type === 'INCOME') {
        payload.batchNumber = batchNumber.trim();
        payload.expirationDate = `${expYear}-${expMonth}-${expDay}`;
        payload.serialNumber = serialNumber.trim();
        payload.supplier = supplierField.trim();
        payload.price = parseFloat(priceField);
      } else if (type === 'OUTFLOW' && selectedBatch) {
        payload.batchNumber = selectedBatch.batchNumber || undefined;
        payload.expirationDate = selectedBatch.expirationDate || undefined;
        payload.serialNumber = selectedBatch.serialNumber || undefined;
        payload.purpose = purposeField.trim() || undefined;
        payload.receiver = receiverField.trim() || undefined;
      }

      const result = await api.post('/transactions', payload);
      
      if (result.data?.offline) {
        Alert.alert(
          '📱 Сохранено оффлайн',
          'Нет подключения к сети. Операция сохранена локально и будет отправлена при восстановлении соединения.'
        );
      } else {
        Alert.alert('✅ Успех', 'Операция успешно проведена!');
      }
      closeModal();
    } catch (e: any) {
      Alert.alert('Ошибка', e.response?.data?.message || e.response?.data?.error || 'Не удалось провести операцию');
    } finally {
      setSubmitting(false);
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

    if (type === 'INCOME') {
      if (!batchNumber.trim()) {
        Alert.alert('Ошибка', 'Поле "Номер партии" обязательно для заполнения');
        return;
      }
      if (!expDay || !expMonth || !expYear) {
        Alert.alert('Ошибка', 'Укажите срок годности (День, Месяц и Год)');
        return;
      }
      if (!serialNumber.trim()) {
        Alert.alert('Ошибка', 'Поле "Серийный номер" обязательно для заполнения');
        return;
      }
      if (!priceField.trim() || isNaN(parseFloat(priceField)) || parseFloat(priceField) <= 0) {
        Alert.alert('Ошибка', 'Введите корректную закупочную цену');
        return;
      }
      if (!supplierField.trim()) {
        Alert.alert('Ошибка', 'Поле "Поставщик" обязательно для заполнения');
        return;
      }
    }

    if (type === 'OUTFLOW') {
      if (!purposeField.trim()) {
        Alert.alert('Ошибка', 'Укажите цель выдачи (поле обязательное)');
        return;
      }
      if (availableBatches.length > 0) {
        if (!selectedBatchId) {
          Alert.alert('Ошибка', 'Выберите конкретную партию для выдачи');
          return;
        }
        
        // FIFO check
        const oldestFirst = [...availableBatches].sort((a, b) => {
          if (!a.expirationDate && !b.expirationDate) return 0;
          if (!a.expirationDate) return 1;
          if (!b.expirationDate) return -1;
          return new Date(a.expirationDate).getTime() - new Date(b.expirationDate).getTime();
        });

        if (selectedBatchId !== oldestFirst[0].id) {
          Alert.alert(
            'Нарушение FIFO!',
            'Вы выбрали не самую старую партию. Согласно правилу FIFO, рекомендуется выдавать сначала старейшие партии. Продолжить?',
            [
              { text: 'Нет, выбрать другую', style: 'cancel' },
              { text: 'Да, продолжить', onPress: () => sendTransaction() }
            ]
          );
          return;
        }
      }
    }

    if (type === 'WRITE_OFF' || type === 'RETURN') {
      const finalReason = selectedReasonType === 'Другое' ? customReason : selectedReasonType;
      if (!finalReason.trim()) {
        Alert.alert('Ошибка', 'Поле "Причина" обязательно для заполнения');
        return;
      }
    }

    sendTransaction();
  };

  const PickerModal = ({ visible, options, onSelect, onClose, title }: any) => {
    return (
      <Modal visible={visible} transparent={true} animationType="slide">
        <View style={styles.modalBg}>
          <View style={styles.modalContainer}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>{title}</Text>
              <TouchableOpacity onPress={onClose}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalList}>
              {options.map((opt: any) => (
                <TouchableOpacity
                  key={opt}
                  style={styles.modalItem}
                  onPress={() => { onSelect(opt); onClose(); }}
                >
                  <Text style={styles.modalItemText}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  const submitNewMedication = async () => {
    const minQty = parseInt(quantity, 10) || 0;
    if (!medication?.name) {
      Alert.alert('Ошибка', 'Введите название товара');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/medication', {
        name: medication.name,
        barcode: medication.barcode,
        minQuantity: minQty,
        groupId: selectedGroupId
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
    setSelectedGroupId(1);
    setSearchQuery('');
    setSearchResults([]);
    setBatchNumber('');
    setSerialNumberField('');
    setPurposeField('');
    setReceiverField('');
    setReasonField('');
    setExpDay('');
    setExpMonth('');
    setExpYear('');
    setPriceField('');
    setSupplierField('');
    setSelectedBatchId(null);
    setSelectedReasonType('');
    setCustomReason('');
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
              <View style={[styles.corner, styles.topLeft]} />
              <View style={[styles.corner, styles.topRight]} />
              <View style={[styles.corner, styles.bottomLeft]} />
              <View style={[styles.corner, styles.bottomRight]} />
              
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
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { maxHeight: '90%' }]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Новая операция</Text>
                <TouchableOpacity onPress={closeModal}>
                  <Ionicons name="close" size={24} color="#64748b" />
                </TouchableOpacity>
              </View>

              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <Text style={styles.barcodeText}>Штрих-код: {barcode}</Text>

                {aiResult && (aiResult.manufacturer || aiResult.dosage || aiResult.expirationDate || aiResult.serialNumber) && (
                  <View style={styles.aiInfoCard}>
                    <View style={styles.aiInfoHeader}>
                      <Ionicons name="sparkles" size={14} color="#7C3AED" />
                      <Text style={styles.aiInfoTitle}>Данные с упаковки (ИИ)</Text>
                      <View style={styles.aiConfidenceBadge}>
                        <Text style={styles.aiConfidenceText}>{aiResult.confidence}%</Text>
                      </View>
                    </View>
                    {aiResult.manufacturer && (
                      <View style={styles.aiInfoRow}>
                        <Text style={styles.aiInfoLabel}>Производитель</Text>
                        <Text style={styles.aiInfoValue}>{aiResult.manufacturer}</Text>
                      </View>
                    )}
                    {aiResult.dosage && (
                      <View style={styles.aiInfoRow}>
                        <Text style={styles.aiInfoLabel}>Дозировка</Text>
                        <Text style={styles.aiInfoValue}>{aiResult.dosage}</Text>
                      </View>
                    )}
                    {aiResult.expirationDate && (
                      <View style={styles.aiInfoRow}>
                        <Text style={styles.aiInfoLabel}>Срок годности</Text>
                        <Text style={[styles.aiInfoValue, { color: '#F59E0B' }]}>{aiResult.expirationDate}</Text>
                      </View>
                    )}
                    {aiResult.serialNumber && (
                      <View style={styles.aiInfoRow}>
                        <Text style={styles.aiInfoLabel}>Серия / Лот</Text>
                        <Text style={styles.aiInfoValue}>{aiResult.serialNumber}</Text>
                      </View>
                    )}
                  </View>
                )}

                {loadingMed ? (
                  <ActivityIndicator size="small" color="#0891B2" style={styles.loader} />
                ) : medication ? (
                  medication.isNew ? (
                    <View style={styles.newMedBox}>
                      <Text style={styles.notFound}>Товар не найден. Создать новый?</Text>
                      <TextInput
                        style={styles.inputSmall}
                        placeholder="Название (МНН)"
                        value={medication.name}
                        onChangeText={(val) => setMedication({ ...medication, name: val })}
                      />
                      
                      <Text style={[styles.label, { marginTop: 12 }]}>Группа товара:</Text>
                      <View style={styles.groupGrid}>
                        {GROUPS.map((g) => (
                          <TouchableOpacity
                            key={g.id}
                            style={[
                              styles.groupBtn,
                              selectedGroupId === g.id && styles.groupBtnActive
                            ]}
                            onPress={() => setSelectedGroupId(g.id)}
                          >
                            <Text
                              style={[
                                styles.groupBtnText,
                                selectedGroupId === g.id && styles.groupBtnTextActive
                              ]}
                            >
                              {g.name}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  ) : (
                    <View style={styles.medicationBox}>
                      <Text style={styles.medName}>{medication.name}</Text>
                      <Text style={styles.medInfo}>Мин. остаток: {medication.minQuantity}</Text>
                    </View>
                  )
                ) : (
                  <View style={styles.searchContainer}>
                    <Text style={styles.notFound}>Препарат не найден в базе данных.</Text>
                    <Text style={styles.searchLabel}>Поиск препарата вручную:</Text>
                    <View style={styles.searchRow}>
                      <TextInput
                        style={styles.searchInput}
                        placeholder="Введите название или МНН..."
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                      />
                      <TouchableOpacity
                        style={styles.searchBtn}
                        onPress={() => handleSearchMedication(searchQuery)}
                      >
                        <Ionicons name="search" size={18} color="#fff" />
                      </TouchableOpacity>
                    </View>

                    {searchLoading ? (
                      <ActivityIndicator size="small" color="#0891B2" style={{ marginVertical: 10 }} />
                    ) : (
                      <View style={styles.searchResultsList}>
                        {searchResults.length === 0 && searchQuery.trim().length >= 2 && (
                          <Text style={styles.noResultsText}>Ничего не найдено</Text>
                        )}
                        {searchResults.map((item) => (
                          <TouchableOpacity
                            key={item.id}
                            style={styles.searchResultItem}
                            onPress={() => {
                              setMedication(item);
                              setBarcode(item.barcodes[0] || 'Распознано ИИ');
                            }}
                          >
                            <Text style={styles.searchResultName}>{item.name}</Text>
                            {item.mnn && <Text style={styles.searchResultMnn}>МНН: {item.mnn}</Text>}
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                )}

                {!medication?.isNew && medication && (
                  <>
                    <Text style={styles.label}>Локация проведения:</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 10 }}>
                      {locations.map(loc => {
                        const isActive = selectedLocId === loc.id;
                        return (
                          <TouchableOpacity
                            key={loc.id}
                            style={[
                              styles.typeBtn,
                              isActive && { backgroundColor: '#0891B2', borderColor: '#0891B2' }
                            ]}
                            onPress={() => { setSelectedLocId(loc.id); setSelectedBatchId(null); }}
                            activeOpacity={0.8}
                          >
                            <Text style={[styles.typeBtnText, isActive && { color: '#fff' }]}>{loc.name}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>

                    <Text style={styles.label}>Тип операции:</Text>
                    <View style={styles.typeSelector}>
                      {allowIncome && (
                        <TouchableOpacity 
                          style={[styles.typeBtn, type === 'INCOME' && styles.typeBtnActive]} 
                          onPress={() => { setType('INCOME'); setSelectedBatchId(null); }}
                        >
                          <Text style={[styles.typeBtnText, type === 'INCOME' && styles.typeBtnTextActive]}>Приёмка</Text>
                        </TouchableOpacity>
                      )}
                      {allowOutflow && (
                        <TouchableOpacity 
                          style={[styles.typeBtn, type === 'OUTFLOW' && styles.typeBtnActive]} 
                          onPress={() => { setType('OUTFLOW'); setSelectedBatchId(null); }}
                        >
                          <Text style={[styles.typeBtnText, type === 'OUTFLOW' && styles.typeBtnTextActive]}>Выдача</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                    <View style={styles.typeSelector}>
                      {allowReturn && (
                        <TouchableOpacity 
                          style={[styles.typeBtn, type === 'RETURN' && styles.typeBtnActive]} 
                          onPress={() => { setType('RETURN'); setSelectedBatchId(null); }}
                        >
                          <Text style={[styles.typeBtnText, type === 'RETURN' && styles.typeBtnTextActive]}>Возврат</Text>
                        </TouchableOpacity>
                      )}
                      {allowWriteOff && (
                        <TouchableOpacity 
                          style={[styles.typeBtn, type === 'WRITE_OFF' && styles.typeBtnActive]} 
                          onPress={() => { setType('WRITE_OFF'); setSelectedBatchId(null); }}
                        >
                          <Text style={[styles.typeBtnText, type === 'WRITE_OFF' && styles.typeBtnTextActive]}>Списание</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </>
                )}

                {medication && (
                  <>
                    <Text style={styles.label}>Количество {medication?.isNew ? '(Мин. остаток)' : ''}:</Text>
                    <TextInput
                      style={styles.input}
                      value={quantity}
                      onChangeText={setQuantity}
                      keyboardType="number-pad"
                      placeholder="1"
                    />

                    {!medication?.isNew && (
                      <>
                        {type === 'INCOME' && (
                          <>
                            <Text style={styles.label}>Номер партии *</Text>
                            <TextInput
                              style={[styles.input, { marginBottom: 12 }]}
                              value={batchNumber}
                              onChangeText={setBatchNumber}
                              placeholder="Напр. B-7023"
                            />

                            <Text style={styles.label}>Срок годности *</Text>
                            <View style={styles.dropdownContainer}>
                              <TouchableOpacity style={styles.dropdownSubBtn} onPress={() => setDayPickerVisible(true)}>
                                <Text style={styles.dropdownSubBtnText}>{expDay || 'День'}</Text>
                              </TouchableOpacity>
                              <TouchableOpacity style={styles.dropdownSubBtn} onPress={() => setMonthPickerVisible(true)}>
                                <Text style={styles.dropdownSubBtnText}>{expMonth || 'Месяц'}</Text>
                              </TouchableOpacity>
                              <TouchableOpacity style={styles.dropdownSubBtn} onPress={() => setYearPickerVisible(true)}>
                                <Text style={styles.dropdownSubBtnText}>{expYear || 'Год'}</Text>
                              </TouchableOpacity>
                            </View>

                            <Text style={styles.label}>Серийный номер *</Text>
                            <TextInput
                              style={[styles.input, { marginBottom: 12 }]}
                              value={serialNumber}
                              onChangeText={setSerialNumberField}
                              placeholder="Напр. SN-552092"
                            />

                            <Text style={styles.label}>Поставщик *</Text>
                            <TextInput
                              style={[styles.input, { marginBottom: 12 }]}
                              value={supplierField}
                              onChangeText={setSupplierField}
                              placeholder="Напр. СК-Фармация"
                            />

                            <Text style={styles.label}>Закупочная цена (₸ за ед.) *</Text>
                            <TextInput
                              style={[styles.input, { marginBottom: 12 }]}
                              value={priceField}
                              onChangeText={setPriceField}
                              placeholder="Напр. 1500"
                              keyboardType="decimal-pad"
                            />
                          </>
                        )}

                        {type === 'OUTFLOW' && (
                          <>
                            <Text style={styles.label}>Цель выдачи *</Text>
                            <TextInput
                              style={[styles.input, { marginBottom: 12 }]}
                              value={purposeField}
                              onChangeText={setPurposeField}
                              placeholder="Цель выдачи (процедура, кабинет...)"
                            />

                            <Text style={styles.label}>Получатель (ФИО / кабинет)</Text>
                            <TextInput
                              style={[styles.input, { marginBottom: 12 }]}
                              value={receiverField}
                              onChangeText={setReceiverField}
                              placeholder="Получатель"
                            />

                            <Text style={styles.label}>Партия списания (FIFO) *</Text>
                            {availableBatches.length === 0 ? (
                              <Text style={{ fontSize: 13, color: '#ef4444', fontWeight: 'bold', marginVertical: 4 }}>
                                Нет доступных партий в выбранной локации
                              </Text>
                            ) : (
                              <TouchableOpacity
                                style={styles.selectBtn}
                                onPress={() => setBatchPickerVisible(true)}
                                activeOpacity={0.8}
                              >
                                <Ionicons name="layers-outline" size={18} color="#64748b" />
                                <Text style={[styles.selectBtnText, !selectedBatchId && { color: '#94a3b8' }]} numberOfLines={1}>
                                  {selectedBatch
                                    ? `Партия: ${selectedBatch.batchNumber || '#' + selectedBatch.id} (до ${selectedBatch.expirationDate ? new Date(selectedBatch.expirationDate).toLocaleDateString('ru-RU') : 'нет'}) — ${selectedBatch.quantity} шт.`
                                    : 'Выберите партию для списания...'}
                                </Text>
                                <Ionicons name="chevron-down" size={18} color="#94a3b8" />
                              </TouchableOpacity>
                            )}
                          </>
                        )}

                        {(type === 'WRITE_OFF' || type === 'RETURN') && (
                          <>
                            <Text style={styles.label}>Причина *</Text>
                            <TouchableOpacity
                              style={styles.selectBtn}
                              onPress={() => setReasonPickerVisible(true)}
                              activeOpacity={0.8}
                            >
                              <Ionicons name="help-circle-outline" size={18} color="#64748b" />
                              <Text style={[styles.selectBtnText, !selectedReasonType && { color: '#94a3b8' }]} numberOfLines={1}>
                                {selectedReasonType || 'Выберите причину из списка...'}
                              </Text>
                              <Ionicons name="chevron-down" size={18} color="#94a3b8" />
                            </TouchableOpacity>

                            {selectedReasonType === 'Другое' && (
                              <TextInput
                                style={[styles.input, { marginTop: 10 }]}
                                placeholder="Опишите причину вручную..."
                                value={customReason}
                                onChangeText={setCustomReason}
                              />
                            )}
                          </>
                        )}
                      </>
                    )}

                    {/* Modals for scan sheet pickers */}
                    <PickerModal
                      visible={dayPickerVisible}
                      options={days}
                      onSelect={setExpDay}
                      onClose={() => setDayPickerVisible(false)}
                      title="Выберите день"
                    />
                    <PickerModal
                      visible={monthPickerVisible}
                      options={months}
                      onSelect={setExpMonth}
                      onClose={() => setMonthPickerVisible(false)}
                      title="Выберите месяц"
                    />
                    <PickerModal
                      visible={yearPickerVisible}
                      options={years}
                      onSelect={setExpYear}
                      onClose={() => setYearPickerVisible(false)}
                      title="Выберите год"
                    />

                    {/* Batch Dropdown Modal */}
                    <PickerModal
                      visible={batchPickerVisible}
                      options={availableBatches.map((b: any) => `ID ${b.id} | Партия: ${b.batchNumber || 'нет'} (до ${b.expirationDate ? new Date(b.expirationDate).toLocaleDateString('ru-RU') : 'нет'}) — ${b.quantity} шт.`)}
                      onSelect={(opt: string) => {
                        const id = Number(opt.split(' | ')[0].replace('ID ', ''));
                        setSelectedBatchId(id);
                      }}
                      onClose={() => setBatchPickerVisible(false)}
                      title="Выберите партию списания"
                    />

                    {/* Reason Dropdown Modal */}
                    <PickerModal
                      visible={reasonPickerVisible}
                      options={standardReasons}
                      onSelect={setSelectedReasonType}
                      onClose={() => setReasonPickerVisible(false)}
                      title="Выберите причину"
                    />

                    <TouchableOpacity 
                      style={[styles.submitBtn, submitting && styles.submitBtnDisabled, { marginTop: 20 }]} 
                      onPress={medication?.isNew ? submitNewMedication : submitTransaction}
                      disabled={submitting}
                    >
                      {submitting ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={styles.submitBtnText}>{medication?.isNew ? 'Создать товар' : 'Подтвердить'}</Text>
                      )}
                    </TouchableOpacity>
                  </>
                )}
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  searchContainer: {
    width: '100%',
    marginVertical: 10,
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  searchLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 6,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    backgroundColor: '#fff',
  },
  searchBtn: {
    width: 40,
    height: 40,
    backgroundColor: '#0891B2',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchResultsList: {
    maxHeight: 150,
    width: '100%',
  },
  searchResultItem: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    backgroundColor: '#fff',
    borderRadius: 6,
    marginVertical: 2,
  },
  searchResultName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  searchResultMnn: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  noResultsText: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    paddingVertical: 10,
  },
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
  aiInfoCard: {
    backgroundColor: 'rgba(124, 58, 237, 0.05)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.2)',
    padding: 14,
    marginBottom: 16,
  },
  aiInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 6,
  },
  aiInfoTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#7C3AED',
    flex: 1,
  },
  aiConfidenceBadge: {
    backgroundColor: '#7C3AED',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  aiConfidenceText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  aiInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(124, 58, 237, 0.08)',
  },
  aiInfoLabel: {
    fontSize: 13,
    color: '#7C3AED',
    fontWeight: '600',
    flex: 1,
  },
  aiInfoValue: {
    fontSize: 13,
    color: '#1E293B',
    fontWeight: '700',
    flex: 2,
    textAlign: 'right',
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
  groupGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  groupBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
  },
  groupBtnActive: {
    backgroundColor: '#0891B2',
    borderColor: '#0891B2',
  },
  groupBtnText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  groupBtnTextActive: {
    color: '#fff',
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
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContainer: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: 350 },
  pickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 18, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  pickerTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  modalList: { padding: 8 },
  modalItem: { paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  modalItemText: { fontSize: 15, fontWeight: '600', color: '#334155', textAlign: 'center' },
  dropdownContainer: { flexDirection: 'row', gap: 8, marginTop: 4, marginBottom: 12 },
  dropdownSubBtn: { flex: 1, backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 14, paddingVertical: 13, alignItems: 'center', justifyContent: 'center' },
  dropdownSubBtnText: { fontSize: 14, fontWeight: '600', color: '#0f172a' },
  selectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12
  },
  selectBtnText: { flex: 1, fontSize: 14, fontWeight: '600', color: '#0f172a' },
});
