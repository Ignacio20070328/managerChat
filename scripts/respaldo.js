// Respaldo de la base de datos y de las fotos de comprobantes.
//   npm run respaldo
// Crea respaldos/terrychat-AAAA-MM-DD_HHMMSS/ con:
//   base.sql.gz  → volcado completo de la base (mysqldump, comprimido)
//   uploads/     → copia de public/uploads (las fotos que referencia la base)
//   info.json    → fecha y tamaño
// Conserva los últimos RESPALDOS_MAXIMOS (por defecto 10) y borra los más antiguos.
//
// ⚠️ Los respaldos contienen datos personales (teléfonos y comprobantes): la carpeta
// respaldos/ está en .gitignore y solo tu usuario puede leerla. Nunca la subas ni la compartas.
//
// La contraseña de MySQL no pasa por la línea de comandos de tu computador: el volcado se
// hace DENTRO del contenedor usando sus propias variables de entorno.

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { spawn } = require('child_process');
const { CARPETA_UPLOADS } = require('../config/carpetas');

const CONTENEDOR = process.env.DB_CONTENEDOR || 'mysql-gestor-mvp';
const CARPETA_RESPALDOS = path.join(__dirname, '..', 'respaldos');
const PREFIJO = 'terrychat-';

function maximoRespaldos() {
    const n = Number(process.env.RESPALDOS_MAXIMOS);
    return Number.isInteger(n) && n > 0 ? n : 10;
}

function marcaDeTiempo(fecha = new Date()) {
    const d = (n) => String(n).padStart(2, '0');
    return `${fecha.getFullYear()}-${d(fecha.getMonth() + 1)}-${d(fecha.getDate())}_${d(fecha.getHours())}${d(fecha.getMinutes())}${d(fecha.getSeconds())}`;
}

/** Ejecuta mysqldump en el contenedor y guarda la salida comprimida en `destino`. */
function volcarBase(destino) {
    return new Promise((resolver, rechazar) => {
        const volcado = spawn('docker', ['exec', CONTENEDOR, 'sh', '-c',
            'exec mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" --single-transaction --no-tablespaces ' +
            '--routines --triggers --set-gtid-purged=OFF --databases "$MYSQL_DATABASE"']);
        const archivo = fs.createWriteStream(destino, { mode: 0o600 });
        let errores = '';
        volcado.stderr.on('data', (d) => { errores += d; });
        volcado.on('error', rechazar); // docker no instalado
        volcado.stdout.pipe(zlib.createGzip()).pipe(archivo);
        volcado.on('close', (codigo) => {
            archivo.on('close', () => {
                // mysqldump avisa siempre que se usó una contraseña: no es un error
                const reales = errores.split('\n').filter((l) => l.trim() && !/Using a password/i.test(l)).join('\n');
                if (codigo !== 0) return rechazar(new Error(`mysqldump terminó con código ${codigo}. ${reales}`.trim()));
                resolver();
            });
        });
    });
}

/** Borra los respaldos más antiguos, dejando los últimos `maximo`. */
function rotar(maximo = maximoRespaldos()) {
    const todos = listarRespaldos();
    const sobran = todos.slice(0, Math.max(0, todos.length - maximo));
    for (const nombre of sobran) fs.rmSync(path.join(CARPETA_RESPALDOS, nombre), { recursive: true, force: true });
    return sobran;
}

function listarRespaldos() {
    if (!fs.existsSync(CARPETA_RESPALDOS)) return [];
    return fs.readdirSync(CARPETA_RESPALDOS)
        .filter((n) => n.startsWith(PREFIJO) && fs.existsSync(path.join(CARPETA_RESPALDOS, n, 'base.sql.gz')))
        .sort();
}

/**
 * Crea un respaldo completo.
 * @param sufijo  texto extra en el nombre (p. ej. "antes-de-restaurar")
 * @returns ruta de la carpeta creada
 */
async function respaldar({ sufijo = '' } = {}) {
    fs.mkdirSync(CARPETA_RESPALDOS, { recursive: true, mode: 0o700 });
    fs.chmodSync(CARPETA_RESPALDOS, 0o700);
    const carpeta = path.join(CARPETA_RESPALDOS, `${PREFIJO}${marcaDeTiempo()}${sufijo ? `_${sufijo}` : ''}`);
    fs.mkdirSync(carpeta, { mode: 0o700 });
    try {
        const base = path.join(carpeta, 'base.sql.gz');
        await volcarBase(base);
        let fotos = 0;
        if (fs.existsSync(CARPETA_UPLOADS)) {
            fs.cpSync(CARPETA_UPLOADS, path.join(carpeta, 'uploads'), { recursive: true });
            fotos = fs.readdirSync(path.join(carpeta, 'uploads')).length;
        }
        const info = { fecha: new Date().toISOString(), contenedor: CONTENEDOR, bytesBase: fs.statSync(base).size, fotos };
        fs.writeFileSync(path.join(carpeta, 'info.json'), JSON.stringify(info, null, 2), { mode: 0o600 });
        return { carpeta, ...info };
    } catch (error) {
        fs.rmSync(carpeta, { recursive: true, force: true }); // no dejar respaldos a medias
        throw error;
    }
}

module.exports = { CARPETA_RESPALDOS, CONTENEDOR, listarRespaldos, respaldar, rotar };

if (require.main === module) {
    respaldar()
        .then(({ carpeta, bytesBase, fotos }) => {
            const borrados = rotar();
            console.log(`Respaldo creado: ${path.relative(process.cwd(), carpeta)}`);
            console.log(`  base: ${(bytesBase / 1024).toFixed(1)} KB comprimida · fotos: ${fotos}`);
            if (borrados.length) console.log(`  se borraron ${borrados.length} respaldo(s) antiguo(s) (se conservan ${maximoRespaldos()})`);
        })
        .catch((error) => {
            console.error('No se pudo crear el respaldo:', error.message);
            console.error(`¿Está corriendo la base? (docker compose up -d) · contenedor esperado: ${CONTENEDOR}`);
            process.exitCode = 1;
        });
}
