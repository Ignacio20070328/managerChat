import { useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ModalRechazo } from '@/components/modal-rechazo';
import { Boton, COLORES, Encabezado, EstadoCarga, Insignia, Pantalla, T, Tarjeta } from '@/components/ui';
import { useAccionesPedido } from '@/hooks/use-acciones-pedido';
import { useDatos } from '@/hooks/use-datos';
import { imagenProtegida, SesionExpiradaError } from '@/lib/api';
import { useSesion } from '@/lib/contexto-sesion';
import { avisar, fechaHora, hace, pesos, telefonoBonito } from '@/lib/formato';
import { COLOR_FILA, estadoFila, motivoDe, sugerenciaDe, SUGERENCIAS } from '@/lib/sugerencias';
import type { Analisis, Pedido, Resumen } from '@/lib/tipos';

const NOMBRE_ESTADO: Record<Pedido['estado'], string> = {
  PorPagar: 'Esperando pago', Pendiente: 'Por revisar', Aprobado: 'Aprobado', Rechazado: 'Rechazado', Entregado: 'Entregado',
};

/** Revisión de un comprobante: lo que se pidió frente a lo que dice la foto. */
export default function DetalleComprobante() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token, api } = useSesion();
  const { datos: pedido, setDatos, error, cargando, refrescando, recargar } = useDatos<Pedido>(`/pedidos/${id}`);
  const resumen = useDatos<Resumen>('/resumen');
  const { aprobar, rechazar, procesando } = useAccionesPedido();
  const { bottom } = useSafeAreaInsets();
  const [fotoGrande, setFotoGrande] = useState(false);
  const [rechazando, setRechazando] = useState(false);
  const [analizando, setAnalizando] = useState(false);

  const pendiente = pedido?.estado === 'Pendiente';
  const iaActiva = resumen.datos?.ia.activa ?? false;

  const alAprobar = async () => {
    if (pedido && (await aprobar(pedido))) router.back();
  };
  const alRechazar = async (motivo: string) => {
    setRechazando(false);
    if (pedido && (await rechazar(pedido.id_pedido, motivo))) router.back();
  };
  const analizar = async () => {
    setAnalizando(true);
    try {
      setDatos(await api<Pedido>(`/pedidos/${id}/analizar`, { metodo: 'POST' }));
    } catch (e) {
      if (!(e instanceof SesionExpiradaError)) avisar('No se pudo analizar', e instanceof Error ? e.message : undefined);
    } finally {
      setAnalizando(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Encabezado volver titulo={`Pedido #${id}`}
        subtitulo={pedido ? `${telefonoBonito(pedido.telefono)} · recibido ${hace(pedido.fecha_comprobante)}` : undefined} />

      <Pantalla refrescando={refrescando} alRefrescar={recargar} espacioInferior={pendiente ? 120 : 32}>
        <EstadoCarga cargando={cargando} error={error} alReintentar={recargar}>
          {pedido ? (
            <>
              {!pendiente ? (
                <Tarjeta estilo={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Ionicons name="information-circle" size={22} color={COLORES.textoSuave} />
                  <T variante="semi" estilo={{ flex: 1 }}>Este pedido ya no está por revisar: está «{NOMBRE_ESTADO[pedido.estado]}».</T>
                </Tarjeta>
              ) : null}

              <AvisoSugerencia pedido={pedido} />

              <View style={s.fila}>
                {pedido.ruta_comprobante && token ? (
                  <TouchableOpacity onPress={() => setFotoGrande(true)} style={s.foto} accessibilityRole="button" accessibilityLabel="Ver la foto del comprobante en grande">
                    <Image source={imagenProtegida(pedido.ruta_comprobante, token)} style={{ flex: 1 }} resizeMode="cover" />
                    <View style={s.ampliar}>
                      <Ionicons name="expand" size={14} color="#ffffff" />
                      <T variante="fuerte" estilo={{ color: '#ffffff', fontSize: 12 }}>Ampliar</T>
                    </View>
                  </TouchableOpacity>
                ) : null}
                <Tarjeta estilo={{ flex: 1, gap: 6 }}>
                  <T variante="etiqueta">El pedido</T>
                  {pedido.items.length ? pedido.items.map((item) => (
                    <T key={item.id_producto} estilo={{ fontSize: 14 }}>{item.cantidad} × {item.nombre}</T>
                  )) : (
                    <T variante="suave">El cliente no pidió por el bot: confirma con él qué compró.</T>
                  )}
                  <T variante="titulo" estilo={{ fontSize: 20, marginTop: 'auto' }}>{pesos(pedido.total)}</T>
                </Tarjeta>
              </View>

              {pedido.analisis?.estado === 'completado' ? (
                <Comparacion pedido={pedido} analisis={pedido.analisis} />
              ) : (
                <Tarjeta estilo={{ gap: 10 }}>
                  <T variante="fuerte">Revisión de la IA</T>
                  <T variante="suave">
                    {analizando || pedido.analisis?.estado === 'procesando' ? 'La IA está leyendo el comprobante…'
                      : pedido.analisis?.estado === 'fallido' ? `No se pudo analizar: ${pedido.analisis.error ?? 'error desconocido'}`
                      : iaActiva ? 'Este comprobante aún no se revisa con IA.'
                      : 'La revisión con IA no está activada en el servidor. Revisa la foto con atención.'}
                  </T>
                  {iaActiva && pendiente ? (
                    <Boton texto={pedido.analisis ? 'Reintentar' : 'Revisar con IA'} tipo="secundario" icono="sparkles-outline"
                      alPresionar={analizar} cargando={analizando} />
                  ) : null}
                </Tarjeta>
              )}

              {pedido.analisis?.estado === 'completado' && iaActiva && pendiente ? (
                <TouchableOpacity onPress={analizar} disabled={analizando} accessibilityRole="button" style={{ alignSelf: 'center', padding: 8 }}>
                  <T variante="semi" estilo={{ color: COLORES.textoSuave, fontSize: 13, textDecorationLine: 'underline' }}>
                    {analizando ? 'Revisando de nuevo…' : 'Volver a revisar con IA'}
                  </T>
                </TouchableOpacity>
              ) : null}
            </>
          ) : null}
        </EstadoCarga>
      </Pantalla>

      {pedido && pendiente ? (
        <View style={[s.acciones, { paddingBottom: bottom + 14 }]}>
          <Boton texto="Rechazar" tipo="peligro" icono="close" grande estilo={{ flex: 1 }}
            alPresionar={() => setRechazando(true)} desactivado={procesando !== null} />
          <Boton texto="Aprobar" tipo="exito" icono="checkmark" grande estilo={{ flex: 1 }}
            alPresionar={alAprobar} cargando={procesando === pedido.id_pedido} desactivado={procesando !== null} />
        </View>
      ) : null}

      {pedido?.ruta_comprobante && token ? (
        <Modal visible={fotoGrande} transparent animationType="fade" onRequestClose={() => setFotoGrande(false)}>
          <Pressable style={s.fondoFoto} onPress={() => setFotoGrande(false)} accessibilityRole="button" accessibilityLabel="Cerrar foto">
            <Image source={imagenProtegida(pedido.ruta_comprobante, token)} style={{ width: '100%', height: '85%' }} resizeMode="contain" />
            <T variante="semi" estilo={{ color: '#ffffff' }}>Toca para cerrar</T>
          </Pressable>
        </Modal>
      ) : null}

      <ModalRechazo visible={rechazando} idPedido={pedido?.id_pedido ?? null}
        alCancelar={() => setRechazando(false)} alConfirmar={alRechazar} />
    </View>
  );
}

function AvisoSugerencia({ pedido }: { pedido: Pedido }) {
  const sugerencia = sugerenciaDe(pedido);
  if (sugerencia === 'sin_analisis') return null;
  const estilo = SUGERENCIAS[sugerencia];
  return (
    <View style={[s.aviso, { backgroundColor: estilo.fondo }]}>
      <Ionicons name={estilo.icono} size={22} color={estilo.color} />
      <View style={{ flex: 1, gap: 2 }}>
        <T variante="fuerte" estilo={{ color: estilo.color }}>{estilo.etiqueta}: {motivoDe(pedido)}</T>
        <T estilo={{ color: estilo.color, fontSize: 12 }}>Sugerencia de la IA. La decisión final es tuya.</T>
      </View>
    </View>
  );
}

function Comparacion({ pedido, analisis: a }: { pedido: Pedido; analisis: Analisis }) {
  const filas = [
    { dato: 'Monto', esperado: pedido.total ? pesos(pedido.total) : '—', leido: a.monto != null ? pesos(a.monto) : null, estado: estadoFila(a, 'monto', a.monto) },
    { dato: 'Cuenta destino', esperado: 'la tuya', leido: a.cuenta_destino, estado: estadoFila(a, 'cuenta', a.cuenta_destino) },
    { dato: 'Fecha', esperado: fechaHora(pedido.fecha_comprobante), leido: a.fecha_transferencia ? fechaHora(a.fecha_transferencia) : null, estado: estadoFila(a, 'fecha', a.fecha_transferencia) },
    { dato: 'N° operación', esperado: 'no repetido', leido: a.numero_operacion, estado: estadoFila(a, 'operacion', a.numero_operacion) },
  ];
  const otrasAlertas = (a.alertas ?? []).filter((x) => x.mensaje !== motivoDe(pedido));

  return (
    <Tarjeta estilo={{ padding: 0, overflow: 'hidden' }}>
      <View style={[s.filaTabla, { backgroundColor: COLORES.superficie }]}>
        <T variante="etiqueta" estilo={s.celda}>Dato</T>
        <T variante="etiqueta" estilo={s.celda}>Pedido</T>
        <T variante="etiqueta" estilo={s.celda}>Comprobante</T>
      </View>
      {filas.map((f) => {
        const c = COLOR_FILA[f.estado];
        return (
          <View key={f.dato} style={[s.filaTabla, { backgroundColor: c.fondo, borderTopWidth: 1, borderTopColor: COLORES.borde }]}
            accessible accessibilityLabel={`${f.dato}: pedido ${f.esperado}, comprobante ${f.leido ?? 'no se leyó'}, ${c.texto}`}>
            <T variante="semi" estilo={[s.celda, { fontSize: 13 }]}>{f.dato}</T>
            <T variante="fuerte" estilo={[s.celda, { fontSize: 13 }]}>{f.esperado}</T>
            <View style={[s.celda, { flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
              {c.icono ? <Ionicons name={c.icono} size={15} color={c.color} /> : null}
              <T variante="fuerte" estilo={{ fontSize: 13, color: c.color, flexShrink: 1 }}>{f.leido ?? 'no se leyó'}</T>
            </View>
          </View>
        );
      })}
      {otrasAlertas.length ? (
        <View style={{ padding: 12, gap: 6, borderTopWidth: 1, borderTopColor: COLORES.borde }}>
          {otrasAlertas.map((x) => (
            <View key={x.tipo} style={{ flexDirection: 'row', gap: 6 }}>
              <Ionicons name={x.gravedad === 'alta' ? 'warning' : 'information-circle'} size={16} color={x.gravedad === 'alta' ? COLORES.rojo : COLORES.ambar} />
              <T estilo={{ fontSize: 13, flex: 1 }}>{x.mensaje}</T>
            </View>
          ))}
        </View>
      ) : null}
      <View style={{ padding: 12, borderTopWidth: 1, borderTopColor: COLORES.borde, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Insignia texto={`IA: ${a.proveedor ?? '—'}`} color={COLORES.textoSuave} fondo="#eef0f3" />
        <T variante="suave" estilo={{ fontSize: 12, flex: 1 }}>Si algo no se ve igual en la foto, manda lo que dice la foto.</T>
      </View>
    </Tarjeta>
  );
}

const s = StyleSheet.create({
  fila: { flexDirection: 'row', gap: 12 },
  foto: { width: 118, minHeight: 150, borderRadius: 14, overflow: 'hidden', backgroundColor: '#f3eef0', borderWidth: 1, borderColor: COLORES.bordeFuerte },
  ampliar: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 6, backgroundColor: 'rgba(31,26,28,0.72)' },
  aviso: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 16, padding: 14 },
  filaTabla: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, gap: 6 },
  celda: { flex: 1 },
  acciones: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 12, backgroundColor: '#ffffff', borderTopWidth: 1, borderTopColor: COLORES.borde },
  fondoFoto: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 12 },
});
