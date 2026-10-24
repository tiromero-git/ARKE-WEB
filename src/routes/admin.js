// ─────────────────────────────────────────────────────────────
// Panel de administración (/admin) — reemplaza al panel de Waclis
// ─────────────────────────────────────────────────────────────
const express = require('express');
const { requiereLogin } = require('../middleware/auth');
const auth = require('../services/authService');
const catalogo = require('../services/catalogoService');
const configService = require('../services/configService');
const productoRepo = require('../repositories/productoRepository');
const categoriaRepo = require('../repositories/categoriaRepository');
const generalRepo = require('../repositories/generalRepository');
const { slugify, htmlSeguro } = require('../utils/texto');

const router = express.Router();

// Todas las vistas del admin usan el layout del admin
router.use((req, res, next) => {
  res.locals.layoutAdmin = true;
  res.locals.usuario = req.session?.usuario || null;
  res.locals.rutaActual = req.path; // ruta relativa a /admin (para marcar el menú)
  res.locals.flash = req.session?.flash || null;
  if (req.session) req.session.flash = null;
  next();
});

// Protección CSRF simple: los POST tienen que venir de nuestro propio sitio
router.use((req, res, next) => {
  if (req.method !== 'POST') return next();
  const origen = req.get('origin') || req.get('referer') || '';
  if (origen && !origen.startsWith(`${req.protocol}://${req.get('host')}`)) return res.status(403).send('Origen no permitido');
  next();
});

function flash(req, texto, tipo = 'ok') {
  req.session.flash = { texto, tipo };
}

// ── Primer usuario (solo funciona si todavía no hay ninguno) ──
router.get('/setup', (req, res) => {
  if (auth.hayUsuarios()) return res.redirect('/admin/login');
  res.render('admin/setup', { error: null });
});
router.post('/setup', (req, res) => {
  if (auth.hayUsuarios()) return res.redirect('/admin/login');
  try {
    auth.crearAdmin(req.body.email, req.body.password, req.body.nombre);
    req.session.usuario = auth.login(req.body.email, req.body.password);
    res.redirect('/admin');
  } catch (e) {
    res.status(400).render('admin/setup', { error: e.message });
  }
});

// ── Login / logout ──────────────────────────────────────────
router.get('/login', (req, res) => {
  if (!auth.hayUsuarios()) return res.redirect('/admin/setup');
  res.render('admin/login', { error: null, volver: req.query.volver || '/admin' });
});
router.post('/login', (req, res) => {
  const u = auth.login(req.body.email, req.body.password);
  const volver = String(req.body.volver || '/admin');
  if (!u) return res.status(401).render('admin/login', { error: 'Email o contraseña incorrectos', volver });
  req.session.usuario = u;
  res.redirect(volver.startsWith('/admin') ? volver : '/admin');
});
router.post('/logout', (req, res) => {
  req.session = null;
  res.redirect('/admin/login');
});

// A partir de acá, todo requiere estar logueado
router.use(requiereLogin);

// ── Dashboard ───────────────────────────────────────────────
router.get('/', (req, res) => {
  res.render('admin/dashboard', { stats: productoRepo.estadisticas(), mensajes: generalRepo.listarMensajes().slice(0, 5) });
});

// ── Productos ───────────────────────────────────────────────
router.get('/productos', (req, res) => {
  const r = productoRepo.buscar({
    q: req.query.q || null,
    categoriaIds: req.query.categoria ? categoriaRepo.idsConDescendientes(Number(req.query.categoria)) : null,
    orden: req.query.orden || 'nuevos',
    pagina: parseInt(req.query.pagina, 10) || 1,
    porPagina: 40,
    incluirInactivos: true,
  });
  res.render('admin/productos', { r, q: req.query.q || '', categoria: req.query.categoria || '', categorias: catalogo.arbolCategorias() });
});

function formProducto(res, producto, error = null) {
  res.render('admin/producto-form', { p: producto, categorias: catalogo.arbolCategorias(), error });
}

router.get('/productos/nuevo', (req, res) => {
  formProducto(res, { id: null, nombre: '', activo: 1, cantidad_minima: 1, stock: 0, precio: 0, imagenes: [], variantes: [], categorias: [] });
});

router.get('/productos/:id', (req, res, next) => {
  const p = productoRepo.obtenerPorId(Number(req.params.id));
  if (!p) return next();
  formProducto(res, p);
});

/**
 * Convierte el formulario en un objeto producto.
 * slugActual: si el producto ya existe, conservamos su slug (el de Waclis, con tildes)
 * para que la URL no cambie aunque se edite el nombre.
 */
function productoDesdeForm(body, id, slugActual = null) {
  const lineas = (t) => String(t || '').split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  const variantes = lineas(body.variantes).map((l) => {
    const [valor, color_hex, stock] = l.split('|').map((s) => (s || '').trim());
    return { atributo: 'Color', valor, color_hex: color_hex || null, stock: Number(stock) || 0 };
  });
  const categoriaIds = [].concat(body.categorias || []).map(Number).filter(Boolean);
  return {
    id,
    nombre: String(body.nombre || '').trim(),
    slug: slugActual || slugify(body.nombre),
    codigo: body.codigo,
    proveedor: body.proveedor,
    descripcion: htmlSeguro(body.descripcion),
    ficha_tecnica: htmlSeguro(body.ficha_tecnica),
    precio: Number(String(body.precio).replace(',', '.')) || 0,
    costo: body.costo === '' ? null : Number(String(body.costo).replace(',', '.')),
    stock: variantes.length ? variantes.reduce((a, v) => a + v.stock, 0) : Number(body.stock) || 0,
    cantidad_minima: Number(body.cantidad_minima) || 1,
    destacado: !!body.destacado,
    activo: body.activo ? 1 : 0,
    imagenes: lineas(body.imagenes),
    variantes,
    categoriaIds,
  };
}

router.post('/productos/guardar', (req, res) => {
  const id = req.body.id ? Number(req.body.id) : null;
  const actual = id ? productoRepo.obtenerPorId(id) : null;
  const p = productoDesdeForm(req.body, id, actual?.slug);
  if (!p.nombre) return formProducto(res.status(400), { ...p, imagenes: p.imagenes.map((url) => ({ url })), categorias: p.categoriaIds.map((id) => ({ id })) }, 'El nombre es obligatorio');
  // Si cambian las imágenes en el form, conservamos el "url_original" de las que ya estaban
  const nuevoId = productoRepo.guardar(p);
  flash(req, `Producto "${p.nombre}" guardado`);
  res.redirect(`/admin/productos/${nuevoId}`);
});

router.post('/productos/:id/eliminar', (req, res) => {
  productoRepo.eliminar(Number(req.params.id));
  flash(req, 'Producto eliminado');
  res.redirect('/admin/productos');
});

router.post('/productos/:id/destacado', (req, res) => {
  productoRepo.cambiarDestacado(Number(req.params.id), req.body.valor === '1');
  res.redirect(req.get('referer') || '/admin/productos');
});

// ── Categorías ──────────────────────────────────────────────
router.get('/categorias', (req, res) => {
  res.render('admin/categorias', { arbol: catalogo.arbolCategorias(), todas: categoriaRepo.listarTodas() });
});
router.post('/categorias/guardar', (req, res) => {
  const nombre = String(req.body.nombre || '').trim();
  if (!nombre) {
    flash(req, 'El nombre es obligatorio', 'error');
    return res.redirect('/admin/categorias');
  }
  const id = req.body.id ? Number(req.body.id) : null;
  const actual = id ? categoriaRepo.obtenerPorId(id) : null;
  categoriaRepo.guardar({
    id,
    nombre,
    slug: actual?.slug || slugify(nombre), // las existentes conservan el slug de Waclis (misma URL)
    padre_id: req.body.padre_id ? Number(req.body.padre_id) : null,
    orden: Number(req.body.orden) || 0,
    destacada: !!req.body.destacada,
    imagen: String(req.body.imagen || '').trim() || null,
  });
  flash(req, `Categoría "${nombre}" guardada`);
  res.redirect('/admin/categorias');
});
router.post('/categorias/:id/eliminar', (req, res) => {
  categoriaRepo.eliminar(Number(req.params.id));
  flash(req, 'Categoría eliminada');
  res.redirect('/admin/categorias');
});

// ── Precios masivos ─────────────────────────────────────────
router.get('/precios', (req, res) => {
  res.render('admin/precios', { categorias: catalogo.arbolCategorias(), margen: configService.obtener().margen_sugerido });
});
router.post('/precios', (req, res) => {
  if (req.body.accion === 'margen') {
    // 0 dejaría precio = costo; más de 200 casi seguro es un error de tipeo (350 en vez de 35)
    const margen = Number(String(req.body.margen).replace(',', '.'));
    if (!Number.isFinite(margen) || margen <= 0 || margen > 200) {
      flash(req, 'Ingresá un margen mayor a 0 y hasta 200%', 'error');
      return res.redirect('/admin/precios');
    }
    const n = productoRepo.aplicarMargenSobreCosto(margen);
    flash(req, `Precio recalculado con ${margen}% sobre el costo en ${n} productos`);
  } else {
    const pct = Number(String(req.body.porcentaje).replace(',', '.'));
    if (!Number.isFinite(pct) || pct === 0) {
      flash(req, 'Ingresá un porcentaje válido', 'error');
      return res.redirect('/admin/precios');
    }
    const cats = req.body.categoria ? categoriaRepo.idsConDescendientes(Number(req.body.categoria)) : null;
    const n = productoRepo.ajustarPrecios(pct, cats);
    flash(req, `Precios ajustados ${pct > 0 ? '+' : ''}${pct}% en ${n} productos`);
  }
  res.redirect('/admin/precios');
});

// ── Mensajes de contacto ────────────────────────────────────
router.get('/mensajes', (req, res) => res.render('admin/mensajes', { mensajes: generalRepo.listarMensajes() }));
router.post('/mensajes/:id/leido', (req, res) => {
  generalRepo.marcarMensajeLeido(Number(req.params.id));
  res.redirect('/admin/mensajes');
});
router.post('/mensajes/:id/eliminar', (req, res) => {
  generalRepo.eliminarMensaje(Number(req.params.id));
  res.redirect('/admin/mensajes');
});

// ── Clientes (logos de la home) ─────────────────────────────
router.get('/clientes', (req, res) => res.render('admin/clientes', { clientes: generalRepo.listarClientes() }));
router.post('/clientes', (req, res) => {
  if (req.body.nombre && req.body.logo) generalRepo.crearCliente(req.body);
  res.redirect('/admin/clientes');
});
router.post('/clientes/:id/eliminar', (req, res) => {
  generalRepo.eliminarCliente(Number(req.params.id));
  res.redirect('/admin/clientes');
});

// ── Configuración ───────────────────────────────────────────
router.get('/configuracion', (req, res) => res.render('admin/configuracion', { c: configService.obtener() }));
router.post('/configuracion', (req, res) => {
  configService.guardar(req.body);
  flash(req, 'Configuración guardada');
  res.redirect('/admin/configuracion');
});

module.exports = router;
