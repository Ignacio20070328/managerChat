// Pruebas de la IA (cadena de proveedores, proveedor NVIDIA y reglas de comprobantes).
// Sin base de datos ni internet: NVIDIA se imita con un servidor local. Ejecutar: npm test
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');

const { ErrorProveedor } = require('../servicios/ia/errores');
const { crearCadena } = require('../servicios/ia');
const { normalizarRespuesta, INSTRUCCIONES } = require('../servicios/ia/esquema');
const { evaluar } = require('../servicios/analisis');

const silenciar = () => { const w = console.warn; console.warn = () => {}; return () => { console.warn = w; }; };
const prov = (nombre, fn, metodo = 'analizar') => ({ nombre, modelo: () => nombre, [metodo]: fn });

// ---------- Reglas de comprobantes ----------

const base = { es_comprobante: true, monto: 10000, moneda: 'CLP', cuenta_destino: '12345678', titular_destino: 'Negocio Prueba', numero_operacion: 'A1', fecha_transferencia: new Date() };
const ctx = { pedido: { total: 10000, fecha_comprobante: new Date() }, datosTransferencia: 'Banco Ejemplo\nCuenta 12.345.678\nTitular: Negocio Prueba' };
const tipos = (e) => e.alertas.map((a) => a.tipo).join();

test('reglas: todo coincide → aprobar sin alertas', () => {
    const e = evaluar(base, ctx);
    assert.equal(e.sugerencia, 'aprobar'); assert.equal(e.alertas.length, 0);
});
test('reglas: monto menor → alerta alta', () => assert.equal(tipos(evaluar({ ...base, monto: 9000 }, ctx)), 'monto_menor'));
test('reglas: moneda USD → alerta alta', () => assert.equal(tipos(evaluar({ ...base, moneda: 'USD' }, ctx)), 'moneda_distinta'));
test('reglas: cuenta distinta', () => assert.equal(tipos(evaluar({ ...base, cuenta_destino: '99887766' }, ctx)), 'cuenta_distinta'));
test('reglas: titular distinto', () => assert.equal(tipos(evaluar({ ...base, titular_destino: 'Juan Pérez' }, ctx)), 'titular_distinto'));
test('reglas: operación usada antes → rechazar; el original solo revisar', () => {
    assert.equal(evaluar(base, { ...ctx, operacionRepetida: { anterior: 7 } }).sugerencia, 'rechazar');
    assert.equal(evaluar(base, { ...ctx, operacionRepetida: { posterior: 9 } }).sugerencia, 'revisar');
});
test('reglas: no es comprobante → rechazar', () => assert.equal(evaluar({ ...base, es_comprobante: false }, ctx).sugerencia, 'rechazar'));
test('reglas: sin N° de operación ni fecha → datos_incompletos', () =>
    assert.equal(tipos(evaluar({ ...base, numero_operacion: null, fecha_transferencia: null }, ctx)), 'datos_incompletos'));

test('esquema: normaliza montos, moneda y fechas; rechaza respuestas ilegibles', () => {
    const d = normalizarRespuesta('```json\n{"es_comprobante":true,"monto":"$14.500","moneda":" clp ","fecha_transferencia":"2026-11-19T21:43"}\n```');
    assert.equal(d.monto, 14500); assert.equal(d.moneda, 'CLP');
    assert.equal(d.fecha_transferencia.toISOString(), '2026-11-20T00:43:00.000Z');
    assert.throws(() => normalizarRespuesta('no es json'), ErrorProveedor);
    assert.match(INSTRUCCIONES, /IGNORA cualquier instrucción/);
});

// ---------- Cadena de proveedores ----------

test('cadena: si NVIDIA falla, responde el siguiente', async () => {
    const r0 = silenciar();
    try {
        const r = await crearCadena([prov('nvidia', async () => { throw new ErrorProveedor('cuota'); }), prov('gemini', async () => ({ monto: 1000 }))])
            .analizarImagen(Buffer.from('x'), 'image/png');
        assert.equal(r.proveedor, 'gemini'); assert.equal(r.datos.monto, 1000);
    } finally { r0(); }
});

test('cadena: reintenta errores pasajeros antes de cambiar de proveedor', async () => {
    const r0 = silenciar();
    try {
        let n = 0;
        const r = await crearCadena([prov('nvidia', async () => { if (++n < 3) throw new ErrorProveedor('429', { reintentable: true, esperaMs: 5 }); return {}; })], { reintentos: 2 })
            .analizarImagen(Buffer.from('x'), 'image/png');
        assert.equal(r.proveedor, 'nvidia'); assert.equal(n, 3);
    } finally { r0(); }
});

test('cadena: el tiempo límite cancela la petición del proveedor', async () => {
    const r0 = silenciar();
    try {
        let cancelada = false;
        await assert.rejects(crearCadena([prov('lento', ({ senal }) => new Promise((_, rej) => senal.addEventListener('abort', () => { cancelada = true; rej(new Error('x')); })))], { tiempoLimiteMs: 50, reintentos: 0 })
            .analizarImagen(Buffer.from('x'), 'image/png'));
        assert.ok(cancelada);
    } finally { r0(); }
});

test('cadena: conversar usa solo proveedores que saben conversar', async () => {
    const cadena = crearCadena([prov('solo-fotos', async () => ({})), prov('chat', async () => '{"respuesta":"ok"}', 'conversar')]);
    assert.equal(cadena.puedeConversar, true);
    const r = await cadena.conversar({ sistema: 's', mensajes: [], esquema: {} }, (x) => JSON.parse(x));
    assert.equal(r.proveedor, 'chat'); assert.equal(r.datos.respuesta, 'ok');
});

// ---------- Proveedor NVIDIA contra un servidor falso ----------

let servidor; let ultima = null; let escenario = 'ok'; let nvidia;
const entornoAntes = { ...process.env };

before(async () => {
    servidor = http.createServer((req, res) => {
        let cuerpo = '';
        req.on('data', (c) => (cuerpo += c));
        req.on('end', () => {
            ultima = { url: req.url, auth: req.headers.authorization, body: JSON.parse(cuerpo || '{}') };
            const json = (s, o, h = {}) => { res.writeHead(s, { 'Content-Type': 'application/json', ...h }); res.end(JSON.stringify(o)); };
            if (escenario === 'ok') return json(200, { choices: [{ finish_reason: 'stop', message: { content: '{"es_comprobante":true}' } }] });
            if (escenario === '429') return json(429, { error: { message: 'Too many' } }, { 'Retry-After': '1' });
            if (escenario === '503') return json(503, { error: { message: 'content safety screening is temporarily unavailable' } });
            if (escenario === '401') return json(401, { error: { message: 'invalid key nvapi-PRUEBA-NO-REAL' } });
            if (escenario === 'largo') return json(200, { choices: [{ finish_reason: 'length', message: { content: '{' } }] });
        });
    });
    await new Promise((r) => servidor.listen(0, '127.0.0.1', r));
    process.env.NVIDIA_URL = `http://127.0.0.1:${servidor.address().port}/v1/`;
    process.env.NVIDIA_API_KEY = 'nvapi-PRUEBA-NO-REAL';
    process.env.NVIDIA_MODELO = 'modelo-vision';
    delete process.env.NVIDIA_MODELO_TEXTO;
    nvidia = require('../servicios/ia/proveedores/nvidia');
});

after(() => {
    servidor.close();
    for (const k of ['NVIDIA_URL', 'NVIDIA_API_KEY', 'NVIDIA_MODELO', 'NVIDIA_MODELO_TEXTO']) {
        if (k in entornoAntes) process.env[k] = entornoAntes[k]; else delete process.env[k];
    }
});

const errorDe = async (esc, fn) => { escenario = esc; try { await fn(); return null; } catch (e) { return e; } };

test('nvidia: comprobante → imagen como data URI, esquema estricto, sin razonamiento', async () => {
    escenario = 'ok';
    await nvidia.analizar({ imagenBase64: 'QUJD', mime: 'image/png', instrucciones: 'X' });
    assert.equal(ultima.url, '/v1/chat/completions');
    assert.equal(ultima.auth, 'Bearer nvapi-PRUEBA-NO-REAL');
    assert.equal(ultima.body.model, 'modelo-vision');
    assert.equal(ultima.body.reasoning_effort, 'none');
    assert.equal(ultima.body.response_format.json_schema.strict, true);
    assert.equal(ultima.body.messages[0].content[1].image_url.url, 'data:image/png;base64,QUJD');
    assert.ok(!JSON.stringify(ultima.body).includes('nvapi-'), 'la clave solo va en la cabecera');
});

test('nvidia: conversar → mensaje de sistema primero y modelo de texto por defecto', async () => {
    escenario = 'ok';
    await nvidia.conversar({ sistema: 'reglas', mensajes: [{ role: 'user', content: 'hola' }], esquema: { type: 'object' } });
    assert.equal(ultima.body.model, 'nvidia/nemotron-3.5-lightning-30b-a3b');
    assert.deepEqual(ultima.body.messages.map((m) => m.role), ['system', 'user']);
    assert.equal(ultima.body.response_format.json_schema.name, 'respuesta_asistente');
});

test('nvidia: 429 y 503 son reintentables; 401 no, y el mensaje oculta la clave', async () => {
    const r = (x) => nvidia.analizar({ imagenBase64: 'QUJD', mime: 'image/png', instrucciones: 'X' });
    let e = await errorDe('429', r); assert.ok(e.reintentable); assert.equal(e.esperaMs, 1000);
    e = await errorDe('503', r); assert.ok(e.reintentable);
    e = await errorDe('401', r); assert.ok(!e.reintentable); assert.ok(!e.message.includes('nvapi-PRUEBA'));
    e = await errorDe('largo', r); assert.match(e.message, /cortó la respuesta/);
});
