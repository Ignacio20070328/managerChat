// Imágenes de comprobantes de EJEMPLO (con marca de agua "EJEMPLO"), para los datos de ejemplo
// (scripts/demo.js) y el chat simulado (scripts/simular-chat.js). Nunca se envían a clientes.


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
          ${fila('Banco destino', c.bancoDestino ?? 'Banco Ejemplo')}${fila('Cuenta destino', c.cuenta)}${fila('Titular', c.titular ?? 'Mermeladas Terry')}
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

module.exports = { generarImagenes, htmlComprobante };
