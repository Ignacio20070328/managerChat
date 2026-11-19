const express = require('express');
const cors = require('cors');
const bot = require('./bot/whatsapp');
const db = require('./config/db');

const app = express();
const port = 3000;

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

bot.initialize();

app.listen(port, () => {
    console.log(`Servidor API corriendo en http://localhost:${port}`);
});