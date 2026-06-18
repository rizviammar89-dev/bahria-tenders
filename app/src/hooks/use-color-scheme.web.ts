// Web mirror of use-color-scheme.ts: the app is locked to its light brand look regardless
// of the system setting, so it looks identical in dark mode.
export function useColorScheme(): 'light' {
  return 'light';
}
