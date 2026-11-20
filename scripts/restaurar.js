// Restaura un respaldo creado con `npm run respaldo`.
//   npm run restaurar                  → lista los respaldos disponibles
//   npm run restaurar -- <nombre>      → restaura ese respaldo (pide confirmación)
//
// REEMPLAZA la base y las fotos actuales por las del respaldo. Antes de hacerlo crea
// automáticamente un respaldo del estado actual ("…_antes-de-restaurar"), por si te equivocas.
// Conviene detener el servidor (npm start / npm run api) antes de restaurar.

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const readline = require('readline');
const { spawn } = require('child_process');
const { CARPETA_UPLOADS } = require('../config/carpetas');
const { CARPETA_RESPALDOS, CONTENEDOR, listarRespaldos, respaldar } = require('./respaldo');

function confirmar(pregunta) {
    if (!process.stdin.isTTY) return Promise.resolve(process.argv.includes('--si'));
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolver) => rl.question(pregunta, (r) => { rl.close(); resolver(r.trim() === 'RESTAURAR'); }));
}

/** Envía el volcado comprimido al cliente mysql dentro del contenedor (como root). */
function cargarBase(archivo) {
    return new Promise((resolver, rechazar) => {
        const mysql = spawn('docker', ['exec', '-i', CONTENEDOR, 'sh', '-c', 'exec mysql -uroot -p"$MYSQL_ROOT_PASSWORD"']);
        let errores = '';
        mysql.stderr.on('data', (d) => { errores += d; });
        mysql.on('error', rechazar);
        fs.createReadStream(archivo).pipe(zlib.createGunzip()).on('error', rechazar).pipe(mysql.stdin);
        mysql.on('close', (codigo) => {
            const reales = errores.split('\n').filter((l) => l.trim() && !/Using a password/i.test(l)).join('\n');
            if (codigo !== 0) return rechazar(new Error(`mysql terminó con código ${codigo}. ${reales}`.trim()));
            resolver();
        });
    });
}

/** Deja public/uploads exactamente como en el respaldo. */
function restaurarFotos(carpetaRespaldo) {
    const origen = path.join(carpetaRespaldo, 'uploads');
    fs.mkdirSync(CARPETA_UPLOADS, { recursive: true });
    for (const f of fs.readdirSync(CARPETA_UPLOADS)) fs.rmSync(path.join(CARPETA_UPLOADS, f), { recursive: true, force: true });
    if (fs.existsSync(origen)) fs.cpSync(origen, CARPETA_UPLOADS, { recursive: true });
    return fs.readdirSync(CARPETA_UPLOADS).length;
}

(async () => {
    const disponibles = listarRespaldos();
    const nombre = process.argv.slice(2).find((a) => !a.startsWith('--'));

    if (!nombre) {
        if (!disponibles.length) return console.log('No hay respaldos. Crea uno con: npm run respaldo');
        console.log('Respaldos disponibles (el más nuevo al final):');
        for (const n of disponibles) {
            const info = JSON.parse(fs.readFileSync(path.join(CARPETA_RESPALDOS, n, 'info.json'), 'utf8'));
            console.log(`  ${n}   (${info.fotos} fotos, ${(info.bytesBase / 1024).toFixed(1)} KB)`);
        }
        return console.log('\nPara restaurar: npm run restaurar -- <nombre>');
    }

    // Solo se aceptan nombres de la lista (nunca rutas arbitrarias)
    if (!disponibles.includes(nombre)) {
        console.error(`No existe el respaldo "${nombre}". Ejecuta "npm run restaurar" para ver la lista.`);
        process.exitCode = 1;
        return;
    }
    const carpeta = path.join(CARPETA_RESPALDOS, nombre);

    console.log(`Vas a REEMPLAZAR la base de datos y las fotos actuales por las del respaldo ${nombre}.`);
    if (!(await confirmar('Escribe RESTAURAR para continuar: '))) {
        console.log('Cancelado. No se cambió nada.');
        return;
    }

    console.log('1/3 Respaldando el estado actual por si acaso…');
    const previo = await respaldar({ sufijo: 'antes-de-restaurar' });
    console.log(`    → ${path.basename(previo.carpeta)}`);
    console.log('2/3 Restaurando la base…');
    await cargarBase(path.join(carpeta, 'base.sql.gz'));
    console.log('3/3 Restaurando las fotos…');
    const fotos = restaurarFotos(carpeta);
    console.log(`Listo: base restaurada y ${fotos} fotos. Reinicia el servidor.`);
})().catch((error) => {
    console.error('No se pudo restaurar:', error.message);
    process.exitCode = 1;
});
