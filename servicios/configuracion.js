const { validacion } = require('../lib/errores');

// Claves permitidas, con su largo máximo y valor por defecto
const CLAVES = {
    nombre_negocio: { maximo: 80, defecto: 'Mi emprendimiento' },
    // Se envía al cliente junto con el total de su pedido
    datos_transferencia: { maximo: 1000, defecto: '' }
};

async function obtener(db) {
    const [filas] = await db.query('SELECT clave, valor FROM Configuracion');
    const guardado = Object.fromEntries(filas.map((f) => [f.clave, f.valor]));
    return Object.fromEntries(
        Object.entries(CLAVES).map(([clave, { defecto }]) => [clave, guardado[clave] ?? defecto])
    );
}

async function actualizar(db, datos) {
    const cambios = [];
    for (const [clave, valor] of Object.entries(datos || {})) {
        const regla = CLAVES[clave];
        if (!regla) throw validacion(`Opción desconocida: ${clave}`);
        if (typeof valor !== 'string') throw validacion(`"${clave}" debe ser texto`);
        const limpio = valor.trim();
        if (limpio.length > regla.maximo) throw validacion(`"${clave}" no puede superar ${regla.maximo} caracteres`);
        cambios.push([clave, limpio]);
    }
    if (cambios.length === 0) throw validacion('No hay cambios que guardar');

    await db.query(
        'INSERT INTO Configuracion (clave, valor) VALUES ? AS nuevo ON DUPLICATE KEY UPDATE valor = nuevo.valor',
        [cambios]
    );
    return obtener(db);
}

module.exports = { actualizar, obtener };
