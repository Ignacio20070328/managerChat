const { conflicto, noEncontrado, validacion } = require('../lib/errores');

const ESTADOS = ['PorPagar', 'Pendiente', 'Aprobado', 'Rechazado', 'Entregado'];
const MAX_CANTIDAD_POR_PRODUCTO = 100;

// Orden de cada lista: lo que espera acción, primero lo más antiguo;
// el historial, primero lo más reciente.
const ORDEN_POR_ESTADO = {
    PorPagar: 'p.fecha ASC',
    Pendiente: 'p.fecha_comprobante ASC, p.id_pedido ASC',
    Aprobado: 'p.fecha_aprobacion ASC',
    Rechazado: 'p.fecha_rechazo DESC',
    Entregado: 'p.fecha_entrega DESC'
};
const LIMITE_HISTORIAL = 100;

async function agregarItems(db, pedidos) {
    if (pedidos.length === 0) return pedidos;
    const [items] = await db.query(
        `SELECT d.id_pedido, d.id_producto, pr.nombre, d.cantidad, d.precio_unitario
         FROM DetallePedido d JOIN Productos pr ON pr.id_producto = d.id_producto
         WHERE d.id_pedido IN (?) ORDER BY pr.nombre`,
        [pedidos.map((p) => p.id_pedido)]
    );
    const porPedido = new Map(pedidos.map((p) => [p.id_pedido, []]));
    for (const { id_pedido, ...item } of items) porPedido.get(id_pedido).push(item);
    const analisis = await require('./analisis').obtenerVarios(db, pedidos.map((p) => p.id_pedido));
    return pedidos.map((p) => ({ ...p, items: porPedido.get(p.id_pedido), analisis: analisis.get(p.id_pedido) ?? null }));
}

const COLUMNAS = `p.id_pedido, c.telefono, c.nombre_completo AS nombre_cliente, p.total, p.estado,
    p.ruta_comprobante, p.motivo_rechazo, p.fecha, p.fecha_comprobante,
    p.fecha_aprobacion, p.fecha_rechazo, p.fecha_entrega`;

async function listarPorEstado(db, estado) {
    if (!ESTADOS.includes(estado)) throw validacion(`Estado inválido. Usa: ${ESTADOS.join(', ')}`);
    const esHistorial = estado === 'Rechazado' || estado === 'Entregado';
    const [filas] = await db.query(
        `SELECT ${COLUMNAS}
         FROM Pedidos p JOIN Clientes c ON c.id_cliente = p.id_cliente
         WHERE p.estado = ?
         ORDER BY ${ORDEN_POR_ESTADO[estado]}
         ${esHistorial ? `LIMIT ${LIMITE_HISTORIAL}` : ''}`,
        [estado]
    );
    return agregarItems(db, filas);
}

async function obtener(db, idPedido) {
    const [filas] = await db.query(
        `SELECT ${COLUMNAS} FROM Pedidos p JOIN Clientes c ON c.id_cliente = p.id_cliente WHERE p.id_pedido = ?`,
        [idPedido]
    );
    if (filas.length === 0) throw noEncontrado('El pedido no existe');
    return (await agregarItems(db, filas))[0];
}

/**
 * Cambia el estado solo si el pedido está en el estado esperado. La condición va
 * dentro del UPDATE: si dos personas actúan a la vez, solo una gana.
 */
async function cambiarEstado(db, idPedido, { desde, hacia, columnaFecha, extra = {} }) {
    const [r] = await db.query(
        `UPDATE Pedidos SET estado = ?, ${columnaFecha} = NOW() ${Object.keys(extra).length ? ', ?' : ''}
         WHERE id_pedido = ? AND estado = ?`,
        Object.keys(extra).length ? [hacia, extra, idPedido, desde] : [hacia, idPedido, desde]
    );
    if (r.affectedRows === 0) {
        const [filas] = await db.query('SELECT estado FROM Pedidos WHERE id_pedido = ?', [idPedido]);
        if (filas.length === 0) throw noEncontrado('El pedido no existe');
        throw conflicto(`El pedido está en estado "${filas[0].estado}"; no se puede pasar a "${hacia}"`);
    }
    return obtener(db, idPedido);
}

async function aprobar(db, id) {
    // Un pedido sin productos (comprobante que llegó sin pedir, de antes de exigir pedido) no se aprueba:
    // nadie sabría qué entregar. Se rechaza pidiendo al cliente que haga su pedido.
    const [filas] = await db.query("SELECT total FROM Pedidos WHERE id_pedido = ? AND estado = 'Pendiente'", [id]);
    if (filas.length > 0 && filas[0].total == null) {
        throw conflicto('Este pedido no tiene productos: recházalo y pídele al cliente que haga su pedido por WhatsApp');
    }
    return cambiarEstado(db, id, { desde: 'Pendiente', hacia: 'Aprobado', columnaFecha: 'fecha_aprobacion' });
}

function rechazar(db, id, motivo) {
    const limpio = typeof motivo === 'string' ? motivo.trim() : '';
    if (limpio.length < 3 || limpio.length > 255) {
        throw validacion('Escribe el motivo del rechazo (entre 3 y 255 caracteres); se le enviará al cliente');
    }
    return cambiarEstado(db, id, {
        desde: 'Pendiente', hacia: 'Rechazado', columnaFecha: 'fecha_rechazo', extra: { motivo_rechazo: limpio }
    });
}

const entregar = (db, id) =>
    cambiarEstado(db, id, { desde: 'Aprobado', hacia: 'Entregado', columnaFecha: 'fecha_entrega' });

/** Crea el cliente si no existe y devuelve su id (atómico ante mensajes simultáneos). */
async function asegurarCliente(conexion, telefono) {
    const [r] = await conexion.query(
        `INSERT INTO Clientes (telefono) VALUES (?)
         ON DUPLICATE KEY UPDATE id_cliente = LAST_INSERT_ID(id_cliente)`,
        [telefono]
    );
    return r.insertId;
}

async function enTransaccion(db, trabajo) {
    const conexion = await db.getConnection();
    try {
        await conexion.beginTransaction();
        const resultado = await trabajo(conexion);
        await conexion.commit();
        return resultado;
    } catch (error) {
        await conexion.rollback().catch(() => {});
        throw error;
    } finally {
        conexion.release();
    }
}

/**
 * Registra el pedido que el cliente hizo por WhatsApp (estado PorPagar).
 * Cada cliente tiene como máximo un pedido PorPagar: si ya tenía uno, se reemplaza.
 * @param items [{ id_producto, cantidad }]
 */
async function crearPedidoPorPagar(db, telefono, items) {
    if (!Array.isArray(items) || items.length === 0) throw validacion('El pedido no tiene productos');

    // Junta cantidades si el mismo producto aparece dos veces
    const cantidades = new Map();
    for (const { id_producto, cantidad } of items) {
        if (!Number.isInteger(cantidad) || cantidad <= 0) throw validacion('Cantidad inválida');
        cantidades.set(id_producto, (cantidades.get(id_producto) || 0) + cantidad);
    }
    for (const cantidad of cantidades.values()) {
        if (cantidad > MAX_CANTIDAD_POR_PRODUCTO) {
            throw validacion(`Máximo ${MAX_CANTIDAD_POR_PRODUCTO} unidades por producto`);
        }
    }

    const idPedido = await enTransaccion(db, async (cx) => {
        const [productos] = await cx.query(
            'SELECT id_producto, precio FROM Productos WHERE activo = 1 AND id_producto IN (?)',
            [[...cantidades.keys()]]
        );
        if (productos.length !== cantidades.size) throw validacion('Algún producto no existe o no está disponible');

        const idCliente = await asegurarCliente(cx, telefono);
        const total = productos.reduce((suma, p) => suma + p.precio * cantidades.get(p.id_producto), 0);

        const [abiertos] = await cx.query(
            "SELECT id_pedido FROM Pedidos WHERE id_cliente = ? AND estado = 'PorPagar' FOR UPDATE",
            [idCliente]
        );
        let id;
        if (abiertos.length > 0) {
            id = abiertos[0].id_pedido;
            await cx.query('UPDATE Pedidos SET total = ?, fecha = NOW() WHERE id_pedido = ?', [total, id]);
            await cx.query('DELETE FROM DetallePedido WHERE id_pedido = ?', [id]);
        } else {
            const [r] = await cx.query(
                "INSERT INTO Pedidos (id_cliente, total, estado) VALUES (?, ?, 'PorPagar')",
                [idCliente, total]
            );
            id = r.insertId;
        }
        await cx.query(
            'INSERT INTO DetallePedido (id_pedido, id_producto, cantidad, precio_unitario) VALUES ?',
            [productos.map((p) => [id, p.id_producto, cantidades.get(p.id_producto), p.precio])]
        );
        return id;
    });
    return obtener(db, idPedido);
}

const DIAS_REENVIO_TRAS_RECHAZO = 7;

/** El cliente envió un comprobante sin tener un pedido por pagar: primero tiene que pedir. */
class SinPedidoError extends Error {}

/**
 * Asocia un comprobante (ya validado) al pedido del cliente:
 * - su pedido PorPagar, o
 * - su último pedido Rechazado (de los últimos 7 días): el mensaje de rechazo le pide reenviar el
 *   comprobante, así que el pedido vuelve a Pendiente con la foto nueva.
 * Si no tiene ninguno lanza SinPedidoError: nunca se crean pedidos sin productos.
 * Se ejecuta dentro de la transacción que recibe, para que el archivo y la fila
 * se guarden juntos (ver bot/comprobantes.js).
 * @returns {Promise<{ idPedido: number, total: number|null, reenvio: boolean }>}
 */
async function adjuntarComprobante(conexion, telefono, rutaComprobante) {
    const idCliente = await asegurarCliente(conexion, telefono);
    const [abiertos] = await conexion.query(
        `SELECT id_pedido, total FROM Pedidos
         WHERE id_cliente = ? AND estado = 'PorPagar'
         ORDER BY fecha DESC LIMIT 1 FOR UPDATE`,
        [idCliente]
    );
    if (abiertos.length > 0) {
        await conexion.query(
            `UPDATE Pedidos SET estado = 'Pendiente', ruta_comprobante = ?, fecha_comprobante = NOW()
             WHERE id_pedido = ?`,
            [rutaComprobante, abiertos[0].id_pedido]
        );
        return { idPedido: abiertos[0].id_pedido, total: abiertos[0].total, reenvio: false };
    }
    const [rechazados] = await conexion.query(
        `SELECT id_pedido, total FROM Pedidos
         WHERE id_cliente = ? AND estado = 'Rechazado' AND total IS NOT NULL
           AND fecha_rechazo >= NOW() - INTERVAL ? DAY
           AND NOT EXISTS (SELECT 1 FROM Pedidos p2 WHERE p2.id_cliente = Pedidos.id_cliente AND p2.fecha > Pedidos.fecha)
         ORDER BY fecha DESC LIMIT 1 FOR UPDATE`,
        [idCliente, DIAS_REENVIO_TRAS_RECHAZO]
    );
    if (rechazados.length > 0) {
        await conexion.query(
            `UPDATE Pedidos SET estado = 'Pendiente', ruta_comprobante = ?, fecha_comprobante = NOW(),
                                motivo_rechazo = NULL, fecha_rechazo = NULL
             WHERE id_pedido = ? AND estado = 'Rechazado'`,
            [rutaComprobante, rechazados[0].id_pedido]
        );
        return { idPedido: rechazados[0].id_pedido, total: rechazados[0].total, reenvio: true };
    }
    throw new SinPedidoError('El cliente no tiene un pedido por pagar');
}

/** Último pedido del cliente (para responder "estado" por WhatsApp). */
async function ultimoDelCliente(db, telefono) {
    const [filas] = await db.query(
        `SELECT p.id_pedido FROM Pedidos p JOIN Clientes c ON c.id_cliente = p.id_cliente
         WHERE c.telefono = ? ORDER BY p.fecha DESC, p.id_pedido DESC LIMIT 1`,
        [telefono]
    );
    return filas.length ? obtener(db, filas[0].id_pedido) : null;
}

module.exports = {
    SinPedidoError,
    ESTADOS,
    MAX_CANTIDAD_POR_PRODUCTO,
    adjuntarComprobante,
    aprobar,
    crearPedidoPorPagar,
    entregar,
    enTransaccion,
    listarPorEstado,
    obtener,
    rechazar,
    ultimoDelCliente
};
