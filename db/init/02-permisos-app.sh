#!/bin/sh
# Permisos mínimos para el usuario de la app (Docker lo ejecuta al crear la base, después de 01-schema.sql).
# La imagen de MySQL le da ALL PRIVILEGES a MYSQL_USER; la app solo necesita leer y escribir filas.
# Cambios de estructura (migraciones) y respaldos se hacen como root.
# Para una base ya creada, ejecutar lo mismo a mano:
#   docker exec -i mysql-gestor-mvp sh < db/init/02-permisos-app.sh
set -e
# MySQL guarda el permiso con los "_" del nombre de la base escapados (gestor\_mvp):
# hay que usar exactamente ese nombre para poder revocarlo.
BASE_ESCAPADA=$(printf '%s' "$MYSQL_DATABASE" | sed 's/_/\\_/g')
mysql -uroot -p"$MYSQL_ROOT_PASSWORD" <<SQL
REVOKE ALL PRIVILEGES ON \`$BASE_ESCAPADA\`.* FROM '$MYSQL_USER'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE ON \`$BASE_ESCAPADA\`.* TO '$MYSQL_USER'@'%';
FLUSH PRIVILEGES;
SQL
echo "Permisos mínimos aplicados a $MYSQL_USER"
