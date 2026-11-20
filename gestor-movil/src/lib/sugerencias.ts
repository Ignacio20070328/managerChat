import type { NombreIcono } from '@/components/ui';
import type { Analisis, Pedido } from './tipos';

export type Sugerencia = 'rechazar' | 'revisar' | 'aprobar' | 'sin_analisis';

/** Cómo se muestra cada sugerencia de la IA (la decisión siempre es de la persona). */
export const SUGERENCIAS: Record<Sugerencia, { etiqueta: string; color: string; fondo: string; icono: NombreIcono; orden: number }> = {
  rechazar: { etiqueta: 'Sospechoso', color: '#b42318', fondo: '#fdecea', icono: 'warning', orden: 0 },
  revisar: { etiqueta: 'Revisar', color: '#8a5a00', fondo: '#fff4dc', icono: 'alert-circle', orden: 1 },
  sin_analisis: { etiqueta: 'Sin revisión de IA', color: '#59636e', fondo: '#eef0f3', icono: 'help-circle', orden: 2 },
  aprobar: { etiqueta: 'Todo coincide', color: '#1a7f37', fondo: '#e6f4ea', icono: 'checkmark-circle', orden: 3 },
};

export function sugerenciaDe(pedido: Pedido): Sugerencia {
  const a = pedido.analisis;
  return a?.estado === 'completado' && a.sugerencia ? a.sugerencia : 'sin_analisis';
}

/** Frase corta que explica la sugerencia (la alerta más grave, o un texto por defecto). */
export function motivoDe(pedido: Pedido): string {
  const a = pedido.analisis;
  if (!a || a.estado === 'procesando') return a ? 'La IA está revisando el comprobante…' : 'Revisa la foto antes de aprobar.';
  if (a.estado === 'fallido') return 'La IA no pudo revisarlo: revisa la foto antes de aprobar.';
  const alertas = [...(a.alertas ?? [])].sort((x, y) => (x.gravedad === 'alta' ? -1 : 1) - (y.gravedad === 'alta' ? -1 : 1));
  if (alertas.length) return alertas[0].mensaje;
  return 'El monto y la cuenta de destino coinciden con el pedido.';
}

// --- Tabla "Pedido vs. Comprobante" del detalle ---

export type EstadoFila = 'ok' | 'aviso' | 'mal' | 'neutro';

/** Qué fila de la comparación afecta cada tipo de alerta (ver servicios/analisis.js del backend). */
const FILA_DE_ALERTA: Record<string, 'monto' | 'cuenta' | 'fecha' | 'operacion'> = {
  monto_menor: 'monto', monto_mayor: 'monto', monto_ilegible: 'monto', pedido_sin_total: 'monto',
  cuenta_distinta: 'cuenta', cuenta_ilegible: 'cuenta', sin_cuenta_configurada: 'cuenta',
  fecha_antigua: 'fecha', fecha_futura: 'fecha',
  operacion_repetida: 'operacion', operacion_reutilizada_despues: 'operacion',
};

/** Estado de una fila: la alerta más grave que la afecta; sin alertas, ok si se leyó el dato. */
export function estadoFila(a: Analisis, fila: 'monto' | 'cuenta' | 'fecha' | 'operacion', leido: unknown): EstadoFila {
  const alertas = (a.alertas ?? []).filter((x) => FILA_DE_ALERTA[x.tipo] === fila);
  if (alertas.some((x) => x.gravedad === 'alta')) return 'mal';
  if (alertas.length) return 'aviso';
  return leido == null ? 'neutro' : 'ok';
}

export const COLOR_FILA: Record<EstadoFila, { color: string; fondo: string; icono: NombreIcono | null; texto: string }> = {
  ok: { color: '#1a7f37', fondo: '#ffffff', icono: 'checkmark', texto: 'coincide' },
  aviso: { color: '#8a5a00', fondo: '#fffaf0', icono: 'alert', texto: 'revisar' },
  mal: { color: '#b42318', fondo: '#fdf3f2', icono: 'close', texto: 'no coincide' },
  neutro: { color: '#6b6266', fondo: '#ffffff', icono: null, texto: 'sin dato' },
};
