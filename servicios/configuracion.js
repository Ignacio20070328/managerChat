const { validacion } = require('../lib/errores');

// Colores de marca que puede elegir cada negocio. Todos tienen contraste >= 5:1
// con texto blanco (WCAG pide 4,5:1), por eso no se acepta cualquier color.
const COLORES_MARCA = [
    { nombre: 'Frambuesa', valor: '#a3133f' },
    { nombre: 'Rosado', valor: '#be185d' },
    { nombre: 'Naranja', valor: '#b4470f' },
    { nombre: 'Verde azulado', valor: '#1f6f5c' },
    { nombre: 'Azul', valor: '#1d4ed8' },
    { nombre: 'Morado', valor: '#6b2c91' },
    { nombre: 'Grafito', valor: '#374151' }
];

// Claves permitidas, con su largo máximo, valor por defecto y valores aceptados
const CLAVES = {
    nombre_negocio: { maximo: 80, defecto: 'Mi emprendimiento' },
    // Se envía al cliente junto con el total de su pedido
    datos_transferencia: { maximo: 1000, defecto: '' },
    // Color principal de la app (cabeceras, botones destacados)
    color_marca: { maximo: 7, defecto: COLORES_MARCA[0].valor, opciones: COLORES_MARCA.map((c) => c.valor) },
    // Asistente de IA en WhatsApp (responde dudas de los clientes). Apagado por defecto:
    // solo debe activarse con un número de WhatsApp dedicado al negocio.
    asistente_activo: { maximo: 2, defecto: 'no', opciones: ['si', 'no'] },
    // Información que el asistente puede dar (si está vacía, dice que no la tiene)
    direccion_retiro: { maximo: 200, defecto: '' },
    horario_atencion: { maximo: 200, defecto: '' },
    preguntas_frecuentes: { maximo: 1000, defecto: '' }
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
        if (regla.opciones && !regla.opciones.includes(limpio.toLowerCase())) {
            throw validacion(`"${clave}" debe ser uno de: ${regla.opciones.join(', ')}`);
        }
        cambios.push([clave, regla.opciones ? limpio.toLowerCase() : limpio]);
    }
    if (cambios.length === 0) throw validacion('No hay cambios que guardar');

    await db.query(
        'INSERT INTO Configuracion (clave, valor) VALUES ? AS nuevo ON DUPLICATE KEY UPDATE valor = nuevo.valor',
        [cambios]
    );
    return obtener(db);
}

module.exports = { COLORES_MARCA, actualizar, obtener };
