import { useState } from 'react';

import { ErrorDeApi, SesionExpiradaError } from '@/lib/api';
import { useSesion } from '@/lib/contexto-sesion';
import { avisar, confirmar, pesos } from '@/lib/formato';
import type { Pedido } from '@/lib/tipos';

/**
 * Aprobar y rechazar pagos, con confirmación y aviso del resultado.
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

  return { aprobar, rechazar, procesando };
}
