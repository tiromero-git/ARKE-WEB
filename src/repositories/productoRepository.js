// DAL: acceso a productos y sus tablas relacionadas
// Acá solo hay SQL. Las reglas de negocio van en /services.
const { getDb, plain, transaction } = require('../db/database');
const { normalizar, sinHtml, htmlSeguro } = require('../utils/texto');

const ORDENES = {
  vistos: 'p.vistas DESC, p.id DESC',
  menor: 'p.precio ASC',
  mayor: 'p.precio DESC',
  az: 'p.nombre COLLATE NOCASE ASC',
  za: 'p.nombre COLLATE NOCASE DESC',
  nuevos: 'p.id DESC',
};

// Subconsulta: primera imagen del producto (para las tarjetas)
const IMG1 = `(SELECT url FROM producto_imagenes i WHERE i.producto_id = p.id ORDER BY orden, id LIMIT 1)`;
const IMG2 = `(SELECT url FROM producto_imagenes i WHERE i.producto_id = p.id ORDER BY orden, id LIMIT 1 OFFSET 1)`;

/**
 * Búsqueda paginada con filtros.
 * @param {object} f { q, categoriaIds[], precioMin, precioMax, stockMin, orden, pagina, porPagina, incluirInactivos }
 */
function buscar(f = {}) {
  const where = [];
  const params = [];

  if (!f.incluirInactivos) where.push('p.activo = 1');

  if (f.q) {
    // cada palabra tiene que aparecer (en nombre, código o descripción)
    for (const palabra of normalizar(f.q).split(/\s+/).filter(Boolean)) {
      where.push('p.busqueda LIKE ?');
      params.push(`%${palabra}%`);
    }
  }
  if (f.categoriaIds && f.categoriaIds.length) {
    where.push(`p.id IN (SELECT producto_id FROM producto_categorias WHERE categoria_id IN (${f.categoriaIds.map(() => '?').join(',')}))`);
    params.push(...f.categoriaIds);
  }
  if (f.precioMin != null) { where.push('p.precio >= ?'); params.push(f.precioMin); }
  if (f.precioMax != null) { where.push('p.precio <= ?'); params.push(f.precioMax); }
  if (f.stockMin != null) { where.push('p.stock >= ?'); params.push(f.stockMin); }

  const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
  let orden = ORDENES[f.orden] || ORDENES.vistos;
  const ordenParams = [];
  if (f.q && (!f.orden || f.orden === 'vistos')) {
    // si se busca algo, primero los que lo tienen en el NOMBRE (no solo en la descripción)
    orden = `(p.busqueda_nombre LIKE ?) DESC, ${orden}`;
    ordenParams.push(`%${normalizar(f.q)}%`);
  }
  const porPagina = f.porPagina || 21;
  const pagina = Math.max(1, f.pagina || 1);

  const db = getDb();
  const total = db.prepare(`SELECT COUNT(*) AS n FROM productos p ${whereSql}`).get(...params).n;
  const items = db
    .prepare(`
      SELECT p.id, p.nombre, p.slug, p.codigo, p.precio, p.costo, p.stock, p.cantidad_minima,
             p.destacado, p.activo, p.proveedor, ${IMG1} AS imagen, ${IMG2} AS imagen2
      FROM productos p ${whereSql}
      ORDER BY ${orden}
      LIMIT ? OFFSET ?`)
    .all(...params, ...ordenParams, porPagina, (pagina - 1) * porPagina)
    .map(plain);

  return { items, total, pagina, porPagina, paginas: Math.max(1, Math.ceil(total / porPagina)) };
}

function obtenerPorId(id) {
  const db = getDb();
  const p = plain(db.prepare('SELECT * FROM productos WHERE id = ?').get(id));
  if (!p) return null;
  p.imagenes = db.prepare('SELECT * FROM producto_imagenes WHERE producto_id = ? ORDER BY orden, id').all(id).map(plain);
  p.variantes = db.prepare('SELECT * FROM producto_variantes WHERE producto_id = ? ORDER BY id').all(id).map(plain);
  p.categorias = db
    .prepare(`SELECT c.* FROM categorias c JOIN producto_categorias pc ON pc.categoria_id = c.id WHERE pc.producto_id = ?`)
    .all(id)
    .map(plain);
  return p;
}

function destacados(limite = 8) {
  return getDb()
    .prepare(`SELECT p.id, p.nombre, p.slug, p.precio, p.stock, p.cantidad_minima, ${IMG1} AS imagen, ${IMG2} AS imagen2
              FROM productos p WHERE p.activo = 1 AND p.destacado = 1 ORDER BY p.vistas DESC LIMIT ?`)
    .all(limite)
    .map(plain);
}

/** Productos al azar de las mismas categorías */
function relacionados(productoId, limite = 8) {
  return getDb()
    .prepare(`
      SELECT p.id, p.nombre, p.slug, p.precio, p.stock, p.cantidad_minima, ${IMG1} AS imagen, ${IMG2} AS imagen2
      FROM productos p
      WHERE p.activo = 1 AND p.id <> ?
        AND p.id IN (SELECT producto_id FROM producto_categorias WHERE categoria_id IN
                      (SELECT categoria_id FROM producto_categorias WHERE producto_id = ?))
      ORDER BY RANDOM() LIMIT ?`)
    .all(productoId, productoId, limite)
    .map(plain);
}

function sugerencias(q, limite = 8) {
  const palabras = normalizar(q).split(/\s+/).filter(Boolean);
  if (!palabras.length) return [];
  const where = palabras.map(() => 'p.busqueda_nombre LIKE ?').join(' AND '); // sugerencias: solo por nombre/código
  return getDb()
    .prepare(`SELECT p.id, p.nombre, p.slug, p.precio, ${IMG1} AS imagen FROM productos p
              WHERE p.activo = 1 AND ${where} ORDER BY p.vistas DESC LIMIT ?`)
    .all(...palabras.map((w) => `%${w}%`), limite)
    .map(plain);
}

function rangoPrecios() {
  return plain(getDb().prepare('SELECT MIN(precio) AS min, MAX(precio) AS max FROM productos WHERE activo = 1').get());
}

function sumarVista(id) {
  getDb().prepare('UPDATE productos SET vistas = vistas + 1 WHERE id = ?').run(id);
}

function textoBusqueda(p) {
  return normalizar([p.nombre, p.codigo, sinHtml(p.descripcion)].filter(Boolean).join(' '));
}

/**
 * Inserta o actualiza un producto completo (con imágenes, variantes y categorías).
 * Todo dentro de una transacción.
 */
function guardar(p) {
  return transaction((db) => {
    const existe = p.id ? db.prepare('SELECT id FROM productos WHERE id = ?').get(p.id) : null;
    const valores = [
      p.nombre, p.slug, p.codigo || null, p.proveedor || null,
      htmlSeguro(p.descripcion) || null, htmlSeguro(p.ficha_tecnica) || null, // nunca guardamos HTML peligroso
      Number(p.precio) || 0, p.costo == null || p.costo === '' ? null : Number(p.costo),
      Number(p.stock) || 0, Number(p.cantidad_minima) || 1, p.destacado ? 1 : 0, p.activo === 0 || p.activo === false ? 0 : 1,
      textoBusqueda(p),
      normalizar([p.nombre, p.codigo].filter(Boolean).join(' ')),
    ];
    let id = p.id;
    if (existe) {
      db.prepare(`UPDATE productos SET nombre=?, slug=?, codigo=?, proveedor=?, descripcion=?, ficha_tecnica=?, precio=?, costo=?,
                  stock=?, cantidad_minima=?, destacado=?, activo=?, busqueda=?, busqueda_nombre=?, actualizado_en=datetime('now') WHERE id=?`)
        .run(...valores, id);
    } else {
      const r = db
        .prepare(`INSERT INTO productos (id, nombre, slug, codigo, proveedor, descripcion, ficha_tecnica, precio, costo,
                  stock, cantidad_minima, destacado, activo, busqueda, busqueda_nombre) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .run(id || null, ...valores);
      id = Number(r.lastInsertRowid);
    }

    if (Array.isArray(p.imagenes)) {
      db.prepare('DELETE FROM producto_imagenes WHERE producto_id = ?').run(id);
      const ins = db.prepare('INSERT INTO producto_imagenes (producto_id, url, url_original, orden) VALUES (?,?,?,?)');
      p.imagenes.forEach((img, i) => {
        const url = typeof img === 'string' ? img : img.url;
        const original = typeof img === 'string' ? img : img.url_original || img.url;
        if (url) ins.run(id, url, original, i);
      });
    }
    if (Array.isArray(p.variantes)) {
      db.prepare('DELETE FROM producto_variantes WHERE producto_id = ?').run(id);
      const ins = db.prepare('INSERT INTO producto_variantes (producto_id, atributo, valor, color_hex, stock, precio) VALUES (?,?,?,?,?,?)');
      for (const v of p.variantes) {
        if (v.valor) ins.run(id, v.atributo || 'Color', v.valor, v.color_hex || null, Number(v.stock) || 0, v.precio == null ? null : Number(v.precio));
      }
    }
    if (Array.isArray(p.categoriaIds)) {
      db.prepare('DELETE FROM producto_categorias WHERE producto_id = ?').run(id);
      const ins = db.prepare('INSERT OR IGNORE INTO producto_categorias (producto_id, categoria_id) VALUES (?,?)');
      for (const c of p.categoriaIds) ins.run(id, Number(c));
    }
    return id;
  });
}

function eliminar(id) {
  getDb().prepare('DELETE FROM productos WHERE id = ?').run(id);
}

function cambiarDestacado(id, valor) {
  getDb().prepare('UPDATE productos SET destacado = ? WHERE id = ?').run(valor ? 1 : 0, id);
}

/** Aumenta/disminuye precios en un % (opcionalmente solo de algunas categorías). */
function ajustarPrecios(porcentaje, categoriaIds = null) {
  const factor = 1 + Number(porcentaje) / 100;
  const db = getDb();
  if (categoriaIds && categoriaIds.length) {
    const marcas = categoriaIds.map(() => '?').join(',');
    return Number(db.prepare(`UPDATE productos SET precio = ROUND(precio * ?, 2), actualizado_en = datetime('now')
      WHERE id IN (SELECT producto_id FROM producto_categorias WHERE categoria_id IN (${marcas}))`).run(factor, ...categoriaIds).changes);
  }
  return Number(db.prepare(`UPDATE productos SET precio = ROUND(precio * ?, 2), actualizado_en = datetime('now')`).run(factor).changes);
}

/** Recalcula precio = costo + margen % para los productos que tienen costo cargado. */
function aplicarMargenSobreCosto(margen) {
  const factor = 1 + Number(margen) / 100;
  return Number(getDb().prepare(`UPDATE productos SET precio = ROUND(costo * ?, 2), actualizado_en = datetime('now')
    WHERE costo IS NOT NULL AND costo > 0`).run(factor).changes);
}

function imagenesRemotas() {
  return getDb()
    .prepare(`SELECT id, producto_id, url FROM producto_imagenes WHERE url LIKE 'http%' ORDER BY producto_id, orden`)
    .all()
    .map(plain);
}

function actualizarUrlImagen(idImagen, nuevaUrl) {
  getDb().prepare('UPDATE producto_imagenes SET url = ? WHERE id = ?').run(nuevaUrl, idImagen);
}

function estadisticas() {
  return plain(getDb().prepare(`
    SELECT (SELECT COUNT(*) FROM productos) AS productos,
           (SELECT COUNT(*) FROM productos WHERE activo = 1) AS activos,
           (SELECT COUNT(*) FROM productos WHERE destacado = 1) AS destacados,
           (SELECT COUNT(*) FROM productos WHERE stock = 0) AS sin_stock,
           (SELECT COUNT(*) FROM categorias) AS categorias,
           (SELECT COUNT(*) FROM producto_imagenes WHERE url LIKE 'http%') AS imagenes_remotas,
           (SELECT COUNT(*) FROM mensajes WHERE leido = 0) AS mensajes_nuevos`).get());
}

function todosParaSitemap() {
  return getDb().prepare('SELECT id, slug, actualizado_en FROM productos WHERE activo = 1').all().map(plain);
}

module.exports = {
  buscar, obtenerPorId, destacados, relacionados, sugerencias, rangoPrecios, sumarVista, guardar, eliminar,
  cambiarDestacado, ajustarPrecios, aplicarMargenSobreCosto, imagenesRemotas, actualizarUrlImagen, estadisticas, todosParaSitemap,
};
