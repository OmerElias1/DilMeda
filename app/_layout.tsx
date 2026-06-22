import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { AuthProvider } from '@/hooks/useAuth';
import { LanguageProvider } from '@/hooks/useLanguage';
import { NotificationProvider } from '@/hooks/NotificationProvider';

export default function RootLayout() {
  useFrameworkReady();

  return (
    <LanguageProvider>
      <NotificationProvider>
        <AuthProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="+not-found" />
          </Stack>
          <StatusBar style="light" />
        </AuthProvider>
      </NotificationProvider>
    </LanguageProvider>
  );
}
