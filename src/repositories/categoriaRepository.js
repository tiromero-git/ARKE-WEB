// DAL: acceso a la tabla "categorias"
const { getDb, plain } = require('../db/database');

function listarTodas() {
  return getDb()
    .prepare('SELECT * FROM categorias ORDER BY orden, nombre')
    .all()
    .map(plain);
}

function obtenerPorId(id) {
  return plain(getDb().prepare('SELECT * FROM categorias WHERE id = ?').get(id));
}

/** Devuelve el id recibido + todos sus descendientes (hijas, nietas...). */
function idsConDescendientes(id) {
  const filas = getDb()
    .prepare(`
      WITH RECURSIVE arbol(id) AS (
        SELECT id FROM categorias WHERE id = ?
        UNION ALL
        SELECT c.id FROM categorias c JOIN arbol a ON c.padre_id = a.id
      )
      SELECT id FROM arbol`)
    .all(id);
  return filas.map((f) => f.id);
}

/** Cantidad de productos activos por categoría (incluye subcategorías). */
function contarProductos() {
  return getDb()
    .prepare(`
      SELECT pc.categoria_id AS id, COUNT(DISTINCT pc.producto_id) AS total
      FROM producto_categorias pc
      JOIN productos p ON p.id = pc.producto_id AND p.activo = 1
      GROUP BY pc.categoria_id`)
    .all()
    .map(plain);
}

function guardar(cat) {
  const db = getDb();
  if (cat.id && obtenerPorId(cat.id)) {
    db.prepare(`UPDATE categorias SET nombre=?, slug=?, padre_id=?, orden=?, destacada=?, imagen=? WHERE id=?`)
      .run(cat.nombre, cat.slug, cat.padre_id || null, cat.orden || 0, cat.destacada ? 1 : 0, cat.imagen || null, cat.id);
    return cat.id;
  }
  const r = db
    .prepare(`INSERT INTO categorias (id, nombre, slug, padre_id, orden, destacada, imagen) VALUES (?,?,?,?,?,?,?)`)
    .run(cat.id || null, cat.nombre, cat.slug, cat.padre_id || null, cat.orden || 0, cat.destacada ? 1 : 0, cat.imagen || null);
  return Number(r.lastInsertRowid);
}

function eliminar(id) {
  getDb().prepare('DELETE FROM categorias WHERE id = ?').run(id);
}

module.exports = { listarTodas, obtenerPorId, idsConDescendientes, contarProductos, guardar, eliminar };
