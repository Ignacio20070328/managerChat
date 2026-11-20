import type { ReactNode } from 'react';
import {
  ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View,
  type StyleProp, type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export const COLORES = {
  fondo: '#f4f6f9',
  tarjeta: '#ffffff',
  texto: '#1f2328',
  textoSuave: '#59636e',
  borde: '#e5e7eb',
  verde: '#25D366',
  verdeOscuro: '#1a7f37',
  verdeFondo: '#e8f8f0',
  rojo: '#b42318',
  rojoFondo: '#fdecea',
  ambar: '#9a6700',
  ambarFondo: '#fff8e5',
  azul: '#0969da',
  azulFondo: '#ddf4ff',
};

/** Contenedor con scroll y "deslizar hacia abajo para recargar". */
export function Pantalla({ children, refrescando = false, alRefrescar }: {
  children: ReactNode; refrescando?: boolean; alRefrescar?: () => void;
}) {
  return (
    <ScrollView
      style={estilos.pantalla}
      contentContainerStyle={estilos.contenido}
      refreshControl={alRefrescar ? <RefreshControl refreshing={refrescando} onRefresh={alRefrescar} colors={[COLORES.verde]} /> : undefined}
      keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  );
}

export function Tarjeta({ children, estilo }: { children: ReactNode; estilo?: StyleProp<ViewStyle> }) {
  return <View style={[estilos.tarjeta, estilo]}>{children}</View>;
}

export function Titulo({ children, sub }: { children: ReactNode; sub?: string }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={estilos.titulo}>{children}</Text>
      {sub ? <Text style={estilos.subtitulo}>{sub}</Text> : null}
    </View>
  );
}

type TipoBoton = 'primario' | 'peligro' | 'secundario';

export function Boton({ texto, alPresionar, tipo = 'primario', icono, cargando = false, desactivado = false, estilo }: {
  texto: string; alPresionar: () => void; tipo?: TipoBoton; icono?: keyof typeof Ionicons.glyphMap;
  cargando?: boolean; desactivado?: boolean; estilo?: StyleProp<ViewStyle>;
}) {
  const colores = {
    primario: { fondo: COLORES.verde, texto: '#fff' },
    peligro: { fondo: COLORES.rojoFondo, texto: COLORES.rojo },
    secundario: { fondo: '#eef0f3', texto: COLORES.texto },
  }[tipo];
  const inactivo = desactivado || cargando;
  return (
    <TouchableOpacity
      style={[estilos.boton, { backgroundColor: colores.fondo }, inactivo && { opacity: 0.5 }, estilo]}
      onPress={alPresionar}
      disabled={inactivo}
      accessibilityRole="button"
      accessibilityLabel={texto}>
      {cargando ? <ActivityIndicator color={colores.texto} /> : (
        <>
          {icono ? <Ionicons name={icono} size={18} color={colores.texto} /> : null}
          <Text style={[estilos.botonTexto, { color: colores.texto }]}>{texto}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

export function Insignia({ texto, color, fondo }: { texto: string; color: string; fondo: string }) {
  return (
    <View style={[estilos.insignia, { backgroundColor: fondo }]}>
      <Text style={[estilos.insigniaTexto, { color }]}>{texto}</Text>
    </View>
  );
}

/** Muestra carga, error (con reintentar) o vacío; si no aplica ninguno, muestra children. */
export function EstadoCarga({ cargando, error, vacio, textoVacio, alReintentar, children }: {
  cargando: boolean; error: string | null; vacio?: boolean; textoVacio?: string;
  alReintentar: () => void; children?: ReactNode;
}) {
  if (cargando) return <ActivityIndicator size="large" color={COLORES.verde} style={{ marginTop: 40 }} />;
  if (error) {
    return (
      <Tarjeta estilo={{ alignItems: 'center', gap: 10 }}>
        <Ionicons name="cloud-offline-outline" size={36} color={COLORES.rojo} />
        <Text style={[estilos.subtitulo, { textAlign: 'center' }]}>{error}</Text>
        <Boton texto="Reintentar" tipo="secundario" icono="refresh" alPresionar={alReintentar} />
      </Tarjeta>
    );
  }
  if (vacio) {
    return (
      <View style={{ alignItems: 'center', marginTop: 40, gap: 8 }}>
        <Ionicons name="checkmark-done-circle-outline" size={48} color="#c4c8ce" />
        <Text style={[estilos.subtitulo, { textAlign: 'center' }]}>{textoVacio}</Text>
      </View>
    );
  }
  return <>{children}</>;
}

export const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: COLORES.fondo },
  contenido: { padding: 16, paddingBottom: 40, gap: 12, maxWidth: 720, width: '100%', alignSelf: 'center' },
  tarjeta: { backgroundColor: COLORES.tarjeta, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: COLORES.borde },
  titulo: { fontSize: 22, fontWeight: 'bold', color: COLORES.texto },
  subtitulo: { fontSize: 14, color: COLORES.textoSuave, marginTop: 2 },
  etiqueta: { fontSize: 13, fontWeight: '600', color: COLORES.textoSuave, marginBottom: 6 },
  texto: { fontSize: 15, color: COLORES.texto },
  boton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 10, minHeight: 46 },
  botonTexto: { fontWeight: 'bold', fontSize: 15 },
  insignia: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  insigniaTexto: { fontSize: 12, fontWeight: '700' },
  input: { backgroundColor: '#fff', borderRadius: 10, padding: 12, fontSize: 15, borderWidth: 1, borderColor: '#d0d7de', color: COLORES.texto },
});
