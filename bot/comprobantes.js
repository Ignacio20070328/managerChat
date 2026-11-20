const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const CARPETA_UPLOADS = path.join(__dirname, '../public/uploads');
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
 * Registra el comprobante: crea el cliente si no existe, crea el pedido y
 * guarda la imagen. Todo o nada: si algo falla, no queda ni la fila en la
 * base ni el archivo en disco.
 * @returns {Promise<{ idPedido: number, ruta: string }>}
 */
async function registrarComprobante(db, telefono, media) {
    const { extension, datos } = validarImagen(media);

    // Nombre aleatorio: no expone el teléfono del cliente en la URL pública
    const nombreArchivo = `comprobante_${crypto.randomUUID()}.${extension}`;
    const rutaDisco = path.join(CARPETA_UPLOADS, nombreArchivo);
    const rutaPublica = `/uploads/${nombreArchivo}`;

    const conexion = await db.getConnection();
    let archivoEscrito = false;
    try {
        await conexion.beginTransaction();

        // Crea el cliente o recupera su id en una sola operación atómica.
        // Evita duplicados si llegan dos comprobantes a la vez.
        const [cliente] = await conexion.query(
            `INSERT INTO Clientes (telefono) VALUES (?)
             ON DUPLICATE KEY UPDATE id_cliente = LAST_INSERT_ID(id_cliente)`,
            [telefono]
        );

        const [pedido] = await conexion.query(
            'INSERT INTO Pedidos (id_cliente, ruta_comprobante) VALUES (?, ?)',
            [cliente.insertId, rutaPublica]
        );

        await fs.writeFile(rutaDisco, datos, { flag: 'wx' });
        archivoEscrito = true;

        await conexion.commit();
        return { idPedido: pedido.insertId, ruta: rutaPublica };
    } catch (error) {
        await conexion.rollback().catch(() => {});
        if (archivoEscrito) {
            await fs.unlink(rutaDisco).catch(() => {});
        }
        throw error;
    } finally {
        conexion.release();
    }
}

module.exports = {
    CARPETA_UPLOADS,
    ComprobanteInvalidoError,
    prepararCarpeta,
    registrarComprobante
};
