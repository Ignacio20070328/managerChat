// Proveedor FALSO para desarrollar y probar sin claves ni costo (IA_PROVEEDORES=simulado).
// No mira la imagen: devuelve datos de ejemplo. El número de operación sale de un hash
// de la imagen, así que enviar la misma foto dos veces se detecta como repetida.
const crypto = require('crypto');

module.exports = {
    nombre: 'simulado',
    modelo: () => 'datos-de-ejemplo',

    async analizar({ imagenBase64 }) {
        const huella = crypto.createHash('sha256').update(imagenBase64).digest('hex').slice(0, 10).toUpperCase();
        return {
            es_comprobante: true,
            monto: Number(process.env.IA_SIMULADO_MONTO) || 14500,
            banco_origen: 'Banco de Ejemplo',
            banco_destino: 'Banco de Ejemplo',
            cuenta_destino: process.env.IA_SIMULADO_CUENTA || '000000000',
            titular_destino: 'Titular de Ejemplo',
            numero_operacion: `SIM-${huella}`,
            // Hora local de Chile, como aparece en un comprobante real
            fecha_transferencia: new Intl.DateTimeFormat('sv-SE', {
                timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
            }).format(new Date()).replace(' ', 'T')
        };
    }
};
