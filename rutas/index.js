const express = require('express');
const { idValido } = require('../lib/errores');
const pedidos = require('../servicios/pedidos');
const productos = require('../servicios/productos');
const configuracion = require('../servicios/configuracion');
const resumen = require('../servicios/resumen');
const analisis = require('../servicios/analisis');
const { cadenaDesdeEntorno } = require('../servicios/ia');
const mensajes = require('../bot/mensajes');

/**
 * Rutas autenticadas de la API. Express 5 envía al manejador de errores
 * cualquier excepción de un handler async (incluidos los ErrorApi).
 * @param bot { estado(): string, notificar(telefono, texto): Promise<boolean> }
 * @param ia  cadena de proveedores de IA (servicios/ia); por defecto la del .env
 */
function crearRutas({ db, bot, ia = cadenaDesdeEntorno() }) {
    const r = express.Router();

    // --- Pedidos ---
    r.get('/pedidos', async (req, res) => {
        res.json(await pedidos.listarPorEstado(db, req.query.estado));
    });

    r.get('/pedidos/:id', async (req, res) => {
        res.json(await pedidos.obtener(db, idValido(req.params.id, 'ID de pedido')));
    });

    r.put('/pedidos/:id/aprobar', async (req, res) => {
        const pedido = await pedidos.aprobar(db, idValido(req.params.id, 'ID de pedido'));
        const notificado = await bot.notificar(pedido.telefono, mensajes.pagoAprobado(pedido));
        res.json({ ...pedido, notificado });
    });

    r.put('/pedidos/:id/rechazar', async (req, res) => {
        const pedido = await pedidos.rechazar(db, idValido(req.params.id, 'ID de pedido'), req.body?.motivo);
        const notificado = await bot.notificar(pedido.telefono, mensajes.pagoRechazado(pedido));
        res.json({ ...pedido, notificado });
    });

    // Vuelve a analizar el comprobante con IA (espera el resultado)
    r.post('/pedidos/:id/analizar', async (req, res) => {
        const id = idValido(req.params.id, 'ID de pedido');
        await analisis.analizarPedido(db, id, { cadena: ia });
        res.json(await pedidos.obtener(db, id));
    });

    r.put('/pedidos/:id/entregar', async (req, res) => {
        res.json(await pedidos.entregar(db, idValido(req.params.id, 'ID de pedido')));
    });

    // --- Productos ---
    r.get('/productos', async (req, res) => {
        res.json(await productos.listar(db));
    });

    r.post('/productos', async (req, res) => {
        res.status(201).json(await productos.crear(db, req.body || {}));
    });

    r.put('/productos/:id', async (req, res) => {
        res.json(await productos.actualizar(db, idValido(req.params.id, 'ID de producto'), req.body || {}));
    });

    // --- Configuración del negocio ---
    r.get('/configuracion', async (req, res) => {
        res.json({ ...(await configuracion.obtener(db)), colores_disponibles: configuracion.COLORES_MARCA });
    });

    r.put('/configuracion', async (req, res) => {
        res.json({ ...(await configuracion.actualizar(db, req.body)), colores_disponibles: configuracion.COLORES_MARCA });
    });

    // --- Inicio / Estadísticas ---
    r.get('/resumen', async (req, res) => {
        res.json({ ...(await resumen.obtener(db)), bot: bot.estado(), ia: { activa: ia.activa, proveedores: ia.nombres, soloDemo: process.env.IA_SOLO_DEMO === '1' } });
    });

    return r;
}

module.exports = { crearRutas };
