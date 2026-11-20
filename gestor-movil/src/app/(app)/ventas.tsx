import { useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';

import { TarjetaPedido } from '@/components/tarjeta-pedido';
import { Boton, COLORES, Encabezado, EstadoCarga, Pantalla, T, type NombreIcono } from '@/components/ui';
import { useDatos } from '@/hooks/use-datos';
import { ErrorDeApi, SesionExpiradaError } from '@/lib/api';
import { useSesion } from '@/lib/contexto-sesion';
import { avisar, confirmar } from '@/lib/formato';
import type { EstadoPedido, Pedido } from '@/lib/tipos';

const PESTANAS: { estado: EstadoPedido; titulo: string; vacio: string; icono: NombreIcono; fecha: keyof Pedido; etiquetaFecha: string }[] = [
  { estado: 'Aprobado', titulo: 'Por entregar', vacio: 'No hay pedidos pagados esperando retiro.', icono: 'bag-check-outline', fecha: 'fecha_aprobacion', etiquetaFecha: 'pago aprobado' },
  { estado: 'PorPagar', titulo: 'Por pagar', vacio: 'Ningún cliente tiene pedidos sin pagar.', icono: 'time-outline', fecha: 'fecha', etiquetaFecha: 'pidió' },
  { estado: 'Entregado', titulo: 'Entregados', vacio: 'Aún no hay pedidos entregados.', icono: 'checkmark-done-outline', fecha: 'fecha_entrega', etiquetaFecha: 'entregado' },
  { estado: 'Rechazado', titulo: 'Rechazados', vacio: 'No hay pagos rechazados.', icono: 'close-circle-outline', fecha: 'fecha_rechazo', etiquetaFecha: 'rechazado' },
];

/** Pedidos según su etapa: por entregar, por pagar e historial. */
export default function Ventas() {
  const [pestana, setPestana] = useState(PESTANAS[0]);

  return (
    <View style={{ flex: 1 }}>
      <Encabezado titulo="Ventas y entregas" />
      <View style={s.barra}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
          {PESTANAS.map((p) => {
            const activa = pestana.estado === p.estado;
            return (
              <TouchableOpacity key={p.estado} onPress={() => setPestana(p)} accessibilityRole="tab" accessibilityState={{ selected: activa }}
                style={[s.pestana, activa && s.pestanaActiva]}>
                <T variante="semi" estilo={{ fontSize: 13, color: activa ? '#ffffff' : COLORES.textoMedio }}>{p.titulo}</T>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
      {/* key: al cambiar de pestaña se monta una lista nueva con su propia carga */}
      <ListaPedidos key={pestana.estado} {...pestana} />
    </View>
  );
}

function ListaPedidos({ estado, vacio, icono, fecha, etiquetaFecha }: (typeof PESTANAS)[number]) {
  const { api } = useSesion();
  const { datos, setDatos, error, cargando, refrescando, recargar } = useDatos<Pedido[]>(`/pedidos?estado=${estado}`);
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
    <Pantalla refrescando={refrescando} alRefrescar={recargar}>
      <EstadoCarga cargando={cargando} error={error} alReintentar={recargar} vacio={datos?.length === 0} textoVacio={vacio} iconoVacio={icono}>
        {datos?.map((pedido) => (
          <TarjetaPedido
            key={pedido.id_pedido}
            pedido={pedido}
            fechaDestacada={{ etiqueta: etiquetaFecha, valor: pedido[fecha] as string | null }}
            acciones={estado === 'Aprobado' ? (
              <Boton texto="Marcar entregado" tipo="exito" icono="bag-check" estilo={{ flex: 1 }}
                cargando={procesando === pedido.id_pedido} desactivado={procesando !== null}
                alPresionar={() => entregar(pedido)} />
            ) : undefined}
          />
        ))}
      </EstadoCarga>
    </Pantalla>
  );
}

const s = StyleSheet.create({
  barra: { backgroundColor: '#ffffff', paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: COLORES.borde },
  pestana: { minHeight: 36, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: COLORES.bordeFuerte, justifyContent: 'center' },
  pestanaActiva: { backgroundColor: COLORES.texto, borderColor: COLORES.texto },
});
