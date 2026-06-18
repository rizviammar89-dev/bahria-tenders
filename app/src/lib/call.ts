// Quick-dev: place a phone call without exposing the digits in the UI. Opens the native dialer
// with the number pre-filled (Linking is RN core — no native build needed).
import { Linking } from 'react-native';

export function callNumber(phone: string) {
  Linking.openURL(`tel:${phone}`).catch((e) => console.warn('call failed:', String(e)));
}
