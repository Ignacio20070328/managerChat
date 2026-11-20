import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const CLAVE_TOKEN = 'terrychat_token';

// En el teléfono el token se guarda cifrado (Keychain / Keystore).
// SecureStore no existe en la versión web: ahí se usa localStorage.
export async function leerToken(): Promise<string | null> {
  if (Platform.OS === 'web') {
    try { return localStorage.getItem(CLAVE_TOKEN); } catch { return null; }
  }
  return SecureStore.getItemAsync(CLAVE_TOKEN);
}

export async function guardarToken(token: string): Promise<void> {
  if (Platform.OS === 'web') {
    try { localStorage.setItem(CLAVE_TOKEN, token); } catch {}
    return;
  }
  await SecureStore.setItemAsync(CLAVE_TOKEN, token);
}

export async function borrarToken(): Promise<void> {
  if (Platform.OS === 'web') {
    try { localStorage.removeItem(CLAVE_TOKEN); } catch {}
    return;
  }
  await SecureStore.deleteItemAsync(CLAVE_TOKEN);
}
