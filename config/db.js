const mysql = require('mysql2/promise');

const requeridas = ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];
const faltantes = requeridas.filter((nombre) => !process.env[nombre]);
if (faltantes.length > 0) {
    throw new Error(
        `Faltan variables de entorno: ${faltantes.join(', ')}. ` +
        'Copia .env.example como .env y complétalo.'
    );
}

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    // Las fechas se guardan y se leen en UTC. Sin esto, mysql2 interpreta las
    // fechas de MySQL como hora local y llegan desfasadas (3 h en Chile).
    // La app móvil las convierte a la hora del teléfono al mostrarlas.
    timezone: 'Z'
});

// Asegura que NOW() y CURRENT_TIMESTAMP usen UTC en cada conexión,
// sin depender de la zona horaria del servidor MySQL.
pool.pool.on('connection', (conexion) => {
    conexion.query("SET time_zone = '+00:00'");
});

module.exports = pool;
