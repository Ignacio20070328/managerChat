// Cancelación de pedidos por WhatsApp y desde la app (sin base de datos: servicios inyectados o simulados).
const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const asistente = require('../servicios/asistente');
const pedidos = require('../servicios/pedidos');
const mensajes = require('../bot/mensajes');
const { procesarTexto } = require('../bot/conversacion');

const TEL = '56911112222';
const silenciar = () => { const l = console.log; console.log = () => {}; return () => { console.log = l; }; };
const pedido = (estado, extra = {}) => ({
    id_pedido: 12, estado, total: 9000, ruta_comprobante: estado === 'PorPagar' ? null : '/uploads/x.png',
    items: [{ id_producto: 1, nombre: 'Torta', cantidad: 1, precio_unitario: 9000 }], ...extra
});

beforeEach(() => asistente.reiniciarEstado());

test('reconoce cuándo el cliente quiere cancelar (y no lo confunde con quitar un producto)', () => {
    for (const t of ['cancelar', 'Cancelar pedido', 'cancelar mi pedido', 'quiero cancelar el pedido', 'anular mi compra',
        'ya no quiero mi pedido', 'Me arrepentí', 'eliminar pedido por favor']) {
        assert.equal(asistente.esPedidoDeCancelar(t), true, t);
    }
    for (const t of ['elimina la mora de mi pedido', 'quiero 2 de frambuesa', 'hola', 'cancelado?', 'no']) {
        assert.equal(asistente.esPedidoDeCancelar(t), false, t);
    }
});

test('pedido sin pagar: pide confirmar; "sí" lo cancela; un segundo "sí" no hace nada', async () => {
    const ultimoDelCliente = async () => pedido('PorPagar');
    assert.match(await asistente.iniciarCancelacion(null, TEL, { ultimoDelCliente }), /¿Seguro que quieres cancelar tu pedido #12\?/);
    const cancelados = [];
    const cancelar = async (db, tel, id) => { cancelados.push([tel, id]); return pedido('Cancelado'); };
    const r = silenciar();
    try {
        assert.equal(await asistente.manejarConfirmacion(null, TEL, 'Sí', { cancelar }), mensajes.pedidoCanceladoPorCliente(pedido('Cancelado')));
    } finally { r(); }
    assert.deepEqual(cancelados, [[TEL, 12]]);
    assert.equal(await asistente.manejarConfirmacion(null, TEL, 'sí', { cancelar }), null);
});

test('pedido sin pagar: "no" lo mantiene; "cancelar" como respuesta significa sí', async () => {
    const ultimoDelCliente = async () => pedido('PorPagar');
    const cancelar = async () => { throw new Error('no debería cancelar'); };
    await asistente.iniciarCancelacion(null, TEL, { ultimoDelCliente });
    assert.equal(await asistente.manejarConfirmacion(null, TEL, 'no', { cancelar }), mensajes.cancelacionDescartada(12));

    await asistente.iniciarCancelacion(null, TEL, { ultimoDelCliente });
    let cancelado = false;
    const r = silenciar();
    try {
        await asistente.manejarConfirmacion(null, TEL, 'cancélalo', { cancelar: async () => { cancelado = true; return pedido('Cancelado'); } });
    } finally { r(); }
    assert.equal(cancelado, true);
});

test('pedido ya pagado: no se cancela solo; queda la solicitud para el dueño', async () => {
    for (const estado of ['Pendiente', 'Aprobado']) {
        const solicitudes = [];
        const r = silenciar();
        let respuesta;
        try {
            respuesta = await asistente.iniciarCancelacion(null, TEL, {
                ultimoDelCliente: async () => pedido(estado),
                solicitar: async (db, tel, id) => { solicitudes.push([tel, id]); }
            });
        } finally { r(); }
        assert.equal(respuesta, mensajes.cancelacionSolicitada(pedido(estado)), estado);
        assert.deepEqual(solicitudes, [[TEL, 12]]);
        // No queda esperando un "sí"
        assert.equal(await asistente.manejarConfirmacion(null, TEL, 'sí', { cancelar: async () => { throw new Error('no'); } }), null);
    }
});

test('sin pedido activo (o ya entregado/rechazado/cancelado) → lo dice', async () => {
    for (const ultimo of [null, pedido('Entregado'), pedido('Rechazado'), pedido('Cancelado')]) {
        assert.equal(await asistente.iniciarCancelacion(null, TEL, { ultimoDelCliente: async () => ultimo }), mensajes.sinPedidoParaCancelar);
    }
});

test('el bot: "cancelar" responde a una propuesta de pedido pendiente antes que al comando', async () => {
    const espia = {
        manejarConfirmacion: async (db, tel, texto) => (texto === 'cancelar' ? 'propuesta cancelada' : null),
        esPedidoDeCancelar: () => true,
        iniciarCancelacion: async () => 'comando cancelar'
    };
    assert.equal(await procesarTexto(null, TEL, 'cancelar', { asistente: espia }), 'propuesta cancelada');
    espia.manejarConfirmacion = async () => null;
    assert.equal(await procesarTexto(null, TEL, 'cancelar', { asistente: espia }), 'comando cancelar');
});

// ---------- Servicio (conexión simulada) ----------

const dbFalsa = (filasAfectadas, estado = 'Entregado') => {
    const consultas = [];
    return {
        consultas,
        async query(sql, params) {
            consultas.push({ sql, params });
            if (/^\s*UPDATE/i.test(sql)) return [{ affectedRows: filasAfectadas }];
            if (/SELECT estado FROM Pedidos/.test(sql)) return [[{ estado }]];
            return [[]];
        }
    };
};

test('el dueño cancela: solo pedidos por pagar, pendientes o aprobados (409 si ya no se puede)', async () => {
    const db = dbFalsa(0, 'Entregado');
    await assert.rejects(pedidos.cancelarPorDueno(db, 5), (e) => e.status === 409 && /Entregado/.test(e.message));
    const update = db.consultas.find((c) => /UPDATE/i.test(c.sql));
    assert.match(update.sql, /cancelado_por = 'dueno'/);
    assert.deepEqual(update.params[1], ['PorPagar', 'Pendiente', 'Aprobado']);
});

test('mantener sin solicitud pendiente → 409; el cliente solo cancela pedidos suyos sin pagar', async () => {
    await assert.rejects(pedidos.mantenerPedido(dbFalsa(0), 5), (e) => e.status === 409);
    const db = dbFalsa(0);
    await assert.rejects(pedidos.cancelarPorCliente(db, TEL, 5), (e) => e.status === 409);
    const update = db.consultas[0];
    assert.match(update.sql, /c\.telefono = \?/);
    assert.match(update.sql, /p\.estado = 'PorPagar'/);
    assert.deepEqual(update.params, [5, TEL]);
});
