const express = require('express');
const cors = require('cors');
const {
    MAX_INTENTOS,
    crearLimitadorDeIntentos,
    crearToken,
    requiereSesion,
    verificarPassword
} = require('./lib/auth');
const { ErrorApi } = require('./lib/errores');
const { crearRutas } = require('./rutas');
const { CARPETA_UPLOADS } = require('./config/carpetas');

/**
 * Construye la aplicación Express sin arrancar nada (ni servidor ni bot),
 * para poder probarla. El arranque real está en index.js.
 * @param db     pool de mysql2/promise
 * @param auth   { secreto, passwordHash } (lib/auth.leerConfiguracion)
 * @param bot    { estado(), notificar(telefono, texto) }
 * @param origenesCors  orígenes web con permiso CORS (la app nativa no lo necesita)
 */
function crearApp({ db, auth, bot, ia, origenesCors = [], carpetaUploads = CARPETA_UPLOADS }) {
    const app = express();
    app.disable('x-powered-by');

    if (origenesCors.length > 0) {
        app.use(cors({ origin: origenesCors }));
    }
    app.use(express.json({ limit: '10kb' }));

    // --- Rutas públicas ---
    // Página de verificación: abrir http://<IP>:3000 en el navegador confirma que el servidor responde
    app.get('/', (req, res) => {
        res.type('text').send('✅ Servidor de TerryChat funcionando. Abre la app para usarlo.');
    });

    const limitador = crearLimitadorDeIntentos();
    app.post('/api/login', (req, res) => {
        const ip = req.ip;
        if (limitador.bloqueado(ip)) {
            return res.status(429).json({
                error: `Demasiados intentos fallidos (${MAX_INTENTOS}). Espera 15 minutos.`
            });
        }
        if (!verificarPassword(req.body?.password, auth.passwordHash)) {
            limitador.registrarFallo(ip);
            console.warn(`Intento de login fallido desde ${ip}`);
            return res.status(401).json({ error: 'Contraseña incorrecta' });
        }
        limitador.limpiar(ip);
        res.json({ token: crearToken(auth.secreto) });
    });

    // --- Todo lo demás exige sesión ---
    const conSesion = requiereSesion(auth.secreto);
    app.use('/api', conSesion, crearRutas({ db, bot, ia }));
    app.use('/uploads', conSesion, express.static(carpetaUploads));

    // Ruta de la API (ya autenticada) que no existe
    app.use('/api', (req, res) => {
        res.status(404).json({ error: 'Ruta no encontrada' });
    });

    // Errores: los ErrorApi llevan su código y un mensaje apto para el usuario;
    // cualquier otro error se registra y se responde con un mensaje genérico.
    app.use((error, req, res, next) => {
        if (error instanceof ErrorApi) {
            return res.status(error.status).json({ error: error.message });
        }
        if (error.type === 'entity.parse.failed' || error.type === 'entity.too.large') {
            return res.status(400).json({ error: 'Solicitud inválida' });
        }
        console.error(`Error no controlado en ${req.method} ${req.path}`, error);
        res.status(500).json({ error: 'Error interno' });
    });

    return app;
}

module.exports = { crearApp };
