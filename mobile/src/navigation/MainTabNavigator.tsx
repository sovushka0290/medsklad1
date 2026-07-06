import React, { useEffect, useState } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { ActivityIndicator, View } from 'react-native';

import HomeScreen from '../screens/HomeScreen';
import InventoryScreen from '../screens/InventoryScreen';
import HistoryScreen from '../screens/HistoryScreen';
import BarcodeScanner from '../components/BarcodeScanner';
import ProceduresScreen from '../screens/ProceduresScreen';

const Tab = createBottomTabNavigator();

export default function MainTabNavigator() {
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRole = async () => {
      try {
        const userRole = await SecureStore.getItemAsync('userRole');
        setRole(userRole || 'NURSE'); // default to least privileged
      } catch (e) {
        setRole('NURSE');
      } finally {
        setLoading(false);
      }
    };
    fetchRole();
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F1F5F9' }}>
        <ActivityIndicator size="large" color="#0891B2" />
      </View>
    );
  }

  const showDashboard = ['ADMIN', 'MANAGER', 'HEAD_NURSE', 'STOREKEEPER'].includes(role!);
  const showInventory = ['ADMIN', 'MANAGER', 'HEAD_NURSE', 'STOREKEEPER'].includes(role!);
  const showHistory = ['ADMIN', 'MANAGER', 'HEAD_NURSE', 'STOREKEEPER'].includes(role!);
  const showScanner = ['ADMIN', 'HEAD_NURSE', 'STOREKEEPER', 'NURSE'].includes(role!);
  const showProcedures = ['ADMIN', 'HEAD_NURSE', 'NURSE'].includes(role!);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'home';

          if (route.name === 'Главная') iconName = focused ? 'home' : 'home-outline';
          else if (route.name === 'Склад') iconName = focused ? 'cube' : 'cube-outline';
          else if (route.name === 'Сканер') iconName = focused ? 'barcode' : 'barcode-outline';
          else if (route.name === 'История') iconName = focused ? 'time' : 'time-outline';
          else if (route.name === 'Процедуры') iconName = focused ? 'medical' : 'medical-outline';

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#0891B2',
        tabBarInactiveTintColor: '#64748b',
        headerStyle: { backgroundColor: '#0A2342' },
        headerTintColor: '#fff',
        tabBarStyle: { backgroundColor: '#fff', borderTopColor: '#e2e8f0' },
      })}
    >
      {showDashboard && <Tab.Screen name="Главная" component={HomeScreen} />}
      {showInventory && <Tab.Screen name="Склад" component={InventoryScreen} />}
      {showProcedures && <Tab.Screen name="Процедуры" component={ProceduresScreen} />}
      {showScanner && (
        <Tab.Screen 
          name="Сканер" 
          component={BarcodeScanner} 
          options={{ headerShown: false }}
        />
      )}
      {showHistory && <Tab.Screen name="История" component={HistoryScreen} />}
    </Tab.Navigator>
  );
}
