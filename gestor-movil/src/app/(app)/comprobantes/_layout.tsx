import { Stack } from 'expo-router';

import { COLORES } from '@/components/ui';

// Lista de comprobantes y su detalle; cada pantalla dibuja su propio encabezado
export default function LayoutComprobantes() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: COLORES.fondo } }} />;
}
