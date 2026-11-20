import { useEffect } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';

import { ProveedorSesion, useSesion } from '@/lib/contexto-sesion';

// La pantalla de carga se mantiene hasta saber si hay una sesión guardada
SplashScreen.preventAutoHideAsync();

function Navegacion() {
  const { token, cargando } = useSesion();

  useEffect(() => {
    if (!cargando) SplashScreen.hideAsync();
  }, [cargando]);

  if (cargando) return null;

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
