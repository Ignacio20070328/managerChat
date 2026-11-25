// Simulador de chat: escribe como si fueras un cliente de WhatsApp y ve lo que responde el bot
// (comandos, pedidos y asistente de IA), sin conectar WhatsApp.
//   npm run chat                 → cliente de ejemplo 56900000050
//   npm run chat -- 56900000001  → otro cliente de ejemplo
// Solo acepta teléfonos de ejemplo (5690000…): lo que escribas se envía a la IA si el asistente está
// activo, y los pedidos que hagas ("1x2") se crean de verdad en la base para ese cliente de ejemplo.
const path = require('path');
const readline = require('readline');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });

const db = require('../config/db');
const { procesarTexto } = require('../bot/conversacion');
const configuracion = require('../servicios/configuracion');
const { cadenaDesdeEntorno } = require('../servicios/ia');
const { esTelefonoDemo } = require('../config/demo');

const telefono = process.argv[2] || '56900000050';
if (!esTelefonoDemo(telefono)) {
    console.error('Usa un teléfono de ejemplo (empieza con 5690000). Para tener clientes de ejemplo: npm run demo:cargar');
    process.exit(1);
}

(async () => {
    const config = await configuracion.obtener(db);
    const ia = cadenaDesdeEntorno();
    console.log(`\n💬 Chat simulado con "${config.nombre_negocio}" como el cliente +${telefono}`);
    if (config.asistente_activo !== 'si') {
        console.log('⚠️  El asistente de IA está APAGADO: solo responderán los comandos (menu, estado, ayuda, 1x2).');
        console.log('   Actívalo en la app: Ajustes → Asistente de WhatsApp (IA).');
    } else if (!ia.puedeConversar) {
        console.log('⚠️  La IA no está configurada en el servidor (.env): solo responderán los comandos.');
    } else {
        console.log('🤖 Asistente de IA activo. Pregunta lo que quieras.');
    }
    console.log('   Escribe "salir" para terminar.\n');

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: 'Tú: ' });
    rl.prompt();
    for await (const linea of rl) {
        const texto = linea.trim();
        if (/^(salir|exit|chao)$/i.test(texto)) break;
        if (texto) {
            const inicio = Date.now();
            try {
                const respuesta = await procesarTexto(db, telefono, texto);
                const ms = Date.now() - inicio;
                console.log(respuesta
                    ? `Bot: ${respuesta.replace(/\n/g, '\n     ')}${ms > 300 ? `   (${(ms / 1000).toFixed(1)} s)` : ''}\n`
                    : 'Bot: (no responde a este mensaje)\n');
            } catch (error) {
                console.log(`Bot: (error: ${String(error.message).replace(/nvapi-[A-Za-z0-9_-]+/g, '[clave]')})\n`);
            }
        }
        rl.prompt();
    }
    rl.close();
    await db.end();
})();
