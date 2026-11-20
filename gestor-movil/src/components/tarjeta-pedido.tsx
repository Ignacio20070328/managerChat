import type { ReactNode } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { COLORES, Insignia, Tarjeta, estilos } from '@/components/ui';
import { imagenProtegida } from '@/lib/api';
import { useSesion } from '@/lib/contexto-sesion';
import { fechaHora, hace, pesos, telefonoLegible } from '@/lib/formato';
import type { Pedido } from '@/lib/tipos';

/** Tarjeta de un pedido: cliente, productos, total, comprobante y acciones. */
export function TarjetaPedido({ pedido, mostrarComprobante = false, fechaDestacada, acciones }: {
  pedido: Pedido;
  mostrarComprobante?: boolean;
  fechaDestacada: { etiqueta: string; valor: string | null };
  acciones?: ReactNode;
}) {
  const { token } = useSesion();

  return (
    <Tarjeta estilo={{ gap: 10 }}>
      <View style={s.fila}>
        <View style={{ flex: 1 }}>
          <Text style={s.cliente}>{telefonoLegible(pedido.telefono)}</Text>
          <Text style={estilos.subtitulo}>
            Pedido #{pedido.id_pedido} · {fechaDestacada.etiqueta} {hace(fechaDestacada.valor)}
          </Text>
        </View>
        <Text style={s.total}>{pesos(pedido.total)}</Text>
      </View>

      {pedido.items.length > 0 ? (
        <View style={s.items}>
          {pedido.items.map((item) => (
            <Text key={item.id_producto} style={estilos.texto}>
              {item.cantidad} × {item.nombre} <Text style={estilos.subtitulo}>· {pesos(item.cantidad * item.precio_unitario)}</Text>
            </Text>
          ))}
        </View>
      ) : (
        <Insignia texto="Comprobante sin pedido previo: revisa el monto en la foto" color={COLORES.ambar} fondo={COLORES.ambarFondo} />
      )}

      {pedido.motivo_rechazo ? (
        <Text style={[estilos.texto, { color: COLORES.rojo }]}>Motivo: {pedido.motivo_rechazo}</Text>
      ) : null}

      {mostrarComprobante && pedido.ruta_comprobante && token ? (
        <Image
          source={imagenProtegida(pedido.ruta_comprobante, token)}
          style={s.imagen}
          resizeMode="contain"
          accessibilityLabel={`Comprobante del pedido ${pedido.id_pedido}`}
        />
      ) : null}

      <Text style={[estilos.subtitulo, { fontSize: 12 }]}>
        {fechaDestacada.etiqueta.charAt(0).toUpperCase() + fechaDestacada.etiqueta.slice(1)}: {fechaHora(fechaDestacada.valor)}
      </Text>

      {acciones ? <View style={s.acciones}>{acciones}</View> : null}
    </Tarjeta>
  );
}

const s = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  cliente: { fontSize: 16, fontWeight: 'bold', color: COLORES.texto },
  total: { fontSize: 18, fontWeight: 'bold', color: COLORES.verdeOscuro },
  items: { backgroundColor: '#f6f8fa', borderRadius: 8, padding: 10, gap: 4 },
  imagen: { width: '100%', height: 320, borderRadius: 10, backgroundColor: '#eef0f3' },
  acciones: { flexDirection: 'row', gap: 10 },
});
