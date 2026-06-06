import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, Text } from 'react-native';

export default function TabLayout() {
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
      <Tabs.Screen
        name="index"
        options={{
          title: 'Склад',
          headerTitle: 'Склад Медикаментов',
          tabBarIcon: ({ color }) => (
            <Text style={{ color, fontSize: 20 }}>📦</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="critical"
        options={{
          title: 'Дефицит',
          headerTitle: 'Критические остатки',
          tabBarIcon: ({ color }) => (
            <Text style={{ color, fontSize: 20 }}>⚠️</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="scanner"
        options={{
          title: 'Сканер',
          headerTitle: 'Операции со складом',
          tabBarIcon: ({ color }) => (
            <Text style={{ color, fontSize: 20 }}>📷</Text>
          ),
        }}
      />
    </Tabs>
  );
}
