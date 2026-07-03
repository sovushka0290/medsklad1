import { Tabs, Redirect } from 'expo-router';
import React from 'react';
import { Platform, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../../src/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';

export default function TabLayout() {
  const { user, logout } = useAuth();
  
  if (!user) {
    return <Redirect href="/login" />;
  }

  const role = user.role;
  const isManagement = role === 'ADMIN' || role === 'MANAGER' || role === 'HEAD_NURSE';
  const isStorekeeper = role === 'STOREKEEPER' || role === 'ADMIN' || role === 'MANAGER';
  const isNurse = role === 'NURSE';

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#0891B2',
        tabBarInactiveTintColor: '#94A3B8',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#F1F5F9',
          elevation: 10,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.05,
          shadowRadius: 12,
          height: Platform.OS === 'ios' ? 88 : 70,
          paddingBottom: Platform.OS === 'ios' ? 25 : 12,
          paddingTop: 12,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
          marginTop: 4,
        },
        headerStyle: {
          backgroundColor: '#0A2342',
          elevation: 0,
          shadowOpacity: 0,
        },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: {
          fontWeight: '800',
          fontSize: 20,
        },
        headerRight: () => (
          <TouchableOpacity 
            onPress={logout}
            className="mr-4 p-2 rounded-full bg-white/10 active:bg-white/20"
          >
            <Ionicons name="log-out-outline" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        ),
      }}
    >
      {/* Склад (STOREKEEPER, HEAD_NURSE, ADMIN, MANAGER) */}
      <Tabs.Screen
        name="index"
        options={{
          href: (isStorekeeper || isManagement) && !isNurse ? '/' : null,
          title: 'Склад',
          headerTitle: 'Склад Медикаментов',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'cube' : 'cube-outline'} size={26} color={color} />
          ),
        }}
      />
      
      {/* Дефицит */}
      <Tabs.Screen
        name="critical"
        options={{
          href: (isStorekeeper || isManagement) && !isNurse ? '/critical' : null,
          title: 'Дефицит',
          headerTitle: 'Критические остатки',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'warning' : 'warning-outline'} size={26} color={color} />
          ),
        }}
      />
      
      {/* Сканер/Операции */}
      <Tabs.Screen
        name="scanner"
        options={{
          href: isStorekeeper && !isNurse ? '/scanner' : null,
          title: 'Сканер',
          headerTitle: 'Операции со складом',
          tabBarIcon: ({ color, focused }) => (
            <View className={`w-12 h-12 rounded-full items-center justify-center -mt-4 shadow-lg ${focused ? 'bg-[#0891B2] shadow-cyan-500/50' : 'bg-slate-800 shadow-slate-500/30'}`}>
              <Ionicons name="scan" size={24} color="#FFF" />
            </View>
          ),
          tabBarLabel: () => null,
        }}
      />

      {/* Мой расход (NURSE, ADMIN) */}
      <Tabs.Screen
        name="nurse_dashboard"
        options={{
          href: (isNurse || role === 'ADMIN') ? '/nurse_dashboard' : null,
          title: 'Списание',
          headerTitle: 'Прямое списание',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'medkit' : 'medkit-outline'} size={26} color={color} />
          ),
        }}
      />

      {/* Процедуры (NURSE, ADMIN) */}
      <Tabs.Screen
        name="log_procedure"
        options={{
          href: (isNurse || role === 'ADMIN') ? '/log_procedure' : null,
          title: 'Процедуры',
          headerTitle: 'Проведенные процедуры',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'clipboard' : 'clipboard-outline'} size={26} color={color} />
          ),
        }}
      />

      {/* Аналитика */}
      <Tabs.Screen
        name="head_nurse_stats"
        options={{
          href: isManagement ? '/head_nurse_stats' : null,
          title: 'Аналитика',
          headerTitle: 'Статистика',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'stats-chart' : 'stats-chart-outline'} size={26} color={color} />
          ),
        }}
      />

      {/* Факт/Норма (HEAD_NURSE, MANAGER, ADMIN) */}
      <Tabs.Screen
        name="fact_vs_norm"
        options={{
          href: isManagement ? '/fact_vs_norm' : null,
          title: 'ГОСТ',
          headerTitle: 'Факт vs Норматив',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'checkmark-circle' : 'checkmark-circle-outline'} size={26} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
