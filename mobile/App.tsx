import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as SecureStore from 'expo-secure-store';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import NetInfo from '@react-native-community/netinfo';
import { getOfflineQueue, dequeueTransaction } from './src/services/offline_queue';
import { api } from './src/services/api_service';

import LoginScreen from './src/screens/LoginScreen';
import MainTabNavigator from './src/navigation/MainTabNavigator';
import InventorySessionScreen from './src/screens/InventorySessionScreen';
import { registerForPushNotificationsAsync } from './src/services/push_service';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const Stack = createNativeStackNavigator();

export default function App() {
  const [initialRoute, setInitialRoute] = useState<string | null>(null);

  useEffect(() => {
    // Check if user is already logged in
    const initApp = async () => {
      try {
        const token = await SecureStore.getItemAsync('accessToken');
        if (token) {
          setInitialRoute('Main');
          // Register for push notifications if logged in
          await registerForPushNotificationsAsync();
        } else {
          setInitialRoute('Login');
        }
      } catch (e) {
        setInitialRoute('Login');
      }
    };
    initApp();

    const unsubscribe = NetInfo.addEventListener(state => {
      if (state.isConnected) {
        syncOfflineQueue();
      }
    });

    return () => unsubscribe();
  }, []);

  const syncOfflineQueue = async () => {
    const queue = await getOfflineQueue();
    if (queue.length === 0) return;
    
    for (const tx of queue) {
      try {
        if (tx.method.toLowerCase() === 'post') {
          await api.post(tx.url, tx.data, { headers: { 'X-Sync-Retry': 'true' } });
        }
        await dequeueTransaction(tx.id);
      } catch (e: any) {
        // If it's a 4xx error (e.g. bad request), we might want to dequeue it to avoid blocking forever,
        // but for ECONNABORTED we leave it in the queue.
        if (e.response && e.response.status >= 400 && e.response.status < 500) {
           await dequeueTransaction(tx.id);
        }
      }
    }
  };

  if (!initialRoute) return null; // Show splash screen or loading here

  return (
    <NavigationContainer>
      <StatusBar style="light" />
      <Stack.Navigator initialRouteName={initialRoute}>
        <Stack.Screen 
          name="Login" 
          component={LoginScreen} 
          options={{ headerShown: false }} 
        />
        <Stack.Screen 
          name="Main" 
          component={MainTabNavigator} 
          options={{ headerShown: false }} 
        />
        <Stack.Screen
          name="InventorySession"
          component={InventorySessionScreen}
          options={{ title: 'Инвентаризация', headerStyle: { backgroundColor: '#0A2342' }, headerTintColor: '#fff' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
