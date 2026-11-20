import { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Drawer, DrawerContentScrollView, DrawerItemList, type DrawerContentComponentProps } from 'expo-router/drawer';

import { COLORES } from '@/components/ui';
import { useSesion } from '@/lib/contexto-sesion';
import { confirmar } from '@/lib/formato';
import type { Configuracion } from '@/lib/tipos';

type NombreIcono = keyof typeof Ionicons.glyphMap;

// Secciones del menú, en orden. `name` es el archivo dentro de src/app/(app)/
const SECCIONES: { name: string; titulo: string; icono: NombreIcono }[] = [
  { name: 'index', titulo: 'Inicio', icono: 'home-outline' },
  { name: 'comprobantes', titulo: 'Comprobantes', icono: 'document-text-outline' },
  { name: 'ventas', titulo: 'Ventas / Entregas', icono: 'bag-check-outline' },
  { name: 'estadisticas', titulo: 'Estadísticas', icono: 'bar-chart-outline' },
  { name: 'productos', titulo: 'Productos', icono: 'pricetags-outline' },
  { name: 'ajustes', titulo: 'Ajustes', icono: 'settings-outline' },
];

function ContenidoMenu(props: DrawerContentComponentProps) {
  const { api, cerrarSesion } = useSesion();
  const [nombreNegocio, setNombreNegocio] = useState<string | null>(null);

  useEffect(() => {
    api<Configuracion>('/configuracion')
      .then((c) => setNombreNegocio(c.nombre_negocio))
      .catch(() => {});
  }, [api]);

  const salir = async () => {
    if (await confirmar('Cerrar sesión', '¿Quieres salir de la app en este teléfono?', 'Salir')) {
      cerrarSesion();
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <DrawerContentScrollView {...props}>
        <View style={s.cabecera}>
          <Ionicons name="storefront" size={44} color={COLORES.verde} />
          <Text style={s.nombre}>{nombreNegocio ?? ' '}</Text>
          <Text style={s.sub}>Gestor de pedidos por WhatsApp</Text>
        </View>
        <DrawerItemList {...props} />
      </DrawerContentScrollView>
      <TouchableOpacity style={s.salir} onPress={salir} accessibilityRole="button">
        <Ionicons name="log-out-outline" size={20} color={COLORES.rojo} />
        <Text style={s.salirTexto}>Cerrar sesión</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function LayoutApp() {
  return (
    <Drawer
      drawerContent={(props) => <ContenidoMenu {...props} />}
      screenOptions={{
        drawerActiveTintColor: COLORES.verdeOscuro,
        drawerActiveBackgroundColor: COLORES.verdeFondo,
        headerTintColor: COLORES.texto,
        headerStyle: { backgroundColor: '#fff' },
        sceneStyle: { backgroundColor: COLORES.fondo },
      }}>
      {SECCIONES.map(({ name, titulo, icono }) => (
        <Drawer.Screen
          key={name}
          name={name}
          options={{
            title: titulo,
            drawerLabel: titulo,
            drawerIcon: ({ color, size }) => <Ionicons name={icono} size={size} color={color as string} />,
          }}
        />
      ))}
    </Drawer>
  );
}

const s = StyleSheet.create({
  cabecera: { alignItems: 'center', paddingVertical: 20, marginBottom: 8, borderBottomWidth: 1, borderBottomColor: COLORES.borde },
  nombre: { fontSize: 18, fontWeight: 'bold', color: COLORES.texto, marginTop: 8, textAlign: 'center' },
  sub: { fontSize: 13, color: COLORES.textoSuave, marginTop: 2 },
  salir: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 20, borderTopWidth: 1, borderTopColor: COLORES.borde },
  salirTexto: { color: COLORES.rojo, fontWeight: 'bold', fontSize: 15 },
});
