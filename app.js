require('dotenv').config();

const express = require('express');
const cors = require('cors');
const bot = require('./bot/whatsapp');
const db = require('./config/db');

const app = express();
const port = Number(process.env.PORT) || 3000;

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('public/uploads')); 

app.get('/api/pedidos/pendientes', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT p.id_pedido, c.telefono, p.ruta_comprobante, p.fecha 
            FROM Pedidos p 
            JOIN Clientes c ON p.id_cliente = c.id_cliente 
            WHERE p.estado = 'Pendiente'
        `);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
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

bot.initialize();

app.listen(port, () => {
    console.log(`Servidor API corriendo en http://localhost:${port}`);
});