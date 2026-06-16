import { ConfigContext, ExpoConfig } from 'expo/config';

// Story 6.3: extend the static app.json with the react-native-maps config plugin, injecting the
// Google Maps Android API key from an env var (GOOGLE_MAPS_ANDROID_KEY) so the secret is never
// committed. app.json stays the base; Expo loads it and passes it here as `config`.
// The Android Maps key ships in the APK regardless — its real protection is the GCP package +
// SHA-1 restriction, which must be configured for `com.bahriatenders.app` + the dev SHA-1.
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: config.name ?? 'Bahria Tenders',
  slug: config.slug ?? 'bahria-tenders',
  plugins: [
    ...(config.plugins ?? []),
    ['react-native-maps', { androidGoogleMapsApiKey: process.env.GOOGLE_MAPS_ANDROID_KEY ?? '' }],
  ],
});
