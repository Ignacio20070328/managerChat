const path = require('path');

// Ruta absoluta: encuentra el .env aunque el servidor se arranque desde otra carpeta
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const {
    MAX_INTENTOS,
    crearLimitadorDeIntentos,
    crearToken,
    leerConfiguracion,
    requiereSesion,
    verificarPassword
} = require('./lib/auth');

// Se valida antes de conectar nada: sin contraseña configurada la API no arranca
const auth = leerConfiguracion();

const bot = require('./bot/whatsapp');
const db = require('./config/db');

const app = express();
const port = Number(process.env.PORT) || 3000;

app.disable('x-powered-by');

// La app nativa no necesita CORS. Solo se habilita para los orígenes web
// listados en CORS_ORIGINS (por ejemplo, la versión web de Expo en desarrollo).
const origenesPermitidos = (process.env.CORS_ORIGINS || '')
    .split(',').map((o) => o.trim()).filter(Boolean);
if (origenesPermitidos.length > 0) {
    app.use(cors({ origin: origenesPermitidos }));
}

app.use(express.json({ limit: '10kb' }));

// --- Rutas públicas ---------------------------------------------------------

const limitador = crearLimitadorDeIntentos();

app.post('/api/login', (req, res) => {
    const ip = req.ip;
    if (limitador.bloqueado(ip)) {
        return res.status(429).json({
            error: `Demasiados intentos fallidos (${MAX_INTENTOS}). Espera 15 minutos.`
        });
    }

    if (!verificarPassword(req.body?.password, auth.passwordHash)) {
        limitador.registrarFallo(ip);
        console.warn(`Intento de login fallido desde ${ip}`);
        return res.status(401).json({ error: 'Contraseña incorrecta' });
    }

    limitador.limpiar(ip);
    res.json({ token: crearToken(auth.secreto) });
});

// --- Todo lo demás exige sesión --------------------------------------------

const conSesion = requiereSesion(auth.secreto);
app.use('/api', conSesion);
// Ruta absoluta: funciona aunque el servidor se arranque desde otra carpeta
app.use('/uploads', conSesion, express.static(path.join(__dirname, 'public/uploads')));

app.get('/api/pedidos/pendientes', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT p.id_pedido, c.telefono, p.ruta_comprobante, p.fecha
            FROM Pedidos p
            JOIN Clientes c ON p.id_cliente = c.id_cliente
            WHERE p.estado = 'Pendiente'
            ORDER BY p.fecha ASC, p.id_pedido ASC
        `);
        res.json(rows);
    } catch (error) {
        console.error('Error al listar pedidos pendientes', error);
        res.status(500).json({ error: 'No se pudieron cargar los pedidos' });
    }
});

app.put('/api/pedidos/:id/aprobar', async (req, res) => {
    const idPedido = Number(req.params.id);
    if (!Number.isInteger(idPedido) || idPedido <= 0) {
        return res.status(400).json({ error: 'ID de pedido inválido' });
    }

    try {
        // Solo se aprueban pedidos pendientes: evita aprobar dos veces
        // o revivir un pedido rechazado/entregado.
        const [resultado] = await db.query(
            `UPDATE Pedidos
             SET estado = 'Aprobado', fecha_aprobacion = NOW()
             WHERE id_pedido = ? AND estado = 'Pendiente'`,
            [idPedido]
        );

        if (resultado.affectedRows === 0) {
            const [filas] = await db.query(
                'SELECT estado FROM Pedidos WHERE id_pedido = ?',
                [idPedido]
            );
            if (filas.length === 0) {
                return res.status(404).json({ error: 'El pedido no existe' });
            }
            return res.status(409).json({
                error: `El pedido ya está en estado "${filas[0].estado}"`
            });
        }

        res.json({ id_pedido: idPedido, estado: 'Aprobado' });
    } catch (error) {
        console.error('Error al aprobar el pedido', idPedido, error);
        res.status(500).json({ error: 'No se pudo aprobar el pedido' });
    }
});

// Cualquier otra ruta de la API (ya autenticada) que no exista
app.use('/api', (req, res) => {
    res.status(404).json({ error: 'Ruta no encontrada' });
});

// JSON mal formado u otros errores no controlados: respuesta genérica
app.use((error, req, res, next) => {
    if (error.type === 'entity.parse.failed' || error.type === 'entity.too.large') {
        return res.status(400).json({ error: 'Solicitud inválida' });
    }
    console.error('Error no controlado', error);
    res.status(500).json({ error: 'Error interno' });
});

bot.initialize();

app.listen(port, () => {
    console.log(`Servidor API corriendo en http://localhost:${port}`);
});
