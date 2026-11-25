// Pruebas del bot de WhatsApp con mensajes simulados (no se conecta a WhatsApp ni a la base).
// Ejecutar: npm test
const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const asistente = require('../servicios/asistente');
const { crearBot } = require('../bot/whatsapp');

const bot = crearBot(null); // sin iniciar(): no abre WhatsApp
const alCrearMensaje = bot.client.listeners('message_create')[0];
const TEL = '56900000077';
const CHAT = `${TEL}@c.us`;

const propio = (body, to = CHAT) => ({ fromMe: true, to, body });
const silenciar = () => { const l = console.log; console.log = () => {}; return () => { console.log = l; }; };

beforeEach(() => asistente.reiniciarEstado());

test('si el dueño escribe a mano en un chat, el asistente se pausa en ese chat', async () => {
    const r = silenciar();
    try { await alCrearMensaje(propio('Hola, te respondo yo')); } finally { r(); }
    assert.equal(asistente.estaPausado(TEL), true);
    assert.equal(asistente.estaPausado('56900000078'), false);
});

test('los mensajes que envía el propio bot NO pausan el asistente', async () => {
    // Simula que el bot respondió: notificar() registra el envío antes de mandarlo
    bot.client.sendMessage = async () => {};
    bot.client.emit('ready');
    const r = silenciar();
    try {
        assert.equal(await bot.notificar(TEL, '🎉 Tu pago fue aprobado'), true);
        await alCrearMensaje(propio('🎉 Tu pago fue aprobado'));
    } finally { r(); }
    assert.equal(asistente.estaPausado(TEL), false);
    // …pero si después el dueño escribe el mismo texto a mano, sí cuenta como del dueño
    const r2 = silenciar();
    try { await alCrearMensaje(propio('🎉 Tu pago fue aprobado')); } finally { r2(); }
    assert.equal(asistente.estaPausado(TEL), true);
});

test('mensajes de grupos, estados o recibidos no pausan nada', async () => {
    await alCrearMensaje(propio('hola grupo', '120363000@g.us'));
    await alCrearMensaje(propio('mi estado', 'status@broadcast'));
    await alCrearMensaje({ fromMe: false, to: CHAT, from: CHAT, body: 'hola' });
    assert.equal(asistente.estaPausado(TEL), false);
});
