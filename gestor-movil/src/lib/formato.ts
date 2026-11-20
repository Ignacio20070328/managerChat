import { Alert, Platform } from 'react-native';

import type { EstadoBot } from './tipos';

export const pesos = (monto: number | null | undefined) =>
  monto == null
    ? 'Sin monto'
    : new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(monto);

/** Fecha y hora en la zona horaria del teléfono (la API entrega UTC). */
export const fechaHora = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleString('es-CL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : '—';

/** "hace 5 min", "hace 2 h", "hace 3 días" */
export function hace(iso: string | null | undefined) {
  if (!iso) return '';
  const minutos = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutos < 1) return 'recién';
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.round(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;
  const dias = Math.round(horas / 24);
  return `hace ${dias} ${dias === 1 ? 'día' : 'días'}`;
}

/** Día de la semana corto a partir de "YYYY-MM-DD" (fecha local del negocio). */
export function diaCorto(dia: string) {
  const [a, m, d] = dia.split('-').map(Number);
  return new Date(a, m - 1, d).toLocaleDateString('es-CL', { weekday: 'short' }).replace('.', '');
}

export const TEXTO_ESTADO_BOT: Record<EstadoBot, { texto: string; textoCorto: string; color: string }> = {
  conectado: { texto: 'Conectado y recibiendo mensajes', textoCorto: 'WhatsApp conectado', color: '#1a7f37' },
  iniciando: { texto: 'Iniciando…', textoCorto: 'WhatsApp iniciando…', color: '#8a5a00' },
  esperando_qr: { texto: 'Esperando que se escanee el QR en el servidor', textoCorto: 'WhatsApp: falta escanear el QR', color: '#8a5a00' },
  desconectado: { texto: 'Desconectado: reinicia el servidor', textoCorto: 'WhatsApp desconectado', color: '#b42318' },
  error_autenticacion: { texto: 'Error de sesión: vuelve a vincular WhatsApp', textoCorto: 'WhatsApp: error de sesión', color: '#b42318' },
  desactivado: { texto: 'Desactivado en el servidor (BOT_DESACTIVADO=1)', textoCorto: 'WhatsApp desactivado', color: '#6b6266' },
};

/** "+56 9 1234 5678" para números chilenos; otros tal cual con "+". */
export function telefonoBonito(telefono: string) {
  if (telefono.startsWith('lid:')) return 'Número oculto por WhatsApp';
  const m = telefono.match(/^56(9)(\d{4})(\d{4})$/);
  return m ? `+56 ${m[1]} ${m[2]} ${m[3]}` : `+${telefono}`;
}

/** "Jueves 19 de noviembre" */
export function fechaLarga(fecha = new Date()) {
  const texto = fecha.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** Aviso simple que funciona en el teléfono y en la versión web. */
export function avisar(titulo: string, mensaje?: string) {
  if (Platform.OS === 'web') window.alert(mensaje ? `${titulo}\n\n${mensaje}` : titulo);
  else Alert.alert(titulo, mensaje);
}

/** Pide confirmación; resuelve true si la persona acepta. */
export function confirmar(titulo: string, mensaje: string, textoAceptar = 'Aceptar'): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(`${titulo}\n\n${mensaje}`));
  return new Promise((resolve) => {
    Alert.alert(titulo, mensaje, [
      { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
      { text: textoAceptar, onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) });
  });
}
