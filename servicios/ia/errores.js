/**
 * Error de un proveedor de IA.
 * - `cambiarDeProveedor`: true si conviene intentar con el siguiente de la cadena
 *   (cuota agotada, límite de uso, caída, tiempo de espera, sin configurar, respuesta inválida).
 * - `reintentable`: true si el MISMO proveedor podría responder si se espera un poco
 *   (429 límite de uso, 5xx, error de red, tiempo de espera).
 * - `esperaMs`: cuánto esperar antes de reintentar, si el proveedor lo indicó (Retry-After).
 *
 * El mensaje se muestra en la app y en los logs: NUNCA debe incluir la clave, cabeceras,
 * la imagen ni el cuerpo de la petición.
 */
class ErrorProveedor extends Error {
    constructor(mensaje, { cambiarDeProveedor = true, reintentable = false, esperaMs = null, causa } = {}) {
        super(ocultarSecretos(mensaje));
        this.cambiarDeProveedor = cambiarDeProveedor;
        this.reintentable = reintentable;
        this.esperaMs = esperaMs;
        if (causa) this.cause = causa;
    }
}

/** Borra cualquier cosa con forma de clave de API de un texto (por si un proveedor la refleja). */
function ocultarSecretos(texto) {
    return String(texto)
        .replace(/nvapi-[A-Za-z0-9_-]+/g, '[clave oculta]')
        .replace(/AIza[0-9A-Za-z_-]{20,}/g, '[clave oculta]')
        .replace(/Bearer\s+\S+/gi, 'Bearer [oculto]');
}

module.exports = { ErrorProveedor, ocultarSecretos };
