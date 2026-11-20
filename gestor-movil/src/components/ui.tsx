import type { ReactNode } from 'react';
import {
  ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View,
  type StyleProp, type TextStyle, type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, router } from 'expo-router';
import { DrawerActions } from 'expo-router/react-navigation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useNegocio } from '@/lib/contexto-negocio';

export type NombreIcono = keyof typeof Ionicons.glyphMap;

// Colores fijos. El color de marca (acento) lo elige cada negocio: useNegocio().acento
export const COLORES = {
  fondo: '#fbf7f4',
  tarjeta: '#ffffff',
  texto: '#1f1a1c',
  textoMedio: '#3d3538',
  textoSuave: '#6b6266',
  borde: '#ece4e6',
  bordeFuerte: '#e4dbde',
  superficie: '#faf6f7',
  verde: '#1a7f37',
  verdeFondo: '#e6f4ea',
  rojo: '#b42318',
  rojoFondo: '#fdecea',
  ambar: '#8a5a00',
  ambarFondo: '#fff4dc',
};

// Las fuentes se cargan en src/app/_layout.tsx
export const FUENTES = {
  titulo: 'PlusJakartaSans_800ExtraBold',
  tituloMedio: 'PlusJakartaSans_700Bold',
  texto: 'Inter_400Regular',
  medio: 'Inter_500Medium',
  semi: 'Inter_600SemiBold',
  negrita: 'Inter_700Bold',
};

/** Texto con la tipografía de la app. */
export function T({ children, estilo, variante = 'texto', lineas }: {
  children: ReactNode;
  estilo?: StyleProp<TextStyle>;
  variante?: keyof typeof variantes;
  lineas?: number;
}) {
  return <Text style={[variantes[variante], estilo]} numberOfLines={lineas}>{children}</Text>;
}

const variantes = StyleSheet.create({
  titulo: { fontFamily: FUENTES.titulo, fontSize: 22, color: COLORES.texto },
  cifra: { fontFamily: FUENTES.titulo, fontSize: 17, color: COLORES.texto },
  texto: { fontFamily: FUENTES.texto, fontSize: 15, color: COLORES.texto },
  fuerte: { fontFamily: FUENTES.negrita, fontSize: 15, color: COLORES.texto },
  semi: { fontFamily: FUENTES.semi, fontSize: 14, color: COLORES.textoMedio },
  suave: { fontFamily: FUENTES.texto, fontSize: 13, color: COLORES.textoSuave },
  etiqueta: { fontFamily: FUENTES.negrita, fontSize: 12, color: COLORES.textoSuave, textTransform: 'uppercase', letterSpacing: 0.6 },
});

/**
 * Encabezado de cada pantalla: botón de menú (o volver), título y subtítulo.
 * `derecha` permite un elemento extra a la derecha.
 */
export function Encabezado({ titulo, subtitulo, volver = false, derecha }: {
  titulo: string; subtitulo?: string; volver?: boolean; derecha?: ReactNode;
}) {
  const navegacion = useNavigation();
  const { top } = useSafeAreaInsets();
  return (
    <View style={[s.encabezado, { paddingTop: top + 8 }]}>
      <BotonIcono
        icono={volver ? 'chevron-back' : 'menu'}
        etiqueta={volver ? 'Volver' : 'Abrir menú'}
        alPresionar={() => (volver ? router.back() : navegacion.dispatch(DrawerActions.openDrawer()))}
      />
      <View style={{ flex: 1 }}>
        <T variante="titulo" estilo={{ fontSize: volver ? 18 : 22 }} lineas={1}>{titulo}</T>
        {subtitulo ? <T variante="suave" estilo={{ fontSize: 12 }} lineas={1}>{subtitulo}</T> : null}
      </View>
      {derecha}
    </View>
  );
}

export function BotonIcono({ icono, etiqueta, alPresionar, color = COLORES.texto, fondo = 'transparent' }: {
  icono: NombreIcono; etiqueta: string; alPresionar: () => void; color?: string; fondo?: string;
}) {
  return (
    <TouchableOpacity onPress={alPresionar} accessibilityRole="button" accessibilityLabel={etiqueta}
      style={[s.botonIcono, { backgroundColor: fondo }]} hitSlop={4}>
      <Ionicons name={icono} size={24} color={color} />
    </TouchableOpacity>
  );
}

/** Contenedor con scroll y "deslizar hacia abajo para recargar". */
export function Pantalla({ children, refrescando = false, alRefrescar, espacioInferior = 32 }: {
  children: ReactNode; refrescando?: boolean; alRefrescar?: () => void; espacioInferior?: number;
}) {
  const { acento } = useNegocio();
  return (
    <ScrollView
      style={s.pantalla}
      contentContainerStyle={[s.contenido, { paddingBottom: espacioInferior }]}
      refreshControl={alRefrescar ? <RefreshControl refreshing={refrescando} onRefresh={alRefrescar} colors={[acento]} tintColor={acento} /> : undefined}
      keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  );
}

export function Tarjeta({ children, estilo }: { children: ReactNode; estilo?: StyleProp<ViewStyle> }) {
  return <View style={[s.tarjeta, estilo]}>{children}</View>;
}

type TipoBoton = 'primario' | 'exito' | 'peligro' | 'secundario';

export function Boton({ texto, alPresionar, tipo = 'primario', icono, cargando = false, desactivado = false, grande = false, estilo }: {
  texto: string; alPresionar: () => void; tipo?: TipoBoton; icono?: NombreIcono;
  cargando?: boolean; desactivado?: boolean; grande?: boolean; estilo?: StyleProp<ViewStyle>;
}) {
  const { acento } = useNegocio();
  const colores = {
    primario: { fondo: acento, texto: '#ffffff', borde: acento },
    exito: { fondo: COLORES.verde, texto: '#ffffff', borde: COLORES.verde },
    peligro: { fondo: '#ffffff', texto: COLORES.rojo, borde: COLORES.rojo },
    secundario: { fondo: '#ffffff', texto: COLORES.texto, borde: COLORES.bordeFuerte },
  }[tipo];
  const inactivo = desactivado || cargando;
  return (
    <TouchableOpacity
      style={[s.boton, grande && s.botonGrande, { backgroundColor: colores.fondo, borderColor: colores.borde }, inactivo && { opacity: 0.5 }, estilo]}
      onPress={alPresionar}
      disabled={inactivo}
      accessibilityRole="button"
      accessibilityLabel={texto}
      accessibilityState={{ disabled: inactivo, busy: cargando }}>
      {cargando ? <ActivityIndicator color={colores.texto} /> : (
        <>
          {icono ? <Ionicons name={icono} size={grande ? 20 : 18} color={colores.texto} /> : null}
          <T variante="fuerte" estilo={{ color: colores.texto, fontSize: grande ? 16 : 15 }}>{texto}</T>
        </>
      )}
    </TouchableOpacity>
  );
}

export function Insignia({ texto, color, fondo, punto = false }: { texto: string; color: string; fondo: string; punto?: boolean }) {
  return (
    <View style={[s.insignia, { backgroundColor: fondo }]}>
      {punto ? <View style={[s.punto, { backgroundColor: color }]} /> : null}
      <T variante="fuerte" estilo={{ color, fontSize: 12 }}>{texto}</T>
    </View>
  );
}

/** Muestra carga, error (con reintentar) o vacío; si no aplica ninguno, muestra children. */
export function EstadoCarga({ cargando, error, vacio, textoVacio, iconoVacio = 'checkmark-done-circle-outline', alReintentar, children }: {
  cargando: boolean; error: string | null; vacio?: boolean; textoVacio?: string; iconoVacio?: NombreIcono;
  alReintentar: () => void; children?: ReactNode;
}) {
  const { acento } = useNegocio();
  if (cargando) return <ActivityIndicator size="large" color={acento} style={{ marginTop: 40 }} />;
  if (error) {
    return (
      <Tarjeta estilo={{ alignItems: 'center', gap: 10 }}>
        <Ionicons name="cloud-offline-outline" size={36} color={COLORES.rojo} />
        <T variante="suave" estilo={{ textAlign: 'center' }}>{error}</T>
        <Boton texto="Reintentar" tipo="secundario" icono="refresh" alPresionar={alReintentar} />
      </Tarjeta>
    );
  }
  if (vacio) {
    return (
      <View style={{ alignItems: 'center', marginTop: 48, gap: 10, paddingHorizontal: 24 }}>
        <Ionicons name={iconoVacio} size={52} color="#cfc5c9" />
        <T variante="suave" estilo={{ textAlign: 'center', fontSize: 15 }}>{textoVacio}</T>
      </View>
    );
  }
  return <>{children}</>;
}

export const s = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: COLORES.fondo },
  contenido: { padding: 16, gap: 12, maxWidth: 720, width: '100%', alignSelf: 'center' },
  encabezado: { backgroundColor: '#ffffff', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: COLORES.borde },
  botonIcono: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  tarjeta: { backgroundColor: COLORES.tarjeta, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: COLORES.borde },
  boton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 16, borderRadius: 12, minHeight: 46, borderWidth: 1.5 },
  botonGrande: { minHeight: 54, borderRadius: 14, borderWidth: 2 },
  insignia: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999 },
  punto: { width: 7, height: 7, borderRadius: 4 },
  input: { backgroundColor: '#ffffff', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: FUENTES.texto, borderWidth: 1, borderColor: '#d9cfd3', color: COLORES.texto },
});
