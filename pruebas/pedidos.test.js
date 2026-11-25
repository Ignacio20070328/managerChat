// Pruebas de servicios/pedidos con una conexión simulada (sin base de datos).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const pedidos = require('../servicios/pedidos');

/** Conexión falsa: responde según el texto de la consulta y guarda cada consulta hecha. */
function conexionFalsa({ porPagar = [], rechazados = [], pendiente = [] } = {}) {
    const consultas = [];
    return {
        consultas,
        async query(sql, params) {
            consultas.push({ sql, params });
            if (/INSERT INTO Clientes/i.test(sql)) return [{ insertId: 7 }];
            if (/SELECT id_cliente FROM Clientes/i.test(sql)) return [[{ id_cliente: 7 }]];
            if (/estado = 'PorPagar'/.test(sql) && /^\s*SELECT/i.test(sql)) return [porPagar];
            if (/estado = 'Rechazado'/.test(sql) && /^\s*SELECT/i.test(sql)) return [rechazados];
            if (/SELECT total FROM Pedidos/.test(sql)) return [pendiente];
            return [{ affectedRows: 1 }];
        }
    };
}

test('comprobante sin pedido → SinPedidoError y no se crea ningún pedido', async () => {
    const cx = conexionFalsa();
    await assert.rejects(pedidos.adjuntarComprobante(cx, '56911111111', '/uploads/x.png'), pedidos.SinPedidoError);
    assert.ok(!cx.consultas.some((c) => /INSERT INTO Pedidos/i.test(c.sql)), 'no inserta pedidos');
});

test('comprobante con pedido por pagar → se asocia a ese pedido', async () => {
    const cx = conexionFalsa({ porPagar: [{ id_pedido: 5, total: 9000 }] });
    assert.deepEqual(await pedidos.adjuntarComprobante(cx, '56911111111', '/uploads/x.png'), { idPedido: 5, total: 9000, reenvio: false });
});

test('comprobante reenviado tras un rechazo → el mismo pedido vuelve a Pendiente', async () => {
    const cx = conexionFalsa({ rechazados: [{ id_pedido: 8, total: 4500 }] });
    assert.deepEqual(await pedidos.adjuntarComprobante(cx, '56911111111', '/uploads/y.png'), { idPedido: 8, total: 4500, reenvio: true });
    const update = cx.consultas.find((c) => /UPDATE Pedidos/i.test(c.sql));
    assert.match(update.sql, /motivo_rechazo = NULL/);
    assert.match(update.sql, /estado = 'Rechazado'/, 'condicionado al estado actual');
});

test('no se aprueba un pedido sin productos', async () => {
    const db = conexionFalsa({ pendiente: [{ total: null }] });
    await assert.rejects(pedidos.aprobar(db, 40), (e) => e.status === 409 && /no tiene productos/.test(e.message));
    assert.ok(!db.consultas.some((c) => /UPDATE Pedidos/i.test(c.sql)));
});
