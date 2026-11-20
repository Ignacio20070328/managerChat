const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { ComprobanteInvalidoError, registrarComprobante } = require('./comprobantes');
const { procesarTexto } = require('./conversacion');
const mensajes = require('./mensajes');

/**
 * Crea el bot de WhatsApp. No se conecta hasta llamar a iniciar().
 * @returns {{ iniciar(): Promise<void>, estado(): string, notificar(telefono, texto): Promise<boolean>, client }}
 */
function crearBot(db) {
    const client = new Client({
        authStrategy: new LocalAuth(),
    });

    // iniciando → esperando_qr → conectado | desconectado | error_autenticacion
    let estado = 'iniciando';

    /** Solo chats individuales: se ignoran grupos, estados, canales y mensajes propios. */
    function esChatIndividual(msg) {
        if (msg.fromMe) return false;
        return msg.from.endsWith('@c.us') || msg.from.endsWith('@lid');
    }

    /**
     * Número de teléfono real (solo dígitos, con código de país). WhatsApp puede
     * identificar al remitente con un "LID" interno; en ese caso se pide el número.
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
        // Último recurso: el identificador interno, con prefijo para distinguirlo
        return `lid:${msg.from.split('@')[0]}`;
    }

    async function manejarComprobante(msg) {
        if (!(msg.body || '').toLowerCase().includes('comprobante')) {
            await msg.reply(mensajes.pedirPalabraComprobante).catch(() => {});
            return;
        }
        try {
            const media = await msg.downloadMedia();
            const telefono = await obtenerTelefono(msg);
            const { idPedido, total } = await registrarComprobante(db, telefono, media);

            console.log(`Comprobante registrado: pedido #${idPedido} del cliente ${telefono}`);
            await msg.reply(mensajes.comprobanteRecibido(idPedido, total));
        } catch (error) {
            if (error instanceof ComprobanteInvalidoError) {
                console.warn('Comprobante rechazado:', error.message);
                await msg.reply(mensajes.formatoInvalido).catch(() => {});
            } else {
                console.error('Error al registrar el comprobante:', error);
                await msg.reply(mensajes.errorInterno).catch(() => {});
            }
        }
    }

    async function manejarTexto(msg) {
        try {
            const telefono = await obtenerTelefono(msg);
            const respuesta = await procesarTexto(db, telefono, msg.body);
            if (respuesta) await msg.reply(respuesta);
        } catch (error) {
            console.error('Error al responder un mensaje:', error);
            await msg.reply(mensajes.errorInterno).catch(() => {});
        }
    }

    client.on('qr', (qr) => {
        estado = 'esperando_qr';
        qrcode.generate(qr, { small: true });
        console.log('Escanea este QR con tu celular en "Dispositivos Vinculados"');
    });

    client.on('ready', () => {
        estado = 'conectado';
        console.log('¡Bot de WhatsApp conectado y listo para recibir comprobantes!');
    });

    client.on('auth_failure', (mensaje) => {
        estado = 'error_autenticacion';
        console.error('Falló la autenticación de WhatsApp. Borra la carpeta .wwebjs_auth y vuelve a escanear el QR.', mensaje);
    });

    client.on('disconnected', (motivo) => {
        estado = 'desconectado';
        console.error(`El bot de WhatsApp se desconectó (${motivo}). Reinicia el servidor para reconectarlo.`);
    });

    client.on('message', async (msg) => {
        if (!esChatIndividual(msg)) return;
        if (msg.hasMedia && msg.type === 'image') return manejarComprobante(msg);
        if (msg.type === 'chat') return manejarTexto(msg);
    });

    return {
        client,
        estado: () => estado,

        iniciar: () => client.initialize(),

        /** Envía un aviso al cliente. Devuelve false (sin lanzar) si no se pudo. */
        async notificar(telefono, texto) {
            if (estado !== 'conectado' || !telefono) return false;
            const chatId = telefono.startsWith('lid:') ? `${telefono.slice(4)}@lid` : `${telefono}@c.us`;
            try {
                await client.sendMessage(chatId, texto);
                return true;
            } catch (error) {
                console.error(`No se pudo notificar a ${telefono}:`, error.message);
                return false;
            }
        }
    };
}

module.exports = { crearBot };
