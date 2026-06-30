import { Tabs, Redirect } from 'expo-router';
import React from 'react';
import { Platform, Text } from 'react-native';
import { useAuth } from '../../src/context/AuthContext';

export default function TabLayout() {
  const { user } = useAuth();
  
  if (!user) {
    return <Redirect href="/login" />;
  }

  const role = user.role;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#0891B2',
        tabBarInactiveTintColor: '#64748B',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#E2E8F0',
          height: Platform.OS === 'ios' ? 88 : 60,
          paddingBottom: Platform.OS === 'ios' ? 25 : 10,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
        headerStyle: {
          backgroundColor: '#0A2342',
        },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      {/* Склад (STOREKEEPER, HEAD_NURSE) */}
      <Tabs.Screen
        name="index"
        options={{
          href: (role === 'STOREKEEPER' || role === 'HEAD_NURSE') ? '/' : null,
          title: 'Склад',
          headerTitle: 'Склад Медикаментов',
          tabBarIcon: ({ color }) => (
            <Text style={{ color, fontSize: 20 }}>📦</Text>
          ),
        }}
      />
      
      {/* Дефицит (STOREKEEPER, HEAD_NURSE) */}
      <Tabs.Screen
        name="critical"
        options={{
          href: (role === 'STOREKEEPER' || role === 'HEAD_NURSE') ? '/critical' : null,
          title: 'Дефицит',
          headerTitle: 'Критические остатки',
          tabBarIcon: ({ color }) => (
            <Text style={{ color, fontSize: 20 }}>⚠️</Text>
          ),
        }}
      />
      
      {/* Сканер/Операции (STOREKEEPER) */}
      <Tabs.Screen
        name="scanner"
        options={{
          href: role === 'STOREKEEPER' ? '/scanner' : null,
          title: 'Сканер',
          headerTitle: 'Операции со складом',
          tabBarIcon: ({ color }) => (
            <Text style={{ color, fontSize: 20 }}>📷</Text>
          ),
        }}
      />

      {/* Мой расход (NURSE) */}
      <Tabs.Screen
        name="nurse_dashboard"
        options={{
          href: role === 'NURSE' ? '/nurse_dashboard' : null,
          title: 'Расход',
          headerTitle: 'Мой расход',
          tabBarIcon: ({ color }) => (
            <Text style={{ color, fontSize: 20 }}>💉</Text>
          ),
        }}
      />

      {/* Аналитика (HEAD_NURSE) */}
      <Tabs.Screen
        name="head_nurse_stats"
        options={{
          href: role === 'HEAD_NURSE' ? '/head_nurse_stats' : null,
          title: 'Аналитика',
          headerTitle: 'Статистика по кабинетам',
          tabBarIcon: ({ color }) => (
            <Text style={{ color, fontSize: 20 }}>📊</Text>
          ),
        }}
      />
    </Tabs>
  );
}
