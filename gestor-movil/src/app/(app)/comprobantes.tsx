import { useEffect, useState } from 'react';

import { ModalRechazo } from '@/components/modal-rechazo';
import { PanelAnalisis } from '@/components/panel-analisis';
import { TarjetaPedido } from '@/components/tarjeta-pedido';
import { Boton, EstadoCarga, Pantalla, Titulo } from '@/components/ui';
import { useDatos } from '@/hooks/use-datos';
import { ErrorDeApi, SesionExpiradaError } from '@/lib/api';
import { useSesion } from '@/lib/contexto-sesion';
import { avisar, confirmar, pesos } from '@/lib/formato';
import type { Pedido, Resumen } from '@/lib/tipos';

// Primero lo que la IA marcó como sospechoso; dentro de cada grupo, el más antiguo primero
const PRIORIDAD = { rechazar: 0, revisar: 1, aprobar: 2 } as const;
const prioridad = (p: Pedido) => (p.analisis?.sugerencia ? PRIORIDAD[p.analisis.sugerencia] : 1);
const SEGUNDOS_ACTUALIZAR = 4;
// Un comprobante sin análisis solo se espera si llegó hace poco (si no, la IA no se activó para él)
const MS_ESPERAR_ANALISIS = 2 * 60 * 1000;
const esperaAnalisis = (p: Pedido, iaActiva: boolean) =>
  p.analisis?.estado === 'procesando' ||
  (iaActiva && !p.analisis && !!p.fecha_comprobante && Date.now() - new Date(p.fecha_comprobante).getTime() < MS_ESPERAR_ANALISIS);

/** Comprobantes recibidos por WhatsApp que esperan revisión. */
export default function Comprobantes() {
  const { api } = useSesion();
  const { datos, setDatos, error, cargando, refrescando, recargar, actualizar } = useDatos<Pedido[]>('/pedidos?estado=Pendiente');
  const resumen = useDatos<Resumen>('/resumen');
  const iaActiva = resumen.datos?.ia.activa ?? false;

  // Mientras la IA analiza en el servidor, la lista se actualiza sola cada pocos segundos
  const hayAnalisisEnCurso = !!datos?.some((p) => esperaAnalisis(p, iaActiva));
  useEffect(() => {
    if (!hayAnalisisEnCurso) return;
    const temporizador = setTimeout(actualizar, SEGUNDOS_ACTUALIZAR * 1000);
    return () => clearTimeout(temporizador);
  }, [hayAnalisisEnCurso, datos, actualizar]);

  const ordenados = datos ? [...datos].sort((a, b) => prioridad(a) - prioridad(b)) : null;
  const reemplazar = (pedido: Pedido) =>
    setDatos((prev) => prev?.map((p) => (p.id_pedido === pedido.id_pedido ? pedido : p)) ?? null);
  const [procesando, setProcesando] = useState<number | null>(null);
  const [rechazando, setRechazando] = useState<number | null>(null);

  const quitarDeLaLista = (id: number) => setDatos((prev) => prev?.filter((p) => p.id_pedido !== id) ?? null);

  /** Ejecuta una acción sobre un pedido y muestra el resultado. */
  const actuar = async (id: number, accion: () => Promise<Pedido & { notificado: boolean }>, exito: string) => {
    setProcesando(id);
    try {
      const pedido = await accion();
      quitarDeLaLista(id);
      avisar(exito, pedido.notificado
        ? 'Se le avisó al cliente por WhatsApp.'
        : 'No se pudo avisar al cliente por WhatsApp (el bot no está conectado). Avísale por otro medio.');
    } catch (e) {
      if (e instanceof SesionExpiradaError) return;
      // Si otra persona ya lo procesó, lo quitamos igual de la lista
      if (e instanceof ErrorDeApi && (e.status === 404 || e.status === 409)) quitarDeLaLista(id);
      avisar('No se pudo completar', e instanceof Error ? e.message : undefined);
    } finally {
      setProcesando(null);
    }
  };

  const aprobar = async (pedido: Pedido) => {
    const monto = pedido.total ? ` por ${pesos(pedido.total)}` : '';
    if (!(await confirmar('Aprobar pago', `¿Confirmas el pago del pedido #${pedido.id_pedido}${monto}?`, 'Aprobar'))) return;
    await actuar(pedido.id_pedido, () => api(`/pedidos/${pedido.id_pedido}/aprobar`, { metodo: 'PUT' }), 'Pago aprobado');
  };

  const rechazar = async (motivo: string) => {
    const id = rechazando;
    if (id == null) return;
    setRechazando(null);
    await actuar(id, () => api(`/pedidos/${id}/rechazar`, { metodo: 'PUT', cuerpo: { motivo } }), 'Pago rechazado');
  };

  return (
    <Pantalla refrescando={refrescando} alRefrescar={recargar}>
      <Titulo sub="Revisa que el monto y la cuenta de destino coincidan antes de aprobar">Comprobantes pendientes</Titulo>
      <EstadoCarga cargando={cargando} error={error} alReintentar={recargar}
        vacio={datos?.length === 0} textoVacio="No hay pagos pendientes por revisar.">
        {ordenados?.map((pedido) => (
          <TarjetaPedido
            key={pedido.id_pedido}
            pedido={pedido}
            mostrarComprobante
            fechaDestacada={{ etiqueta: 'comprobante recibido', valor: pedido.fecha_comprobante }}
            analisis={<PanelAnalisis pedido={pedido} iaActiva={iaActiva} alActualizar={reemplazar} />}
            acciones={
              <>
                <Boton texto="Rechazar" tipo="peligro" icono="close" estilo={{ flex: 1 }}
                  desactivado={procesando !== null} alPresionar={() => setRechazando(pedido.id_pedido)} />
                <Boton texto="Aprobar" icono="checkmark" estilo={{ flex: 1 }}
                  cargando={procesando === pedido.id_pedido} desactivado={procesando !== null}
                  alPresionar={() => aprobar(pedido)} />
              </>
            }
          />
        ))}
      </EstadoCarga>
      <ModalRechazo visible={rechazando !== null} idPedido={rechazando}
        alCancelar={() => setRechazando(null)} alConfirmar={rechazar} />
    </Pantalla>
  );
}
