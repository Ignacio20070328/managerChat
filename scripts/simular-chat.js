// Simulador de chat: escribe como si fueras un cliente de WhatsApp y ve lo que responde el bot
// (comandos, pedidos y asistente de IA), sin conectar WhatsApp.
//   npm run chat                 → cliente de ejemplo 56900000050
//   npm run chat -- 56900000001  → otro cliente de ejemplo
// Solo acepta teléfonos de ejemplo (5690000…): lo que escribas se envía a la IA si el asistente está
// activo, y los pedidos que hagas ("1x2") se crean de verdad en la base para ese cliente de ejemplo.
//
// Enviar la foto del comprobante (como si la mandaras por WhatsApp con la palabra "comprobante"):
//   /foto                → genera un comprobante de EJEMPLO por el total de tu pedido por pagar
//   /foto 3000           → …por otro monto (para ver las alertas de la IA)
//   /foto ruta/imagen.jpg → envía esa imagen (JPG, PNG o WebP)
const path = require('path');
const readline = require('readline');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });

const db = require('../config/db');
const { procesarTexto } = require('../bot/conversacion');
const configuracion = require('../servicios/configuracion');
const { cadenaDesdeEntorno } = require('../servicios/ia');
const { esTelefonoDemo } = require('../config/demo');
const fs = require('fs/promises');
const crypto = require('crypto');
const mensajes = require('../bot/mensajes');
const pedidos = require('../servicios/pedidos');
const analisis = require('../servicios/analisis');
const { registrarComprobante, prepararCarpeta, ComprobanteInvalidoError } = require('../bot/comprobantes');
const { generarImagenes } = require('./comprobante-ejemplo');

const MIME = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
const pesos = (n) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n);
const TEXTO_SUGERENCIA = { aprobar: '✅ aprobar', revisar: '⚠️ revisar', rechazar: '❌ rechazar' };

/** La imagen que "envía" el cliente: un archivo o un comprobante de ejemplo generado. */
async function imagenDelComprobante(argumento, config) {
    if (argumento && !/^\d+$/.test(argumento)) {
        const mime = MIME[path.extname(argumento).slice(1).toLowerCase()];
        if (!mime) throw new Error('usa una imagen JPG, PNG o WebP');
        return { mimetype: mime, data: (await fs.readFile(argumento)).toString('base64') };
    }
    const ultimo = await pedidos.ultimoDelCliente(db, telefono);
    const monto = argumento ? Number(argumento) : (ultimo?.estado === 'PorPagar' ? ultimo.total : null);
    if (!monto) throw new Error('no tienes un pedido por pagar: haz un pedido primero o escribe /foto <monto>');
    // La cuenta y el titular salen de los datos de transferencia del negocio (Ajustes)
    const cuenta = (config.datos_transferencia || '').match(/\d[\d-]{5,}\d/)?.[0] ?? '12345678';
    const fecha = new Date().toLocaleString('es-CL', { timeZone: 'America/Santiago', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const operacion = String(crypto.randomInt(1e9, 1e10));
    console.log(`     (generando un comprobante de ejemplo por ${pesos(monto)}…)`);
    const imagenes = await generarImagenes([{ operacion, monto, fecha, cuenta, banco: 'Banco Ejemplo', color: '#0057b8',
        titular: config.nombre_negocio || 'Mi negocio' }]);
    return { mimetype: 'image/png', data: imagenes.get(operacion) };
}

/** Lo mismo que hace el bot al recibir una foto con la palabra "comprobante", y espera el análisis de la IA. */
async function enviarFoto(argumento, ia) {
    const config = await configuracion.obtener(db);
    const media = await imagenDelComprobante(argumento, config);
    await prepararCarpeta();
    let registrado;
    try {
        registrado = await registrarComprobante(db, telefono, media);
    } catch (error) {
        if (error instanceof ComprobanteInvalidoError) return console.log(`Bot: ${mensajes.formatoInvalido}\n`);
        throw error;
    }
    console.log(`Bot: ${mensajes.comprobanteRecibido(registrado.idPedido, registrado.total)}`);
    console.log(`     → En la app: Comprobantes → pedido #${registrado.idPedido}`);
    if (!ia.activa) return console.log('     (la IA no está configurada: el comprobante queda sin revisión previa)\n');
    console.log('     (la IA está revisando el comprobante…)');
    const inicio = Date.now();
    const r = await analisis.analizarPedido(db, registrado.idPedido, { cadena: ia });
    if (r?.estado !== 'completado') return console.log(`     Revisión de la IA: no se pudo completar${r?.error ? ` (${r.error})` : ''}\n`);
    const alertas = (r.alertas || []).map((a) => a.mensaje ?? a).join(' · ');
    console.log(`     Revisión de la IA (${((Date.now() - inicio) / 1000).toFixed(1)} s, solo la ve el dueño): ` +
        `sugiere ${TEXTO_SUGERENCIA[r.sugerencia] ?? r.sugerencia}${alertas ? ` — ${alertas}` : ''}\n`);
}

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
    console.log('   Para enviar la foto del comprobante escribe /foto (o /foto <monto>, o /foto <ruta-de-imagen>).');
    console.log('   Escribe "salir" para terminar.\n');

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: 'Tú: ' });
    rl.prompt();
    for await (const linea of rl) {
        const texto = linea.trim();
        if (/^(salir|exit|chao)$/i.test(texto)) break;
        if (/^\/foto\b/i.test(texto)) {
            try {
                await enviarFoto(texto.slice(5).trim(), ia);
            } catch (error) {
                console.log(`Bot: (no se envió la foto: ${String(error.message).replace(/nvapi-[A-Za-z0-9_-]+/g, '[clave]')})\n`);
            }
        } else if (texto) {
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
