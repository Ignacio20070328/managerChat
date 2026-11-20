// Proveedor NVIDIA NIM (API compatible con OpenAI: POST {NVIDIA_URL}/chat/completions).
//
// Modelo verificado el 2026-11-20 con un comprobante sintético:
//   nvidia/nemotron-3.5-super-vl-120b-a12b — acepta la imagen como data URI en base64,
//   respeta response_format json_schema y responde en ~3 s con reasoning_effort "none".
// (nemotron-3.5-parse NO sirve aquí: es solo OCR, usa otro endpoint y no acepta instrucciones.)
//
// ⚠️ La clave gratuita de NVIDIA Build se rige por los "NVIDIA API Trial Terms": prohíben enviar
//    datos personales o financieros y permiten a NVIDIA usar lo enviado para mejorar sus modelos.
//    Con esa clave usar IA_SOLO_DEMO=1 (solo comprobantes de ejemplo). Ver CLAUDE.md.
//
// Configuración (.env, NUNCA en el código ni en la app):
//   NVIDIA_API_KEY=   clave de la API
//   NVIDIA_MODELO=    p. ej. nvidia/nemotron-3.5-super-vl-120b-a12b
//   NVIDIA_URL=       opcional; por defecto https://integrate.api.nvidia.com/v1

const { ErrorProveedor, ocultarSecretos } = require('../errores');
const { ESQUEMA_JSON } = require('../esquema');

const URL_POR_DEFECTO = 'https://integrate.api.nvidia.com/v1';
const MAX_ESPERA_REINTENTO_MS = 30_000;

/** Retry-After puede venir en segundos o como fecha HTTP. */
function esperaDesdeCabecera(valor) {
    if (!valor) return null;
    const segundos = Number(valor);
    const ms = Number.isFinite(segundos) ? segundos * 1000 : Date.parse(valor) - Date.now();
    return Number.isFinite(ms) && ms > 0 ? Math.min(ms, MAX_ESPERA_REINTENTO_MS) : null;
}

/** Mensaje corto y seguro a partir del cuerpo de error (nunca se registra el cuerpo completo). */
async function detalleDeError(respuesta) {
    const texto = await respuesta.text().catch(() => '');
    let detalle = texto;
    try {
        const json = JSON.parse(texto);
        detalle = json?.error?.message ?? json?.detail ?? json?.title ?? texto;
    } catch { /* no era JSON (p. ej. "404 page not found") */ }
    return ocultarSecretos(String(detalle).replace(/\s+/g, ' ').trim().slice(0, 120));
}

module.exports = {
    nombre: 'nvidia',
    modelo: () => process.env.NVIDIA_MODELO || null,

    async analizar({ imagenBase64, mime, instrucciones, senal }) {
        const clave = process.env.NVIDIA_API_KEY;
        const modelo = process.env.NVIDIA_MODELO;
        if (!clave || !modelo) {
            throw new ErrorProveedor('NVIDIA_API_KEY o NVIDIA_MODELO no están configurados');
        }
        const url = `${(process.env.NVIDIA_URL || URL_POR_DEFECTO).replace(/\/+$/, '')}/chat/completions`;

        let respuesta;
        try {
            respuesta = await fetch(url, {
                method: 'POST',
                headers: { Authorization: `Bearer ${clave}`, 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({
                    model: modelo,
                    stream: false,
                    max_tokens: 1024,
                    temperature: 0.2,
                    reasoning_effort: 'none',
                    response_format: { type: 'json_schema', json_schema: { name: 'comprobante', strict: true, schema: ESQUEMA_JSON } },
                    messages: [{
                        role: 'user',
                        content: [
                            { type: 'text', text: instrucciones },
                            { type: 'image_url', image_url: { url: `data:${mime};base64,${imagenBase64}` } }
                        ]
                    }]
                }),
                signal: senal
            });
        } catch (error) {
            // Red caída, DNS, o se acabó el tiempo (AbortSignal de la cadena)
            const porTiempo = error?.name === 'AbortError' || error?.name === 'TimeoutError';
            throw new ErrorProveedor(porTiempo ? 'NVIDIA no respondió a tiempo' : 'no se pudo conectar con NVIDIA', { reintentable: !porTiempo });
        }

        if (!respuesta.ok) {
            const estado = respuesta.status;
            const detalle = await detalleDeError(respuesta);
            if (estado === 429) {
                throw new ErrorProveedor('NVIDIA: límite de uso alcanzado (429)', {
                    reintentable: true, esperaMs: esperaDesdeCabecera(respuesta.headers.get('retry-after'))
                });
            }
            if (estado >= 500) {
                throw new ErrorProveedor(`NVIDIA no disponible (${estado})`, {
                    reintentable: true, esperaMs: esperaDesdeCabecera(respuesta.headers.get('retry-after'))
                });
            }
            if (estado === 401 || estado === 403) {
                throw new ErrorProveedor(`NVIDIA rechazó la clave (${estado}): revisa NVIDIA_API_KEY`);
            }
            if (estado === 404) {
                throw new ErrorProveedor(`NVIDIA no encontró el modelo (404): revisa NVIDIA_MODELO`);
            }
            throw new ErrorProveedor(`NVIDIA rechazó la petición (${estado}): ${detalle}`);
        }

        const json = await respuesta.json().catch(() => null);
        const opcion = json?.choices?.[0];
        if (!opcion?.message) throw new ErrorProveedor('NVIDIA respondió en un formato inesperado');
        if (opcion.finish_reason === 'length') throw new ErrorProveedor('NVIDIA cortó la respuesta (demasiado larga)');
        // normalizarRespuesta() (en la cadena) valida el JSON igual que para cualquier proveedor
        return opcion.message.content;
    }
};
