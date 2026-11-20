-- Endurece la base (bases creadas antes del 2026-11-20). Aplicar UNA vez, como root:
--   npm run respaldo        ← primero, siempre
--   docker exec -i mysql-gestor-mvp sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"' < db/migraciones/2026-11-20-endurecer-base.sql
--
-- 1) Reglas de cada etapa del pedido también en la base (antes solo las controlaba el código).
--    Si alguna falla al aplicarla, hay pedidos inconsistentes: revísalos antes de reintentar.
-- 2) Índices para las dos consultas más usadas que no tenían el índice ideal.
-- 3) Intercalación de la base igual a la de las tablas.
-- Los permisos mínimos del usuario de la app están en db/init/02-permisos-app.sh (mismo contenido).

ALTER TABLE Pedidos
    -- Solo un pedido "por pagar" puede no tener comprobante, y no puede tenerlo
    ADD CONSTRAINT chk_pedidos_comprobante CHECK ((estado = 'PorPagar') = (ruta_comprobante IS NULL)),
    ADD CONSTRAINT chk_pedidos_total CHECK (total IS NULL OR total > 0),
    ADD CONSTRAINT chk_pedidos_aprobacion CHECK (estado NOT IN ('Aprobado', 'Entregado') OR fecha_aprobacion IS NOT NULL),
    ADD CONSTRAINT chk_pedidos_entrega CHECK (estado <> 'Entregado' OR fecha_entrega IS NOT NULL),
    ADD CONSTRAINT chk_pedidos_rechazo CHECK (estado <> 'Rechazado' OR (motivo_rechazo IS NOT NULL AND fecha_rechazo IS NOT NULL)),
    -- Lista de comprobantes por revisar (ordenada por llegada) y ventas por día (por fecha de aprobación)
    ADD INDEX idx_pedidos_estado_comprobante (estado, fecha_comprobante),
    ADD INDEX idx_pedidos_estado_aprobacion (estado, fecha_aprobacion);

ALTER DATABASE CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
