-- Esquema de la base de datos de TerryChat (gestor_mvp)
-- Docker lo ejecuta automáticamente la PRIMERA vez que se crea el volumen db_data.
-- Para aplicarlo a una base existente:
--   docker exec -i mysql-gestor-mvp sh -c 'mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"' < db/schema.sql
--
-- Montos en pesos chilenos (CLP), enteros sin decimales.
-- Fechas en UTC (ver config/db.js).

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS Clientes (
    id_cliente      INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    telefono        VARCHAR(32)   NOT NULL,
    nombre_completo VARCHAR(120)  NOT NULL DEFAULT 'Cliente Nuevo',
    fecha_registro  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id_cliente),
    -- Un cliente por teléfono: evita duplicados si llegan dos mensajes a la vez
    UNIQUE KEY uq_clientes_telefono (telefono)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Catálogo. Los productos no se borran (los pedidos antiguos los referencian):
-- se desactivan con activo = 0.
CREATE TABLE IF NOT EXISTS Productos (
    id_producto     INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    nombre          VARCHAR(80)   NOT NULL,
    descripcion     VARCHAR(255)  NULL,
    precio          INT UNSIGNED  NOT NULL,
    activo          TINYINT(1)    NOT NULL DEFAULT 1,
    fecha_creacion  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id_producto),
    UNIQUE KEY uq_productos_nombre (nombre),
    CONSTRAINT chk_productos_precio CHECK (precio > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Ciclo de vida de un pedido:
--   PorPagar  → el cliente pidió por WhatsApp; falta el comprobante
--   Pendiente → llegó el comprobante; falta que el dueño lo revise
--   Aprobado  → pago validado; falta entregar
--   Rechazado → comprobante inválido (motivo_rechazo)
--   Entregado → el cliente retiró su pedido
CREATE TABLE IF NOT EXISTS Pedidos (
    id_pedido         INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    id_cliente        INT UNSIGNED  NOT NULL,
    total             INT UNSIGNED  NULL,          -- NULL si llegó un comprobante sin pedido previo
    ruta_comprobante  VARCHAR(255)  NULL,          -- NULL mientras está PorPagar
    estado            ENUM('PorPagar', 'Pendiente', 'Aprobado', 'Rechazado', 'Entregado')
                                    NOT NULL DEFAULT 'Pendiente',
    motivo_rechazo    VARCHAR(255)  NULL,
    fecha             DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,  -- creación del pedido
    fecha_comprobante DATETIME      NULL,
    fecha_aprobacion  DATETIME      NULL,
    fecha_rechazo     DATETIME      NULL,
    fecha_entrega     DATETIME      NULL,
    PRIMARY KEY (id_pedido),
    -- Las pantallas listan pedidos por estado y fecha
    KEY idx_pedidos_estado_fecha (estado, fecha),
    -- El bot busca el pedido abierto de un cliente
    KEY idx_pedidos_cliente_estado (id_cliente, estado),
    CONSTRAINT fk_pedidos_cliente FOREIGN KEY (id_cliente)
        REFERENCES Clientes (id_cliente)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Productos de cada pedido. El precio se copia al momento de pedir:
-- si después cambia el precio del catálogo, los pedidos antiguos no se alteran.
CREATE TABLE IF NOT EXISTS DetallePedido (
    id_pedido        INT UNSIGNED  NOT NULL,
    id_producto      INT UNSIGNED  NOT NULL,
    cantidad         INT UNSIGNED  NOT NULL,
    precio_unitario  INT UNSIGNED  NOT NULL,
    PRIMARY KEY (id_pedido, id_producto),
    CONSTRAINT chk_detalle_cantidad CHECK (cantidad > 0),
    CONSTRAINT fk_detalle_pedido FOREIGN KEY (id_pedido)
        REFERENCES Pedidos (id_pedido) ON DELETE CASCADE,
    CONSTRAINT fk_detalle_producto FOREIGN KEY (id_producto)
        REFERENCES Productos (id_producto) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Configuración del negocio editable desde la app (clave → valor).
-- Claves usadas: nombre_negocio, datos_transferencia
CREATE TABLE IF NOT EXISTS Configuracion (
    clave  VARCHAR(50)    NOT NULL,
    valor  VARCHAR(1000)  NOT NULL,
    PRIMARY KEY (clave)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Revisión previa del comprobante hecha por IA (una por pedido; reanalizar la reemplaza).
-- La IA solo SUGIERE: aprobar o rechazar siempre lo decide una persona.
CREATE TABLE IF NOT EXISTS AnalisisComprobante (
    id_pedido           INT UNSIGNED  NOT NULL,
    estado              ENUM('procesando', 'completado', 'fallido') NOT NULL,
    proveedor           VARCHAR(30)   NULL,      -- quién respondió (nvidia, gemini, simulado…)
    modelo              VARCHAR(100)  NULL,
    -- Datos leídos de la imagen (NULL si no se pudieron leer)
    es_comprobante      TINYINT(1)    NULL,
    monto               INT UNSIGNED  NULL,
    moneda              CHAR(3)       NULL,      -- código ISO (CLP, USD…) si se identificó
    banco_origen        VARCHAR(80)   NULL,
    banco_destino       VARCHAR(80)   NULL,
    cuenta_destino      VARCHAR(60)   NULL,
    titular_destino     VARCHAR(120)  NULL,
    numero_operacion    VARCHAR(60)   NULL,
    fecha_transferencia DATETIME      NULL,
    -- Resultado de las reglas (servicios/analisis.js)
    alertas             JSON          NULL,      -- [{ tipo, gravedad: 'alta'|'media', mensaje }]
    sugerencia          ENUM('aprobar', 'revisar', 'rechazar') NULL,
    error               VARCHAR(255)  NULL,      -- por qué falló (si estado = fallido)
    fecha_analisis      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id_pedido),
    -- Para detectar el mismo comprobante enviado en otro pedido
    KEY idx_analisis_operacion (numero_operacion),
    CONSTRAINT fk_analisis_pedido FOREIGN KEY (id_pedido)
        REFERENCES Pedidos (id_pedido) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
