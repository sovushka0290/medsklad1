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
  StatusBar,
  Animated
} from 'react-native';
import { api } from '../services/api_service';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';

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

const FadeInItem = ({ children, index }: { children: React.ReactNode, index: number }) => {
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const slideAnim = React.useRef(new Animated.Value(15)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 350,
        delay: Math.min(index * 45, 450),
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 350,
        delay: Math.min(index * 45, 450),
        useNativeDriver: true,
      })
    ]).start();
  }, []);

  return (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
      {children}
    </Animated.View>
  );
};

export default function InventoryScreen({ navigation }: any) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    SecureStore.getItemAsync('userRole').then(role => setUserRole(role));
  }, []);

  const handleLogout = () => {
    Alert.alert(
      'Выход из аккаунта',
      'Вы уверены, что хотите выйти из учетной записи?',
      [
        { text: 'Отмена', style: 'cancel' },
        { 
          text: 'Выйти', 
          style: 'destructive',
          onPress: async () => {
            await SecureStore.deleteItemAsync('accessToken');
            await SecureStore.deleteItemAsync('refreshToken');
            await SecureStore.deleteItemAsync('userRole');
            await SecureStore.deleteItemAsync('userName');
            navigation.replace('Login');
          }
        }
      ]
    );
  };

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

  const getExpirationStatus = (dateStr: string | null) => {
    if (!dateStr) return null;
    const today = new Date();
    const expDate = new Date(dateStr);
    const diffTime = expDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      return { label: 'Срок истёк', color: '#ef4444', bg: '#fee2e2' };
    } else if (diffDays <= 30) {
      return { label: `Истекает через ${diffDays} дн.`, color: '#f59e0b', bg: '#fef3c7' };
    }
    return null;
  };

  const renderItem = ({ item, index }: { item: InventoryItem; index: number }) => {
    const isLowStock = item.quantity <= item.medication.minQuantity;
    const expStatus = getExpirationStatus(item.expirationDate);
    const stockRatio = item.medication.minQuantity > 0 
      ? Math.min(item.quantity / (item.medication.minQuantity * 2), 1) 
      : 1;

    return (
      <FadeInItem index={index}>
        <View style={[styles.card, isLowStock ? styles.cardLowStock : styles.cardNormalStock]}>
          
          <View style={styles.cardHeader}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={styles.medName} numberOfLines={2}>{item.medication.name}</Text>
              <View style={styles.infoRow}>
                <Ionicons name="location-outline" size={13} color="#64748B" />
                <Text style={styles.locationText}>{item.location.name}</Text>
              </View>
            </View>
            
            <View style={[styles.badge, isLowStock ? styles.badgeDanger : styles.badgeSuccess]}>
              <Text style={[styles.badgeText, isLowStock ? styles.badgeTextDanger : styles.badgeTextSuccess]}>
                {item.quantity} шт
              </Text>
            </View>
          </View>

          {/* Stock level visualization bar */}
          <View style={styles.stockLevelContainer}>
            <View style={styles.stockLevelHeader}>
              <Text style={styles.stockLevelLabel}>Уровень запаса</Text>
              <Text style={styles.stockLevelValues}>
                Мин. норма: {item.medication.minQuantity} шт
              </Text>
            </View>
            <View style={styles.stockBarBg}>
              <View style={[
                styles.stockBarFill, 
                { 
                  width: `${stockRatio * 100}%`,
                  backgroundColor: isLowStock ? '#ef4444' : '#10b981'
                }
              ]} />
            </View>
          </View>

          {/* Expiration date or warnings */}
          {item.expirationDate && (
            <View style={styles.expirationRow}>
              {expStatus ? (
                <View style={[styles.expWarningBadge, { backgroundColor: expStatus.bg }]}>
                  <Ionicons name="alert-circle-outline" size={12} color={expStatus.color} />
                  <Text style={[styles.expWarningText, { color: expStatus.color }]}>
                    {expStatus.label}
                  </Text>
                </View>
              ) : (
                <View style={styles.expNormalRow}>
                  <Ionicons name="calendar-outline" size={13} color="#64748B" />
                  <Text style={styles.expNormalText}>
                    Годен до: {new Date(item.expirationDate).toLocaleDateString('ru-RU')}
                  </Text>
                </View>
              )}
            </View>
          )}

        </View>
      </FadeInItem>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text style={styles.title}>Склад</Text>
              <TouchableOpacity onPress={handleLogout} style={{ padding: 4 }} activeOpacity={0.7}>
                <Ionicons name="log-out-outline" size={20} color="#fff" style={{ opacity: 0.8 }} />
              </TouchableOpacity>
            </View>
            <Text style={styles.subtitle}>Остатки медикаментов</Text>
          </View>
          {userRole !== 'MANAGER' && (
            <TouchableOpacity 
              style={styles.invButton}
              onPress={() => navigation.navigate('InventorySession')}
              activeOpacity={0.8}
            >
              <Ionicons name="barcode-outline" size={18} color="#fff" style={{ marginRight: 6 }} />
              <Text style={styles.invButtonText}>Инвентарь</Text>
            </TouchableOpacity>
          )}
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
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 22,
    padding: 16,
    marginBottom: 14,
    borderLeftWidth: 5,
    shadowColor: '#0A2342',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
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
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    lineHeight: 20,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 4,
  },
  locationText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  badgeSuccess: {
    backgroundColor: '#DCFCE7',
  },
  badgeDanger: {
    backgroundColor: '#FEE2E2',
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '900',
  },
  badgeTextSuccess: {
    color: '#15803D',
  },
  badgeTextDanger: {
    color: '#B91C1C',
  },
  stockLevelContainer: {
    marginVertical: 10,
  },
  stockLevelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  stockLevelLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
  },
  stockLevelValues: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  stockBarBg: {
    height: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: 3,
    overflow: 'hidden',
  },
  stockBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  expirationRow: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 10,
    marginTop: 6,
  },
  expWarningBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  expWarningText: {
    fontSize: 11,
    fontWeight: '800',
  },
  expNormalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  expNormalText: {
    fontSize: 12,
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
