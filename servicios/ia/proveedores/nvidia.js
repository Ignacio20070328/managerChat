// Proveedor NVIDIA — ESQUELETO, pendiente de implementar cuando se elija el modelo.
//
// Para completarlo:
//  1. Revisar la documentación oficial de la API de NVIDIA para el modelo elegido
//     (debe aceptar imágenes) y el formato exacto de la petición y la respuesta.
//  2. Implementar analizar(): enviar `instrucciones` + la imagen (`imagenBase64`, `mime`)
//     y devolver el objeto JSON (o el texto JSON) que responda el modelo.
//  3. Convertir los errores de la API en ErrorProveedor:
//       - cuota agotada, límite de uso (HTTP 429), caídas (5xx), red → { cambiarDeProveedor: true }
//         (así la cadena pasa al siguiente proveedor, p. ej. de NVIDIA a Gemini)
//  4. Probar con una foto real y con la misma foto dos veces (número de operación repetido).
//
// Configuración (.env):
//   NVIDIA_API_KEY=   clave de la API (NUNCA en el código ni en la app)
//   NVIDIA_MODELO=    nombre del modelo

const { ErrorProveedor } = require('../errores');

module.exports = {
    nombre: 'nvidia',
    modelo: () => process.env.NVIDIA_MODELO || null,

    async analizar(/* { imagenBase64, mime, instrucciones } */) {
        if (!process.env.NVIDIA_API_KEY || !process.env.NVIDIA_MODELO) {
            throw new ErrorProveedor('NVIDIA_API_KEY o NVIDIA_MODELO no están configurados');
        }
        throw new ErrorProveedor('el proveedor nvidia aún no está implementado (servicios/ia/proveedores/nvidia.js)');
    }
};
