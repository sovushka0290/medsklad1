import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Button,
  Modal,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  FlatList,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import { MaterialIcons } from '@expo/vector-icons';
import { api } from '../../src/api/api';
import { InventoryModal } from '../../src/components/InventoryModal';

export default function ScannerScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [barcode, setBarcode] = useState('');
  const [medication, setMedication] = useState<any | null>(null);
  const [locations, setLocations] = useState<any[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null);
  const [torch, setTorch] = useState(false);
  
  const cameraRef = useRef<CameraView>(null);

  // Сжатие и изменение размера кадра перед отправкой в ИИ (подготовка к будущим этапам)
  const captureAndCompressImage = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          skipProcessing: true,
        });

        if (photo) {
          const manipulated = await ImageManipulator.manipulateAsync(
            photo.uri,
            [{ resize: { width: 1024 } }],
            { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true }
          );
          console.log(`Оригинал: ${photo.uri}`);
          console.log(`Сжато: ${manipulated.uri} (base64 size: ${manipulated.base64?.length})`);
          return manipulated.base64;
        }
      } catch (error) {
        console.error('Ошибка захвата/сжатия фото:', error);
      }
    }
    return null;
  };
  
  // Состояния интерфейса
  const [loading, setLoading] = useState(false);
  const [transactionLoading, setTransactionLoading] = useState(false);
  const [showMedicationModal, setShowMedicationModal] = useState(false);
  const [showManualSearch, setShowManualSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [notFound, setNotFound] = useState(false);

  // Загружаем список всех локаций при старте
  useEffect(() => {
    api.get('/locations')
      .then(res => {
        setLocations(res.data);
        if (res.data.length > 0) {
          setSelectedLocationId(res.data[0].id);
        }
      })
      .catch(err => {
        console.error('Ошибка загрузки локаций:', err);
      });
  }, []);

  if (!permission) {
    return (
      <View className="flex-1 justify-center items-center bg-[#F1F5F9]">
        <ActivityIndicator size="large" color="#0891B2" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View className="flex-1 justify-center items-center bg-[#F1F5F9] p-6">
        <Text className="text-center mb-6 text-lg text-[#0A2342] font-semibold">
          Для сканирования штрихкодов приложению требуется разрешение на использование камеры
        </Text>
        <TouchableOpacity
          onPress={requestPermission}
          className="bg-[#0891B2] px-6 py-3 rounded-xl shadow-md"
        >
          <Text className="text-white font-bold text-base">Предоставить доступ</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Обработка успешного сканирования штрихкода
  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    setScanned(true);
    setBarcode(data);
    setLoading(true);
    setNotFound(false);
    setMedication(null);

    try {
      const response = await api.get(`/medications?barcode=${data}`);
      if (response.data && response.data.length > 0) {
        const med = response.data[0];
        setMedication(med);
        setShowMedicationModal(true);
      } else {
        setNotFound(true);
      }
    } catch (err: any) {
      console.error(err);
      Alert.alert('Ошибка соединения', 'Не удалось связаться с сервером');
      setScanned(false);
    } finally {
      setLoading(false);
    }
  };

  // Поиск товаров вручную для привязки ШК
  const handleSearch = async (text: string) => {
    setSearchQuery(text);
    if (!text.trim()) {
      setSearchResults([]);
      return;
    }
    try {
      const response = await api.get(`/medications/search?q=${encodeURIComponent(text)}`);
      setSearchResults(response.data);
    } catch (err) {
      console.error('Ошибка поиска:', err);
    }
  };

  // Привязка текущего отсканированного ШК к выбранному товару
  const linkBarcodeToMedication = async (medId: number, medName: string) => {
    Alert.alert(
      'Подтверждение привязки',
      `Вы уверены, что хотите привязать штрихкод ${barcode} к товару "${medName}"?`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Привязать',
          onPress: async () => {
            setLoading(true);
            try {
              const response = await api.put(`/medications/${medId}`, { barcode }, {
                headers: {
                  'x-api-key': 'MedSkladSecretKey123',
                },
              });
              Alert.alert('Успех', 'Штрихкод успешно привязан!');
              
              // Загружаем обновленные данные товара
              const updatedMedRes = await api.get(`/medications?barcode=${barcode}`);
              setMedication(updatedMedRes.data[0]);
              
              // Сбрасываем режим поиска и открываем окно операций
              setShowManualSearch(false);
              setNotFound(false);
              setShowMedicationModal(true);
            } catch (err: any) {
              console.error(err);
              Alert.alert('Ошибка', 'Не удалось привязать штрихкод. Возможно, он уже используется.');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  // Выполнение транзакции (Приход / Списание)
  const executeTransaction = async (type: 'INCOME' | 'OUTFLOW', locationId: number, quantity: number = 1) => {
    if (!medication) return;
    
    setTransactionLoading(true);
    try {
      await api.post('/transactions', {
        type,
        quantity,
        medicationId: medication.id,
        locationId,
      }, {
        headers: {
          'x-api-key': 'MedSkladSecretKey123', // Передаем API ключ для записи
        },
      });

      // Перезапрашиваем остатки по товару
      const response = await api.get(`/medications?barcode=${barcode}`);
      if (response.data && response.data.length > 0) {
        setMedication(response.data[0]);
      }
      
      Alert.alert(
        'Успех',
        type === 'INCOME' ? `Товар оприходован (+${quantity} шт)` : `Товар успешно списан (-${quantity} шт)`
      );
    } catch (err: any) {
      console.error(err);
      const errMsg = err.response?.data?.error || 'Произошла ошибка при транзакции';
      Alert.alert('Ошибка', errMsg);
      throw err; // Прокидываем ошибку дальше в модалку
    } finally {
      setTransactionLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-black">
      {/* Камера */}
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFillObject}
        facing="back"
        enableTorch={torch}
        onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ['ean13', 'ean8', 'qr', 'upc_a', 'upc_e', 'code128'],
        }}
      />

      {/* Оверлей-прицел */}
      {!scanned && (
        <View className="absolute inset-0 items-center justify-center pointer-events-none">
          <View className="w-72 h-44 border-2 border-[#0891B2] rounded-2xl bg-transparent" />
          <View className="bg-black/50 px-4 py-2 rounded-lg mt-6">
            <Text className="text-white font-semibold text-center text-sm">
              Наведите камеру на штрихкод препарата
            </Text>
          </View>
        </View>
      )}

      {/* Индикатор загрузки при поиске ШК */}
      {loading && (
        <View className="absolute inset-0 bg-black/60 items-center justify-center">
          <ActivityIndicator size="large" color="#0891B2" />
          <Text className="text-white mt-4 font-semibold text-base">Поиск товара...</Text>
        </View>
      )}

      {/* Плавающие кнопки управления внизу экрана */}
      {!scanned && (
        <View className="absolute bottom-6 left-4 right-4 flex-row justify-between">
          <TouchableOpacity
            onPress={() => setTorch(prev => !prev)}
            className="flex-1 bg-[#0A2342]/90 border border-slate-700/30 py-3.5 rounded-xl flex-row items-center justify-center mr-2 shadow-lg active:bg-[#0A2342]"
          >
            <MaterialIcons 
              name={torch ? "flash-off" : "flash-on"} 
              size={20} 
              color="white" 
              style={{ marginRight: 6 }} 
            />
            <Text className="text-white font-bold text-sm">
              {torch ? "Выкл. свет" : "Вкл. свет"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              setBarcode('');
              setShowManualSearch(true);
            }}
            className="flex-1 bg-[#0891B2]/90 border border-[#0891B2]/30 py-3.5 rounded-xl flex-row items-center justify-center ml-2 shadow-lg active:bg-[#0891B2]"
          >
            <MaterialIcons 
              name="search" 
              size={20} 
              color="white" 
              style={{ marginRight: 6 }} 
            />
            <Text className="text-white font-bold text-sm">Поиск вручную</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Карточка "Товар не найден" */}
      {notFound && !loading && (
        <View className="absolute bottom-10 left-4 right-4 bg-white p-6 rounded-2xl shadow-2xl border border-slate-100">
          <View className="w-12 h-12 bg-amber-100 rounded-full items-center justify-center mb-3 mx-auto">
            <Text className="text-amber-600 text-xl font-bold">?</Text>
          </View>
          <Text className="text-xl font-bold text-[#0A2342] text-center mb-1">
            Штрихкод не найден
          </Text>
          <Text className="text-slate-400 text-center text-sm mb-6">
            Код: {barcode}
          </Text>
          
          <TouchableOpacity
            onPress={() => setShowManualSearch(true)}
            className="bg-[#0891B2] py-3 rounded-xl mb-3 items-center"
          >
            <Text className="text-white font-bold text-base">Привязать вручную</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              setScanned(false);
              setNotFound(false);
            }}
            className="bg-[#0A2342] py-3 rounded-xl items-center"
          >
            <Text className="text-white font-bold text-base">Сканировать другой</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Компонент операций с существующим товаром */}
      <InventoryModal
        visible={showMedicationModal}
        medication={medication}
        locations={locations}
        onClose={() => {
          setShowMedicationModal(false);
          setScanned(false);
        }}
        onConfirm={async (type, locationId, qty) => {
          await executeTransaction(type, locationId, qty);
        }}
      />

      {/* Модальное окно поиска вручную для привязки */}
      <Modal
        visible={showManualSearch}
        animationType="slide"
        onRequestClose={() => setShowManualSearch(false)}
      >
        <View className="flex-1 bg-[#F1F5F9] px-4 pt-12">
          <View className="flex-row justify-between items-center mb-6">
            <Text className="text-xl font-bold text-[#0A2342]">
              Привязка к товару
            </Text>
            <TouchableOpacity
              onPress={() => setShowManualSearch(false)}
              className="bg-slate-200 px-3 py-1.5 rounded-lg"
            >
              <Text className="text-slate-600 font-bold text-sm">Назад</Text>
            </TouchableOpacity>
          </View>

          {barcode ? (
            <View className="bg-amber-50 border border-amber-200 p-3 rounded-xl mb-4">
              <Text className="text-amber-800 text-xs font-medium">
                Выберите препарат из списка, к которому будет привязан штрихкод: {barcode}
              </Text>
            </View>
          ) : (
            <View className="bg-blue-50 border border-blue-200 p-3 rounded-xl mb-4 flex-row items-center">
              <MaterialIcons name="info-outline" size={16} color="#1D4ED8" style={{ marginRight: 6 }} />
              <Text className="text-blue-800 text-xs font-medium flex-1">
                Выберите препарат из списка для выполнения операций.
              </Text>
            </View>
          )}

          {/* Строка поиска */}
          <View className="mb-4">
            <TextInput
              className="bg-white px-4 py-3 rounded-xl border border-slate-200 text-[#0A2342] text-base shadow-sm focus:border-[#0891B2]"
              placeholder="Введите название препарата..."
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={handleSearch}
              autoFocus
              clearButtonMode="while-editing"
            />
          </View>

          <FlatList
            data={searchResults}
            keyExtractor={(item: any) => item.id.toString()}
            renderItem={({ item }: { item: any }) => (
              <TouchableOpacity
                onPress={() => {
                  if (barcode) {
                    linkBarcodeToMedication(item.id, item.name);
                  } else {
                    // Если зашли по ручному поиску без ШК - просто открываем модалку для этого товара
                    setMedication(item);
                    setShowManualSearch(false);
                    setShowMedicationModal(true);
                  }
                }}
                className="bg-white p-4 mb-3 rounded-xl border border-slate-100 shadow-sm flex-row justify-between items-center"
              >
                <View className="flex-1 pr-2">
                  <Text className="text-base font-bold text-[#0A2342]">{item.name}</Text>
                  <Text className="text-xs text-slate-400 mt-1">
                    ШК: {item.barcode || 'Не задан'}
                  </Text>
                </View>
                <View className="bg-cyan-50 px-2.5 py-1 rounded-lg">
                  <Text className="text-[#0891B2] text-xs font-bold">Выбрать</Text>
                </View>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View className="py-10 items-center justify-center">
                <Text className="text-slate-400 text-base">
                  {searchQuery ? 'Ничего не найдено' : 'Начните вводить название для поиска'}
                </Text>
              </View>
            }
          />
        </View>
      </Modal>
    </View>
  );
}
