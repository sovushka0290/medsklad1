import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../services/api_service';

type TxType = 'INCOME' | 'OUTFLOW' | 'RETURN' | 'WRITE_OFF';

const TX_TYPES: { key: TxType; label: string; icon: string; color: string }[] = [
  { key: 'INCOME', label: 'Приход', icon: 'arrow-down-circle', color: '#10b981' },
  { key: 'OUTFLOW', label: 'Расход', icon: 'arrow-up-circle', color: '#3b82f6' },
  { key: 'RETURN', label: 'Возврат', icon: 'refresh-circle', color: '#f59e0b' },
  { key: 'WRITE_OFF', label: 'Списание', icon: 'trash', color: '#ef4444' },
];

import { Modal } from 'react-native';

export default function TransactionScreen({ navigation }: any) {
  const [type, setType] = useState<TxType>('INCOME');
  const [medications, setMedications] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [selectedMedId, setSelectedMedId] = useState<number | null>(null);
  const [selectedLocId, setSelectedLocId] = useState<number | null>(null);
  const [medSearch, setMedSearch] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [batchNumber, setBatchNumber] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [supplier, setSupplier] = useState('');
  const [price, setPrice] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [medDropdownOpen, setMedDropdownOpen] = useState(false);

  // Dropdown list date states
  const [expDay, setExpDay] = useState('');
  const [expMonth, setExpMonth] = useState('');
  const [expYear, setExpYear] = useState('');
  const [dayPickerVisible, setDayPickerVisible] = useState(false);
  const [monthPickerVisible, setMonthPickerVisible] = useState(false);
  const [yearPickerVisible, setYearPickerVisible] = useState(false);

  // Outflow select batch state
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
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [medRes, locRes] = await Promise.all([
        api.get('/medications'),
        api.get('/locations'),
      ]);
      setMedications(medRes.data?.data || medRes.data || []);
      const locs = locRes.data || [];
      setLocations(locs);
      if (locs.length > 0) setSelectedLocId(locs[0].id);
    } catch (e) {
      Alert.alert('Ошибка', 'Не удалось загрузить данные');
    } finally {
      setLoading(false);
    }
  };

  const filteredMeds = medications.filter(m =>
    m.name.toLowerCase().includes(medSearch.toLowerCase())
  );

  const selectedMed = medications.find(m => m.id === selectedMedId);
  const selectedLoc = locations.find(l => l.id === selectedLocId);
  const currentType = TX_TYPES.find(t => t.key === type)!;

  // Filter available batches for Selected Med and Location (OUTFLOW)
  const availableBatches = useMemo(() => {
    if (!selectedMedId || !selectedLocId) return [];
    return (selectedMed?.batches || []).filter(
      (b: any) => b.locationId === selectedLocId && b.quantity > 0
    );
  }, [selectedMed, selectedLocId, selectedMedId]);

  const selectedBatch = availableBatches.find((b: any) => b.id === selectedBatchId);

  const sendTransaction = async () => {
    setSubmitting(true);
    try {
      const finalReason = (type === 'WRITE_OFF' || type === 'RETURN')
        ? (selectedReasonType === 'Другое' ? customReason : selectedReasonType)
        : reason;

      const payload: any = {
        type,
        quantity: parseInt(quantity, 10),
        medicationId: selectedMedId,
        locationId: selectedLocId,
        reason: finalReason.trim() || undefined,
      };

      if (type === 'INCOME') {
        payload.batchNumber = batchNumber.trim();
        payload.expirationDate = `${expYear}-${expMonth}-${expDay}`;
        payload.serialNumber = serialNumber.trim();
        payload.supplier = supplier.trim();
        payload.price = parseFloat(price);
      } else if (type === 'OUTFLOW' && selectedBatch) {
        payload.batchNumber = selectedBatch.batchNumber || undefined;
        payload.expirationDate = selectedBatch.expirationDate || undefined;
        payload.serialNumber = selectedBatch.serialNumber || undefined;
      }

      await api.post('/transactions', payload);

      Alert.alert(
        'Успешно!',
        `${currentType.label} на ${quantity} шт. зафиксирован.`,
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (e: any) {
      const errMsg =
        e.response?.data?.error || e.response?.data?.message || 'Не удалось создать транзакцию';
      Alert.alert('Ошибка', errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const validateAndSubmit = async () => {
    if (!selectedMedId) {
      Alert.alert('Ошибка', 'Выберите медикамент');
      return;
    }
    if (!selectedLocId) {
      Alert.alert('Ошибка', 'Выберите локацию');
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
      if (!price.trim() || isNaN(parseFloat(price)) || parseFloat(price) <= 0) {
        Alert.alert('Ошибка', 'Введите корректную закупочную цену');
        return;
      }
      if (!supplier.trim()) {
        Alert.alert('Ошибка', 'Поле "Поставщик" обязательно для заполнения');
        return;
      }
    }

    if (type === 'OUTFLOW') {
      if (!reason.trim()) {
        Alert.alert('Ошибка', 'Поле "Цель выдачи" обязательно для заполнения');
        return;
      }
      if (availableBatches.length > 0) {
        if (!selectedBatchId) {
          Alert.alert('Ошибка', 'Выберите партию для списания');
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
            'Вы выбрали не самую старую партию. Согласно правилу FIFO, рекомендуется выдавать сначала старейшие партии. Вы уверены, что хотите продолжить?',
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
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{title}</Text>
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

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0891B2" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Новая операция</Text>
          <Text style={styles.headerSub}>Складской учёт</Text>
        </View>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.sectionLabel}>Тип операции</Text>
        <View style={styles.typeGrid}>
          {TX_TYPES.map(t => {
            const isActive = type === t.key;
            return (
              <TouchableOpacity
                key={t.key}
                style={[styles.typeBtn, isActive && { backgroundColor: t.color, borderColor: t.color }]}
                onPress={() => {
                  setType(t.key);
                  setSelectedBatchId(null);
                  setSelectedReasonType('');
                  setCustomReason('');
                }}
                activeOpacity={0.8}
              >
                <Ionicons name={t.icon as any} size={20} color={isActive ? '#fff' : t.color} />
                <Text style={[styles.typeBtnText, isActive && { color: '#fff' }]}>{t.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.sectionLabel}>Медикамент *</Text>
        <TouchableOpacity
          style={styles.selectBtn}
          onPress={() => setMedDropdownOpen(!medDropdownOpen)}
          activeOpacity={0.8}
        >
          <Ionicons name="cube-outline" size={18} color="#64748b" />
          <Text style={[styles.selectBtnText, !selectedMed && { color: '#94a3b8' }]} numberOfLines={1}>
            {selectedMed?.name || 'Выберите препарат...'}
          </Text>
          <Ionicons name={medDropdownOpen ? 'chevron-up' : 'chevron-down'} size={18} color="#94a3b8" />
        </TouchableOpacity>

        {medDropdownOpen && (
          <View style={styles.dropdown}>
            <TextInput
              style={styles.dropdownSearch}
              placeholder="Поиск по названию..."
              placeholderTextColor="#94a3b8"
              value={medSearch}
              onChangeText={setMedSearch}
            />
            <ScrollView style={{ maxHeight: 200 }} keyboardShouldPersistTaps="handled">
              {filteredMeds.length === 0 ? (
                <Text style={styles.dropdownEmpty}>Ничего не найдено</Text>
              ) : (
                filteredMeds.map(m => (
                  <TouchableOpacity
                    key={m.id}
                    style={[styles.dropdownItem, selectedMedId === m.id && styles.dropdownItemActive]}
                    onPress={() => {
                      setSelectedMedId(m.id);
                      setMedDropdownOpen(false);
                      setMedSearch('');
                      setSelectedBatchId(null);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[styles.dropdownItemText, selectedMedId === m.id && { color: '#0891B2', fontWeight: '700' }]}
                      numberOfLines={2}
                    >
                      {m.name}
                    </Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        )}

        <Text style={styles.sectionLabel}>Локация *</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {locations.map(loc => {
            const isActive = selectedLocId === loc.id;
            return (
              <TouchableOpacity
                key={loc.id}
                style={[styles.chip, isActive && styles.chipActive]}
                onPress={() => { setSelectedLocId(loc.id); setSelectedBatchId(null); }}
                activeOpacity={0.8}
              >
                <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{loc.name}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <Text style={styles.sectionLabel}>Количество *</Text>
        <View style={styles.stepperRow}>
          <TouchableOpacity
            style={styles.stepBtn}
            onPress={() => { const v = parseInt(quantity, 10); if (!isNaN(v) && v > 1) setQuantity(String(v - 1)); }}
            activeOpacity={0.7}
          >
            <Ionicons name="remove" size={22} color="#0891B2" />
          </TouchableOpacity>
          <TextInput
            style={styles.stepInput}
            value={quantity}
            onChangeText={setQuantity}
            keyboardType="number-pad"
            textAlign="center"
          />
          <TouchableOpacity
            style={styles.stepBtn}
            onPress={() => { const v = parseInt(quantity, 10); setQuantity(String(isNaN(v) ? 1 : v + 1)); }}
            activeOpacity={0.7}
          >
            <Ionicons name="add" size={22} color="#0891B2" />
          </TouchableOpacity>
        </View>

        {type === 'INCOME' && (
          <>
            <Text style={styles.sectionLabel}>Номер партии *</Text>
            <TextInput
              style={styles.input}
              placeholder="Напр. B-7023"
              placeholderTextColor="#94a3b8"
              value={batchNumber}
              onChangeText={setBatchNumber}
            />

            <Text style={styles.sectionLabel}>Срок годности *</Text>
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

            <Text style={styles.sectionLabel}>Серийный номер *</Text>
            <TextInput
              style={styles.input}
              placeholder="Напр. SN-552092"
              placeholderTextColor="#94a3b8"
              value={serialNumber}
              onChangeText={setSerialNumber}
            />

            <Text style={styles.sectionLabel}>Поставщик *</Text>
            <TextInput
              style={styles.input}
              placeholder="Напр. СК-Фармация"
              placeholderTextColor="#94a3b8"
              value={supplier}
              onChangeText={setSupplier}
            />

            <Text style={styles.sectionLabel}>Закупочная цена (₸ за ед.) *</Text>
            <TextInput
              style={styles.input}
              placeholder="Напр. 1500"
              placeholderTextColor="#94a3b8"
              value={price}
              onChangeText={setPrice}
              keyboardType="decimal-pad"
            />
          </>
        )}

        {type === 'OUTFLOW' && (
          <>
            <Text style={styles.sectionLabel}>Цель выдачи *</Text>
            <TextInput
              style={styles.input}
              placeholder="Напр. Выдача в кабинет терапевта"
              placeholderTextColor="#94a3b8"
              value={reason}
              onChangeText={setReason}
            />

            <Text style={styles.sectionLabel}>Партия списания (FIFO) *</Text>
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
            <Text style={styles.sectionLabel}>Причина *</Text>
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
                placeholderTextColor="#94a3b8"
                value={customReason}
                onChangeText={setCustomReason}
              />
            )}
          </>
        )}

        {/* Date Dropdowns Modals */}
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
          style={[styles.submitBtn, { backgroundColor: currentType.color }, submitting && { opacity: 0.7 }]}
          onPress={validateAndSubmit}
          disabled={submitting}
          activeOpacity={0.85}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name={currentType.icon as any} size={20} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.submitBtnText}>Зафиксировать {currentType.label}</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0A2342',
    paddingTop: Platform.OS === 'ios' ? 56 : 40,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  backBtn: { backgroundColor: 'rgba(255,255,255,0.12)', padding: 8, borderRadius: 12 },
  headerTitle: { fontSize: 20, fontWeight: '900', color: '#fff', textAlign: 'center' },
  headerSub: { fontSize: 12, color: '#94a3b8', textAlign: 'center', marginTop: 2 },
  scroll: { flex: 1, backgroundColor: '#F8FAFC' },
  scrollContent: { padding: 20, paddingBottom: 40 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginTop: 16,
  },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  typeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#fff',
  },
  typeBtnText: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
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
  },
  selectBtnText: { flex: 1, fontSize: 14, fontWeight: '600', color: '#0f172a' },
  dropdown: {
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    marginTop: 4,
    overflow: 'hidden',
  },
  dropdownSearch: {
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: '#0f172a',
  },
  dropdownEmpty: { textAlign: 'center', color: '#94a3b8', padding: 16, fontSize: 13 },
  dropdownItem: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  dropdownItemActive: { backgroundColor: 'rgba(8,145,178,0.06)' },
  dropdownItemText: { fontSize: 13, fontWeight: '600', color: '#0f172a' },
  chips: { gap: 8, paddingBottom: 4 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
  },
  chipActive: { backgroundColor: '#0891B2', borderColor: '#0891B2' },
  chipText: { fontSize: 13, fontWeight: '700', color: '#475569' },
  chipTextActive: { color: '#fff' },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepBtn: {
    width: 48,
    height: 48,
    backgroundColor: 'rgba(8,145,178,0.08)',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(8,145,178,0.15)',
  },
  stepInput: {
    flex: 1,
    height: 48,
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    fontSize: 20,
    fontWeight: '900',
    color: '#0f172a',
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  inputMultiline: { minHeight: 88, textAlignVertical: 'top', paddingTop: 12 },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    paddingVertical: 16,
    borderRadius: 18,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  submitBtnText: { fontSize: 15, fontWeight: '900', color: '#fff' },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContainer: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: 350 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 18, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  modalList: { padding: 8 },
  modalItem: { paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  modalItemText: { fontSize: 15, fontWeight: '600', color: '#334155', textAlign: 'center' },
  dropdownContainer: { flexDirection: 'row', gap: 8, marginTop: 4 },
  dropdownSubBtn: { flex: 1, backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 14, paddingVertical: 13, alignItems: 'center', justifyContent: 'center' },
  dropdownSubBtnText: { fontSize: 14, fontWeight: '600', color: '#0f172a' },
});
