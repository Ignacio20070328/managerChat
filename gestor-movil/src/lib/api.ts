// Dirección del servidor. Se define en gestor-movil/.env.local (ver .env.example).
// No es un secreto: las variables EXPO_PUBLIC_* quedan visibles dentro de la app.
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/+$/, '');

/** El servidor rechazó el token (vencido, inválido o contraseña cambiada). */
export class SesionExpiradaError extends Error {}

/** Error con el mensaje que envió el servidor (apto para mostrar). */
export class ErrorDeApi extends Error {
  constructor(public status: number, mensaje: string) {
    super(mensaje);
  }
}

const SIN_CONEXION = 'No se pudo conectar con el servidor. Revisa que esté encendido y que estés en la misma red.';

export async function login(password: string): Promise<string> {
  let respuesta: Response;
  try {
    respuesta = await fetch(`${API_URL}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
  } catch {
    throw new Error(SIN_CONEXION);
  }
  const datos = await respuesta.json().catch(() => null);
  if (!respuesta.ok || !datos?.token) {
    throw new Error(datos?.error ?? 'No se pudo iniciar sesión');
  }
  return datos.token;
}

/**
 * Llama a la API con el token y devuelve el JSON.
 * Lanza SesionExpiradaError (401) o ErrorDeApi con el mensaje del servidor.
 */
export async function pedirApi<T>(ruta: string, token: string, opciones: { metodo?: string; cuerpo?: unknown } = {}): Promise<T> {
  let respuesta: Response;
  try {
    respuesta = await fetch(`${API_URL}/api${ruta}`, {
      method: opciones.metodo ?? 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        ...(opciones.cuerpo !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: opciones.cuerpo !== undefined ? JSON.stringify(opciones.cuerpo) : undefined,
    });
  } catch {
    throw new ErrorDeApi(0, SIN_CONEXION);
  }
  if (respuesta.status === 401) throw new SesionExpiradaError('Tu sesión expiró. Vuelve a ingresar.');
  const datos = await respuesta.json().catch(() => null);
  if (!respuesta.ok) throw new ErrorDeApi(respuesta.status, datos?.error ?? `Error del servidor (${respuesta.status})`);
  return datos as T;
}

/** Fuente de imagen protegida: la app envía el token al pedir la foto del comprobante. */
export function imagenProtegida(ruta: string, token: string) {
  return { uri: `${API_URL}${ruta}`, headers: { Authorization: `Bearer ${token}` } };
}
