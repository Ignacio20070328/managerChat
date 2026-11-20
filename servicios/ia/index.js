// Cadena de proveedores de IA con respaldo automático.
// IA_PROVEEDORES=nvidia,gemini → intenta NVIDIA y, si falla por cuota, límite,
// caída o falta de configuración, intenta Gemini. Vacío → IA desactivada.
// Ante un error pasajero (429, 5xx, red) reintenta el MISMO proveedor IA_REINTENTOS
// veces (por defecto 1) antes de pasar al siguiente.

const { ErrorProveedor, ocultarSecretos } = require('./errores');
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

const esperar = (ms) => new Promise((resolver) => setTimeout(resolver, ms));

/**
 * Ejecuta un intento con tiempo límite: avisa al proveedor con una señal de cancelación
 * (para que corte la petición HTTP) y, por si no la respeta, deja de esperarlo igual.
 */
function conTiempoLimite(intento, ms, nombre) {
    const control = new AbortController();
    let temporizador;
    const limite = new Promise((_, rechazar) => {
        temporizador = setTimeout(() => {
            control.abort();
            rechazar(new ErrorProveedor(`${nombre} no respondió en ${Math.round(ms / 1000)} s`));
        }, ms);
    });
    return Promise.race([intento(control.signal), limite]).finally(() => clearTimeout(temporizador));
}

/**
 * Crea la cadena. Cada proveedor es { nombre, modelo(), analizar({ imagenBase64, mime, instrucciones, senal }) }
 * y devuelve el objeto (o texto JSON) que respondió el modelo.
 * @param reintentos  reintentos por proveedor ante errores pasajeros
 * @param esperaBaseMs espera antes del primer reintento (se duplica en cada uno, máx. 8 s)
 */
function crearCadena(proveedores, {
    tiempoLimiteMs = Number(process.env.IA_TIEMPO_LIMITE_MS) || 45_000,
    reintentos = Number.isInteger(Number(process.env.IA_REINTENTOS)) && process.env.IA_REINTENTOS !== '' ? Number(process.env.IA_REINTENTOS) : 1,
    esperaBaseMs = 2000
} = {}) {
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
                for (let intento = 0; ; intento++) {
                    try {
                        const respuesta = await conTiempoLimite(
                            (senal) => proveedor.analizar({ imagenBase64, mime, instrucciones: INSTRUCCIONES, senal }),
                            tiempoLimiteMs,
                            proveedor.nombre
                        );
                        return { proveedor: proveedor.nombre, modelo: proveedor.modelo(), datos: normalizarRespuesta(respuesta) };
                    } catch (error) {
                        const esDelProveedor = error instanceof ErrorProveedor;
                        const mensaje = esDelProveedor ? error.message : `error inesperado: ${ocultarSecretos(error.message)}`;
                        if (esDelProveedor && error.reintentable && intento < reintentos) {
                            const espera = error.esperaMs ?? Math.min(esperaBaseMs * 2 ** intento, 8000);
                            console.warn(`IA: ${proveedor.nombre} falló (${mensaje}); reintento ${intento + 1}/${reintentos} en ${Math.round(espera / 1000)} s`);
                            await esperar(espera);
                            continue;
                        }
                        intentos.push(`${proveedor.nombre}: ${mensaje}`);
                        console.warn(`IA: falló ${proveedor.nombre} (${mensaje})`);
                        // Un error que no amerita cambiar de proveedor corta la cadena
                        if (esDelProveedor && !error.cambiarDeProveedor) throw new Error(intentos.join(' · '));
                        break; // siguiente proveedor
                    }
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
