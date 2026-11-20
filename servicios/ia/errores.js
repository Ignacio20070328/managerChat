/**
 * Error de un proveedor de IA.
 * `cambiarDeProveedor`: true si conviene intentar con el siguiente de la cadena
 * (cuota agotada, límite de uso, caída, tiempo de espera, sin configurar, respuesta inválida).
 */
class ErrorProveedor extends Error {
    constructor(mensaje, { cambiarDeProveedor = true, causa } = {}) {
        super(mensaje);
        this.cambiarDeProveedor = cambiarDeProveedor;
        if (causa) this.cause = causa;
    }
}

module.exports = { ErrorProveedor };
