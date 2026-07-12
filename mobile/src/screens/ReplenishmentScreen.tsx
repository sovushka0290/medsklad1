import React, { useState, useEffect, useCallback } from 'react';
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
  FlatList,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { api } from '../services/api_service';

type ReplenishmentStatus = 'PENDING' | 'ACKNOWLEDGED' | 'FULFILLED' | 'REJECTED';

interface ReplenishmentRequest {
  id: number;
  medication: { id: number; name: string; group?: string };
  location: { id: number; name: string };
  requester: { id: number; name: string; role: string };
  quantity: number;
  comment?: string;
  status: ReplenishmentStatus;
  createdAt: string;
  resolvedAt?: string;
  resolver?: { id: number; name: string } | null;
}

const STATUS_LABELS: Record<ReplenishmentStatus, { label: string; color: string; bg: string; icon: string }> = {
  PENDING:      { label: 'Ожидает',   color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  icon: 'time-outline' },
  ACKNOWLEDGED: { label: 'Принят',    color: '#3b82f6', bg: 'rgba(59,130,246,0.1)',   icon: 'checkmark-circle-outline' },
  FULFILLED:    { label: 'Выполнен',  color: '#10b981', bg: 'rgba(16,185,129,0.1)',   icon: 'checkmark-done-circle' },
  REJECTED:     { label: 'Отклонён',  color: '#ef4444', bg: 'rgba(239,68,68,0.1)',    icon: 'close-circle-outline' },
};

export default function ReplenishmentScreen({ navigation }: any) {
  const [tab, setTab] = useState<'create' | 'history'>('create');
  const [userRole, setUserRole] = useState('NURSE');
  const [userId, setUserId] = useState<number | null>(null);

  // Форма создания
  const [medications, setMedications] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [selectedMed, setSelectedMed] = useState<any | null>(null);
  const [selectedLoc, setSelectedLoc] = useState<any | null>(null);
  const [medSearch, setMedSearch] = useState('');
  const [medDropdownOpen, setMedDropdownOpen] = useState(false);
  const [locDropdownOpen, setLocDropdownOpen] = useState(false);
  const [quantity, setQuantity] = useState('1');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  // История запросов
  const [requests, setRequests] = useState<ReplenishmentRequest[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const canResolve = ['STOREKEEPER', 'HEAD_NURSE', 'ADMIN'].includes(userRole);

  useEffect(() => {
    const init = async () => {
      const role = await SecureStore.getItemAsync('userRole');
      if (role) setUserRole(role);
    };
    init();
    fetchFormData();
  }, []);

  useEffect(() => {
    if (tab === 'history') {
      fetchHistory();
    }
  }, [tab]);

  const fetchFormData = async () => {
    try {
      const [medRes, locRes] = await Promise.all([
        api.get('/medications'),
        api.get('/locations'),
      ]);
      const meds = medRes.data?.data || medRes.data || [];
      const locs = locRes.data || [];
      setMedications(meds);
      setLocations(locs);
      if (locs.length > 0) setSelectedLoc(locs[0]);
    } catch {
      Alert.alert('Ошибка', 'Не удалось загрузить данные склада');
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await api.get('/replenishment?limit=50');
      setRequests(res.data?.data || []);
    } catch {
      Alert.alert('Ошибка', 'Не удалось загрузить историю запросов');
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedMed) {
      Alert.alert('Ошибка', 'Выберите медикамент');
      return;
    }
    if (!selectedLoc) {
      Alert.alert('Ошибка', 'Выберите кабинет');
      return;
    }
    const qty = parseInt(quantity, 10);
    if (!qty || qty <= 0) {
      Alert.alert('Ошибка', 'Укажите корректное количество');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/replenishment', {
        medicationId: selectedMed.id,
        locationId: selectedLoc.id,
        quantity: qty,
        comment: comment.trim() || undefined,
      });
      Alert.alert(
        '✅ Запрос отправлен',
        `Запрос на пополнение "${selectedMed.name}" (${qty} шт.) успешно создан. Кладовщик получит уведомление.`,
        [{ text: 'OK', onPress: () => { setTab('history'); fetchHistory(); } }]
      );
      // Сброс формы
      setSelectedMed(null);
      setMedSearch('');
      setQuantity('1');
      setComment('');
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Не удалось отправить запрос';
      Alert.alert('Ошибка', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResolve = async (req: ReplenishmentRequest, newStatus: 'ACKNOWLEDGED' | 'FULFILLED' | 'REJECTED') => {
    const labels: Record<string, string> = {
      ACKNOWLEDGED: 'Принять в работу',
      FULFILLED: 'Отметить как выполненный',
      REJECTED: 'Отклонить запрос',
    };
    Alert.alert(
      labels[newStatus],
      `${labels[newStatus]} запрос от "${req.requester.name}"?`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Подтвердить',
          onPress: async () => {
            try {
              await api.patch(`/replenishment/${req.id}/status`, { status: newStatus });
              fetchHistory();
            } catch (err: any) {
              Alert.alert('Ошибка', err?.response?.data?.error || 'Не удалось обновить статус');
            }
          },
        },
      ]
    );
  };

  const filteredMeds = medications.filter(
    (m) =>
      m.name.toLowerCase().includes(medSearch.toLowerCase()) ||
      (m.group && m.group.toLowerCase().includes(medSearch.toLowerCase()))
  );

  const renderRequestCard = ({ item }: { item: ReplenishmentRequest }) => {
    const st = STATUS_LABELS[item.status];
    return (
      <View style={styles.requestCard}>
        <View style={styles.requestCardHeader}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={styles.requestMedName} numberOfLines={1}>{item.medication.name}</Text>
            <Text style={styles.requestMeta}>
              {item.location.name} • {new Date(item.createdAt).toLocaleDateString('ru-RU')}
            </Text>
            {item.requester && (
              <Text style={styles.requestMeta}>От: {item.requester.name}</Text>
            )}
          </View>
          <View>
            <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
              <Ionicons name={st.icon as any} size={12} color={st.color} />
              <Text style={[styles.statusText, { color: st.color }]}>{st.label}</Text>
            </View>
            <Text style={styles.requestQty}>{item.quantity} шт.</Text>
          </View>
        </View>

        {item.comment ? (
          <Text style={styles.requestComment}>💬 {item.comment}</Text>
        ) : null}

        {/* Действия для кладовщика/руководства */}
        {canResolve && item.status === 'PENDING' && (
          <View style={styles.resolveActions}>
            <TouchableOpacity
              style={[styles.resolveBtn, { backgroundColor: 'rgba(59,130,246,0.1)' }]}
              onPress={() => handleResolve(item, 'ACKNOWLEDGED')}
            >
              <Ionicons name="checkmark-circle-outline" size={14} color="#3b82f6" />
              <Text style={[styles.resolveBtnText, { color: '#3b82f6' }]}>Принять</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.resolveBtn, { backgroundColor: 'rgba(16,185,129,0.1)' }]}
              onPress={() => handleResolve(item, 'FULFILLED')}
            >
              <Ionicons name="checkmark-done-circle" size={14} color="#10b981" />
              <Text style={[styles.resolveBtnText, { color: '#10b981' }]}>Выполнен</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.resolveBtn, { backgroundColor: 'rgba(239,68,68,0.1)' }]}
              onPress={() => handleResolve(item, 'REJECTED')}
            >
              <Ionicons name="close-circle-outline" size={14} color="#ef4444" />
              <Text style={[styles.resolveBtnText, { color: '#ef4444' }]}>Отклонить</Text>
            </TouchableOpacity>
          </View>
        )}

        {canResolve && item.status === 'ACKNOWLEDGED' && (
          <View style={styles.resolveActions}>
            <TouchableOpacity
              style={[styles.resolveBtn, { backgroundColor: 'rgba(16,185,129,0.1)' }]}
              onPress={() => handleResolve(item, 'FULFILLED')}
            >
              <Ionicons name="checkmark-done-circle" size={14} color="#10b981" />
              <Text style={[styles.resolveBtnText, { color: '#10b981' }]}>Отметить выполненным</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>Запрос пополнения</Text>
            <Text style={styles.subtitle}>ТЗ 3.6 — Заявка на склад</Text>
          </View>
          <TouchableOpacity onPress={() => fetchHistory()} style={styles.refreshBtn}>
            <Ionicons name="refresh" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, tab === 'create' && styles.tabActive]}
            onPress={() => setTab('create')}
          >
            <Ionicons name="add-circle-outline" size={16} color={tab === 'create' ? '#0891B2' : '#94a3b8'} />
            <Text style={[styles.tabText, tab === 'create' && styles.tabTextActive]}>Создать</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, tab === 'history' && styles.tabActive]}
            onPress={() => setTab('history')}
          >
            <Ionicons name="list-outline" size={16} color={tab === 'history' ? '#0891B2' : '#94a3b8'} />
            <Text style={[styles.tabText, tab === 'history' && styles.tabTextActive]}>История</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Tab: Create */}
      {tab === 'create' ? (
        <ScrollView contentContainerStyle={styles.formContainer} keyboardShouldPersistTaps="handled">
          {loading ? (
            <ActivityIndicator size="large" color="#0891B2" style={{ marginTop: 60 }} />
          ) : (
            <>
              <Text style={styles.formLabel}>Медикамент <Text style={styles.required}>*</Text></Text>

              {/* Medication search/select */}
              <TouchableOpacity
                style={styles.selector}
                onPress={() => setMedDropdownOpen(true)}
              >
                <Ionicons name="medical-outline" size={18} color="#64748b" />
                <Text style={[styles.selectorText, !selectedMed && { color: '#94a3b8' }]} numberOfLines={1}>
                  {selectedMed ? selectedMed.name : 'Выберите медикамент...'}
                </Text>
                <Ionicons name="chevron-down" size={16} color="#94a3b8" />
              </TouchableOpacity>

              <Text style={styles.formLabel}>Кабинет / Локация <Text style={styles.required}>*</Text></Text>
              <TouchableOpacity
                style={styles.selector}
                onPress={() => setLocDropdownOpen(true)}
              >
                <Ionicons name="location-outline" size={18} color="#64748b" />
                <Text style={[styles.selectorText, !selectedLoc && { color: '#94a3b8' }]} numberOfLines={1}>
                  {selectedLoc ? selectedLoc.name : 'Выберите локацию...'}
                </Text>
                <Ionicons name="chevron-down" size={16} color="#94a3b8" />
              </TouchableOpacity>

              <Text style={styles.formLabel}>Количество <Text style={styles.required}>*</Text></Text>
              <View style={styles.quantityRow}>
                <TouchableOpacity
                  style={styles.qtyBtn}
                  onPress={() => setQuantity(String(Math.max(1, parseInt(quantity || '1') - 1)))}
                >
                  <Ionicons name="remove" size={20} color="#0891B2" />
                </TouchableOpacity>
                <TextInput
                  style={styles.qtyInput}
                  value={quantity}
                  onChangeText={setQuantity}
                  keyboardType="numeric"
                  textAlign="center"
                  selectTextOnFocus
                />
                <TouchableOpacity
                  style={styles.qtyBtn}
                  onPress={() => setQuantity(String(parseInt(quantity || '0') + 1))}
                >
                  <Ionicons name="add" size={20} color="#0891B2" />
                </TouchableOpacity>
              </View>

              <Text style={styles.formLabel}>Комментарий (необязательно)</Text>
              <TextInput
                style={styles.commentInput}
                value={comment}
                onChangeText={setComment}
                placeholder="Причина запроса, примечания..."
                placeholderTextColor="#94a3b8"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />

              <TouchableOpacity
                style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
                onPress={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="send" size={20} color="#fff" />
                    <Text style={styles.submitBtnText}>Отправить запрос</Text>
                  </>
                )}
              </TouchableOpacity>

              <View style={styles.infoBox}>
                <Ionicons name="information-circle-outline" size={18} color="#0891B2" />
                <Text style={styles.infoText}>
                  Запрос будет передан кладовщику склада. Вы получите уведомление, когда статус изменится.
                </Text>
              </View>
            </>
          )}
        </ScrollView>
      ) : (
        /* Tab: History */
        <View style={{ flex: 1 }}>
          {historyLoading ? (
            <ActivityIndicator size="large" color="#0891B2" style={{ marginTop: 60 }} />
          ) : requests.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="clipboard-outline" size={56} color="#cbd5e1" />
              <Text style={styles.emptyTitle}>Нет запросов</Text>
              <Text style={styles.emptySubtitle}>
                {canResolve ? 'Пока нет запросов на пополнение' : 'Вы ещё не создавали запросов пополнения'}
              </Text>
            </View>
          ) : (
            <FlatList
              data={requests}
              keyExtractor={(item) => String(item.id)}
              renderItem={renderRequestCard}
              contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
              showsVerticalScrollIndicator={false}
              onRefresh={fetchHistory}
              refreshing={historyLoading}
            />
          )}
        </View>
      )}

      {/* Medication picker modal */}
      <Modal visible={medDropdownOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Выберите медикамент</Text>
              <TouchableOpacity onPress={() => setMedDropdownOpen(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>
            <View style={styles.searchBox}>
              <Ionicons name="search" size={16} color="#94a3b8" />
              <TextInput
                style={styles.searchInput}
                value={medSearch}
                onChangeText={setMedSearch}
                placeholder="Поиск по названию или группе..."
                placeholderTextColor="#94a3b8"
                autoFocus
              />
            </View>
            <FlatList
              data={filteredMeds}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.dropdownItem, selectedMed?.id === item.id && styles.dropdownItemSelected]}
                  onPress={() => {
                    setSelectedMed(item);
                    setMedDropdownOpen(false);
                    setMedSearch('');
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.dropdownItemName}>{item.name}</Text>
                    {item.group && <Text style={styles.dropdownItemMeta}>{item.group}</Text>}
                  </View>
                  {selectedMed?.id === item.id && (
                    <Ionicons name="checkmark-circle" size={18} color="#0891B2" />
                  )}
                </TouchableOpacity>
              )}
              keyboardShouldPersistTaps="handled"
            />
          </View>
        </View>
      </Modal>

      {/* Location picker modal */}
      <Modal visible={locDropdownOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { maxHeight: '50%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Выберите кабинет</Text>
              <TouchableOpacity onPress={() => setLocDropdownOpen(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={locations}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.dropdownItem, selectedLoc?.id === item.id && styles.dropdownItemSelected]}
                  onPress={() => {
                    setSelectedLoc(item);
                    setLocDropdownOpen(false);
                  }}
                >
                  <Ionicons name="location-outline" size={16} color="#64748b" style={{ marginRight: 8 }} />
                  <Text style={styles.dropdownItemName}>{item.name}</Text>
                  {selectedLoc?.id === item.id && (
                    <Ionicons name="checkmark-circle" size={18} color="#0891B2" style={{ marginLeft: 'auto' }} />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    backgroundColor: '#0A2342',
    paddingTop: Platform.OS === 'ios' ? 56 : 40,
    paddingHorizontal: 24,
    paddingBottom: 0,
    shadowColor: '#0A2342',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: { fontSize: 24, fontWeight: '900', color: '#fff' },
  subtitle: { fontSize: 13, color: '#94a3b8', marginTop: 4 },
  refreshBtn: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: 4,
    marginBottom: 0,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 10,
  },
  tabActive: { backgroundColor: '#fff' },
  tabText: { fontSize: 13, fontWeight: '600', color: '#94a3b8' },
  tabTextActive: { color: '#0891B2' },

  formContainer: { padding: 20, paddingBottom: 40 },
  formLabel: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 8, marginTop: 16 },
  required: { color: '#ef4444' },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    paddingHorizontal: 14,
    paddingVertical: 13,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  selectorText: { flex: 1, fontSize: 14, color: '#1e293b', fontWeight: '500' },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  qtyBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#f0f9ff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#bae6fd',
  },
  qtyInput: {
    flex: 1,
    height: 48,
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    fontSize: 20,
    fontWeight: '700',
    color: '#1e293b',
  },
  commentInput: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#1e293b',
    minHeight: 80,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#0891B2',
    borderRadius: 16,
    paddingVertical: 16,
    marginTop: 24,
    shadowColor: '#0891B2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: 'rgba(8,145,178,0.08)',
    borderRadius: 12,
    padding: 14,
    marginTop: 16,
  },
  infoText: { flex: 1, fontSize: 13, color: '#0e7490', lineHeight: 18 },

  // History/list
  requestCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  requestCardHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  requestMedName: { fontSize: 15, fontWeight: '700', color: '#1e293b', marginBottom: 4 },
  requestMeta: { fontSize: 12, color: '#94a3b8', marginBottom: 2 },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  statusText: { fontSize: 11, fontWeight: '700' },
  requestQty: { fontSize: 18, fontWeight: '800', color: '#1e293b', textAlign: 'right' },
  requestComment: { fontSize: 13, color: '#64748b', marginTop: 8, fontStyle: 'italic' },
  resolveActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    flexWrap: 'wrap',
  },
  resolveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  resolveBtnText: { fontSize: 12, fontWeight: '700' },

  // Empty
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#94a3b8', marginTop: 16 },
  emptySubtitle: { fontSize: 14, color: '#cbd5e1', marginTop: 8, textAlign: 'center' },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#1e293b' },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    margin: 16,
    marginBottom: 8,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  searchInput: { flex: 1, fontSize: 14, color: '#1e293b' },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  dropdownItemSelected: { backgroundColor: '#f0f9ff' },
  dropdownItemName: { fontSize: 14, fontWeight: '600', color: '#1e293b' },
  dropdownItemMeta: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
});
