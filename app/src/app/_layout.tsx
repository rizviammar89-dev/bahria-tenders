import {
  Montserrat_400Regular,
  Montserrat_500Medium,
  Montserrat_600SemiBold,
  Montserrat_700Bold,
  useFonts,
} from '@expo-google-fonts/montserrat';
import * as Notifications from 'expo-notifications';
import { DefaultTheme, ThemeProvider } from 'expo-router';
import { useEffect } from 'react';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { LoginScreen } from '@/components/login-screen';
import { ProfileSetupScreen } from '@/components/profile-setup-screen';
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
  const { session, loading, hasProfile } = useAuth();
  // Story 2.5: once signed in, register + persist this device's push token so the broadcast
  // dispatcher can reach it. Non-fatal, re-runs per user (captures a rotated token).
  const uid = session?.user?.id;
  useEffect(() => {
    if (uid) savePushToken().catch(() => {});
  }, [uid]);
  if (loading) return null; // splash overlay covers this
  if (!session) return <LoginScreen />;
  if (hasProfile === false) return <ProfileSetupScreen />; // OTP-verified but no profile yet → set it up
  return <AppTabs />;
}

export default function TabLayout() {
  // Brand: load Montserrat before rendering so text doesn't flash in the system font.
  const [fontsLoaded, fontError] = useFonts({
    Montserrat_400Regular,
    Montserrat_500Medium,
    Montserrat_600SemiBold,
    Montserrat_700Bold,
  });
  // Render once fonts load OR if loading errors — otherwise a failed font fetch in a dev
  // build would leave the whole app returning null forever (permanent grey screen).
  if (!fontsLoaded && !fontError) return null; // the splash screen covers this brief load
  return (
    <ThemeProvider value={DefaultTheme}>
      <AuthProvider>
        <AnimatedSplashOverlay />
        <Gate />
      </AuthProvider>
    </ThemeProvider>
  );
}
