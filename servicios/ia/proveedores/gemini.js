// Proveedor GEMINI — ESQUELETO, pendiente de implementar cuando se elija el modelo.
//
// Para completarlo:
//  1. Revisar la documentación oficial de la API de GEMINI para el modelo elegido
//     (debe aceptar imágenes) y el formato exacto de la petición y la respuesta.
//  2. Implementar analizar(): enviar `instrucciones` + la imagen (`imagenBase64`, `mime`)
//     y devolver el objeto JSON (o el texto JSON) que responda el modelo.
//  3. Convertir los errores de la API en ErrorProveedor:
//       - cuota agotada, límite de uso (HTTP 429), caídas (5xx), red → { cambiarDeProveedor: true }
//         (así la cadena pasa al siguiente proveedor, p. ej. de NVIDIA a Gemini)
//  4. Probar con una foto real y con la misma foto dos veces (número de operación repetido).
//
// Configuración (.env):
//   GEMINI_API_KEY=   clave de la API (NUNCA en el código ni en la app)
//   GEMINI_MODELO=    nombre del modelo

const { ErrorProveedor } = require('../errores');

module.exports = {
    nombre: 'gemini',
    modelo: () => process.env.GEMINI_MODELO || null,

    async analizar(/* { imagenBase64, mime, instrucciones } */) {
        if (!process.env.GEMINI_API_KEY || !process.env.GEMINI_MODELO) {
            throw new ErrorProveedor('GEMINI_API_KEY o GEMINI_MODELO no están configurados');
        }
        throw new ErrorProveedor('el proveedor gemini aún no está implementado (servicios/ia/proveedores/gemini.js)');
    }
};
