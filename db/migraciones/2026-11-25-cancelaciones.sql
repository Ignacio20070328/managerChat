-- Cancelación de pedidos (bases creadas antes del 2026-11-25). Aplicar UNA vez, como root:
--   npm run respaldo        ← primero, siempre
--   docker exec -i mysql-gestor-mvp sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"' < db/migraciones/2026-11-25-cancelaciones.sql
--
-- - Estado nuevo "Cancelado": el cliente canceló un pedido sin pagar, o el dueño canceló uno (p. ej. tras
--   devolver el dinero). cancelado_por = 'cliente' | 'dueno' y fecha_cancelacion.
-- - cancelacion_solicitada: el cliente pidió cancelar un pedido que YA pagó; el dueño decide en la app.

ALTER TABLE Pedidos
    MODIFY estado ENUM('PorPagar', 'Pendiente', 'Aprobado', 'Rechazado', 'Entregado', 'Cancelado') NOT NULL DEFAULT 'Pendiente',
    ADD COLUMN fecha_cancelacion DATETIME NULL AFTER fecha_entrega,
    ADD COLUMN cancelado_por ENUM('cliente', 'dueno') NULL AFTER fecha_cancelacion,
    ADD COLUMN cancelacion_solicitada DATETIME NULL AFTER cancelado_por,
    DROP CHECK chk_pedidos_comprobante;

ALTER TABLE Pedidos
    -- Un pedido cancelado puede o no tener comprobante (se canceló antes o después de pagar)
    ADD CONSTRAINT chk_pedidos_comprobante CHECK (estado = 'Cancelado' OR (estado = 'PorPagar') = (ruta_comprobante IS NULL)),
    ADD CONSTRAINT chk_pedidos_cancelacion CHECK (estado <> 'Cancelado' OR (fecha_cancelacion IS NOT NULL AND cancelado_por IS NOT NULL));
