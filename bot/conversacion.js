// Respuestas del bot a mensajes de texto. No depende de WhatsApp: recibe el
// teléfono y el texto y devuelve la respuesta (o null si no corresponde responder).

const productos = require('../servicios/productos');
const pedidos = require('../servicios/pedidos');
const configuracion = require('../servicios/configuracion');
const { ErrorApi } = require('../lib/errores');
const mensajes = require('./mensajes');
const asistenteServicio = require('../servicios/asistente');

const quitarTildes = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

// Palabras que activan cada comando (el mensaje completo, sin tildes ni mayúsculas).
// Lo que no es un comando solo lo responde el asistente de IA, y solo si el dueño lo activó
// en Ajustes (requiere un número dedicado: con un número personal contestaría a todos).
const COMANDOS = {
    menu: ['menu', 'catalogo', 'productos', 'precios', 'pedir', 'comprar'],
    estado: ['estado', 'mi pedido', 'estado pedido', 'estado de mi pedido'],
    ayuda: ['ayuda', 'info', 'informacion']
};

// "1x2", "1 x 2", "1*2", "1×2" separados por coma, punto y coma, "y" o saltos de línea
const ITEM = /(\d{1,3})\s*[x×*]\s*(\d{1,3})/g;
const SOLO_ITEMS = /^\s*\d{1,3}\s*[x×*]\s*\d{1,3}(\s*(,|;|\by\b|\n)?\s*\d{1,3}\s*[x×*]\s*\d{1,3})*\s*[.!]?\s*$/i;

function normalizar(texto) {
    return quitarTildes((texto || '').toLowerCase()).replace(/[¿?¡!.,]/g, ' ').replace(/\s+/g, ' ').trim();
}

function detectarComando(texto) {
    const limpio = normalizar(texto);
    for (const [comando, palabras] of Object.entries(COMANDOS)) {
        if (palabras.includes(limpio)) return comando;
    }
    return null;
}

/** "1x2, 2x1" → [{ numero: 1, cantidad: 2 }, { numero: 2, cantidad: 1 }] o null si no es un pedido. */
function parsearItems(texto) {
    if (!SOLO_ITEMS.test(texto || '')) return null;
    return [...texto.matchAll(ITEM)].map((m) => ({ numero: Number(m[1]), cantidad: Number(m[2]) }));
}

/**
 * @param asistente  servicio del asistente de IA (inyectable en pruebas). Responde lo que no es un comando,
 *                   solo si el dueño lo activó en Ajustes; si no, el bot sigue sin responder conversaciones.
 */
async function procesarTexto(db, telefono, texto, { asistente = asistenteServicio } = {}) {
    const comando = detectarComando(texto);

    if (comando === 'menu') {
        const [lista, config] = await Promise.all([
            productos.listar(db, { soloActivos: true }),
            configuracion.obtener(db)
        ]);
        return mensajes.catalogo(lista, config.nombre_negocio);
    }
    if (comando === 'estado') {
        return mensajes.estadoPedido(await pedidos.ultimoDelCliente(db, telefono));
    }
    if (comando === 'ayuda') {
        return mensajes.ayuda;
    }

    // ¿Responde "sí" o "no" a un pedido que le propuso el asistente?
    const confirmacion = await asistente.manejarConfirmacion?.(db, telefono, texto);
    if (confirmacion) return confirmacion;

    const solicitados = parsearItems(texto);
    if (!solicitados) return asistente.responder(db, telefono, texto);
    asistente.descartarPropuesta?.(telefono); // pidió directo con códigos: la propuesta anterior ya no aplica

    // Los números corresponden al orden del catálogo que muestra "menu"
    const catalogo = await productos.listar(db, { soloActivos: true });
    const items = [];
    for (const { numero, cantidad } of solicitados) {
        const producto = catalogo[numero - 1];
        if (!producto) return mensajes.pedidoInvalido(`El producto número ${numero} no existe`);
        if (cantidad === 0) return mensajes.pedidoInvalido('La cantidad debe ser mayor que 0');
        items.push({ id_producto: producto.id_producto, cantidad });
    }

    try {
        const pedido = await pedidos.crearPedidoPorPagar(db, telefono, items);
        const config = await configuracion.obtener(db);
        return mensajes.pedidoCreado(pedido, config.datos_transferencia);
    } catch (error) {
        if (error instanceof ErrorApi && error.status === 400) return mensajes.pedidoInvalido(error.message);
        throw error;
    }
}

module.exports = { detectarComando, parsearItems, procesarTexto };
