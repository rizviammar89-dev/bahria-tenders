// Story 6.3: minimal Google-maps wrapper (the reusable surface 6.4's resident map builds on).
// Requires the new EAS dev build (react-native-maps is native) — won't render on the current client.
import { StyleSheet, type ViewStyle } from 'react-native';
import MapView, { PROVIDER_GOOGLE, type Region } from 'react-native-maps';

// Default region: Bahria Town Karachi-ish, so the smoke map opens somewhere sensible.
const DEFAULT_REGION: Region = {
  latitude: 24.8607,
  longitude: 67.0011,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

export function AppMap({
  region = DEFAULT_REGION,
  style,
  children,
}: {
  region?: Region;
  style?: ViewStyle;
  children?: React.ReactNode;
}) {
  // PROVIDER_GOOGLE is required (SDK 56 / react-native-maps) for Google tiles on Android.
  return (
    <MapView provider={PROVIDER_GOOGLE} style={[styles.map, style]} initialRegion={region}>
      {children}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: { width: '100%', height: 220 },
});
