import React, { useState, useEffect } from 'react';
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

export default function TransactionScreen({ navigation }: any) {
  const [type, setType] = useState<TxType>('INCOME');
  const [medications, setMedications] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [selectedMedId, setSelectedMedId] = useState<number | null>(null);
  const [selectedLocId, setSelectedLocId] = useState<number | null>(null);
  const [medSearch, setMedSearch] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [serialNumber, setSerialNumber] = useState('');
  const [supplier, setSupplier] = useState('');
  const [expirationDate, setExpirationDate] = useState('');
  const [price, setPrice] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [medDropdownOpen, setMedDropdownOpen] = useState(false);

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
    if (type === 'WRITE_OFF' && !reason.trim()) {
      Alert.alert('Ошибка', 'Для списания обязательно укажите причину');
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
        type,
        quantity: qty,
        medicationId: selectedMedId,
        locationId: selectedLocId,
        reason: reason.trim() || undefined,
      };

      if (serialNumber.trim()) payload.serialNumber = serialNumber.trim();
      if (supplier.trim()) payload.supplier = supplier.trim();
      if (expirationDate.trim()) payload.expirationDate = expirationDate.trim();
      if (price.trim() && !isNaN(parseFloat(price))) payload.price = parseFloat(price);

      await api.post('/transactions', payload);

      Alert.alert(
        'Успешно!',
        `${currentType.label} на ${qty} шт. зафиксирован.`,
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
                onPress={() => setType(t.key)}
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
                    onPress={() => { setSelectedMedId(m.id); setMedDropdownOpen(false); setMedSearch(''); }}
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
                onPress={() => setSelectedLocId(loc.id)}
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

        {(type === 'INCOME' || type === 'RETURN') && (
          <>
            <Text style={styles.sectionLabel}>Серийный номер / Номер партии</Text>
            <TextInput
              style={styles.input}
              placeholder="Напр. ULT-1092"
              placeholderTextColor="#94a3b8"
              value={serialNumber}
              onChangeText={setSerialNumber}
            />

            <Text style={styles.sectionLabel}>Поставщик</Text>
            <TextInput
              style={styles.input}
              placeholder="Напр. ТОО МедМаркет"
              placeholderTextColor="#94a3b8"
              value={supplier}
              onChangeText={setSupplier}
            />

            <Text style={styles.sectionLabel}>Срок годности</Text>
            <TextInput
              style={styles.input}
              placeholder="ГГГГ-ММ-ДД (напр. 2026-12-31)"
              placeholderTextColor="#94a3b8"
              value={expirationDate}
              onChangeText={setExpirationDate}
              keyboardType="numbers-and-punctuation"
            />

            <Text style={styles.sectionLabel}>Закупочная цена (₸ за единицу)</Text>
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

        {(type === 'WRITE_OFF' || type === 'OUTFLOW' || type === 'RETURN') && (
          <>
            <Text style={styles.sectionLabel}>
              Причина {type === 'WRITE_OFF' ? '*' : '(необязательно)'}
            </Text>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              placeholder={
                type === 'WRITE_OFF'
                  ? 'Укажите причину списания...'
                  : type === 'RETURN'
                  ? 'Причина возврата (опционально)'
                  : 'Цель расхода (опционально)'
              }
              placeholderTextColor="#94a3b8"
              value={reason}
              onChangeText={setReason}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </>
        )}

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
});
