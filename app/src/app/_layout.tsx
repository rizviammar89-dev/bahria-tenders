import * as Notifications from 'expo-notifications';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { LoginScreen } from '@/components/login-screen';
import { AuthProvider, useAuth } from '@/lib/auth';
import { savePushToken } from '@/lib/push';

// Story 1.1: show push notifications even while the app is foregrounded, so the
// spike can observe delivery without backgrounding for every test.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Story 1.4: gate the app behind auth — unauthenticated users see the login screen.
function Gate() {
  const { session, loading } = useAuth();
  // Story 2.5: once signed in, register + persist this device's push token so the broadcast
  // dispatcher can reach it. Non-fatal, re-runs per user (captures a rotated token).
  const uid = session?.user?.id;
  useEffect(() => {
    if (uid) savePushToken().catch(() => {});
  }, [uid]);
  if (loading) return null; // splash overlay covers this
  if (!session) return <LoginScreen />;
  return <AppTabs />;
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthProvider>
        <AnimatedSplashOverlay />
        <Gate />
      </AuthProvider>
    </ThemeProvider>
  );
}
