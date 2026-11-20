const { conflicto, noEncontrado, validacion } = require('../lib/errores');

const PRECIO_MAXIMO = 10_000_000; // CLP

function normalizarCampos(datos, { parcial }) {
    const campos = {};

    if (datos.nombre !== undefined || !parcial) {
        const nombre = typeof datos.nombre === 'string' ? datos.nombre.trim() : '';
        if (nombre.length < 2 || nombre.length > 80) throw validacion('El nombre debe tener entre 2 y 80 caracteres');
        campos.nombre = nombre;
    }
    if (datos.descripcion !== undefined) {
        if (datos.descripcion !== null && typeof datos.descripcion !== 'string') throw validacion('Descripción inválida');
        const descripcion = (datos.descripcion ?? '').trim();
        if (descripcion.length > 255) throw validacion('La descripción no puede superar 255 caracteres');
        campos.descripcion = descripcion || null;
    }
    if (datos.precio !== undefined || !parcial) {
        const precio = Number(datos.precio);
        if (!Number.isInteger(precio) || precio <= 0 || precio > PRECIO_MAXIMO) {
            throw validacion('El precio debe ser un número entero de pesos mayor que 0');
        }
        campos.precio = precio;
    }
    if (datos.activo !== undefined) {
        if (typeof datos.activo !== 'boolean') throw validacion('"activo" debe ser verdadero o falso');
        campos.activo = datos.activo ? 1 : 0;
    }
    return campos;
}

const aProducto = (fila) => ({ ...fila, activo: Boolean(fila.activo) });

async function listar(db, { soloActivos = false } = {}) {
    const [filas] = await db.query(
        `SELECT id_producto, nombre, descripcion, precio, activo
         FROM Productos ${soloActivos ? 'WHERE activo = 1' : ''}
         ORDER BY activo DESC, nombre ASC`
    );
    return filas.map(aProducto);
}

async function obtener(db, idProducto) {
    const [filas] = await db.query(
        'SELECT id_producto, nombre, descripcion, precio, activo FROM Productos WHERE id_producto = ?',
        [idProducto]
    );
    if (filas.length === 0) throw noEncontrado('El producto no existe');
    return aProducto(filas[0]);
}

async function crear(db, datos) {
    const campos = normalizarCampos(datos, { parcial: false });
    try {
        const [r] = await db.query('INSERT INTO Productos SET ?', [campos]);
        return obtener(db, r.insertId);
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') throw conflicto('Ya existe un producto con ese nombre');
        throw error;
    }
}

async function actualizar(db, idProducto, datos) {
    const campos = normalizarCampos(datos, { parcial: true });
    if (Object.keys(campos).length === 0) throw validacion('No hay cambios que guardar');
    try {
        const [r] = await db.query('UPDATE Productos SET ? WHERE id_producto = ?', [campos, idProducto]);
        if (r.affectedRows === 0) throw noEncontrado('El producto no existe');
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') throw conflicto('Ya existe un producto con ese nombre');
        throw error;
    }
    return obtener(db, idProducto);
}

module.exports = { actualizar, crear, listar, obtener };
