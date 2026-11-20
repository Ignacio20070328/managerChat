import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Boton, COLORES, estilos } from '@/components/ui';
import { SesionExpiradaError } from '@/lib/api';
import { useSesion } from '@/lib/contexto-sesion';
import { avisar, fechaHora, pesos } from '@/lib/formato';
import type { Analisis, Pedido } from '@/lib/tipos';

const SUGERENCIAS = {
  aprobar: { texto: 'Todo coincide', icono: 'checkmark-circle', color: COLORES.verdeOscuro, fondo: COLORES.verdeFondo },
  revisar: { texto: 'Revisar con atención', icono: 'alert-circle', color: COLORES.ambar, fondo: COLORES.ambarFondo },
  rechazar: { texto: 'Sospechoso', icono: 'close-circle', color: COLORES.rojo, fondo: COLORES.rojoFondo },
} as const;

/**
 * Revisión previa con IA de un comprobante. Es solo una AYUDA: la decisión
 * de aprobar o rechazar siempre la toma la persona.
 */
export function PanelAnalisis({ pedido, iaActiva, alActualizar }: {
  pedido: Pedido; iaActiva: boolean; alActualizar: (pedido: Pedido) => void;
}) {
  const { api } = useSesion();
  const [analizando, setAnalizando] = useState(false);
  const a = pedido.analisis;

  const analizar = async () => {
    setAnalizando(true);
    try {
      alActualizar(await api<Pedido>(`/pedidos/${pedido.id_pedido}/analizar`, { metodo: 'POST' }));
    } catch (e) {
      if (!(e instanceof SesionExpiradaError)) avisar('No se pudo analizar', e instanceof Error ? e.message : undefined);
    } finally {
      setAnalizando(false);
    }
  };

  if (!a && !iaActiva) return null; // IA no configurada en el servidor: no se muestra nada

  if (analizando || a?.estado === 'procesando') {
    return (
      <View style={[s.panel, { flexDirection: 'row', alignItems: 'center', gap: 10 }]}>
        <ActivityIndicator color={COLORES.azul} />
        <Text style={estilos.texto}>Analizando el comprobante con IA…</Text>
      </View>
    );
  }

  if (!a || a.estado === 'fallido') {
    return (
      <View style={[s.panel, { gap: 8 }]}>
        <Text style={estilos.subtitulo}>
          {a ? `No se pudo analizar: ${a.error ?? 'error desconocido'}` : 'Este comprobante aún no se analiza con IA.'}
        </Text>
        {iaActiva ? <Boton texto={a ? 'Reintentar análisis' : 'Analizar con IA'} tipo="secundario" icono="sparkles-outline" alPresionar={analizar} /> : null}
      </View>
    );
  }

  const sugerencia = a.sugerencia ? SUGERENCIAS[a.sugerencia] : null;
  return (
    <View style={[s.panel, sugerencia && { borderColor: sugerencia.color }]}>
      <View style={s.cabecera}>
        <Ionicons name="sparkles" size={16} color={COLORES.azul} />
        <Text style={s.titulo}>Revisión previa con IA</Text>
        {sugerencia ? (
          <View style={[s.sugerencia, { backgroundColor: sugerencia.fondo }]}>
            <Ionicons name={sugerencia.icono} size={14} color={sugerencia.color} />
            <Text style={[s.sugerenciaTexto, { color: sugerencia.color }]}>{sugerencia.texto}</Text>
          </View>
        ) : null}
      </View>

      <Datos a={a} />

      {(a.alertas ?? []).map((alerta) => (
        <View key={alerta.tipo} style={s.alerta}>
          <Ionicons name={alerta.gravedad === 'alta' ? 'warning' : 'information-circle'} size={16}
            color={alerta.gravedad === 'alta' ? COLORES.rojo : COLORES.ambar} />
          <Text style={[estilos.texto, { flex: 1, fontSize: 14 }]}>{alerta.mensaje}</Text>
        </View>
      ))}

      <View style={s.pie}>
        <Text style={[estilos.subtitulo, { fontSize: 11, flex: 1 }]}>
          {a.proveedor}{a.modelo ? ` · ${a.modelo}` : ''} · Es una ayuda: confirma tú en la foto.
        </Text>
        {iaActiva ? <Text style={s.enlace} onPress={analizar} accessibilityRole="button">Volver a analizar</Text> : null}
      </View>
    </View>
  );
}

function Datos({ a }: { a: Analisis }) {
  const filas: [string, string | null][] = [
    ['Monto', a.monto != null ? pesos(a.monto) : null],
    ['Desde', a.banco_origen],
    ['Hacia', [a.banco_destino, a.cuenta_destino].filter(Boolean).join(' · ') || null],
    ['Titular', a.titular_destino],
    ['N° operación', a.numero_operacion],
    ['Fecha', a.fecha_transferencia ? fechaHora(a.fecha_transferencia) : null],
  ];
  return (
    <View style={{ gap: 2 }}>
      {filas.map(([etiqueta, valor]) => (
        <View key={etiqueta} style={{ flexDirection: 'row', gap: 8 }}>
          <Text style={[estilos.subtitulo, { width: 92, marginTop: 0 }]}>{etiqueta}</Text>
          <Text style={[estilos.texto, { flex: 1, fontSize: 14 }, !valor && { color: COLORES.textoSuave }]}>{valor ?? 'no se leyó'}</Text>
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  panel: { borderWidth: 1, borderColor: COLORES.borde, borderRadius: 10, padding: 12, gap: 10, backgroundColor: '#fbfcfd' },
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  titulo: { fontWeight: 'bold', color: COLORES.texto, flex: 1 },
  sugerencia: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  sugerenciaTexto: { fontSize: 12, fontWeight: 'bold' },
  alerta: { flexDirection: 'row', gap: 6, alignItems: 'flex-start' },
  pie: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  enlace: { color: COLORES.azul, fontWeight: '600', fontSize: 13 },
});
