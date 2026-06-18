// The app is locked to its light brand look regardless of the device's system setting,
// so it looks identical in dark mode. (Native side is also pinned via
// `userInterfaceStyle: "light"` in app.json.) Import this hook instead of react-native's
// `useColorScheme` anywhere theming is derived.
export function useColorScheme(): 'light' {
  return 'light';
}
