import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as SecureStore from 'expo-secure-store';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import NetInfo from '@react-native-community/netinfo';
import { syncOfflineTransactions } from './src/services/sync_service';

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
      if (state.isConnected && state.isInternetReachable !== false) {
        syncOfflineTransactions();
      }
    });

    return () => unsubscribe();
  }, []);

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
