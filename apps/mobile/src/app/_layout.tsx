import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { AuthProvider } from '@/providers/auth-provider';
import { palette } from '@/lib/palette';

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: palette.surface },
          headerTintColor: palette.text,
          headerTitleStyle: { fontWeight: '700' },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: palette.background },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="patents/new" options={{ title: 'Add patent', presentation: 'modal' }} />
        <Stack.Screen name="patents/[id]" options={{ title: 'Patent detail' }} />
        <Stack.Screen name="settings" options={{ title: 'Hesap ve güvenlik' }} />
        <Stack.Screen name="update-password" options={{ title: 'Yeni şifre' }} />
      </Stack>
    </AuthProvider>
  );
}
