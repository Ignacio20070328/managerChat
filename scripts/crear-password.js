// Crea o cambia la contraseña de acceso a la app y la guarda (como hash) en .env.
// Uso: npm run crear-password
// Cambiar la contraseña con este script también cierra todas las sesiones abiertas.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { hashearPassword } = require('../lib/auth');

const RUTA_ENV = path.join(__dirname, '..', '.env');
const LARGO_MINIMO = 10;

/** Lee una línea desde la terminal sin mostrar lo que se escribe. */
function preguntarOcultoEnTerminal(pregunta) {
    return new Promise((resolve) => {
        process.stdout.write(pregunta);
        const entrada = process.stdin;
        entrada.setRawMode(true);
        entrada.resume();
        entrada.setEncoding('utf8');
        let texto = '';

        const alTeclear = (teclas) => {
            for (const tecla of teclas) {
                if (tecla === '\r' || tecla === '\n') {
                    entrada.setRawMode(false);
                    entrada.pause();
                    entrada.removeListener('data', alTeclear);
                    process.stdout.write('\n');
                    return resolve(texto);
                }
                if (tecla === '\u0003') { // Ctrl+C
                    entrada.setRawMode(false);
                    process.stdout.write('\nCancelado.\n');
                    process.exit(130);
                }
                if (tecla === '\u007f' || tecla === '\b') { // Borrar
                    texto = texto.slice(0, -1);
                } else if (tecla >= ' ') {
                    texto += tecla;
                }
            }
        };
        entrada.on('data', alTeclear);
    });
}

/** Sin terminal (entrada por tubería): lee las dos primeras líneas. */
async function leerDeTuberia() {
    const datos = fs.readFileSync(0, 'utf8').split(/\r?\n/);
    return [datos[0] || '', datos[1] || ''];
}

function fijarVariable(contenido, nombre, valor) {
    const linea = `${nombre}=${valor}`;
    const patron = new RegExp(`^${nombre}=.*$`, 'm');
    return patron.test(contenido) ? contenido.replace(patron, () => linea) : `${contenido.trimEnd()}\n${linea}\n`;
}

function fallar(mensaje) {
    console.error(mensaje);
    process.exit(1);
}

(async () => {
    if (!fs.existsSync(RUTA_ENV)) fallar('No existe .env. Primero: cp .env.example .env');

    let password;
    let confirmacion;
    if (process.stdin.isTTY) {
        password = await preguntarOcultoEnTerminal(`Nueva contraseña (mínimo ${LARGO_MINIMO} caracteres): `);
        confirmacion = await preguntarOcultoEnTerminal('Repite la contraseña: ');
    } else {
        [password, confirmacion] = await leerDeTuberia();
    }

    if (password.length < LARGO_MINIMO) fallar(`La contraseña debe tener al menos ${LARGO_MINIMO} caracteres.`);
    if (password !== confirmacion) fallar('Las contraseñas no coinciden. No se cambió nada.');

    let contenido = fs.readFileSync(RUTA_ENV, 'utf8');
    contenido = fijarVariable(contenido, 'ADMIN_PASSWORD_HASH', hashearPassword(password));
    // Un secreto nuevo invalida todos los tokens emitidos antes
    contenido = fijarVariable(contenido, 'TOKEN_SECRET', crypto.randomBytes(32).toString('base64url'));
    fs.writeFileSync(RUTA_ENV, contenido, { mode: 0o600 });
    fs.chmodSync(RUTA_ENV, 0o600);

    console.log('Contraseña guardada en .env. Las sesiones anteriores quedaron cerradas.');
    console.log('Reinicia el servidor para aplicar el cambio.');
})();
