// Dirección del servidor. Se define en gestor-movil/.env.local (ver .env.example).
// No es un secreto: las variables EXPO_PUBLIC_* quedan visibles dentro de la app.
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/+$/, '');

/** El servidor rechazó el token (vencido, inválido o contraseña cambiada). */
export class SesionExpiradaError extends Error {}

export async function login(password: string): Promise<string> {
  const respuesta = await fetch(`${API_URL}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  const datos = await respuesta.json().catch(() => null);
  if (!respuesta.ok || !datos?.token) {
    throw new Error(datos?.error ?? 'No se pudo iniciar sesión');
  }
  return datos.token;
}

/** fetch a la API con el token de sesión. Lanza SesionExpiradaError si responde 401. */
export async function apiFetch(ruta: string, token: string, opciones: RequestInit = {}): Promise<Response> {
  const respuesta = await fetch(`${API_URL}${ruta}`, {
    ...opciones,
    headers: { ...(opciones.headers ?? {}), Authorization: `Bearer ${token}` },
  });
  if (respuesta.status === 401) throw new SesionExpiradaError('Tu sesión expiró. Vuelve a ingresar.');
  return respuesta;
}

/** Fuente de imagen protegida: la app envía el token al pedir la foto del comprobante. */
export function imagenProtegida(ruta: string, token: string) {
  return { uri: `${API_URL}${ruta}`, headers: { Authorization: `Bearer ${token}` } };
}
