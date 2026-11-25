// Formas de los datos que entrega la API (ver rutas/index.js y servicios/ del backend).

export type EstadoPedido = 'PorPagar' | 'Pendiente' | 'Aprobado' | 'Rechazado' | 'Entregado' | 'Cancelado';

export interface ItemPedido {
  id_producto: number;
  nombre: string;
  cantidad: number;
  precio_unitario: number;
}

export interface Pedido {
  id_pedido: number;
  telefono: string;
  nombre_cliente: string;
  total: number | null; // null: llegó un comprobante sin pedido por el bot
  estado: EstadoPedido;
  ruta_comprobante: string | null;
  motivo_rechazo: string | null;
  fecha: string;
  fecha_comprobante: string | null;
  fecha_aprobacion: string | null;
  fecha_rechazo: string | null;
  fecha_entrega: string | null;
  fecha_cancelacion: string | null;
  cancelado_por: 'cliente' | 'dueno' | null;
  cancelacion_solicitada: string | null; // el cliente pidió cancelar un pedido ya pagado
  items: ItemPedido[];
  analisis: Analisis | null; // revisión previa con IA (null si no se ha analizado)
}

export interface AlertaAnalisis {
  tipo: string;
  gravedad: 'alta' | 'media';
  mensaje: string;
}

/** Revisión previa con IA. Es solo una sugerencia: aprobar o rechazar lo decide una persona. */
export interface Analisis {
  estado: 'procesando' | 'completado' | 'fallido';
  proveedor: string | null;
  modelo: string | null;
  es_comprobante: boolean | null;
  monto: number | null;
  moneda: string | null; // código ISO (CLP, USD…) si se identificó
  banco_origen: string | null;
  banco_destino: string | null;
  cuenta_destino: string | null;
  titular_destino: string | null;
  numero_operacion: string | null;
  fecha_transferencia: string | null;
  alertas: AlertaAnalisis[] | null;
  sugerencia: 'aprobar' | 'revisar' | 'rechazar' | null;
  error: string | null;
  fecha_analisis: string;
}

export interface Producto {
  id_producto: number;
  nombre: string;
  descripcion: string | null;
  precio: number;
  activo: boolean;
}

export interface ColorMarca {
  nombre: string;
  valor: string;
}

export interface Configuracion {
  nombre_negocio: string;
  datos_transferencia: string;
  color_marca: string;
  colores_disponibles: ColorMarca[];
  // Asistente de IA en WhatsApp
  asistente_activo: 'si' | 'no';
  direccion_retiro: string;
  horario_atencion: string;
  preguntas_frecuentes: string;
}

export type EstadoBot = 'iniciando' | 'esperando_qr' | 'conectado' | 'desconectado' | 'error_autenticacion' | 'desactivado';

export interface Resumen {
  porEstado: Record<EstadoPedido, number>;
  cancelacionesSolicitadas: number;
  pendientesPorSugerencia: { rechazar: number; revisar: number; aprobar: number; sin_analisis: number };
  productosActivos: number;
  ventasPorDia: { dia: string; pedidos: number; monto: number }[];
  ventasSemana: { pedidos: number; monto: number };
  productosUltimos30Dias: { nombre: string; unidades: number; monto: number }[];
  bot: EstadoBot;
  ia: { activa: boolean; proveedores: string[]; soloDemo: boolean; puedeConversar: boolean };
}
