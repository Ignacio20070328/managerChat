/**
 * Error con código HTTP y mensaje apto para mostrar al usuario.
 * Los servicios lo lanzan; el manejador de errores de app.js lo convierte en respuesta.
 */
class ErrorApi extends Error {
    constructor(status, mensaje) {
        super(mensaje);
        this.status = status;
    }
}

const validacion = (mensaje) => new ErrorApi(400, mensaje);
const noEncontrado = (mensaje) => new ErrorApi(404, mensaje);
const conflicto = (mensaje) => new ErrorApi(409, mensaje);

/** Convierte un parámetro de ruta en un ID entero positivo o lanza 400. */
function idValido(valor, nombre = 'ID') {
    const id = Number(valor);
    if (!Number.isInteger(id) || id <= 0) throw validacion(`${nombre} inválido`);
    return id;
}

module.exports = { ErrorApi, conflicto, idValido, noEncontrado, validacion };
