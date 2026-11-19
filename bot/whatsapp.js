const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
const db = require('../config/db');

const client = new Client({
    authStrategy: new LocalAuth(),
});

client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
    console.log('Escanea este QR con tu celular en "Dispositivos Vinculados"');
});

client.on('ready', () => {
    console.log('¡Bot de WhatsApp conectado y listo para recibir comprobantes!');
});

client.on('message', async msg => {
  if (msg.hasMedia) {
    
    
    if (msg.type !== 'image') return;

  
    const textoMensaje = msg.body.toLowerCase();
    if (!textoMensaje.includes('comprobante')) {
        msg.reply('📸 Para registrar tu pago, por favor envía la foto escribiendo la palabra "comprobante" en el mismo mensaje.');
        return; 
    }

    // --- SI PASA LOS FILTROS, SIGUE TU CÓDIGO NORMAL ---
    const media = await msg.downloadMedia();

    if (media && media.mimetype.includes('image')) {
      const telefonoCliente = msg.from.split('@')[0];
            
            const fileName = `comprobante_${telefonoCliente}_${Date.now()}.${media.mimetype.split('/')[1]}`;
            const savePath = path.join(__dirname, '../public/uploads/', fileName);
            
            
            const dir = path.join(__dirname, '../public/uploads/');
            if (!fs.existsSync(dir)){
                fs.mkdirSync(dir, { recursive: true });
            }

            // Guardar imagen en disco
            fs.writeFileSync(savePath, media.data, 'base64');
            console.log(`Comprobante guardado de: ${telefonoCliente}`);

            // Insertar en la base de datos
            try {
                const [clientes] = await db.query('SELECT id_cliente FROM Clientes WHERE telefono = ?', [telefonoCliente]);
                let idCliente;

                if (clientes.length === 0) {
                    const [nuevoCliente] = await db.query('INSERT INTO Clientes (telefono, nombre_completo) VALUES (?, ?)', [telefonoCliente, 'Cliente Nuevo']);
                    idCliente = nuevoCliente.insertId;
                } else {
                    idCliente = clientes[0].id_cliente;
                }

                const rutaBD = `/uploads/${fileName}`;
                await db.query('INSERT INTO Pedidos (id_cliente, ruta_comprobante, estado) VALUES (?, ?, ?)', [idCliente, rutaBD, 'Pendiente']);
                
                console.log('Registro guardado en MySQL con éxito.');

            } catch (error) {
                console.error('Error al guardar en la base de datos:', error);
            }
        }
    }
});

module.exports = client;