const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const { adjuntarComprobante, enTransaccion } = require('../servicios/pedidos');

const { CARPETA_UPLOADS } = require('../config/carpetas');
const TAMANO_MAXIMO_BYTES = 10 * 1024 * 1024; // 10 MB

// Solo se aceptan estos formatos de imagen
const EXTENSIONES = {
    'image/jpeg': 'jpeg',
    'image/png': 'png',
    'image/webp': 'webp'
};

class ComprobanteInvalidoError extends Error {}

async function prepararCarpeta() {
    await fs.mkdir(CARPETA_UPLOADS, { recursive: true });
}

function validarImagen(media) {
    const mime = (media?.mimetype || '').split(';')[0].trim().toLowerCase();
    const extension = EXTENSIONES[mime];
    if (!extension) {
        throw new ComprobanteInvalidoError(`Formato no soportado: ${mime || 'desconocido'}`);
    }

    const datos = Buffer.from(media.data || '', 'base64');
    if (datos.length === 0) {
        throw new ComprobanteInvalidoError('La imagen está vacía');
    }
    if (datos.length > TAMANO_MAXIMO_BYTES) {
        throw new ComprobanteInvalidoError('La imagen supera los 10 MB');
    }
    return { extension, datos };
}

/**
 * Registra el comprobante: lo asocia al pedido PorPagar del cliente (o crea un
 * pedido nuevo si no tenía) y guarda la imagen. Todo o nada: si algo falla, no
 * queda ni el cambio en la base ni el archivo en disco.
 * @returns {Promise<{ idPedido: number, total: number|null, reenvio: boolean, ruta: string }>}
 * @throws SinPedidoError (servicios/pedidos) si el cliente no tiene un pedido al cual asociarlo
 */
async function registrarComprobante(db, telefono, media) {
    const { extension, datos } = validarImagen(media);

    // Nombre aleatorio: no expone el teléfono del cliente en la URL
    const nombreArchivo = `comprobante_${crypto.randomUUID()}.${extension}`;
    const rutaDisco = path.join(CARPETA_UPLOADS, nombreArchivo);
    const rutaPublica = `/uploads/${nombreArchivo}`;

    let archivoEscrito = false;
    try {
        return await enTransaccion(db, async (conexion) => {
            const { idPedido, total, reenvio } = await adjuntarComprobante(conexion, telefono, rutaPublica);
            await fs.writeFile(rutaDisco, datos, { flag: 'wx' });
            archivoEscrito = true;
            return { idPedido, total, reenvio, ruta: rutaPublica };
        });
    } catch (error) {
        // La transacción ya se revirtió; si el archivo alcanzó a escribirse, se borra
        if (archivoEscrito) await fs.unlink(rutaDisco).catch(() => {});
        throw error;
    }
}

module.exports = {
    CARPETA_UPLOADS,
    ComprobanteInvalidoError,
    prepararCarpeta,
    registrarComprobante
};
