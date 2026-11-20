const path = require('path');

// Carpeta donde se guardan las fotos de los comprobantes (ignorada por git)
const CARPETA_UPLOADS = path.join(__dirname, '../public/uploads');

module.exports = { CARPETA_UPLOADS };
