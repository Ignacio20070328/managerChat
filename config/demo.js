// Datos de ejemplo (scripts/demo.js). Los clientes de ejemplo usan teléfonos con este prefijo:
// así se distinguen de los reales al borrarlos y en el modo IA_SOLO_DEMO.
const PREFIJO_DEMO = '5690000';

const esTelefonoDemo = (telefono) => typeof telefono === 'string' && telefono.startsWith(PREFIJO_DEMO);

module.exports = { PREFIJO_DEMO, esTelefonoDemo };
