import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  Drawer, DrawerContentScrollView, DrawerItemList, useDrawerStatus, type DrawerContentComponentProps,
} from 'expo-router/drawer';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { COLORES, FUENTES, T, type NombreIcono } from '@/components/ui';
import { ProveedorNegocio, useNegocio } from '@/lib/contexto-negocio';
import { useSesion } from '@/lib/contexto-sesion';
import { confirmar, TEXTO_ESTADO_BOT } from '@/lib/formato';
import type { Resumen } from '@/lib/tipos';

// Secciones del menú, en orden. `name` es la ruta dentro de src/app/(app)/
// `contador`: qué cantidad de /resumen se muestra como globo junto al nombre
const SECCIONES: { name: string; titulo: string; icono: NombreIcono; contador?: 'Pendiente' | 'Aprobado' }[] = [
  { name: 'index', titulo: 'Inicio', icono: 'home-outline' },
  { name: 'comprobantes', titulo: 'Comprobantes', icono: 'receipt-outline', contador: 'Pendiente' },
  { name: 'ventas', titulo: 'Ventas y entregas', icono: 'bag-check-outline', contador: 'Aprobado' },
  { name: 'estadisticas', titulo: 'Estadísticas', icono: 'bar-chart-outline' },
  { name: 'productos', titulo: 'Productos', icono: 'pricetags-outline' },
  { name: 'ajustes', titulo: 'Ajustes', icono: 'settings-outline' },
];

// Contadores de los globos del menú (se actualizan al abrirlo)
type Contadores = Partial<Record<'Pendiente' | 'Aprobado', number>>;
const ContextoContadores = createContext<{ contadores: Contadores; setContadores: (c: Contadores) => void }>({
  contadores: {}, setContadores: () => {},
});

function ContenidoMenu(props: DrawerContentComponentProps) {
  const { api, cerrarSesion } = useSesion();
  const { setContadores } = useContext(ContextoContadores);
  const { config, acento } = useNegocio();
  const { top, bottom } = useSafeAreaInsets();
  const abierto = useDrawerStatus() === 'open';
  const [resumen, setResumen] = useState<Resumen | null>(null);

  // Los contadores se actualizan cada vez que se abre el menú
  const cargarResumen = useCallback(() => {
    api<Resumen>('/resumen')
      .then((r) => {
        setResumen(r);
        setContadores(r.porEstado);
      })
      .catch(() => {});
  }, [api, setContadores]);
  useEffect(() => {
    if (abierto) cargarResumen();
  }, [abierto, cargarResumen]);

  const salir = async () => {
    if (await confirmar('Cerrar sesión', '¿Quieres salir de la app en este teléfono?', 'Salir')) cerrarSesion();
  };
  const bot = resumen ? TEXTO_ESTADO_BOT[resumen.bot] : null;

  return (
    <View style={{ flex: 1 }}>
      <View style={[s.cabecera, { backgroundColor: acento, paddingTop: top + 24 }]}>
        <View style={s.logo}>
          <Ionicons name="storefront" size={28} color="#ffffff" />
        </View>
        <T variante="titulo" estilo={{ color: '#ffffff', fontSize: 20 }} lineas={2}>{config?.nombre_negocio ?? ' '}</T>
        <T estilo={{ color: '#ffffff', opacity: 0.85, fontSize: 13 }}>Pedidos por WhatsApp</T>
      </View>
      <DrawerContentScrollView {...props} contentContainerStyle={{ paddingTop: 10 }}>
        <DrawerItemList {...props} />
      </DrawerContentScrollView>
      <View style={[s.pie, { paddingBottom: bottom + 18 }]}>
        {bot ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={[s.punto, { backgroundColor: bot.color }]} />
            <T variante="semi" estilo={{ color: bot.color, fontSize: 13, flex: 1 }} lineas={2}>{bot.textoCorto}</T>
          </View>
        ) : null}
        <TouchableOpacity style={s.salir} onPress={salir} accessibilityRole="button">
          <Ionicons name="log-out-outline" size={22} color={COLORES.rojo} />
          <T variante="fuerte" estilo={{ color: COLORES.rojo }}>Cerrar sesión</T>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/** Nombre de la sección con un globo que muestra cuántas cosas esperan ahí. */
function EtiquetaConGlobo({ titulo, color, contador, colorGlobo }: {
  titulo: string; color: string; contador: keyof Contadores; colorGlobo: string;
}) {
  const cantidad = useContext(ContextoContadores).contadores[contador];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <T variante="semi" estilo={{ color, fontSize: 15, flex: 1 }}>{titulo}</T>
      {cantidad ? (
        <View style={[s.globo, { backgroundColor: colorGlobo }]} accessibilityLabel={`${cantidad} pendientes`}>
          <T variante="fuerte" estilo={{ color: '#ffffff', fontSize: 12 }}>{cantidad}</T>
        </View>
      ) : null}
    </View>
  );
}

function LayoutConMenu() {
  const { acento, acentoSuave } = useNegocio();
  const [contadores, setContadores] = useState<Contadores>({});
  const valorContadores = useMemo(() => ({ contadores, setContadores }), [contadores]);
  return (
    <ContextoContadores.Provider value={valorContadores}>
    <Drawer
      drawerContent={(props) => <ContenidoMenu {...props} />}
      screenOptions={{
        headerShown: false, // cada pantalla dibuja su propio <Encabezado />
        drawerActiveTintColor: acento,
        drawerActiveBackgroundColor: acentoSuave,
        drawerInactiveTintColor: COLORES.textoMedio,
        drawerLabelStyle: { fontFamily: FUENTES.semi, fontSize: 15 },
        drawerItemStyle: { borderRadius: 12 },
        drawerStyle: { width: 300, borderTopRightRadius: 24, borderBottomRightRadius: 24, overflow: 'hidden' },
        sceneStyle: { backgroundColor: COLORES.fondo },
      }}>
      {SECCIONES.map(({ name, titulo, icono, contador }) => (
        <Drawer.Screen
          key={name}
          name={name}
          options={{
            title: titulo,
            drawerLabel: titulo,
            drawerIcon: ({ color, size }) => <Ionicons name={icono} size={size} color={color as string} />,
            drawerItemStyle: { borderRadius: 12 },
            ...(contador
              ? { drawerLabel: ({ color }) => (
                  <EtiquetaConGlobo titulo={titulo} color={color as string} contador={contador}
                    colorGlobo={contador === 'Pendiente' ? acento : COLORES.verde} />
                ) }
              : {}),
          }}
        />
      ))}
    </Drawer>
    </ContextoContadores.Provider>
  );
}

export default function LayoutApp() {
  return (
    <ProveedorNegocio>
      <LayoutConMenu />
    </ProveedorNegocio>
  );
}

const s = StyleSheet.create({
  cabecera: { paddingHorizontal: 20, paddingBottom: 22, gap: 6 },
  logo: { width: 52, height: 52, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  pie: { paddingHorizontal: 20, paddingTop: 14, gap: 12, borderTopWidth: 1, borderTopColor: COLORES.borde },
  punto: { width: 8, height: 8, borderRadius: 4 },
  salir: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
  globo: { minWidth: 24, height: 24, paddingHorizontal: 7, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
