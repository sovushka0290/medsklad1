import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert, ScrollView, RefreshControl } from 'react-native';
import { api } from '../services/api_service';
import { Ionicons } from '@expo/vector-icons';

interface DashboardOverview {
  totalItemsInStock: number;
  totalInventoryValue: number;
  totalUniqueMedications: number;
  criticalItemsCount: number;
}

export default function HomeScreen() {
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboard = async () => {
    try {
      const response = await api.get('/dashboard/metrics');
      setOverview(response.data.overview || null);
    } catch (error: any) {
      if (error.code !== 'ECONNABORTED' && error.response) {
        Alert.alert('Ошибка', 'Не удалось загрузить данные дашборда');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchDashboard();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Главная</Text>
        <Text style={styles.subtitle}>Сводка по складу</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {loading ? (
          <ActivityIndicator size="large" color="#0891B2" style={{ marginTop: 50 }} />
        ) : overview ? (
          <View style={styles.grid}>
            <View style={styles.statCard}>
              <Ionicons name="cube-outline" size={24} color="#0891B2" />
              <Text style={styles.statValue}>{overview.totalItemsInStock}</Text>
              <Text style={styles.statLabel}>Всего единиц на складе</Text>
            </View>

            <View style={styles.statCard}>
              <Ionicons name="alert-circle-outline" size={24} color="#ef4444" />
              <Text style={styles.statValue}>{overview.criticalItemsCount}</Text>
              <Text style={styles.statLabel}>Критических остатков</Text>
            </View>

            <View style={styles.statCard}>
              <Ionicons name="list-outline" size={24} color="#10b981" />
              <Text style={styles.statValue}>{overview.totalUniqueMedications}</Text>
              <Text style={styles.statLabel}>Уникальных позиций</Text>
            </View>

            <View style={styles.statCard}>
              <Ionicons name="cash-outline" size={24} color="#f59e0b" />
              <Text style={styles.statValue}>{overview.totalInventoryValue} ₸</Text>
              <Text style={styles.statLabel}>Оценочная стоимость</Text>
            </View>
          </View>
        ) : (
          <Text style={styles.emptyText}>Нет данных</Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
  header: {
    padding: 20,
    backgroundColor: '#0A2342',
    paddingTop: 60,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  subtitle: {
    fontSize: 16,
    color: '#94a3b8',
    marginTop: 4,
  },
  scrollContent: {
    padding: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
    marginTop: 8,
    marginBottom: 4,
    textAlign: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 40,
    color: '#64748b',
    fontSize: 16,
  },
});
