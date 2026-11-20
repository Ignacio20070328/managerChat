const crypto = require('crypto');

// Parámetros de scrypt para el hash de la contraseña
const SCRYPT = { N: 16384, r: 8, p: 1, largo: 64 };
const DURACION_TOKEN_MS = 30 * 24 * 60 * 60 * 1000; // 30 días

// Límite de intentos de login fallidos por IP
const MAX_INTENTOS = 5;
const VENTANA_INTENTOS_MS = 15 * 60 * 1000; // 15 minutos

function hashearPassword(password) {
    const sal = crypto.randomBytes(16);
    const hash = crypto.scryptSync(password, sal, SCRYPT.largo, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p });
    return ['scrypt', SCRYPT.N, SCRYPT.r, SCRYPT.p, sal.toString('base64url'), hash.toString('base64url')].join('$');
}

function parsearHash(textoHash) {
    const partes = (textoHash || '').split('$');
    if (partes.length !== 6 || partes[0] !== 'scrypt') return null;
    const [, N, r, p, sal, hash] = partes;
    return { N: Number(N), r: Number(r), p: Number(p), sal: Buffer.from(sal, 'base64url'), hash: Buffer.from(hash, 'base64url') };
}

function verificarPassword(password, textoHash) {
    const h = parsearHash(textoHash);
    if (!h || typeof password !== 'string' || password.length === 0 || password.length > 200) return false;
    const calculado = crypto.scryptSync(password, h.sal, h.hash.length, { N: h.N, r: h.r, p: h.p });
    return crypto.timingSafeEqual(calculado, h.hash);
}

function firmar(datos, secreto) {
    return crypto.createHmac('sha256', secreto).update(datos).digest('base64url');
}

function crearToken(secreto, ahora = Date.now()) {
    const carga = Buffer.from(JSON.stringify({ v: 1, exp: ahora + DURACION_TOKEN_MS })).toString('base64url');
    return `${carga}.${firmar(carga, secreto)}`;
}

function tokenEsValido(token, secreto, ahora = Date.now()) {
    if (typeof token !== 'string') return false;
    const [carga, firma, ...resto] = token.split('.');
    if (!carga || !firma || resto.length > 0) return false;

    const esperada = Buffer.from(firmar(carga, secreto));
    const recibida = Buffer.from(firma);
    if (esperada.length !== recibida.length || !crypto.timingSafeEqual(esperada, recibida)) return false;

    try {
        const { v, exp } = JSON.parse(Buffer.from(carga, 'base64url').toString());
        return v === 1 && typeof exp === 'number' && exp > ahora;
    } catch {
        return false;
    }
}

/**
 * Lee y valida la configuración de autenticación del .env.
 * Detiene el servidor al arrancar si falta algo, en vez de dejar la API abierta.
 */
function leerConfiguracion(env = process.env) {
    const secreto = env.TOKEN_SECRET || '';
    if (secreto.length < 32) {
        throw new Error('TOKEN_SECRET falta o es muy corto (mínimo 32 caracteres). Revisa .env.example.');
    }
    if (!parsearHash(env.ADMIN_PASSWORD_HASH)) {
        throw new Error('ADMIN_PASSWORD_HASH falta o no es válido. Créalo con: npm run crear-password');
    }
    return { secreto, passwordHash: env.ADMIN_PASSWORD_HASH };
}

function crearLimitadorDeIntentos() {
    const intentos = new Map(); // ip → { fallos, reinicio }
    return {
        bloqueado(ip, ahora = Date.now()) {
            const r = intentos.get(ip);
            if (!r || r.reinicio <= ahora) return false;
            return r.fallos >= MAX_INTENTOS;
        },
        registrarFallo(ip, ahora = Date.now()) {
            const r = intentos.get(ip);
            if (!r || r.reinicio <= ahora) {
                intentos.set(ip, { fallos: 1, reinicio: ahora + VENTANA_INTENTOS_MS });
            } else {
                r.fallos += 1;
            }
        },
        limpiar(ip) {
            intentos.delete(ip);
        }
    };
}

/** Middleware de Express: exige "Authorization: Bearer <token>" válido. */
function requiereSesion(secreto) {
    return (req, res, next) => {
        const [tipo, token] = (req.get('authorization') || '').split(' ');
        if (tipo === 'Bearer' && tokenEsValido(token, secreto)) return next();
        res.status(401).json({ error: 'Sesión inválida o expirada' });
    };
}

module.exports = {
    DURACION_TOKEN_MS,
    MAX_INTENTOS,
    crearLimitadorDeIntentos,
    crearToken,
    hashearPassword,
    leerConfiguracion,
    requiereSesion,
    tokenEsValido,
    verificarPassword
};
