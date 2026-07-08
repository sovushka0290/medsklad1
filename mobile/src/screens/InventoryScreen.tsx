import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  ActivityIndicator, 
  Alert, 
  RefreshControl, 
  TouchableOpacity, 
  TextInput, 
  Platform,
  StatusBar
} from 'react-native';
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
  const [searchQuery, setSearchQuery] = useState('');
  const fetchInventory = async () => {
    try {
      const response = await api.get('/inventory');
      setItems(response.data?.data || response.data || []);
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

  const filteredItems = items.filter(item => 
    item.medication.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (item.location.name && item.location.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const renderItem = ({ item }: { item: InventoryItem }) => {
    const isLowStock = item.quantity <= item.medication.minQuantity;

    return (
      <View style={[styles.card, isLowStock ? styles.cardLowStock : styles.cardNormalStock]}>
        <View style={styles.cardHeader}>
          <Text style={styles.medName}>{item.medication.name}</Text>
          <View style={[styles.badge, isLowStock ? styles.badgeDanger : styles.badgeSuccess]}>
            <Text style={[styles.badgeText, isLowStock ? styles.badgeTextDanger : styles.badgeTextSuccess]}>
              {item.quantity} шт
            </Text>
          </View>
        </View>
        <View style={styles.cardBody}>
          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={14} color="#64748B" />
            <Text style={styles.infoText}>{item.location.name}</Text>
          </View>
          {item.expirationDate && (
            <View style={styles.infoRow}>
              <Ionicons name="calendar-outline" size={14} color="#64748B" />
              <Text style={styles.infoText}>
                Годен до: {new Date(item.expirationDate).toLocaleDateString()}
              </Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.title}>Склад</Text>
            <Text style={styles.subtitle}>Остатки медикаментов</Text>
          </View>
          <TouchableOpacity 
            style={styles.invButton}
            onPress={() => navigation.navigate('InventorySession')}
            activeOpacity={0.8}
          >
            <Ionicons name="barcode-outline" size={18} color="#fff" style={{ marginRight: 6 }} />
            <Text style={styles.invButtonText}>Инвентарь</Text>
          </TouchableOpacity>
        </View>
        
        {/* Modern search bar container in header */}
        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={18} color="#94A3B8" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Поиск по названию или кабинету..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#0891B2" />
        </View>
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0891B2" />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="search-outline" size={48} color="#cbd5e1" />
              <Text style={styles.emptyText}>Препараты не найдены</Text>
            </View>
          }
        />
      )}
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
  headerTop: {
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
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
    marginTop: 4,
    fontWeight: '500',
  },
  invButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0891B2',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    shadowColor: '#0891B2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  invButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    height: '100%',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    padding: 20,
    paddingTop: 24,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    shadowColor: '#0A2342',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardLowStock: {
    borderLeftColor: '#EF4444',
  },
  cardNormalStock: {
    borderLeftColor: '#10B981',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  medName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    flex: 1,
    marginRight: 8,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  badgeSuccess: {
    backgroundColor: '#DCFCE7',
  },
  badgeDanger: {
    backgroundColor: '#FEE2E2',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  badgeTextSuccess: {
    color: '#15803D',
  },
  badgeTextDanger: {
    color: '#B91C1C',
  },
  cardBody: {
    flexDirection: 'column',
    gap: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 60,
  },
  emptyText: {
    marginTop: 12,
    color: '#64748b',
    fontSize: 15,
    fontWeight: '500',
  },
});
