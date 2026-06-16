import {
  Montserrat_400Regular,
  Montserrat_500Medium,
  Montserrat_600SemiBold,
  Montserrat_700Bold,
  useFonts,
} from '@expo-google-fonts/montserrat';
import * as Notifications from 'expo-notifications';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { useEffect } from 'react';

import { useColorScheme } from '@/hooks/use-color-scheme';

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
  // Brand: load Montserrat before rendering so text doesn't flash in the system font.
  const [fontsLoaded] = useFonts({
    Montserrat_400Regular,
    Montserrat_500Medium,
    Montserrat_600SemiBold,
    Montserrat_700Bold,
  });
  if (!fontsLoaded) return null; // the splash screen covers this brief load
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthProvider>
        <AnimatedSplashOverlay />
        <Gate />
      </AuthProvider>
    </ThemeProvider>
  );
}
