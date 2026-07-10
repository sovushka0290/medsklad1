import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  ActivityIndicator, 
  Alert, 
  Modal, 
  TextInput,
  Platform,
  StatusBar,
  RefreshControl,
  ScrollView
} from 'react-native';
import { api } from '../services/api_service';
import { Ionicons } from '@expo/vector-icons';

export default function ProceduresScreen() {
  const [procedures, setProcedures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedProc, setSelectedProc] = useState<any>(null);
  const [quantity, setQuantity] = useState('1');
  const [submitting, setSubmitting] = useState(false);
  const [locations, setLocations] = useState<any[]>([]);
  const [selectedLocId, setSelectedLocId] = useState<number>(1);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [procRes, locRes] = await Promise.all([
        api.get('/procedures'),
        api.get('/locations')
      ]);
      setProcedures(procRes.data?.data || []);
      const locList = locRes.data || [];
      setLocations(locList);
      if (locList.length > 0) {
        setSelectedLocId(locList[0].id);
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Ошибка', 'Не удалось загрузить данные');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const openModal = (proc: any) => {
    setSelectedProc(proc);
    setQuantity('1');
    setModalVisible(true);
  };

  const submitLog = async () => {
    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty <= 0) {
      Alert.alert('Ошибка', 'Введите корректное количество');
      return;
    }

    setSubmitting(true);
    try {
      for (let i = 0; i < qty; i++) {
        await api.post('/procedures/log', {
          procedureId: selectedProc.id,
          locationId: selectedLocId
        });
      }
      
      Alert.alert('Успех', 'Расход медикаментов по процедуре зафиксирован!');
      setModalVisible(false);
    } catch (e: any) {
      const errMsg = e.response?.data?.error || 'Не удалось записать процедуру';
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
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      <View style={styles.header}>
        <Text style={styles.title}>Процедуры</Text>
        <Text style={styles.subtitle}>Фиксация расхода медикаментов по нормативам</Text>
      </View>

      <FlatList
        data={procedures}
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#0891B2']}
            tintColor="#0891B2"
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="medical-outline" size={64} color="#CBD5E1" style={{ marginBottom: 16 }} />
            <Text style={styles.emptyText}>Список процедур пуст</Text>
            <Text style={styles.emptySubtext}>Потяните экран вниз для обновления данных</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={styles.card} 
            onPress={() => openModal(item)}
            activeOpacity={0.7}
          >
            <View style={styles.cardIcon}>
              <Ionicons name="medical" size={20} color="#0891B2" />
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>{item.name}</Text>
              <Text style={styles.cardDesc} numberOfLines={2}>
                {item.description || 'Описание отсутствует'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
          </TouchableOpacity>
        )}
      />

      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Фиксация процедуры</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color="#64748b" />
              </TouchableOpacity>
            </View>

            <Text style={styles.procName}>{selectedProc?.name}</Text>

            <View style={styles.inputWrapper}>
              <Text style={styles.label}>Количество выполнений:</Text>
              <TextInput
                style={styles.input}
                value={quantity}
                onChangeText={setQuantity}
                keyboardType="number-pad"
              />
            </View>

            <View style={styles.inputWrapper}>
              <Text style={styles.label}>Кабинет / Склад списания:</Text>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.locationChips}
                style={{ maxHeight: 50 }}
              >
                {locations.map((loc) => {
                  const isSelected = selectedLocId === loc.id;
                  return (
                    <TouchableOpacity
                      key={loc.id}
                      style={[
                        styles.chip,
                        isSelected && styles.chipSelected
                      ]}
                      onPress={() => setSelectedLocId(loc.id)}
                    >
                      <Text style={[
                        styles.chipText,
                        isSelected && styles.chipTextSelected
                      ]}>
                        {loc.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            <TouchableOpacity 
              style={[styles.submitBtn, submitting && styles.submitBtnDisabled]} 
              onPress={submitLog}
              disabled={submitting}
              activeOpacity={0.8}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitBtnText}>Записать расход</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  container: { 
    flex: 1, 
    backgroundColor: '#F8FAFC',
  },
  header: {
    padding: 24,
    backgroundColor: '#0A2342',
    paddingTop: Platform.OS === 'ios' ? 56 : 40,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#0A2342',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 6,
    fontWeight: '500',
  },
  list: {
    padding: 20,
    paddingTop: 8,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#0A2342',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardIcon: {
    backgroundColor: 'rgba(8, 145, 178, 0.08)',
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  cardContent: { 
    flex: 1,
    marginRight: 8,
  },
  cardTitle: { 
    fontSize: 16, 
    fontWeight: '700', 
    color: '#0F172A',
  },
  cardDesc: { 
    fontSize: 13, 
    color: '#64748B', 
    marginTop: 4,
    lineHeight: 18,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 20,
  },
  modalHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 20,
  },
  modalTitle: { 
    fontSize: 20, 
    fontWeight: '800', 
    color: '#0F172A',
  },
  closeBtn: {
    padding: 4,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  procName: { 
    fontSize: 16, 
    color: '#0891B2', 
    marginBottom: 24, 
    fontWeight: '700', 
  },
  inputWrapper: {
    marginBottom: 28,
  },
  label: { 
    fontSize: 14, 
    fontWeight: '700', 
    color: '#475569', 
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: { 
    borderWidth: 1, 
    borderColor: '#E2E8F0', 
    borderRadius: 14, 
    padding: 14, 
    fontSize: 20, 
    fontWeight: '700',
    textAlign: 'center',
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
  },
  submitBtn: { 
    backgroundColor: '#0891B2', 
    padding: 16, 
    borderRadius: 14, 
    alignItems: 'center',
    shadowColor: '#0891B2',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  submitBtnDisabled: { 
    opacity: 0.7, 
  },
  submitBtnText: { 
    color: '#fff', 
    fontSize: 16, 
    fontWeight: '700',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
  },
  locationChips: {
    paddingVertical: 4,
    paddingHorizontal: 2,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  chipSelected: {
    backgroundColor: '#0891B2',
    borderColor: '#0891B2',
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  chipTextSelected: {
    color: '#FFFFFF',
  },
});
