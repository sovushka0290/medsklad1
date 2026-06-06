import { Stack } from 'expo-router';
import '../global.css'; // NativeWind v4 requirement if applicable, or we just configure it

export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  );
}
