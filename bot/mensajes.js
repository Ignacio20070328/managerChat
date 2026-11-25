// Todos los textos que el bot envía a los clientes, en un solo lugar.

const pesos = (monto) =>
    new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(monto);

const lineasItems = (items) =>
    items.map((i) => `• ${i.cantidad} × ${i.nombre} — ${pesos(i.cantidad * i.precio_unitario)}`).join('\n');

const COMO_PEDIR = 'Para pedir, responde con el *número* del producto y la *cantidad*, por ejemplo: *1x2, 2x1*';

module.exports = {
    pesos,

    catalogo(productos, nombreNegocio) {
        if (productos.length === 0) {
            return `🙏 ${nombreNegocio}: por ahora no tenemos productos disponibles. ¡Vuelve a consultar pronto!`;
        }
        const lista = productos.map((p, i) => `*${i + 1}.* ${p.nombre} — ${pesos(p.precio)}`).join('\n');
        return `🛍️ *${nombreNegocio}* — productos disponibles:\n\n${lista}\n\n${COMO_PEDIR}`;
    },

    pedidoCreado(pedido, datosTransferencia) {
        const pago = datosTransferencia
            ? `\n\n💳 *Datos para transferir:*\n${datosTransferencia}`
            : '';
        return `📝 *Tu pedido #${pedido.id_pedido}*\n${lineasItems(pedido.items)}\n\n*Total: ${pesos(pedido.total)}*${pago}` +
            '\n\nCuando pagues, envía la *foto del comprobante* escribiendo la palabra *comprobante*.' +
            '\nSi quieres cambiar el pedido, vuelve a enviarlo y reemplazará a este.';
    },

    pedidoInvalido: (detalle) => `⚠️ ${detalle}.\n\n${COMO_PEDIR}\nEscribe *menu* para ver los productos.`,

    pedirPalabraComprobante:
        '📸 Para registrar tu pago, por favor envía la foto escribiendo la palabra "comprobante" en el mismo mensaje.',

    comprobanteRecibido(idPedido, total) {
        const detalle = total ? ` del pedido #${idPedido} (${pesos(total)})` : '';
        return `✅ Recibimos tu comprobante${detalle}. Te avisaremos cuando el pago sea validado.`;
    },

    formatoInvalido: '⚠️ No pudimos leer la imagen. Envía el comprobante como foto (JPG o PNG) de menos de 10 MB.',

    errorInterno: '⚠️ Tuvimos un problema al procesar tu mensaje. Por favor, inténtalo de nuevo en unos minutos.',

    pagoAprobado(pedido) {
        const total = pedido.total ? ` de ${pesos(pedido.total)}` : '';
        return `🎉 ¡Tu pago${total} fue *aprobado*! Tu pedido #${pedido.id_pedido} está listo para retirar.`;
    },

    pagoRechazado(pedido) {
        return `❌ No pudimos validar el pago de tu pedido #${pedido.id_pedido}.\n*Motivo:* ${pedido.motivo_rechazo}` +
            '\n\nSi crees que es un error, envía nuevamente el comprobante con la palabra *comprobante*.';
    },

    estadoPedido(pedido) {
        if (!pedido) return 'No encontramos pedidos a tu nombre. Escribe *menu* para ver los productos.';
        const total = pedido.total ? ` (${pesos(pedido.total)})` : '';
        const textos = {
            PorPagar: 'está esperando tu pago. Envía la foto del comprobante con la palabra *comprobante*.',
            Pendiente: 'tiene el comprobante recibido y estamos revisando el pago.',
            Aprobado: 'tiene el pago aprobado y está listo para retirar. 🎉',
            Rechazado: `fue rechazado. Motivo: ${pedido.motivo_rechazo}`,
            Entregado: 'ya fue entregado. ¡Gracias por tu compra! 💚'
        };
        return `📦 Tu pedido #${pedido.id_pedido}${total} ${textos[pedido.estado]}`;
    },

    // Asistente de IA (servicios/asistente.js)
    asistenteNoDisponible: 'En este momento no puedo responder tu consulta 🙏. Puedes escribir *menu* para ver los productos ' +
        'o *estado* para ver tu pedido, o espera y el dueño te responderá por aquí.',
    asistenteDatoNoVerificado: 'Para no darte un dato equivocado, revisa los precios con *menu* o espera: el dueño te responderá por aquí.',

    ayuda: '👋 Hola. Puedes escribir:\n• *menu* — ver productos y precios\n• *estado* — ver cómo va tu pedido\n' +
        '• Enviar la foto de tu pago con la palabra *comprobante*'
};
