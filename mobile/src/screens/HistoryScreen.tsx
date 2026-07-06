import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { api } from '../services/api_service';
import { Ionicons } from '@expo/vector-icons';

interface Transaction {
  id: number;
  type: 'INCOME' | 'OUTFLOW' | 'RETURN' | 'WRITE_OFF';
  quantity: number;
  createdAt: string;
  medication: {
    name: string;
  };
  user: {
    name: string;
  } | null;
}

export default function HistoryScreen() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchHistory = async () => {
    try {
      const response = await api.get('/transactions');
      setTransactions(response.data.data || []);
    } catch (error: any) {
      if (error.code !== 'ECONNABORTED' && error.response) {
        Alert.alert('Ошибка', 'Не удалось загрузить историю операций');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchHistory();
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'INCOME': return { label: 'Приёмка', color: '#10b981', icon: 'arrow-down-circle' };
      case 'OUTFLOW': return { label: 'Выдача', color: '#f59e0b', icon: 'arrow-up-circle' };
      case 'RETURN': return { label: 'Возврат', color: '#3b82f6', icon: 'refresh-circle' };
      case 'WRITE_OFF': return { label: 'Списание', color: '#ef4444', icon: 'close-circle' };
      default: return { label: 'Неизвестно', color: '#64748b', icon: 'help-circle' };
    }
  };

  const renderItem = ({ item }: { item: Transaction }) => {
    const typeInfo = getTypeLabel(item.type);

    return (
      <View style={styles.card}>
        <View style={styles.iconContainer}>
          <Ionicons name={typeInfo.icon as any} size={32} color={typeInfo.color} />
        </View>
        <View style={styles.contentContainer}>
          <Text style={styles.medName}>{item.medication.name}</Text>
          <Text style={styles.details}>
            {typeInfo.label} • {item.quantity} шт.
          </Text>
          <Text style={styles.timeUser}>
            {new Date(item.createdAt).toLocaleString()} {item.user ? `• ${item.user.name}` : ''}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>История</Text>
        <Text style={styles.subtitle}>Недавние операции на складе</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#0891B2" />
        </View>
      ) : (
        <FlatList
          data={transactions}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <Text style={styles.emptyText}>История операций пуста</Text>
          }
        />
      )}
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
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    padding: 16,
  },
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
  iconContainer: {
    marginRight: 16,
  },
  contentContainer: {
    flex: 1,
  },
  medName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
  },
  details: {
    fontSize: 14,
    fontWeight: '500',
    color: '#475569',
    marginBottom: 2,
  },
  timeUser: {
    fontSize: 12,
    color: '#94a3b8',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 40,
    color: '#64748b',
    fontSize: 16,
  },
});
