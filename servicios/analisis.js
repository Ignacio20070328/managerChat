// Revisión previa de comprobantes: la IA lee la imagen y estas REGLAS (sin IA)
// comparan lo leído con el pedido, la configuración y otros comprobantes.
// El resultado es solo una SUGERENCIA: aprobar o rechazar lo decide una persona.

const fs = require('fs/promises');
const path = require('path');
const { CARPETA_UPLOADS } = require('../config/carpetas');
const configuracion = require('./configuracion');
const { conflicto, noEncontrado } = require('../lib/errores');
const { cadenaDesdeEntorno } = require('./ia');

const MIME_POR_EXTENSION = { jpeg: 'image/jpeg', jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
const DIAS_FECHA_ANTIGUA = 3;
const pesos = (n) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n);
const soloDigitos = (s) => (s || '').replace(/\D/g, '');

/**
 * Compara los datos leídos con el pedido y devuelve { alertas, sugerencia }.
 * Función pura (los datos externos llegan como parámetros) para poder probarla.
 */
function evaluar(datos, { pedido, datosTransferencia, operacionRepetida = {}, ahora = new Date() }) {
    const alertas = [];
    const alerta = (tipo, gravedad, mensaje) => alertas.push({ tipo, gravedad, mensaje });

    if (datos.es_comprobante === false) {
        alerta('no_es_comprobante', 'alta', 'La imagen no parece un comprobante de transferencia.');
    }

    // Mismo N° de operación en otro pedido: el que llegó DESPUÉS es el sospechoso;
    // el original solo recibe un aviso (no se castiga al cliente al que le copiaron el comprobante).
    if (operacionRepetida.anterior) {
        alerta('operacion_repetida', 'alta',
            `El N° de operación ${datos.numero_operacion} ya se usó antes en el pedido #${operacionRepetida.anterior}.`);
    } else if (operacionRepetida.posterior) {
        alerta('operacion_reutilizada_despues', 'media',
            `Este comprobante parece el original, pero su N° de operación se volvió a enviar en el pedido #${operacionRepetida.posterior}.`);
    }

    if (datos.monto == null) {
        alerta('monto_ilegible', 'media', 'No se pudo leer el monto: revísalo en la foto.');
    } else if (pedido.total == null) {
        alerta('pedido_sin_total', 'media',
            `El cliente no pidió por el bot: no hay total con qué comparar el monto leído (${pesos(datos.monto)}).`);
    } else if (datos.monto < pedido.total) {
        alerta('monto_menor', 'alta', `El monto leído (${pesos(datos.monto)}) es MENOR al total del pedido (${pesos(pedido.total)}).`);
    } else if (datos.monto > pedido.total) {
        alerta('monto_mayor', 'media', `El monto leído (${pesos(datos.monto)}) es mayor al total del pedido (${pesos(pedido.total)}).`);
    }

    // Cuenta de destino: se compara con los números que aparecen en los datos de transferencia
    const numerosConfigurados = (datosTransferencia || '').match(/\d[\d.\-\s]{4,}\d/g)?.map(soloDigitos).filter((n) => n.length >= 6) ?? [];
    const cuentaLeida = soloDigitos(datos.cuenta_destino);
    if (numerosConfigurados.length === 0) {
        alerta('sin_cuenta_configurada', 'media', 'Configura los datos de transferencia en Ajustes para verificar la cuenta de destino.');
    } else if (cuentaLeida.length >= 4) {
        const coincide = numerosConfigurados.some((n) => n.endsWith(cuentaLeida) || cuentaLeida.endsWith(n)
            || (cuentaLeida.length >= 4 && n.slice(-4) === cuentaLeida.slice(-4)));
        if (!coincide) alerta('cuenta_distinta', 'alta', `La cuenta de destino (${datos.cuenta_destino}) no coincide con la configurada.`);
    } else {
        alerta('cuenta_ilegible', 'media', 'No se pudo leer la cuenta de destino.');
    }

    if (datos.fecha_transferencia) {
        const referencia = pedido.fecha_comprobante ? new Date(pedido.fecha_comprobante) : ahora;
        const dias = (referencia - datos.fecha_transferencia) / 86_400_000;
        if (dias > DIAS_FECHA_ANTIGUA) {
            alerta('fecha_antigua', 'media', `La transferencia es de hace ${Math.floor(dias)} días: podría ser un comprobante reutilizado.`);
        } else if (dias < -1) {
            alerta('fecha_futura', 'media', 'La fecha de la transferencia es posterior a la recepción del comprobante.');
        }
    }

    const sugerencia = alertas.some((a) => a.tipo === 'no_es_comprobante' || a.tipo === 'operacion_repetida')
        ? 'rechazar'
        : alertas.length > 0 ? 'revisar' : 'aprobar';
    return { alertas, sugerencia };
}

async function guardar(db, idPedido, campos) {
    const fila = { ...campos, alertas: campos.alertas ? JSON.stringify(campos.alertas) : null, fecha_analisis: new Date() };
    await db.query(
        'INSERT INTO AnalisisComprobante SET ? AS nuevo ON DUPLICATE KEY UPDATE ' +
            Object.keys(fila).map((c) => `${c} = nuevo.${c}`).join(', '),
        [{ id_pedido: idPedido, ...fila }]
    );
}

const VACIO = {
    proveedor: null, modelo: null, es_comprobante: null, monto: null, banco_origen: null, banco_destino: null,
    cuenta_destino: null, titular_destino: null, numero_operacion: null, fecha_transferencia: null,
    alertas: null, sugerencia: null, error: null
};

/**
 * Analiza el comprobante de un pedido y guarda el resultado (completado o fallido).
 * @param cadena cadena de proveedores (por defecto, la del .env)
 */
async function analizarPedido(db, idPedido, { cadena = cadenaDesdeEntorno() } = {}) {
    if (!cadena.activa) throw conflicto('La IA no está configurada en el servidor (IA_PROVEEDORES)');

    const [filas] = await db.query(
        'SELECT id_pedido, total, ruta_comprobante, fecha_comprobante FROM Pedidos WHERE id_pedido = ?', [idPedido]
    );
    if (filas.length === 0) throw noEncontrado('El pedido no existe');
    const pedido = filas[0];
    if (!pedido.ruta_comprobante) throw conflicto('El pedido aún no tiene comprobante');

    // basename: la ruta viene de la base, pero nunca se lee fuera de la carpeta de comprobantes
    const archivo = path.basename(pedido.ruta_comprobante);
    const mime = MIME_POR_EXTENSION[path.extname(archivo).slice(1).toLowerCase()];

    await guardar(db, idPedido, { ...VACIO, estado: 'procesando' });
    try {
        if (!mime) throw new Error('Formato de imagen no soportado');
        const imagen = await fs.readFile(path.join(CARPETA_UPLOADS, archivo));
        const { proveedor, modelo, datos } = await cadena.analizarImagen(imagen, mime);

        const operacionRepetida = {};
        if (datos.numero_operacion) {
            const [repetidas] = await db.query(
                `SELECT a.id_pedido, p.fecha_comprobante FROM AnalisisComprobante a
                 JOIN Pedidos p ON p.id_pedido = a.id_pedido
                 WHERE a.numero_operacion = ? AND a.id_pedido <> ?
                 ORDER BY p.fecha_comprobante ASC, a.id_pedido ASC`,
                [datos.numero_operacion, idPedido]
            );
            // "Antes" = comprobante recibido antes (a igual hora, el de menor número de pedido)
            const esAnterior = (r) => r.fecha_comprobante < pedido.fecha_comprobante
                || (+r.fecha_comprobante === +pedido.fecha_comprobante && r.id_pedido < idPedido);
            operacionRepetida.anterior = repetidas.find(esAnterior)?.id_pedido ?? null;
            operacionRepetida.posterior = repetidas.find((r) => !esAnterior(r))?.id_pedido ?? null;
        }
        const { datos_transferencia } = await configuracion.obtener(db);
        const { alertas, sugerencia } = evaluar(datos, { pedido, datosTransferencia: datos_transferencia, operacionRepetida });

        await guardar(db, idPedido, { ...VACIO, ...datos, es_comprobante: datos.es_comprobante, estado: 'completado', proveedor, modelo, alertas, sugerencia });
    } catch (error) {
        await guardar(db, idPedido, { ...VACIO, estado: 'fallido', error: String(error.message).slice(0, 255) });
        console.error(`IA: no se pudo analizar el pedido #${idPedido}:`, error.message);
    }
    return obtener(db, idPedido);
}

/** Lanza el análisis sin esperar (para no demorar la respuesta al cliente en WhatsApp). */
function analizarEnSegundoPlano(db, idPedido) {
    const cadena = cadenaDesdeEntorno();
    if (!cadena.activa) return;
    analizarPedido(db, idPedido, { cadena }).catch((error) => {
        console.error(`IA: error al analizar el pedido #${idPedido}:`, error.message);
    });
}

function aAnalisis(fila) {
    const { id_pedido, ...resto } = fila;
    return {
        ...resto,
        es_comprobante: fila.es_comprobante == null ? null : Boolean(fila.es_comprobante),
        alertas: typeof fila.alertas === 'string' ? JSON.parse(fila.alertas) : fila.alertas
    };
}

async function obtener(db, idPedido) {
    const mapa = await obtenerVarios(db, [idPedido]);
    return mapa.get(idPedido) ?? null;
}

/** Map id_pedido → análisis (para agregarlo a las listas de pedidos). */
async function obtenerVarios(db, ids) {
    if (ids.length === 0) return new Map();
    const [filas] = await db.query('SELECT * FROM AnalisisComprobante WHERE id_pedido IN (?)', [ids]);
    return new Map(filas.map((f) => [f.id_pedido, aAnalisis(f)]));
}

module.exports = { analizarEnSegundoPlano, analizarPedido, evaluar, obtener, obtenerVarios };
