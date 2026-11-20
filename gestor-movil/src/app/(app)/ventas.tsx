import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { TarjetaPedido } from '@/components/tarjeta-pedido';
import { Boton, COLORES, EstadoCarga, Pantalla, Titulo } from '@/components/ui';
import { useDatos } from '@/hooks/use-datos';
import { ErrorDeApi, SesionExpiradaError } from '@/lib/api';
import { useSesion } from '@/lib/contexto-sesion';
import { avisar, confirmar } from '@/lib/formato';
import type { EstadoPedido, Pedido } from '@/lib/tipos';

const PESTANAS: { estado: EstadoPedido; titulo: string; vacio: string; fecha: keyof Pedido; etiquetaFecha: string }[] = [
  { estado: 'Aprobado', titulo: 'Por entregar', vacio: 'No hay pedidos pagados esperando retiro.', fecha: 'fecha_aprobacion', etiquetaFecha: 'pago aprobado' },
  { estado: 'PorPagar', titulo: 'Por pagar', vacio: 'Ningún cliente tiene pedidos sin pagar.', fecha: 'fecha', etiquetaFecha: 'pedido' },
  { estado: 'Entregado', titulo: 'Entregados', vacio: 'Aún no hay pedidos entregados.', fecha: 'fecha_entrega', etiquetaFecha: 'entregado' },
  { estado: 'Rechazado', titulo: 'Rechazados', vacio: 'No hay pagos rechazados.', fecha: 'fecha_rechazo', etiquetaFecha: 'rechazado' },
];

/** Pedidos según su etapa: por entregar, por pagar e historial. */
export default function Ventas() {
  const [pestana, setPestana] = useState(PESTANAS[0]);

  return (
    <Pantalla>
      <Titulo>Ventas y entregas</Titulo>
      <View style={s.pestanas}>
        {PESTANAS.map((p) => (
          <TouchableOpacity key={p.estado} onPress={() => setPestana(p)}
            style={[s.pestana, pestana.estado === p.estado && s.pestanaActiva]}
            accessibilityRole="tab" accessibilityState={{ selected: pestana.estado === p.estado }}>
            <Text style={[s.pestanaTexto, pestana.estado === p.estado && { color: COLORES.verdeOscuro }]}>{p.titulo}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {/* key: al cambiar de pestaña se monta una lista nueva con su propia carga */}
      <ListaPedidos key={pestana.estado} {...pestana} />
    </Pantalla>
  );
}

function ListaPedidos({ estado, vacio, fecha, etiquetaFecha }: (typeof PESTANAS)[number]) {
  const { api } = useSesion();
  const { datos, setDatos, error, cargando, recargar } = useDatos<Pedido[]>(`/pedidos?estado=${estado}`);
  const [procesando, setProcesando] = useState<number | null>(null);

  const entregar = async (pedido: Pedido) => {
    if (!(await confirmar('Marcar como entregado', `¿El cliente ya retiró el pedido #${pedido.id_pedido}?`, 'Entregado'))) return;
    setProcesando(pedido.id_pedido);
    try {
      await api(`/pedidos/${pedido.id_pedido}/entregar`, { metodo: 'PUT' });
      setDatos((prev) => prev?.filter((p) => p.id_pedido !== pedido.id_pedido) ?? null);
    } catch (e) {
      if (e instanceof SesionExpiradaError) return;
      if (e instanceof ErrorDeApi && e.status === 409) recargar();
      avisar('No se pudo marcar como entregado', e instanceof Error ? e.message : undefined);
    } finally {
      setProcesando(null);
    }
  };

  return (
    <EstadoCarga cargando={cargando} error={error} alReintentar={recargar} vacio={datos?.length === 0} textoVacio={vacio}>
      {datos?.map((pedido) => (
        <TarjetaPedido
          key={pedido.id_pedido}
          pedido={pedido}
          fechaDestacada={{ etiqueta: etiquetaFecha, valor: pedido[fecha] as string | null }}
          acciones={estado === 'Aprobado' ? (
            <Boton texto="Marcar entregado" icono="bag-check" estilo={{ flex: 1 }}
              cargando={procesando === pedido.id_pedido} desactivado={procesando !== null}
              alPresionar={() => entregar(pedido)} />
          ) : undefined}
        />
      ))}
    </EstadoCarga>
  );
}

const s = StyleSheet.create({
  pestanas: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pestana: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: '#eef0f3' },
  pestanaActiva: { backgroundColor: COLORES.verdeFondo },
  pestanaTexto: { fontWeight: '600', color: COLORES.textoSuave },
});
