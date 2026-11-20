-- Esquema de la base de datos de TerryChat (gestor_mvp)
-- Docker lo ejecuta automáticamente la PRIMERA vez que se crea el volumen db_data.
-- Para aplicarlo a una base existente:
--   docker exec -i mysql-gestor-mvp sh -c 'mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"' < db/schema.sql

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

CREATE TABLE IF NOT EXISTS Pedidos (
    id_pedido        INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    id_cliente       INT UNSIGNED  NOT NULL,
    ruta_comprobante VARCHAR(255)  NOT NULL,
    estado           ENUM('Pendiente', 'Aprobado', 'Rechazado', 'Entregado')
                                   NOT NULL DEFAULT 'Pendiente',
    fecha            DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_aprobacion DATETIME      NULL,
    PRIMARY KEY (id_pedido),
    -- La app lista pedidos por estado y fecha
    KEY idx_pedidos_estado_fecha (estado, fecha),
    CONSTRAINT fk_pedidos_cliente FOREIGN KEY (id_cliente)
        REFERENCES Clientes (id_cliente)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
