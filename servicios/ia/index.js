// Cadena de proveedores de IA con respaldo automático.
// IA_PROVEEDORES=nvidia,gemini → intenta NVIDIA y, si falla por cuota, límite,
// caída o falta de configuración, intenta Gemini. Vacío → IA desactivada.

const { ErrorProveedor } = require('./errores');
const { INSTRUCCIONES, normalizarRespuesta } = require('./esquema');

const DISPONIBLES = {
    nvidia: () => require('./proveedores/nvidia'),
    gemini: () => require('./proveedores/gemini'),
    simulado: () => require('./proveedores/simulado')
};

/** Lee IA_PROVEEDORES y devuelve los módulos de proveedor en ese orden. */
function proveedoresDesdeEntorno(env = process.env) {
    const nombres = (env.IA_PROVEEDORES || '')
        .split(',').map((n) => n.trim().toLowerCase()).filter(Boolean);
    return nombres.map((nombre) => {
        const cargar = DISPONIBLES[nombre];
        if (!cargar) {
            throw new Error(`IA_PROVEEDORES: proveedor desconocido "${nombre}". Disponibles: ${Object.keys(DISPONIBLES).join(', ')}`);
        }
        return cargar();
    });
}

function conTiempoLimite(promesa, ms, nombre) {
    let temporizador;
    const limite = new Promise((_, rechazar) => {
        temporizador = setTimeout(
            () => rechazar(new ErrorProveedor(`${nombre} no respondió en ${Math.round(ms / 1000)} s`)),
            ms
        );
    });
    return Promise.race([promesa, limite]).finally(() => clearTimeout(temporizador));
}

/**
 * Crea la cadena. Cada proveedor es { nombre, modelo(), analizar({ imagenBase64, mime, instrucciones }) }
 * y devuelve el objeto (o texto JSON) que respondió el modelo.
 */
function crearCadena(proveedores, { tiempoLimiteMs = Number(process.env.IA_TIEMPO_LIMITE_MS) || 45_000 } = {}) {
    return {
        activa: proveedores.length > 0,
        nombres: proveedores.map((p) => p.nombre),

        /**
         * @returns {Promise<{ proveedor, modelo, datos }>}
         * @throws Error con el detalle de cada intento si todos fallan
         */
        async analizarImagen(imagen, mime) {
            if (proveedores.length === 0) throw new Error('La IA no está configurada (IA_PROVEEDORES vacío)');
            const imagenBase64 = imagen.toString('base64');
            const intentos = [];

            for (const proveedor of proveedores) {
                try {
                    const respuesta = await conTiempoLimite(
                        proveedor.analizar({ imagenBase64, mime, instrucciones: INSTRUCCIONES }),
                        tiempoLimiteMs,
                        proveedor.nombre
                    );
                    return { proveedor: proveedor.nombre, modelo: proveedor.modelo(), datos: normalizarRespuesta(respuesta) };
                } catch (error) {
                    const mensaje = error instanceof ErrorProveedor ? error.message : `error inesperado: ${error.message}`;
                    intentos.push(`${proveedor.nombre}: ${mensaje}`);
                    console.warn(`IA: falló ${proveedor.nombre} (${mensaje})`);
                    // Un error que no amerita cambiar de proveedor corta la cadena
                    if (error instanceof ErrorProveedor && !error.cambiarDeProveedor) break;
                }
            }
            throw new Error(intentos.join(' · '));
        }
    };
}

let cadenaGlobal;
/** Cadena configurada por el .env (se crea una sola vez). */
function cadenaDesdeEntorno() {
    cadenaGlobal ??= crearCadena(proveedoresDesdeEntorno());
    return cadenaGlobal;
}

module.exports = { ErrorProveedor, cadenaDesdeEntorno, crearCadena, proveedoresDesdeEntorno };
