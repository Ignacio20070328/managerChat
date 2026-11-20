// Punto de entrada: carga la configuración, conecta el bot y levanta la API.
const path = require('path');

// Ruta absoluta: encuentra el .env aunque el servidor se arranque desde otra carpeta
require('dotenv').config({ path: path.join(__dirname, '.env') });

const { leerConfiguracion } = require('./lib/auth');

// Se valida antes de conectar nada: sin contraseña configurada la API no arranca
const auth = leerConfiguracion();

const db = require('./config/db');
const { crearApp } = require('./app');
const { crearBot } = require('./bot/whatsapp');
const { prepararCarpeta } = require('./bot/comprobantes');
const { cadenaDesdeEntorno } = require('./servicios/ia');
const { recuperarPendientes } = require('./servicios/analisis');

// Valida IA_PROVEEDORES al arrancar (un nombre mal escrito detiene el servidor con un mensaje claro)
cadenaDesdeEntorno();

const puerto = Number(process.env.PORT) || 3000;
const origenesCors = (process.env.CORS_ORIGINS || '')
    .split(',').map((o) => o.trim()).filter(Boolean);

// BOT_DESACTIVADO=1 levanta solo la API, sin conectar WhatsApp (útil para
// trabajar en la app sin escanear el QR). Los avisos a clientes no se envían.
const botDesactivado = process.env.BOT_DESACTIVADO === '1';
const botApagado = { estado: () => 'desactivado', notificar: async () => false, iniciar: async () => {} };

(async () => {
    await prepararCarpeta();

    const bot = botDesactivado ? botApagado : crearBot(db);
    const app = crearApp({ db, auth, bot, origenesCors });

    app.listen(puerto, () => {
        console.log(`Servidor API corriendo en http://localhost:${puerto}`);
        if (botDesactivado) console.log('Bot de WhatsApp DESACTIVADO (BOT_DESACTIVADO=1)');
        const ia = cadenaDesdeEntorno();
        console.log(ia.activa
            ? `IA para revisar comprobantes: ${ia.nombres.join(' → ')}` +
              (process.env.IA_SOLO_DEMO === '1' ? ' (MODO DEMO: solo comprobantes de ejemplo)' : '')
            : 'IA para revisar comprobantes: desactivada (IA_PROVEEDORES vacío)');
        // Análisis interrumpidos por un reinicio: se vuelven a poner en la cola
        recuperarPendientes(db)
            .then((n) => { if (n > 0) console.log(`IA: ${n} análisis interrumpidos vuelven a la cola`); })
            .catch((error) => console.error('IA: no se pudieron recuperar los análisis pendientes:', error.message));
    });

    bot.iniciar().catch((error) => {
        console.error('No se pudo iniciar el bot de WhatsApp:', error);
    });
})();
