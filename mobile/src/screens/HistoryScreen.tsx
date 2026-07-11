import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  ActivityIndicator, 
  Alert, 
  RefreshControl,
  Platform,
  StatusBar,
  TouchableOpacity,
  Animated
} from 'react-native';
import { api } from '../services/api_service';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { useNavigation } from '@react-navigation/native';

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
  const navigation = useNavigation<any>();

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

  const getTypeStyle = (type: string) => {
    switch (type) {
      case 'INCOME': 
        return { 
          label: 'Приёмка', 
          color: '#10B981', 
          borderColor: '#10B981',
          bg: 'rgba(16, 185, 129, 0.08)',
          icon: 'arrow-down-circle-outline' 
        };
      case 'OUTFLOW': 
        return { 
          label: 'Выдача', 
          color: '#3B82F6', 
          borderColor: '#3B82F6',
          bg: 'rgba(59, 130, 246, 0.08)',
          icon: 'arrow-up-circle-outline' 
        };
      case 'RETURN': 
        return { 
          label: 'Возврат', 
          color: '#F59E0B', 
          borderColor: '#F59E0B',
          bg: 'rgba(245, 158, 11, 0.08)',
          icon: 'refresh-circle-outline' 
        };
      case 'WRITE_OFF': 
        return { 
          label: 'Списание', 
          color: '#EF4444', 
          borderColor: '#EF4444',
          bg: 'rgba(239, 68, 68, 0.08)',
          icon: 'trash-outline' 
        };
      default: 
        return { 
          label: 'Операция', 
          color: '#64748B', 
          borderColor: '#64748B',
          bg: 'rgba(100, 116, 139, 0.08)',
          icon: 'help-circle-outline' 
        };
    }
  };

  const renderItem = ({ item, index }: { item: Transaction; index: number }) => {
    const styleInfo = getTypeStyle(item.type);

    return (
      <FadeInItem index={index}>
        <View style={[styles.card, { borderLeftColor: styleInfo.borderColor }]}>
          <View style={[styles.iconContainer, { backgroundColor: styleInfo.bg }]}>
            <Ionicons name={styleInfo.icon as any} size={22} color={styleInfo.color} />
          </View>
          <View style={styles.contentContainer}>
            <Text style={styles.medName}>{item.medication.name}</Text>
            <View style={styles.detailsRow}>
              <Text style={[styles.typeLabel, { color: styleInfo.color }]}>{styleInfo.label}</Text>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.qtyText}>{item.quantity} шт.</Text>
            </View>
            <View style={styles.footerRow}>
              <Ionicons name="time-outline" size={12} color="#94A3B8" />
              <Text style={styles.timeText}>
                {new Date(item.createdAt).toLocaleString('ru-RU', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </Text>
              {item.user && (
                <>
                  <Text style={styles.bullet}>•</Text>
                  <Ionicons name="person-outline" size={12} color="#94A3B8" />
                  <Text style={styles.userText}>{item.user.name}</Text>
                </>
              )}
            </View>
          </View>
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
            <Text style={styles.title}>История</Text>
            <Text style={styles.subtitle}>Недавние операции на складе</Text>
          </View>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutButton} activeOpacity={0.7}>
            <Ionicons name="log-out-outline" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
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
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0891B2" />}
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
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logoutButton: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
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
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
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
    borderLeftWidth: 4,
    shadowColor: '#0A2342',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  contentContainer: {
    flex: 1,
  },
  medName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  typeLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  bullet: {
    marginHorizontal: 6,
    color: '#CBD5E1',
    fontSize: 12,
  },
  qtyText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
  },
  userText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 40,
    color: '#64748b',
    fontSize: 16,
    fontWeight: '500',
  },
});
