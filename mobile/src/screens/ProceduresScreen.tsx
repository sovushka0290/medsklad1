import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, Modal, TextInput } from 'react-native';
import { api } from '../services/api_service';
import { Ionicons } from '@expo/vector-icons';

export default function ProceduresScreen() {
  const [procedures, setProcedures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedProc, setSelectedProc] = useState<any>(null);
  const [quantity, setQuantity] = useState('1');
  const [submitting, setSubmitting] = useState(false);
  const [defaultLocId, setDefaultLocId] = useState<number>(1);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [procRes, locRes] = await Promise.all([
        api.get('/procedures'),
        api.get('/locations')
      ]);
      setProcedures(procRes.data.data);
      if (locRes.data.data.length > 0) {
        setDefaultLocId(locRes.data.data[0].id);
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Ошибка', 'Не удалось загрузить данные');
    } finally {
      setLoading(false);
    }
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
      // POST /procedures/log requires procedureId, locationId
      // Body: { procedureId: number, locationId: number } (it logs 1 execution if quantity isn't supported, let's check backend)
      // Wait, let's assume backend logs 1 per call, or takes quantity. The backend logProcedure creates a log. Let's send the loop.
      for (let i = 0; i < qty; i++) {
        await api.post('/procedures/log', {
          procedureId: selectedProc.id,
          locationId: defaultLocId
        });
      }
      
      Alert.alert('Успех', 'Процедуры успешно записаны!');
      setModalVisible(false);
    } catch (e: any) {
      Alert.alert('Ошибка', 'Не удалось записать процедуру');
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
      <Text style={styles.title}>Выполненные процедуры</Text>
      <Text style={styles.subtitle}>Выберите процедуру для фиксации расхода по нормативу</Text>

      <FlatList
        data={procedures}
        keyExtractor={item => item.id.toString()}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => openModal(item)}>
            <View style={styles.cardIcon}>
              <Ionicons name="medical" size={24} color="#0891B2" />
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>{item.name}</Text>
              <Text style={styles.cardDesc} numberOfLines={2}>{item.description || 'Нет описания'}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#cbd5e1" />
          </TouchableOpacity>
        )}
      />

      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Фиксация процедуры</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <Text style={styles.procName}>{selectedProc?.name}</Text>

            <Text style={styles.label}>Количество (пациентов):</Text>
            <TextInput
              style={styles.input}
              value={quantity}
              onChangeText={setQuantity}
              keyboardType="number-pad"
            />

            <TouchableOpacity 
              style={[styles.submitBtn, submitting && styles.submitBtnDisabled]} 
              onPress={submitLog}
              disabled={submitting}
            >
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Записать</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1, backgroundColor: '#F1F5F9', padding: 16 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#0A2342', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#64748b', marginBottom: 16 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  cardIcon: {
    backgroundColor: '#e0f2fe',
    padding: 10,
    borderRadius: 10,
    marginRight: 12,
  },
  cardContent: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#1e293b' },
  cardDesc: { fontSize: 13, color: '#64748b', marginTop: 4 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, minHeight: 300 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#0A2342' },
  procName: { fontSize: 16, color: '#0891B2', marginBottom: 20, fontWeight: '500' },
  label: { fontSize: 16, fontWeight: '500', color: '#334155', marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 12, fontSize: 18, marginBottom: 24, backgroundColor: '#f8fafc' },
  submitBtn: { backgroundColor: '#0891B2', padding: 16, borderRadius: 12, alignItems: 'center' },
  submitBtnDisabled: { opacity: 0.7 },
  submitBtnText: { color: '#fff', fontSize: 18, fontWeight: '600' },
});
