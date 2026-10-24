// BLL: reglas de negocio del catálogo
// Las rutas llaman a estos métodos; estos usan los repositorios.
const productoRepo = require('../repositories/productoRepository');
const categoriaRepo = require('../repositories/categoriaRepository');
const generalRepo = require('../repositories/generalRepository');
const config = require('../config');

// ── Categorías ───────────────────────────────────────────────

/** Devuelve las categorías como árbol, con la cantidad de productos de cada rama */
function arbolCategorias() {
  const todas = categoriaRepo.listarTodas();
  const conteo = new Map(categoriaRepo.contarProductos().map((c) => [c.id, c.total]));
  const porId = new Map(todas.map((c) => [c.id, { ...c, hijas: [], total: conteo.get(c.id) || 0 }]));
  const raices = [];
  for (const c of porId.values()) {
    if (c.padre_id && porId.has(c.padre_id)) porId.get(c.padre_id).hijas.push(c);
    else raices.push(c);
  }
  return raices;
}

/** Ruta pública de una categoría, igual a la del sitio viejo (sirve para no perder Google) */
function urlCategoria(cat, padre) {
  if (padre) return `/categoria/${padre.id}/${padre.slug}/${cat.id}/${cat.slug}`;
  return `/categoria/${cat.id}/${cat.slug}`;
}

function categoriaConPadre(id) {
  const cat = categoriaRepo.obtenerPorId(id);
  if (!cat) return null;
  const padre = cat.padre_id ? categoriaRepo.obtenerPorId(cat.padre_id) : null;
  return { ...cat, padre, url: urlCategoria(cat, padre) };
}

// ── Productos ────────────────────────────────────────────────

function numeroOpcional(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/** Traduce los parámetros de la URL (?q=&orden=&pagina=...) a un filtro válido */
function filtrosDesdeQuery(query = {}, extra = {}) {
  return {
    q: String(query.q || query.buscar || '').trim().slice(0, 80) || null,
    precioMin: numeroOpcional(query.min),
    precioMax: numeroOpcional(query.max),
    stockMin: numeroOpcional(query.stock),
    orden: ['vistos', 'menor', 'mayor', 'az', 'za', 'nuevos'].includes(query.orden) ? query.orden : 'vistos',
    pagina: Math.max(1, parseInt(query.pagina, 10) || 1),
    porPagina: config.productosPorPagina,
    ...extra,
  };
}

function buscarProductos(query, extra = {}) {
  const filtros = filtrosDesdeQuery(query, extra);
  if (filtros.categoriaId) {
    filtros.categoriaIds = categoriaRepo.idsConDescendientes(filtros.categoriaId);
  }
  const resultado = productoRepo.buscar(filtros);
  return { ...resultado, filtros };
}

function urlProducto(p) {
  return `/productos/${p.id}/${p.slug}`;
}

/** Agrupa las imágenes por color (si el nombre del archivo lo indica) */
function imagenesPorVariante(producto) {
  const mapa = {};
  for (const v of producto.variantes) {
    const clave = v.valor.toLowerCase().split(' ')[0];
    const idx = producto.imagenes.findIndex((img) => (img.url_original || img.url).toLowerCase().includes(clave));
    if (idx >= 0) mapa[v.valor] = idx;
  }
  return mapa;
}

function detalleProducto(id, { contarVista = true } = {}) {
  const p = productoRepo.obtenerPorId(id);
  if (!p || !p.activo) return null;
  if (contarVista) productoRepo.sumarVista(id);

  // Breadcrumb: tomamos la categoría más "profunda"
  let categoria = null;
  const hija = p.categorias.find((c) => c.padre_id) || p.categorias[0];
  if (hija) categoria = categoriaConPadre(hija.id);

  return {
    producto: p,
    categoria,
    imagenPorVariante: imagenesPorVariante(p),
    relacionados: productoRepo.relacionados(id, 8),
  };
}

function sugerencias(q) {
  if (!q || String(q).trim().length < 2) return [];
  return productoRepo.sugerencias(q, 8).map((p) => ({ ...p, url: urlProducto(p) }));
}

// ── Home ─────────────────────────────────────────────────────

function datosHome() {
  const arbol = arbolCategorias();
  let destacadas = categoriaRepo.listarTodas().filter((c) => c.destacada);
  if (!destacadas.length) destacadas = arbol.slice(0, 4);

  // Si la categoría no tiene imagen propia, usamos la de su producto más visto
  const categoriasDestacadas = destacadas.map((c) => {
    let imagen = c.imagen;
    if (!imagen) {
      const r = productoRepo.buscar({ categoriaIds: categoriaRepo.idsConDescendientes(c.id), porPagina: 1, orden: 'vistos' });
      imagen = r.items[0]?.imagen || null;
    }
    return { ...c, imagen, url: urlCategoria(c) };
  });

  let destacados = productoRepo.destacados(8);
  if (!destacados.length) destacados = productoRepo.buscar({ porPagina: 8, orden: 'vistos' }).items;

  return { categoriasDestacadas, destacados, clientes: generalRepo.listarClientes() };
}

module.exports = {
  arbolCategorias, urlCategoria, categoriaConPadre, buscarProductos, filtrosDesdeQuery,
  urlProducto, detalleProducto, sugerencias, datosHome, rangoPrecios: productoRepo.rangoPrecios,
};
