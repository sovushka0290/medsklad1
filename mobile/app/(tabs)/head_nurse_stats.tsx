import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { api } from '../../src/api/api';

export default function HeadNurseStats() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await api.get('/dashboard/metrics');
        setData(response.data);
      } catch (error) {
        console.error('Ошибка загрузки статистики:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#0891B2" />
      </View>
    );
  }

  if (!data) {
    return (
      <View style={styles.container}>
        <Text style={styles.subtitle}>Не удалось загрузить данные</Text>
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      <View style={styles.container}>
        <Text style={styles.title}>Сводка по складу</Text>
        
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Всего единиц на складе</Text>
          <Text style={styles.cardValue}>{data.overview.totalItemsInStock}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Оценочная стоимость</Text>
          <Text style={styles.cardValue}>{data.overview.totalInventoryValue || 0} ₸</Text>
        </View>

        <Text style={styles.title}>Топ-10 расходов</Text>
        {data.top10Consumed.map((item: any, index: number) => (
          <View key={index} style={styles.listItem}>
            <Text style={styles.listText}>{item.medicationName}</Text>
            <Text style={styles.listValue}>{item.totalConsumed} шт</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 15,
    marginTop: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 12,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 5,
  },
  cardValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#0891B2',
  },
  listItem: {
    backgroundColor: '#FFFFFF',
    padding: 15,
    borderRadius: 8,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  listText: {
    fontSize: 16,
    color: '#0F172A',
    flex: 1,
  },
  listValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#EF4444',
  }
});
