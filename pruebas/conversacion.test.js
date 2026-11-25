// Pruebas de los pedidos con código ("1x2") del bot. Sin base de datos.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parsearItems } = require('../bot/conversacion');

test('pedidos con código: formatos aceptados, incluido lo copiado del menú con negrita', () => {
    for (const [texto, esperado] of [
        ['1x2', [[1, 2]]], ['1 x 2', [[1, 2]]], ['1*2', [[1, 2]]], ['1×2', [[1, 2]]],
        ['1x2, 2x1', [[1, 2], [2, 1]]], ['1x2 y 3x1', [[1, 2], [3, 1]]],
        ['*1x3*', [[1, 3]]], ['*1x3,', [[1, 3]]], ['*1x2*, *2x1*', [[1, 2], [2, 1]]], ['_1x2_', [[1, 2]]],
        ['1x2.', [[1, 2]]], ['1x2,', [[1, 2]]]
    ]) assert.deepEqual(parsearItems(texto)?.map((i) => [i.numero, i.cantidad]), esperado, texto);
});

test('pedidos con código: lo que no es un pedido no se interpreta como tal', () => {
    for (const texto of ['1', 'hola', 'quiero 2 de frambuesa', '1x', 'x2', '', '*hola*']) {
        assert.equal(parsearItems(texto), null, texto);
    }
});
