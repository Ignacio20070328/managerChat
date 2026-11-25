import { useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { TarjetaPedido } from '@/components/tarjeta-pedido';
import { Boton, COLORES, Encabezado, EstadoCarga, Pantalla, T, type NombreIcono } from '@/components/ui';
import { useAccionesPedido } from '@/hooks/use-acciones-pedido';
import { useDatos } from '@/hooks/use-datos';
import { ErrorDeApi, SesionExpiradaError } from '@/lib/api';
import { useSesion } from '@/lib/contexto-sesion';
import { avisar, confirmar } from '@/lib/formato';
import type { Pedido } from '@/lib/tipos';

type Clave = 'Aprobado' | 'cancelar' | 'PorPagar' | 'Entregado' | 'Rechazado' | 'Cancelado';

const PESTANAS: { clave: Clave; ruta: string; titulo: string; vacio: string; icono: NombreIcono; fecha: keyof Pedido; etiquetaFecha: string }[] = [
  { clave: 'Aprobado', ruta: '/pedidos?estado=Aprobado', titulo: 'Por entregar', vacio: 'No hay pedidos pagados esperando retiro.', icono: 'bag-check-outline', fecha: 'fecha_aprobacion', etiquetaFecha: 'pago aprobado' },
  { clave: 'cancelar', ruta: '/pedidos?cancelacion=solicitada', titulo: 'Pidieron cancelar', vacio: 'Ningún cliente ha pedido cancelar un pedido pagado.', icono: 'warning-outline', fecha: 'cancelacion_solicitada', etiquetaFecha: 'pidió cancelar' },
  { clave: 'PorPagar', ruta: '/pedidos?estado=PorPagar', titulo: 'Por pagar', vacio: 'Ningún cliente tiene pedidos sin pagar.', icono: 'time-outline', fecha: 'fecha', etiquetaFecha: 'pidió' },
  { clave: 'Entregado', ruta: '/pedidos?estado=Entregado', titulo: 'Entregados', vacio: 'Aún no hay pedidos entregados.', icono: 'checkmark-done-outline', fecha: 'fecha_entrega', etiquetaFecha: 'entregado' },
  { clave: 'Rechazado', ruta: '/pedidos?estado=Rechazado', titulo: 'Rechazados', vacio: 'No hay pagos rechazados.', icono: 'close-circle-outline', fecha: 'fecha_rechazo', etiquetaFecha: 'rechazado' },
  { clave: 'Cancelado', ruta: '/pedidos?estado=Cancelado', titulo: 'Cancelados', vacio: 'No hay pedidos cancelados.', icono: 'ban-outline', fecha: 'fecha_cancelacion', etiquetaFecha: 'cancelado' },
];

/** Pedidos según su etapa: por entregar, cancelaciones pedidas, por pagar e historial. */
export default function Ventas() {
  // ?pestana=cancelar abre directamente esa pestaña (desde el aviso de Inicio)
  const { pestana: inicial } = useLocalSearchParams<{ pestana?: string }>();
  const [pestana, setPestana] = useState(PESTANAS.find((p) => p.clave === inicial) ?? PESTANAS[0]);
  // La pantalla puede seguir montada en el menú lateral: si llega otra pestaña por parámetro, se cambia
  // (ajuste durante el render, como recomienda React, en vez de un efecto)
  const [parametroPrevio, setParametroPrevio] = useState(inicial);
  if (inicial !== parametroPrevio) {
    setParametroPrevio(inicial);
    const pedida = PESTANAS.find((p) => p.clave === inicial);
    if (pedida) setPestana(pedida);
  }

  return (
    <View style={{ flex: 1 }}>
      <Encabezado titulo="Ventas y entregas" />
      <View style={s.barra}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
          {PESTANAS.map((p) => {
            const activa = pestana.clave === p.clave;
            return (
              <TouchableOpacity key={p.clave} onPress={() => setPestana(p)} accessibilityRole="tab" accessibilityState={{ selected: activa }}
                style={[s.pestana, activa && s.pestanaActiva]}>
                <T variante="semi" estilo={{ fontSize: 13, color: activa ? '#ffffff' : COLORES.textoMedio }}>{p.titulo}</T>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
      {/* key: al cambiar de pestaña se monta una lista nueva con su propia carga */}
      <ListaPedidos key={pestana.clave} {...pestana} />
    </View>
  );
}

function ListaPedidos({ clave, ruta, vacio, icono, fecha, etiquetaFecha }: (typeof PESTANAS)[number]) {
  const { api } = useSesion();
  const { datos, setDatos, error, cargando, refrescando, recargar } = useDatos<Pedido[]>(ruta);
  const { cancelar, mantener, procesando: procesandoAccion } = useAccionesPedido();
  const [entregando, setEntregando] = useState<number | null>(null);
  const procesando = entregando ?? procesandoAccion;

  const quitar = (id: number) => setDatos((prev) => prev?.filter((p) => p.id_pedido !== id) ?? null);

  const entregar = async (pedido: Pedido) => {
    if (!(await confirmar('Marcar como entregado', `¿El cliente ya retiró el pedido #${pedido.id_pedido}?`, 'Entregado'))) return;
    setEntregando(pedido.id_pedido);
    try {
      await api(`/pedidos/${pedido.id_pedido}/entregar`, { metodo: 'PUT' });
      quitar(pedido.id_pedido);
    } catch (e) {
      if (e instanceof SesionExpiradaError) return;
      if (e instanceof ErrorDeApi && e.status === 409) recargar();
      avisar('No se pudo marcar como entregado', e instanceof Error ? e.message : undefined);
    } finally {
      setEntregando(null);
    }
  };

  const alCancelar = async (pedido: Pedido) => { if (await cancelar(pedido)) quitar(pedido.id_pedido); };
  // "Seguir con el pedido": en "Pidieron cancelar" sale de la lista; en las demás solo se quita el aviso
  const alMantener = async (pedido: Pedido) => {
    if (!(await mantener(pedido))) return;
    if (clave === 'cancelar') quitar(pedido.id_pedido);
    else recargar();
  };

  const acciones = (pedido: Pedido) => {
    const bloqueado = procesando !== null;
    const cargando = procesando === pedido.id_pedido;
    if (pedido.cancelacion_solicitada && (pedido.estado === 'Pendiente' || pedido.estado === 'Aprobado')) {
      return (
        <>
          <Boton texto="Seguir con él" tipo="secundario" estilo={{ flex: 1 }} desactivado={bloqueado} alPresionar={() => alMantener(pedido)} />
          <Boton texto="Cancelar pedido" tipo="peligro" icono="ban" estilo={{ flex: 1 }}
            cargando={cargando} desactivado={bloqueado} alPresionar={() => alCancelar(pedido)} />
        </>
      );
    }
    if (clave === 'Aprobado') {
      return (
        <Boton texto="Marcar entregado" tipo="exito" icono="bag-check" estilo={{ flex: 1 }}
          cargando={cargando} desactivado={bloqueado} alPresionar={() => entregar(pedido)} />
      );
    }
    if (clave === 'PorPagar') {
      return (
        <Boton texto="Cancelar pedido" tipo="secundario" icono="ban" estilo={{ flex: 1 }}
          cargando={cargando} desactivado={bloqueado} alPresionar={() => alCancelar(pedido)} />
      );
    }
    return undefined;
  };

  return (
    <Pantalla refrescando={refrescando} alRefrescar={recargar}>
      <EstadoCarga cargando={cargando} error={error} alReintentar={recargar} vacio={datos?.length === 0} textoVacio={vacio} iconoVacio={icono}>
        {datos?.map((pedido) => (
          <TarjetaPedido
            key={pedido.id_pedido}
            pedido={pedido}
            fechaDestacada={{ etiqueta: etiquetaFecha, valor: pedido[fecha] as string | null }}
            acciones={acciones(pedido)}
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
