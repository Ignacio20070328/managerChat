// Datos para las pantallas Inicio y Estadísticas.
// Una venta cuenta desde que su pago se aprueba (estado Aprobado o Entregado).

const ZONA_HORARIA = process.env.ZONA_HORARIA || 'America/Santiago';
const DIAS_GRAFICO = 7;

/** Fecha local (YYYY-MM-DD) de un instante, en la zona horaria del negocio. */
function diaLocal(fecha, zona = ZONA_HORARIA) {
    return new Intl.DateTimeFormat('en-CA', { timeZone: zona, year: 'numeric', month: '2-digit', day: '2-digit' })
        .format(fecha);
}

/** Los últimos `n` días locales, del más antiguo al de hoy. */
function ultimosDias(n, ahora = new Date(), zona = ZONA_HORARIA) {
    const dias = [];
    for (let i = n - 1; i >= 0; i--) dias.push(diaLocal(new Date(ahora.getTime() - i * 86_400_000), zona));
    return [...new Set(dias)]; // por si un cambio de horario repite un día
}

async function obtener(db, ahora = new Date()) {
    const [conteos] = await db.query('SELECT estado, COUNT(*) AS cantidad FROM Pedidos GROUP BY estado');
    const porEstado = { PorPagar: 0, Pendiente: 0, Aprobado: 0, Rechazado: 0, Entregado: 0 };
    for (const { estado, cantidad } of conteos) porEstado[estado] = Number(cantidad);

    // Se trae un día extra para cubrir la diferencia entre UTC y la hora local
    const desde = new Date(ahora.getTime() - (DIAS_GRAFICO + 1) * 86_400_000);
    const [ventas] = await db.query(
        `SELECT total, fecha_aprobacion FROM Pedidos
         WHERE estado IN ('Aprobado', 'Entregado') AND fecha_aprobacion >= ?`,
        [desde]
    );
    const dias = ultimosDias(DIAS_GRAFICO, ahora);
    const porDia = new Map(dias.map((d) => [d, { dia: d, pedidos: 0, monto: 0 }]));
    for (const v of ventas) {
        const dia = porDia.get(diaLocal(v.fecha_aprobacion));
        if (!dia) continue;
        dia.pedidos += 1;
        dia.monto += v.total ?? 0;
    }
    const ventasPorDia = [...porDia.values()];

    const [porProducto] = await db.query(
        `SELECT pr.nombre, SUM(d.cantidad) AS unidades, SUM(d.cantidad * d.precio_unitario) AS monto
         FROM DetallePedido d
         JOIN Pedidos p ON p.id_pedido = d.id_pedido
         JOIN Productos pr ON pr.id_producto = d.id_producto
         WHERE p.estado IN ('Aprobado', 'Entregado') AND p.fecha_aprobacion >= ?
         GROUP BY pr.id_producto, pr.nombre
         ORDER BY unidades DESC`,
        [new Date(ahora.getTime() - 30 * 86_400_000)]
    );

    // Comprobantes por revisar según la sugerencia de la IA (para destacar los sospechosos)
    const [sugerencias] = await db.query(
        `SELECT COALESCE(a.sugerencia, 'sin_analisis') AS sugerencia, COUNT(*) AS cantidad
         FROM Pedidos p LEFT JOIN AnalisisComprobante a ON a.id_pedido = p.id_pedido AND a.estado = 'completado'
         WHERE p.estado = 'Pendiente' GROUP BY 1`
    );
    const pendientesPorSugerencia = { rechazar: 0, revisar: 0, aprobar: 0, sin_analisis: 0 };
    for (const { sugerencia, cantidad } of sugerencias) pendientesPorSugerencia[sugerencia] = Number(cantidad);

    const [[{ activos }]] = await db.query('SELECT COUNT(*) AS activos FROM Productos WHERE activo = 1');

    return {
        porEstado,
        pendientesPorSugerencia,
        productosActivos: Number(activos),
        ventasPorDia,
        ventasSemana: {
            pedidos: ventasPorDia.reduce((s, d) => s + d.pedidos, 0),
            monto: ventasPorDia.reduce((s, d) => s + d.monto, 0)
        },
        productosUltimos30Dias: porProducto.map((p) => ({
            nombre: p.nombre, unidades: Number(p.unidades), monto: Number(p.monto)
        })),
        zonaHoraria: ZONA_HORARIA
    };
}

module.exports = { diaLocal, obtener, ultimosDias };
