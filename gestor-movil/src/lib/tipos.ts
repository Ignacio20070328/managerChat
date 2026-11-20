// Formas de los datos que entrega la API (ver rutas/index.js y servicios/ del backend).

export type EstadoPedido = 'PorPagar' | 'Pendiente' | 'Aprobado' | 'Rechazado' | 'Entregado';

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
  items: ItemPedido[];
}

export interface Producto {
  id_producto: number;
  nombre: string;
  descripcion: string | null;
  precio: number;
  activo: boolean;
}

export interface Configuracion {
  nombre_negocio: string;
  datos_transferencia: string;
}

export type EstadoBot = 'iniciando' | 'esperando_qr' | 'conectado' | 'desconectado' | 'error_autenticacion' | 'desactivado';

export interface Resumen {
  porEstado: Record<EstadoPedido, number>;
  ventasPorDia: { dia: string; pedidos: number; monto: number }[];
  ventasSemana: { pedidos: number; monto: number };
  productosUltimos30Dias: { nombre: string; unidades: number; monto: number }[];
  bot: EstadoBot;
}
