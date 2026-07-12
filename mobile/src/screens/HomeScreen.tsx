import React, { useEffect, useState, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ActivityIndicator, 
  Alert, 
  ScrollView, 
  RefreshControl, 
  StatusBar, 
  Platform, 
  TouchableOpacity 
} from 'react-native';
import { api } from '../services/api_service';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { useNavigation } from '@react-navigation/native';
import { Animated } from 'react-native';

interface DashboardOverview {
  totalItemsInStock: number;
  totalInventoryValue: number;
  totalUniqueMedications: number;
  criticalItemsCount: number;
  expiringItemsCount?: number;
  proceduresLoggedToday?: number;
}

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

export default function HomeScreen() {
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [expiringCount, setExpiringCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userName, setUserName] = useState('');
  const [userRole, setUserRole] = useState('NURSE');
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
      const [metricsRes, transactionsRes] = await Promise.all([
        api.get('/dashboard/metrics'),
        api.get('/transactions')
      ]);
      setOverview(metricsRes.data.overview || null);
      setExpiringCount(metricsRes.data.overview?.expiringItemsCount || 0);
      
      const allTx = transactionsRes.data?.data || transactionsRes.data || [];
      setRecentTransactions(allTx.slice(0, 3));
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
      const role = await SecureStore.getItemAsync('userRole');
      if (name) setUserName(name);
      if (role) setUserRole(role);
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

  const getTxStyle = (type: string) => {
    switch (type) {
      case 'INCOME': 
        return { color: '#10B981', bg: 'rgba(16, 185, 129, 0.08)', icon: 'arrow-down', sign: '+' };
      case 'OUTFLOW': 
        return { color: '#3B82F6', bg: 'rgba(59, 130, 246, 0.08)', icon: 'arrow-up', sign: '-' };
      case 'RETURN': 
        return { color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.08)', icon: 'refresh', sign: '+' };
      case 'WRITE_OFF': 
        return { color: '#EF4444', bg: 'rgba(239, 68, 68, 0.08)', icon: 'trash', sign: '-' };
      default: 
        return { color: '#64748B', bg: 'rgba(100, 116, 139, 0.08)', icon: 'help', sign: '' };
    }
  };

  const criticalPercent = overview && overview.totalUniqueMedications > 0 
    ? Math.round((overview.criticalItemsCount / overview.totalUniqueMedications) * 100) 
    : 0;

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
          <View style={{ width: '100%' }}>
            
            {/* Role-Based Stat Cards */}
            {userRole === 'NURSE' ? (
              <View style={styles.grid}>
                <Animated.View style={[
                  styles.statCard, 
                  styles.cardCyan,
                  { width: '100%', opacity: cardAnims[0], transform: [{ translateY: cardSlides[0] }] }
                ]}>
                  <View style={[styles.iconWrapper, { backgroundColor: 'rgba(8, 145, 178, 0.1)' }]}>
                    <Ionicons name="checkmark-done-circle-outline" size={22} color="#0891B2" />
                  </View>
                  <Text style={styles.statValue}>{overview.proceduresLoggedToday || 0}</Text>
                  <Text style={styles.statLabel}>Выполнено процедур сегодня</Text>
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
                  <Text style={styles.statLabel}>Дефицитных остатков</Text>
                </Animated.View>

                <Animated.View style={[
                  styles.statCard, 
                  styles.cardOrange,
                  { opacity: cardAnims[2], transform: [{ translateY: cardSlides[2] }] }
                ]}>
                  <View style={[styles.iconWrapper, { backgroundColor: 'rgba(245, 158, 11, 0.1)' }]}>
                    <Ionicons name="time-outline" size={22} color="#f59e0b" />
                  </View>
                  <Text style={styles.statValue}>{expiringCount}</Text>
                  <Text style={styles.statLabel}>Истекающие сроки (30д)</Text>
                </Animated.View>
              </View>
            ) : userRole === 'STOREKEEPER' ? (
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
                  <Text style={styles.statLabel}>Всего на складе</Text>
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
                    <Ionicons name="time-outline" size={22} color="#f59e0b" />
                  </View>
                  <Text style={styles.statValue}>{expiringCount}</Text>
                  <Text style={styles.statLabel}>Истекающие сроки (30д)</Text>
                </Animated.View>
              </View>
            ) : (
              /* ADMIN, HEAD_NURSE, MANAGER */
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
            )}

            {/* Critical Stock Level Visual Progress */}
            {userRole !== 'NURSE' && overview.totalUniqueMedications > 0 && (
              <View style={styles.progressCard}>
                <View style={styles.progressHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="analytics" size={18} color="#0F172A" />
                    <Text style={styles.sectionTitleCompact}>Уровень дефицита товаров</Text>
                  </View>
                  <Text style={[styles.progressPercentText, { color: criticalPercent > 30 ? '#ef4444' : '#10b981' }]}>
                    {criticalPercent}%
                  </Text>
                </View>
                <View style={styles.progressBarBg}>
                  <View style={[
                    styles.progressBarFill, 
                    { 
                      width: `${Math.min(criticalPercent, 100)}%`,
                      backgroundColor: criticalPercent > 30 ? '#ef4444' : '#10b981'
                    }
                  ]} />
                </View>
                <Text style={styles.progressHelperText}>
                  {overview.criticalItemsCount} из {overview.totalUniqueMedications} уникальных позиций находятся на критическом уровне остатков.
                </Text>
              </View>
            )}

            {/* Expiring Soon Widget — Ф-04 */}
            {expiringCount > 0 && (
              <View style={[styles.progressCard, { borderLeftWidth: 4, borderLeftColor: '#f59e0b' }]}>
                <View style={styles.progressHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="time-outline" size={18} color="#f59e0b" />
                    <Text style={[styles.sectionTitleCompact, { color: '#92400e' }]}>Истекающие сроки</Text>
                  </View>
                  <Text style={[styles.progressPercentText, { color: '#f59e0b' }]}>{expiringCount} поз.</Text>
                </View>
                <Text style={[styles.progressHelperText, { color: '#92400e' }]}>
                  {expiringCount} {expiringCount === 1 ? 'позиция истекает' : expiringCount < 5 ? 'позиции истекают' : 'позиций истекают'} в течение 30 дней. Проверьте срок годности!
                </Text>
              </View>
            )}

            {/* Quick Actions Grid — role-based */}
            <Text style={styles.sectionHeading}>Быстрые действия</Text>
            <View style={styles.actionGrid}>
              {/* STOREKEEPER + ADMIN: Приёмка */}
              {['STOREKEEPER', 'ADMIN', 'HEAD_NURSE'].includes(userRole) && (
                <TouchableOpacity 
                  style={styles.actionBtn} 
                  onPress={() => navigation.navigate('Транзакции')}
                  activeOpacity={0.7}
                >
                  <View style={[styles.actionIconBg, { backgroundColor: 'rgba(8, 145, 178, 0.1)' }]}>
                    <Ionicons name="arrow-down-circle" size={22} color="#0891B2" />
                  </View>
                  <Text style={styles.actionBtnText}>Приёмка товара</Text>
                </TouchableOpacity>
              )}

              {/* Списать процедуру — NURSE, HEAD_NURSE, ADMIN */}
              {['NURSE', 'HEAD_NURSE', 'ADMIN', 'STOREKEEPER'].includes(userRole) && (
                <TouchableOpacity 
                  style={styles.actionBtn} 
                  onPress={() => navigation.navigate('Процедуры')}
                  activeOpacity={0.7}
                >
                  <View style={[styles.actionIconBg, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
                    <Ionicons name="medical" size={22} color="#10b981" />
                  </View>
                  <Text style={styles.actionBtnText}>Списать процедуру</Text>
                </TouchableOpacity>
              )}

              {/* Инвентаризация — STOREKEEPER, ADMIN, HEAD_NURSE */}
              {['STOREKEEPER', 'ADMIN', 'HEAD_NURSE'].includes(userRole) && (
                <TouchableOpacity 
                  style={styles.actionBtn} 
                  onPress={() => navigation.navigate('Склад')}
                  activeOpacity={0.7}
                >
                  <View style={[styles.actionIconBg, { backgroundColor: 'rgba(245, 158, 11, 0.1)' }]}>
                    <Ionicons name="barcode" size={22} color="#f59e0b" />
                  </View>
                  <Text style={styles.actionBtnText}>Инвентаризация</Text>
                </TouchableOpacity>
              )}

              {/* История — все */}
              <TouchableOpacity 
                style={styles.actionBtn} 
                onPress={() => navigation.navigate('История')}
                activeOpacity={0.7}
              >
                <View style={[styles.actionIconBg, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
                  <Ionicons name="time" size={22} color="#3B82F6" />
                </View>
                <Text style={styles.actionBtnText}>История списаний</Text>
              </TouchableOpacity>

              {/* Запрос пополнения — все роли (ТЗ 3.6) */}
              <TouchableOpacity 
                style={styles.actionBtn} 
                onPress={() => navigation.navigate('Пополнение')}
                activeOpacity={0.7}
              >
                <View style={[styles.actionIconBg, { backgroundColor: 'rgba(168, 85, 247, 0.1)' }]}>
                  <Ionicons name="archive" size={22} color="#a855f7" />
                </View>
                <Text style={styles.actionBtnText}>Запрос пополнения</Text>
              </TouchableOpacity>

            </View>

            {/* Recent Activity List */}
            <View style={styles.recentActivityHeader}>
              <Text style={styles.sectionHeadingNoMargin}>Недавние операции</Text>
              <TouchableOpacity onPress={() => navigation.navigate('История')} activeOpacity={0.7}>
                <Text style={styles.seeAllText}>Посмотреть все</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.recentActivityList}>
              {recentTransactions.length > 0 ? (
                recentTransactions.map((tx) => {
                  const txStyle = getTxStyle(tx.type);
                  return (
                    <View key={tx.id} style={styles.txRow}>
                      <View style={[styles.txIconBg, { backgroundColor: txStyle.bg }]}>
                        <Ionicons name={txStyle.icon as any} size={16} color={txStyle.color} />
                      </View>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={styles.txMedName} numberOfLines={1}>
                          {tx.medication.name}
                        </Text>
                        <Text style={styles.txDetails}>
                          {tx.user?.name || 'Система'} • {new Date(tx.createdAt).toLocaleDateString('ru-RU')}
                        </Text>
                      </View>
                      <Text style={[styles.txQty, { color: txStyle.color }]}>
                        {txStyle.sign}{tx.quantity} шт
                      </Text>
                    </View>
                  );
                })
              ) : (
                <Text style={styles.emptyRecentText}>Нет недавних операций</Text>
              )}
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
    paddingBottom: 40,
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
  progressCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 20,
    marginTop: 4,
    marginBottom: 20,
    shadowColor: '#0A2342',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitleCompact: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  progressPercentText: {
    fontSize: 16,
    fontWeight: '900',
  },
  progressBarBg: {
    height: 8,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressHelperText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
    lineHeight: 16,
  },
  sectionHeading: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
    marginTop: 10,
    marginBottom: 14,
  },
  sectionHeadingNoMargin: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  actionBtn: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
    shadowColor: '#0A2342',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  actionIconBg: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#334155',
    textAlign: 'center',
  },
  recentActivityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0891B2',
  },
  recentActivityList: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 16,
    shadowColor: '#0A2342',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  txIconBg: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txMedName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1E293B',
  },
  txDetails: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },
  txQty: {
    fontSize: 14,
    fontWeight: '900',
  },
  emptyRecentText: {
    textAlign: 'center',
    color: '#94A3B8',
    paddingVertical: 20,
    fontSize: 14,
    fontWeight: '500',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 40,
    color: '#64748b',
    fontSize: 16,
  },
});
