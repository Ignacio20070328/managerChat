import { useEffect } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
// Se importa cada grosor por separado: importar el paquete completo agrega ~50 variantes (≈7 MB) a la app
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans/700Bold';
import { PlusJakartaSans_800ExtraBold } from '@expo-google-fonts/plus-jakarta-sans/800ExtraBold';

import { ProveedorSesion, useSesion } from '@/lib/contexto-sesion';

// La pantalla de carga se mantiene hasta tener las fuentes y saber si hay sesión guardada
SplashScreen.preventAutoHideAsync();

function Navegacion() {
  const { token, cargando } = useSesion();
  const [fuentesListas, errorFuentes] = useFonts({
    Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold,
    PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold,
  });
  // Si las fuentes fallan, la app sigue con la tipografía del sistema
  const listo = !cargando && (fuentesListas || !!errorFuentes);

  useEffect(() => {
    if (listo) SplashScreen.hideAsync();
  }, [listo]);

  if (!listo) return null;

  // Sin sesión solo se puede ver el login; con sesión, solo la app (menú lateral).
  // Si la sesión expira, Expo Router saca automáticamente al usuario al login.
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!!token}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={!token}>
        <Stack.Screen name="login" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <ProveedorSesion>
      <StatusBar style="dark" />
      <Navegacion />
    </ProveedorSesion>
  );
}
