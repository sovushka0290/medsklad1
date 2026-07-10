import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert, ScrollView, RefreshControl, StatusBar, Platform } from 'react-native';
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
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <Text style={styles.title}>Главная</Text>
        <Text style={styles.subtitle}>Сводка по складу и балансу</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0891B2" />}
      >
        {loading ? (
          <ActivityIndicator size="large" color="#0891B2" style={{ marginTop: 50 }} />
        ) : overview ? (
          <View style={styles.grid}>
            
            <View style={[styles.statCard, styles.cardCyan]}>
              <View style={[styles.iconWrapper, { backgroundColor: 'rgba(8, 145, 178, 0.1)' }]}>
                <Ionicons name="cube-outline" size={22} color="#0891B2" />
              </View>
              <Text style={styles.statValue}>{overview.totalItemsInStock}</Text>
              <Text style={styles.statLabel}>Всего единиц на складе</Text>
            </View>

            <View style={[styles.statCard, styles.cardRed]}>
              <View style={[styles.iconWrapper, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
                <Ionicons name="alert-circle-outline" size={22} color="#ef4444" />
              </View>
              <Text style={[styles.statValue, { color: '#ef4444' }]}>{overview.criticalItemsCount}</Text>
              <Text style={styles.statLabel}>Критических остатков</Text>
            </View>

            <View style={[styles.statCard, styles.cardGreen]}>
              <View style={[styles.iconWrapper, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
                <Ionicons name="list-outline" size={22} color="#10b981" />
              </View>
              <Text style={styles.statValue}>{overview.totalUniqueMedications}</Text>
              <Text style={styles.statLabel}>Уникальных позиций</Text>
            </View>

            <View style={[styles.statCard, styles.cardOrange]}>
              <View style={[styles.iconWrapper, { backgroundColor: 'rgba(245, 158, 11, 0.1)' }]}>
                <Ionicons name="cash-outline" size={22} color="#f59e0b" />
              </View>
              <Text style={styles.statValue}>{overview.totalInventoryValue.toLocaleString('ru-RU')} ₸</Text>
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
  scrollContent: {
    padding: 20,
    paddingTop: 24,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    shadowColor: '#0A2342',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  cardCyan: {
    borderLeftColor: '#0891B2',
  },
  cardRed: {
    borderLeftColor: '#ef4444',
  },
  cardGreen: {
    borderLeftColor: '#10b981',
  },
  cardOrange: {
    borderLeftColor: '#f59e0b',
  },
  iconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    lineHeight: 15,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 40,
    color: '#64748b',
    fontSize: 16,
  },
});
