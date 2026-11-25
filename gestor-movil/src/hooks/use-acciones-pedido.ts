import { useState } from 'react';

import { ErrorDeApi, SesionExpiradaError } from '@/lib/api';
import { useSesion } from '@/lib/contexto-sesion';
import { avisar, confirmar, pesos } from '@/lib/formato';
import type { Pedido } from '@/lib/tipos';

/**
 * Aprobar y rechazar pagos, y cancelar o mantener pedidos, con confirmación y aviso del resultado.
 * Cada acción resuelve `true` si el pedido ya no está pendiente (se puede sacar de la lista).
 */
export function useAccionesPedido() {
  const { api } = useSesion();
  const [procesando, setProcesando] = useState<number | null>(null);

  async function ejecutar(id: number, accion: () => Promise<Pedido & { notificado: boolean }>, exito: string) {
    setProcesando(id);
    try {
      const pedido = await accion();
      avisar(exito, pedido.notificado
        ? 'Se le avisó al cliente por WhatsApp.'
        : 'No se pudo avisar al cliente por WhatsApp (el bot no está conectado). Avísale por otro medio.');
      return true;
    } catch (e) {
      if (e instanceof SesionExpiradaError) return false;
      avisar('No se pudo completar', e instanceof Error ? e.message : undefined);
      // Si otra persona ya lo procesó o no existe, igual deja de estar pendiente
      return e instanceof ErrorDeApi && (e.status === 404 || e.status === 409);
    } finally {
      setProcesando(null);
    }
  }

  async function aprobar(pedido: Pedido) {
    const monto = pedido.total ? ` por ${pesos(pedido.total)}` : '';
    if (!(await confirmar('Aprobar pago', `¿Confirmas el pago del pedido #${pedido.id_pedido}${monto}? Se le avisará al cliente.`, 'Aprobar'))) {
      return false;
    }
    return ejecutar(pedido.id_pedido, () => api(`/pedidos/${pedido.id_pedido}/aprobar`, { metodo: 'PUT' }), 'Pago aprobado');
  }

  function rechazar(id: number, motivo: string) {
    return ejecutar(id, () => api(`/pedidos/${id}/rechazar`, { metodo: 'PUT', cuerpo: { motivo } }), 'Pago rechazado');
  }

  async function cancelar(pedido: Pedido) {
    const pagado = !!pedido.ruta_comprobante;
    const detalle = pagado
      ? ' El cliente ya envió su pago: tendrás que devolverle el dinero por tu cuenta.'
      : ' El cliente aún no ha pagado.';
    if (!(await confirmar('Cancelar pedido', `¿Cancelar el pedido #${pedido.id_pedido}?${detalle} Se le avisará al cliente.`, 'Cancelar pedido'))) {
      return false;
    }
    return ejecutar(pedido.id_pedido, () => api(`/pedidos/${pedido.id_pedido}/cancelar`, { metodo: 'PUT' }), 'Pedido cancelado');
  }

  async function mantener(pedido: Pedido) {
    if (!(await confirmar('Seguir con el pedido', `El pedido #${pedido.id_pedido} sigue activo y se le avisará al cliente. Te recomendamos escribirle para explicarle.`, 'Seguir con el pedido'))) {
      return false;
    }
    return ejecutar(pedido.id_pedido, () => api(`/pedidos/${pedido.id_pedido}/mantener`, { metodo: 'PUT' }), 'Pedido mantenido');
  }

  return { aprobar, rechazar, cancelar, mantener, procesando };
}
