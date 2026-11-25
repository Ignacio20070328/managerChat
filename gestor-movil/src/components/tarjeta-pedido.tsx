import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { COLORES, T, Tarjeta } from '@/components/ui';
import { fechaHora, hace, pesos, telefonoBonito } from '@/lib/formato';
import type { Pedido } from '@/lib/tipos';

/** Tarjeta de un pedido (Ventas): cliente, productos, total, fecha de la etapa y acciones. */
export function TarjetaPedido({ pedido, fechaDestacada, acciones }: {
  pedido: Pedido;
  fechaDestacada: { etiqueta: string; valor: string | null };
  acciones?: ReactNode;
}) {
  return (
    <Tarjeta estilo={{ gap: 10 }}>
      <View style={s.fila}>
        <View style={{ flex: 1, gap: 2 }}>
          <T variante="fuerte" lineas={1}>{telefonoBonito(pedido.telefono)}</T>
          <T variante="suave" estilo={{ fontSize: 12 }}>
            Pedido #{pedido.id_pedido} · {fechaDestacada.etiqueta} {hace(fechaDestacada.valor)}
          </T>
        </View>
        <T variante="cifra" estilo={{ fontSize: 18 }}>{pesos(pedido.total)}</T>
      </View>

      {pedido.items.length > 0 ? (
        <View style={s.items}>
          {pedido.items.map((item) => (
            <View key={item.id_producto} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
              <T estilo={{ fontSize: 14, flex: 1 }}>{item.cantidad} × {item.nombre}</T>
              <T variante="suave">{pesos(item.cantidad * item.precio_unitario)}</T>
            </View>
          ))}
        </View>
      ) : (
        <T variante="suave">Comprobante sin pedido por WhatsApp.</T>
      )}

      {pedido.cancelacion_solicitada && (pedido.estado === 'Pendiente' || pedido.estado === 'Aprobado') ? (
        <AvisoCancelacion pedido={pedido} />
      ) : null}
      {pedido.estado === 'Cancelado' ? (
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <Ionicons name="ban" size={16} color={COLORES.textoSuave} />
          <T variante="semi" estilo={{ fontSize: 14, color: COLORES.textoMedio, flex: 1 }}>
            Cancelado {pedido.cancelado_por === 'cliente' ? 'por el cliente' : 'por ti'}
            {pedido.ruta_comprobante ? ' · había enviado su pago' : ''}
          </T>
        </View>
      ) : null}

      {pedido.motivo_rechazo ? (
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <Ionicons name="close-circle" size={16} color={COLORES.rojo} />
          <T estilo={{ fontSize: 14, color: COLORES.rojo, flex: 1 }}>{pedido.motivo_rechazo}</T>
        </View>
      ) : null}

      <T variante="suave" estilo={{ fontSize: 12 }}>
        {fechaDestacada.etiqueta.charAt(0).toUpperCase() + fechaDestacada.etiqueta.slice(1)}: {fechaHora(fechaDestacada.valor)}
      </T>

      {acciones ? <View style={{ flexDirection: 'row', gap: 10 }}>{acciones}</View> : null}
    </Tarjeta>
  );
}

/** El cliente pidió cancelar un pedido que ya pagó: lo decide el dueño. */
export function AvisoCancelacion({ pedido }: { pedido: Pedido }) {
  return (
    <View style={s.aviso}>
      <Ionicons name="warning" size={18} color={COLORES.ambar} />
      <View style={{ flex: 1, gap: 2 }}>
        <T variante="fuerte" estilo={{ fontSize: 14, color: COLORES.ambar }}>El cliente pidió cancelar · {hace(pedido.cancelacion_solicitada)}</T>
        <T variante="suave" estilo={{ fontSize: 12 }}>Ya envió su pago. Si lo cancelas, coordina con él la devolución del dinero.</T>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  aviso: { flexDirection: 'row', gap: 8, padding: 10, borderRadius: 10, backgroundColor: COLORES.ambarFondo },
  fila: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  items: { backgroundColor: COLORES.superficie, borderRadius: 10, padding: 10, gap: 4 },
});
