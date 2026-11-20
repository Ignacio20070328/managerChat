-- Agrega la moneda leída por la IA a AnalisisComprobante (bases creadas antes del 2026-11-20).
-- Aplicar una sola vez:
--   docker exec -i mysql-gestor-mvp sh -c 'mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"' < db/migraciones/2026-11-20-moneda-analisis.sql
ALTER TABLE AnalisisComprobante ADD COLUMN moneda CHAR(3) NULL AFTER monto;
