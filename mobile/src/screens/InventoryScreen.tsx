import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Alert, RefreshControl, TouchableOpacity } from 'react-native';
import { api } from '../services/api_service';
import { Ionicons } from '@expo/vector-icons';

interface InventoryItem {
  id: number;
  quantity: number;
  expirationDate: string | null;
  medication: {
    id: number;
    name: string;
    minQuantity: number;
  };
  location: {
    name: string;
  };
}

export default function InventoryScreen({ navigation }: any) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchInventory = async () => {
    try {
      const response = await api.get('/inventory');
      setItems(response.data.data || []);
    } catch (error: any) {
      if (error.code !== 'ECONNABORTED' && error.response) {
        Alert.alert('Ошибка', 'Не удалось загрузить данные склада');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchInventory();
  };

  const renderItem = ({ item }: { item: InventoryItem }) => {
    const isLowStock = item.quantity <= item.medication.minQuantity;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.medName}>{item.medication.name}</Text>
          <View style={[styles.badge, isLowStock ? styles.badgeDanger : styles.badgeSuccess]}>
            <Text style={styles.badgeText}>{item.quantity} шт</Text>
          </View>
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.infoText}><Ionicons name="location-outline" size={14} /> {item.location.name}</Text>
          {item.expirationDate && (
            <Text style={styles.infoText}>
              <Ionicons name="calendar-outline" size={14} /> Годен до: {new Date(item.expirationDate).toLocaleDateString()}
            </Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Text style={styles.title}>Склад</Text>
            <Text style={styles.subtitle}>Остатки медикаментов</Text>
          </View>
          <TouchableOpacity 
            style={styles.invButton}
            onPress={() => navigation.navigate('InventorySession')}
          >
            <Ionicons name="barcode-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.invButtonText}>Инвентаризация</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#0891B2" />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <Text style={styles.emptyText}>Нет данных на складе</Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F1F5F9', // Light Gray background
  },
  header: {
    padding: 20,
    backgroundColor: '#0A2342', // Dark Blue
    paddingTop: 60, // Padding for status bar
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
  invButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0891B2',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  invButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  medName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    flex: 1,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  badgeSuccess: {
    backgroundColor: '#dcfce7', // Light green
  },
  badgeDanger: {
    backgroundColor: '#fee2e2', // Light red
  },
  badgeText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  cardBody: {
    flexDirection: 'column',
    gap: 4,
  },
  infoText: {
    fontSize: 14,
    color: '#64748b',
    flexDirection: 'row',
    alignItems: 'center',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 40,
    color: '#64748b',
    fontSize: 16,
  },
});
