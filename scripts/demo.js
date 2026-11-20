// Datos de ejemplo para probar o presentar la app sin WhatsApp.
//   npm run demo:cargar   → crea productos, pedidos en todas las etapas, comprobantes y análisis de IA
//   npm run demo:borrar   → borra SOLO los datos de ejemplo (nunca datos reales)
//
// Los clientes de ejemplo usan teléfonos que empiezan con PREFIJO_DEMO y los productos
// llevan "(ejemplo)" en la descripción: así se distinguen de los reales al borrar.
// El análisis de IA es SIMULADO (no se llama a ningún proveedor), pero las reglas son las reales.

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const fs = require('fs/promises');
const db = require('../config/db');
const pedidos = require('../servicios/pedidos');
const productos = require('../servicios/productos');
const configuracion = require('../servicios/configuracion');
const analisis = require('../servicios/analisis');
const { crearCadena } = require('../servicios/ia');
const { registrarComprobante, prepararCarpeta } = require('../bot/comprobantes');
const { CARPETA_UPLOADS } = require('../config/carpetas');

const { PREFIJO_DEMO } = require('../config/demo');
const MARCA_PRODUCTO = '(ejemplo)';
const tel = (n) => `${PREFIJO_DEMO}${String(n).padStart(4, '0')}`;
const haceMinutos = (m) => new Date(Date.now() - m * 60_000);
const haceDias = (d, hora = 15) => { const f = new Date(Date.now() - d * 86_400_000); f.setHours(hora, 20, 0, 0); return f; };

const CUENTA_NEGOCIO = '12345678';
const DATOS_TRANSFERENCIA = `Banco Ejemplo\nCuenta Vista N° ${CUENTA_NEGOCIO}\nRUT 11.111.111-1\nTitular: Mermeladas Terry\npagos@ejemplo.cl`;

// ---------- Imagen del comprobante ----------

function htmlComprobante(c) {
    const pesos = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(c.monto);
    const fila = (k, v) => `<div class="f"><span>${k}</span><b>${v}</b></div>`;
    return `<html><body style="margin:0;font-family:Arial,sans-serif;background:#eef2f6">
      <div style="width:340px;margin:10px;background:#fff;border-radius:14px;overflow:hidden;position:relative;box-shadow:0 2px 8px #0002">
        <div style="background:${c.color};color:#fff;padding:16px 18px;font-size:18px;font-weight:bold">${c.banco}</div>
        <div style="padding:16px 18px">
          <div style="color:#1a7f37;font-weight:bold;font-size:15px">✔ Transferencia exitosa</div>
          <div style="font-size:30px;font-weight:bold;margin:10px 0 14px">${pesos}</div>
          ${fila('Fecha', c.fecha)}${fila('N° de operación', c.operacion)}
          ${fila('Banco destino', 'Banco Ejemplo')}${fila('Cuenta destino', c.cuenta)}${fila('Titular', 'Mermeladas Terry')}
        </div>
        <div style="position:absolute;top:44%;left:-20px;right:-20px;text-align:center;transform:rotate(-24deg);
                    font-size:54px;font-weight:900;color:#d0003c33;letter-spacing:4px">EJEMPLO</div>
      </div>
      <style>.f{display:flex;justify-content:space-between;font-size:13px;padding:6px 0;border-top:1px solid #eee}.f span{color:#666}</style>
    </body></html>`;
}

/** Genera las imágenes con el Chromium que ya trae whatsapp-web.js (puppeteer). */
async function generarImagenes(comprobantes) {
    const puppeteer = require('puppeteer');
    const navegador = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    try {
        const pagina = await navegador.newPage();
        await pagina.setViewport({ width: 360, height: 400, deviceScaleFactor: 2 });
        const imagenes = new Map();
        for (const c of comprobantes) {
            await pagina.setContent(htmlComprobante(c));
            const elemento = await pagina.$('body > div');
            imagenes.set(c.operacion, (await elemento.screenshot({ type: 'png' })).toString('base64'));
        }
        return imagenes;
    } finally {
        await navegador.close();
    }
}

// ---------- Escenario ----------

async function hayDemo() {
    const [[c]] = await db.query('SELECT COUNT(*) AS n FROM Clientes WHERE telefono LIKE ?', [`${PREFIJO_DEMO}%`]);
    const [[p]] = await db.query('SELECT COUNT(*) AS n FROM Productos WHERE descripcion LIKE ?', [`%${MARCA_PRODUCTO}%`]);
    return c.n + p.n > 0;
}

async function cargar() {
    if (await hayDemo()) {
        console.log('Ya hay datos de ejemplo cargados. Para empezar de nuevo: npm run demo:borrar');
        return;
    }
    await prepararCarpeta();

    // Productos (se omiten los que ya existan con el mismo nombre)
    const catalogo = {};
    for (const [clave, nombre, precio, descripcion, activo] of [
        ['frambuesa', 'Mermelada de Frambuesa', 4500, 'Frasco 250 g', true],
        ['cereza', 'Mermelada de Cereza', 5000, 'Frasco 250 g', true],
        ['mora', 'Mermelada de Mora', 4800, 'Frasco 250 g, sin azúcar', true],
        ['damasco', 'Mermelada de Damasco', 4200, 'Sin stock por ahora', false],
    ]) {
        try {
            catalogo[clave] = await productos.crear(db, { nombre, precio, descripcion: `${descripcion} ${MARCA_PRODUCTO}`, activo });
        } catch (error) {
            if (error.status !== 409) throw error;
            const [[existente]] = await db.query('SELECT * FROM Productos WHERE nombre = ?', [nombre]);
            catalogo[clave] = existente;
            console.log(`  (ya existía "${nombre}": se usa el existente)`);
        }
    }

    // Configuración: solo si está vacía (no pisa datos reales)
    const config = await configuracion.obtener(db);
    const cambios = {};
    if (!config.datos_transferencia) cambios.datos_transferencia = DATOS_TRANSFERENCIA;
    if (config.nombre_negocio === 'Mi emprendimiento') cambios.nombre_negocio = 'Mermeladas Terry';
    if (Object.keys(cambios).length) await configuracion.actualizar(db, cambios);

    const item = (clave, cantidad) => ({ id_producto: catalogo[clave].id_producto, cantidad });
    const fechaTexto = (f) => f.toLocaleString('es-CL', { timeZone: 'America/Santiago', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    // Comprobantes de ejemplo: lo que "lee" la IA simulada es exactamente lo que dice la imagen
    const C = (operacion, monto, cuandoPago, banco = 'Banco Ejemplo', color = '#0057b8', cuenta = CUENTA_NEGOCIO) =>
        ({ operacion, monto, cuandoPago, banco, color, cuenta, fecha: fechaTexto(cuandoPago) });
    const comprobantes = {
        ok: C('0048213377', 14500, haceMinutos(28), 'BancoEjemplo Personas', '#c8102e'),
        menor: C('0091822004', 4000, haceMinutos(130)),
        sinPedido: C('0073310298', 9000, haceMinutos(70), 'Banco Digital Demo', '#5b2a86'),
        original: C('0066120045', 9500, haceDias(3, 11)),
        // Reutiliza el N° de operación del comprobante "original" (ya entregado)
        copia: C('0066120045', 9500, haceDias(3, 11)),
        aprobado1: C('0011200331', 9000, haceDias(0, 10)),
        aprobado2: C('0011200877', 4800, haceDias(1, 17)),
        rechazado: C('0055100912', 5000, haceDias(2, 12), 'Banco Ejemplo', '#0057b8', '98765432'),
    };
    const entregados = [[6, 2], [5, 1], [5, 3], [4, 2], [2, 1], [1, 3]].map(([dias, n], i) =>
        ({ clave: `entregado${i}`, dias, items: [item(i % 2 ? 'frambuesa' : 'cereza', n)] }));
    for (const e of entregados) comprobantes[e.clave] = C(`00${String(30000000 + e.dias * 1000 + e.items[0].cantidad * 7)}`, 0, haceDias(e.dias, 13));

    console.log('Generando imágenes de comprobantes…');
    // El monto de los entregados se calcula de sus productos
    for (const e of entregados) {
        const p = catalogo[e.items[0].id_producto === catalogo.cereza.id_producto ? 'cereza' : 'frambuesa'];
        comprobantes[e.clave].monto = p.precio * e.items[0].cantidad;
    }
    const imagenes = await generarImagenes(Object.values(comprobantes));

    // IA simulada: devuelve los datos del comprobante correspondiente a la imagen recibida
    const porImagen = new Map(Object.values(comprobantes).map((c) => [imagenes.get(c.operacion), c]));
    const iaDemo = crearCadena([{
        nombre: 'simulado', modelo: () => 'demo',
        analizar: async ({ imagenBase64 }) => {
            const c = porImagen.get(imagenBase64);
            const f = c.cuandoPago;
            const local = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(f).replace(' ', 'T');
            return { es_comprobante: true, monto: c.monto, banco_origen: c.banco, banco_destino: 'Banco Ejemplo',
                cuenta_destino: c.cuenta, titular_destino: 'Mermeladas Terry', numero_operacion: c.operacion, fecha_transferencia: local };
        }
    }]);

    /** Crea un pedido en la etapa pedida y ajusta sus fechas para que parezcan reales. */
    async function pedido(n, { items, comprobante, etapa, pedidoHace, motivo }) {
        const telefono = tel(n);
        let id;
        if (items) id = (await pedidos.crearPedidoPorPagar(db, telefono, items)).id_pedido;
        if (comprobante) {
            const c = comprobantes[comprobante];
            id = (await registrarComprobante(db, telefono, { mimetype: 'image/png', data: imagenes.get(c.operacion) })).idPedido;
            const recibido = new Date(c.cuandoPago.getTime() + 2 * 60_000);
            await db.query('UPDATE Pedidos SET fecha = ?, fecha_comprobante = ? WHERE id_pedido = ?',
                [items ? new Date(recibido.getTime() - 40 * 60_000) : recibido, recibido, id]);
            await analisis.analizarPedido(db, id, { cadena: iaDemo });
            if (etapa === 'Aprobado' || etapa === 'Entregado') {
                await pedidos.aprobar(db, id);
                await db.query('UPDATE Pedidos SET fecha_aprobacion = ? WHERE id_pedido = ?', [new Date(recibido.getTime() + 25 * 60_000), id]);
            }
            if (etapa === 'Entregado') {
                await pedidos.entregar(db, id);
                await db.query('UPDATE Pedidos SET fecha_entrega = ? WHERE id_pedido = ?', [new Date(recibido.getTime() + 26 * 3_600_000), id]);
            }
            if (etapa === 'Rechazado') {
                await pedidos.rechazar(db, id, motivo);
                await db.query('UPDATE Pedidos SET fecha_rechazo = ? WHERE id_pedido = ?', [new Date(recibido.getTime() + 15 * 60_000), id]);
            }
        } else if (pedidoHace) {
            await db.query('UPDATE Pedidos SET fecha = ? WHERE id_pedido = ?', [pedidoHace, id]);
        }
        return id;
    }

    console.log('Creando pedidos…');
    // Historial (primero, para que el "original" sea anterior a la "copia")
    for (const [i, e] of entregados.entries()) await pedido(20 + i, { items: e.items, comprobante: e.clave, etapa: 'Entregado' });
    await pedido(30, { items: [item('frambuesa', 1), item('cereza', 1)], comprobante: 'original', etapa: 'Entregado' });
    await pedido(31, { items: [item('cereza', 1)], comprobante: 'rechazado', etapa: 'Rechazado', motivo: 'La transferencia fue a otra cuenta' });
    // Por entregar
    await pedido(40, { items: [item('frambuesa', 2)], comprobante: 'aprobado1', etapa: 'Aprobado' });
    await pedido(41, { items: [item('mora', 1)], comprobante: 'aprobado2', etapa: 'Aprobado' });
    // Comprobantes por revisar: uno correcto, monto menor, sin pedido previo y uno reutilizado
    await pedido(1, { items: [item('cereza', 2), item('frambuesa', 1)], comprobante: 'ok' });
    await pedido(2, { items: [item('mora', 1)], comprobante: 'menor' });
    await pedido(3, { comprobante: 'sinPedido' });
    await pedido(4, { items: [item('frambuesa', 1), item('cereza', 1)], comprobante: 'copia' });
    // Esperando pago
    await pedido(50, { items: [item('cereza', 3)], pedidoHace: haceMinutos(45) });
    await pedido(51, { items: [item('frambuesa', 1), item('mora', 2)], pedidoHace: haceDias(1, 19) });

    const [conteo] = await db.query(
        `SELECT p.estado, COUNT(*) AS n FROM Pedidos p JOIN Clientes c USING (id_cliente)
         WHERE c.telefono LIKE ? GROUP BY p.estado`, [`${PREFIJO_DEMO}%`]);
    console.log('Listo. Pedidos de ejemplo por etapa:', Object.fromEntries(conteo.map((r) => [r.estado, r.n])));
    console.log('Abre la app (o deslízala hacia abajo para recargar).');
}

async function borrar() {
    const [archivos] = await db.query(
        `SELECT p.ruta_comprobante FROM Pedidos p JOIN Clientes c USING (id_cliente)
         WHERE c.telefono LIKE ? AND p.ruta_comprobante IS NOT NULL`, [`${PREFIJO_DEMO}%`]);
    // AnalisisComprobante y DetallePedido se borran en cascada con el pedido
    const [p] = await db.query(
        'DELETE p FROM Pedidos p JOIN Clientes c USING (id_cliente) WHERE c.telefono LIKE ?', [`${PREFIJO_DEMO}%`]);
    const [c] = await db.query('DELETE FROM Clientes WHERE telefono LIKE ?', [`${PREFIJO_DEMO}%`]);
    // Solo productos de ejemplo que ningún pedido real use
    const [pr] = await db.query(
        `DELETE FROM Productos WHERE descripcion LIKE ?
         AND id_producto NOT IN (SELECT DISTINCT id_producto FROM DetallePedido)`, [`%${MARCA_PRODUCTO}%`]);
    for (const { ruta_comprobante } of archivos) {
        await fs.unlink(path.join(CARPETA_UPLOADS, path.basename(ruta_comprobante))).catch(() => {});
    }
    console.log(`Borrados: ${p.affectedRows} pedidos, ${c.affectedRows} clientes, ${pr.affectedRows} productos y ${archivos.length} imágenes de ejemplo.`);
    console.log('La configuración del negocio (Ajustes) no se tocó.');
}

const accion = process.argv[2];
(accion === 'cargar' ? cargar() : accion === 'borrar' ? borrar() : Promise.reject(new Error('Uso: node scripts/demo.js cargar|borrar')))
    .catch((error) => { console.error('Error:', error.message); process.exitCode = 1; })
    .finally(() => db.end());
