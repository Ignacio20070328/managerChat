const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { ComprobanteInvalidoError, registrarComprobante } = require('./comprobantes');
const { procesarTexto } = require('./conversacion');
const mensajes = require('./mensajes');
const { analizarEnSegundoPlano } = require('../servicios/analisis');
const asistente = require('../servicios/asistente');

const SEGUNDOS_RECONOCER_ENVIO = 60; // ventana para reconocer un mensaje propio como enviado por el bot

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

    // Textos que el bot está por enviar, por chat. Sirve para distinguir, entre los mensajes
    // propios, los que mandó el bot de los que el dueño escribió a mano.
    const enviosDelBot = new Map(); // chatId → [{ texto, hasta }]

    function registrarEnvio(chatId, texto) {
        const ahora = Date.now();
        const vigentes = (enviosDelBot.get(chatId) ?? []).filter((e) => e.hasta > ahora);
        vigentes.push({ texto, hasta: ahora + SEGUNDOS_RECONOCER_ENVIO * 1000 });
        enviosDelBot.set(chatId, vigentes);
    }

    /** ¿Este mensaje propio lo envió el bot? (lo consume para no confundirlo con uno igual del dueño) */
    function fueEnviadoPorElBot(chatId, texto) {
        const ahora = Date.now();
        const vigentes = (enviosDelBot.get(chatId) ?? []).filter((e) => e.hasta > ahora);
        const i = vigentes.findIndex((e) => e.texto === texto);
        if (i >= 0) vigentes.splice(i, 1);
        if (vigentes.length) enviosDelBot.set(chatId, vigentes); else enviosDelBot.delete(chatId);
        return i >= 0;
    }

    /** Responde al mensaje dejando registro de que lo envió el bot. */
    function responder(msg, texto) {
        registrarEnvio(msg.from, texto);
        return msg.reply(texto);
    }

    /** Solo chats individuales: se ignoran grupos, estados, canales y mensajes propios. */
    function esChatIndividual(msg) {
        if (msg.fromMe) return false;
        return msg.from.endsWith('@c.us') || msg.from.endsWith('@lid');
    }

    /**
     * Número de teléfono real (solo dígitos, con código de país). WhatsApp puede
     * identificar al remitente con un "LID" interno; en ese caso se pide el número.
     */
    async function telefonoDeChat(chatId) {
        if (chatId.endsWith('@c.us')) {
            return chatId.split('@')[0];
        }
        try {
            const [resultado] = await client.getContactLidAndPhone([chatId]);
            if (resultado?.pn) {
                return resultado.pn.split('@')[0];
            }
        } catch (error) {
            console.warn('No se pudo convertir el LID a teléfono:', error.message);
        }
        // Último recurso: el identificador interno, con prefijo para distinguirlo
        return `lid:${chatId.split('@')[0]}`;
    }

    const obtenerTelefono = (msg) => telefonoDeChat(msg.from);

    async function manejarComprobante(msg) {
        if (!(msg.body || '').toLowerCase().includes('comprobante')) {
            await responder(msg, mensajes.pedirPalabraComprobante).catch(() => {});
            return;
        }
        try {
            const media = await msg.downloadMedia();
            const telefono = await obtenerTelefono(msg);
            const { idPedido, total } = await registrarComprobante(db, telefono, media);

            console.log(`Comprobante registrado: pedido #${idPedido} del cliente ${telefono}`);
            await responder(msg, mensajes.comprobanteRecibido(idPedido, total));
            // Revisión previa con IA (si está configurada); no demora la respuesta al cliente
            analizarEnSegundoPlano(db, idPedido);
        } catch (error) {
            if (error instanceof ComprobanteInvalidoError) {
                console.warn('Comprobante rechazado:', error.message);
                await responder(msg, mensajes.formatoInvalido).catch(() => {});
            } else {
                console.error('Error al registrar el comprobante:', error);
                await responder(msg, mensajes.errorInterno).catch(() => {});
            }
        }
    }

    async function manejarTexto(msg) {
        try {
            const telefono = await obtenerTelefono(msg);
            const respuesta = await procesarTexto(db, telefono, msg.body);
            if (respuesta) await responder(msg, respuesta);
        } catch (error) {
            console.error('Error al responder un mensaje:', error);
            await responder(msg, mensajes.errorInterno).catch(() => {});
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

    // Mensajes propios: si el dueño escribió a mano en un chat, el asistente de IA se calla ahí un rato
    client.on('message_create', async (msg) => {
        if (!msg.fromMe) return;
        const chatId = msg.to;
        if (!chatId || !(chatId.endsWith('@c.us') || chatId.endsWith('@lid'))) return;
        if (fueEnviadoPorElBot(chatId, msg.body)) return;
        try {
            const telefono = await telefonoDeChat(chatId);
            asistente.pausarPorDueno(telefono);
            console.log(`Asistente en pausa ${asistente.MINUTOS_PAUSA_POR_DUENO} min en el chat de ${telefono}: el dueño está respondiendo`);
        } catch (error) {
            console.warn('No se pudo pausar el asistente:', error.message);
        }
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
                registrarEnvio(chatId, texto);
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
