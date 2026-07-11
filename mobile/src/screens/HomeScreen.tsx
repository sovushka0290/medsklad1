import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert, ScrollView, RefreshControl, StatusBar, Platform, TouchableOpacity, Animated } from 'react-native';
import { api } from '../services/api_service';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { useNavigation } from '@react-navigation/native';

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
  const [userName, setUserName] = useState('');
  const navigation = useNavigation<any>();

  const cardAnims = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;

  const cardSlides = useRef([
    new Animated.Value(20),
    new Animated.Value(20),
    new Animated.Value(20),
    new Animated.Value(20),
  ]).current;

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

  useEffect(() => {
    fetchDashboard();
    const fetchUser = async () => {
      const name = await SecureStore.getItemAsync('userName');
      if (name) {
        setUserName(name);
      }
    };
    fetchUser();
  }, []);

  useEffect(() => {
    if (overview) {
      cardAnims.forEach(anim => anim.setValue(0));
      cardSlides.forEach(slide => slide.setValue(20));

      const animations = cardAnims.map((anim, index) => {
        return Animated.parallel([
          Animated.timing(anim, {
            toValue: 1,
            duration: 450,
            useNativeDriver: true,
          }),
          Animated.timing(cardSlides[index], {
            toValue: 0,
            duration: 450,
            useNativeDriver: true,
          }),
        ]);
      });
      Animated.stagger(100, animations).start();
    }
  }, [overview]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchDashboard();
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.title}>Главная</Text>
            <Text style={styles.subtitle}>С возвращением, {userName || 'коллега'}!</Text>
          </View>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutButton} activeOpacity={0.7}>
            <Ionicons name="log-out-outline" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0891B2" />}
      >
        {loading ? (
          <ActivityIndicator size="large" color="#0891B2" style={{ marginTop: 50 }} />
        ) : overview ? (
          <View style={styles.grid}>
            
            <Animated.View style={[
              styles.statCard, 
              styles.cardCyan,
              { opacity: cardAnims[0], transform: [{ translateY: cardSlides[0] }] }
            ]}>
              <View style={[styles.iconWrapper, { backgroundColor: 'rgba(8, 145, 178, 0.1)' }]}>
                <Ionicons name="cube-outline" size={22} color="#0891B2" />
              </View>
              <Text style={styles.statValue}>{overview.totalItemsInStock}</Text>
              <Text style={styles.statLabel}>Всего единиц на складе</Text>
            </Animated.View>

            <Animated.View style={[
              styles.statCard, 
              styles.cardRed,
              { opacity: cardAnims[1], transform: [{ translateY: cardSlides[1] }] }
            ]}>
              <View style={[styles.iconWrapper, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
                <Ionicons name="alert-circle-outline" size={22} color="#ef4444" />
              </View>
              <Text style={[styles.statValue, { color: '#ef4444' }]}>{overview.criticalItemsCount}</Text>
              <Text style={styles.statLabel}>Критических остатков</Text>
            </Animated.View>

            <Animated.View style={[
              styles.statCard, 
              styles.cardGreen,
              { opacity: cardAnims[2], transform: [{ translateY: cardSlides[2] }] }
            ]}>
              <View style={[styles.iconWrapper, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
                <Ionicons name="list-outline" size={22} color="#10b981" />
              </View>
              <Text style={styles.statValue}>{overview.totalUniqueMedications}</Text>
              <Text style={styles.statLabel}>Уникальных позиций</Text>
            </Animated.View>

            <Animated.View style={[
              styles.statCard, 
              styles.cardOrange,
              { opacity: cardAnims[3], transform: [{ translateY: cardSlides[3] }] }
            ]}>
              <View style={[styles.iconWrapper, { backgroundColor: 'rgba(245, 158, 11, 0.1)' }]}>
                <Ionicons name="cash-outline" size={22} color="#f59e0b" />
              </View>
              <Text style={styles.statValue}>{overview.totalInventoryValue.toLocaleString('ru-RU')} ₸</Text>
              <Text style={styles.statLabel}>Оценочная стоимость</Text>
            </Animated.View>
            
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
    borderRadius: 24,
    padding: 18,
    marginBottom: 16,
    borderLeftWidth: 5,
    shadowColor: '#0A2342',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
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
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
    marginBottom: 6,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    lineHeight: 16,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 40,
    color: '#64748b',
    fontSize: 16,
  },
});
