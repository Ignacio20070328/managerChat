const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const db = require('../config/db');
const {
    ComprobanteInvalidoError,
    prepararCarpeta,
    registrarComprobante
} = require('./comprobantes');

const MENSAJES = {
    pedirPalabra: '📸 Para registrar tu pago, por favor envía la foto escribiendo la palabra "comprobante" en el mismo mensaje.',
    recibido: '✅ Recibimos tu comprobante. Te avisaremos cuando el pago sea validado.',
    formatoInvalido: '⚠️ No pudimos leer la imagen. Envía el comprobante como foto (JPG o PNG) de menos de 10 MB.',
    errorInterno: '⚠️ Tuvimos un problema al registrar tu comprobante. Por favor, inténtalo de nuevo en unos minutos.'
};

const client = new Client({
    authStrategy: new LocalAuth(),
});

/**
 * Solo se atienden chats individuales: se ignoran grupos, estados,
 * canales y mensajes enviados por el propio bot.
 */
function esChatIndividual(msg) {
    if (msg.fromMe) return false;
    return msg.from.endsWith('@c.us') || msg.from.endsWith('@lid');
}

/**
 * Devuelve el número de teléfono real (solo dígitos, con código de país).
 * WhatsApp puede identificar al remitente con un "LID" interno en vez de su
 * número; en ese caso se pide el número asociado.
 */
async function obtenerTelefono(msg) {
    if (msg.from.endsWith('@c.us')) {
        return msg.from.split('@')[0];
    }
    try {
        const [resultado] = await client.getContactLidAndPhone([msg.from]);
        if (resultado?.pn) {
            return resultado.pn.split('@')[0];
        }
    } catch (error) {
        console.warn('No se pudo convertir el LID a teléfono:', error.message);
    }
    // Último recurso: se guarda el identificador interno con un prefijo para
    // poder distinguirlo de un teléfono real.
    return `lid:${msg.from.split('@')[0]}`;
}

client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
    console.log('Escanea este QR con tu celular en "Dispositivos Vinculados"');
});

client.on('ready', () => {
    console.log('¡Bot de WhatsApp conectado y listo para recibir comprobantes!');
});

client.on('auth_failure', (mensaje) => {
    console.error('Falló la autenticación de WhatsApp. Borra la carpeta .wwebjs_auth y vuelve a escanear el QR.', mensaje);
});

client.on('disconnected', (motivo) => {
    console.error(`El bot de WhatsApp se desconectó (${motivo}). Reinicia el servidor para reconectarlo.`);
});

client.on('message', async (msg) => {
    if (!msg.hasMedia || msg.type !== 'image' || !esChatIndividual(msg)) return;

    if (!(msg.body || '').toLowerCase().includes('comprobante')) {
        await msg.reply(MENSAJES.pedirPalabra).catch(() => {});
        return;
    }

    try {
        const media = await msg.downloadMedia();
        const telefono = await obtenerTelefono(msg);
        const { idPedido } = await registrarComprobante(db, telefono, media);

        console.log(`Comprobante registrado: pedido #${idPedido} del cliente ${telefono}`);
        await msg.reply(MENSAJES.recibido);
    } catch (error) {
        if (error instanceof ComprobanteInvalidoError) {
            console.warn('Comprobante rechazado:', error.message);
            await msg.reply(MENSAJES.formatoInvalido).catch(() => {});
        } else {
            console.error('Error al registrar el comprobante:', error);
            await msg.reply(MENSAJES.errorInterno).catch(() => {});
        }
    }
});

// Crea la carpeta de comprobantes una sola vez, al arrancar
prepararCarpeta().catch((error) => {
    console.error('No se pudo crear la carpeta de comprobantes:', error);
});

module.exports = client;
