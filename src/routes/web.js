// ─────────────────────────────────────────────────────────────
// Rutas del sitio público (páginas HTML renderizadas en el servidor)
// ─────────────────────────────────────────────────────────────
// Mantenemos LAS MISMAS URLs que el sitio de Waclis
// (/productos/1119085/mug-termico-magno, /categoria/169820/drinkwear ...)
// así los links que ya están en Google, Instagram o WhatsApp siguen andando.
const express = require('express');
const catalogo = require('../services/catalogoService');
const contacto = require('../services/contactoService');
const configService = require('../services/configService');
const productoRepo = require('../repositories/productoRepository');
const categoriaRepo = require('../repositories/categoriaRepository');
const config = require('../config');
const { sinHtml } = require('../utils/texto');

const router = express.Router();

// ── Home ─────────────────────────────────────────────────────
router.get(['/', '/home'], (req, res) => {
  res.render('home', { ...catalogo.datosHome(), pagina: 'home' });
});

// ── Listado de productos ─────────────────────────────────────
function renderListado(req, res, { categoria = null } = {}) {
  const r = catalogo.buscarProductos(req.query, { categoriaId: categoria?.id });
  res.render('productos', {
    pagina: 'productos',
    resultado: r,
    categoria,
    rango: catalogo.rangoPrecios(),
    titulo: categoria ? categoria.nombre : r.filtros.q ? `Resultados para "${r.filtros.q}"` : 'Productos',
    baseUrl: categoria ? categoria.url : '/productos',
  });
}

router.get('/productos', (req, res) => renderListado(req, res));

// El sitio viejo paginaba así: /productos/21, /productos/42 ... (offset)
router.get('/productos/:offset', (req, res, next) => {
  const offset = Number(req.params.offset);
  if (!Number.isInteger(offset)) return next();
  // si existe un producto con ese id, vamos a su ficha
  const p = productoRepo.obtenerPorId(offset);
  if (p) return res.redirect(301, catalogo.urlProducto(p));
  const pagina = Math.floor(offset / config.productosPorPagina) + 1;
  res.redirect(301, `/productos?pagina=${pagina}`);
});

// ── Ficha de producto ────────────────────────────────────────
router.get('/productos/:id/:slug', (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return next();
  const d = catalogo.detalleProducto(id);
  if (!d) return next(); // -> 404
  const p = d.producto;
  // URL "canónica": si el slug no coincide, redirigimos (bueno para SEO)
  if (decodeURIComponent(req.params.slug) !== p.slug) return res.redirect(301, catalogo.urlProducto(p));

  res.render('producto', {
    pagina: 'producto',
    ...d,
    seo: {
      titulo: p.nombre,
      descripcion: sinHtml(p.descripcion).slice(0, 160),
      imagen: p.imagenes[0]?.url,
    },
  });
});

// ── Categorías ───────────────────────────────────────────────
router.get(['/categoria/:id/:slug', '/categoria/:padreId/:padreSlug/:id/:slug'], (req, res, next) => {
  const categoria = catalogo.categoriaConPadre(Number(req.params.id));
  if (!categoria) return next();
  renderListado(req, res, { categoria });
});

// ── Páginas informativas ─────────────────────────────────────
router.get('/proceso-de-compra', (req, res) => res.render('proceso', { pagina: 'proceso', titulo: 'Proceso de compra' }));
router.get('/otros/1107', (req, res) => res.redirect(301, '/proceso-de-compra'));
router.get('/carrito', (req, res) => res.redirect(302, '/contacto'));

router.get('/contacto', (req, res) => {
  res.render('contacto', { pagina: 'contacto', titulo: 'Contacto', enviado: req.query.enviado === '1', errores: [], datos: {} });
});

router.post('/contacto', (req, res) => {
  const r = contacto.enviarMensaje(req.body);
  if (r.ok) return res.redirect(303, '/contacto?enviado=1');
  res.status(400).render('contacto', { pagina: 'contacto', titulo: 'Contacto', enviado: false, errores: r.errores, datos: r.datos });
});

// ── SEO: sitemap y robots ────────────────────────────────────
router.get('/sitemap.xml', (req, res) => {
  const base = config.siteUrl;
  const urls = ['/', '/productos', '/proceso-de-compra', '/contacto'];
  for (const c of categoriaRepo.listarTodas()) {
    const padre = c.padre_id ? categoriaRepo.obtenerPorId(c.padre_id) : null;
    urls.push(catalogo.urlCategoria(c, padre));
  }
  for (const p of productoRepo.todosParaSitemap()) urls.push(catalogo.urlProducto(p));
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  res.type('application/xml').send(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      urls.map((u) => `  <url><loc>${esc(base + encodeURI(u))}</loc></url>`).join('\n') +
      `\n</urlset>`
  );
});

router.get('/robots.txt', (req, res) => {
  res.type('text/plain').send(`User-agent: *\nDisallow: /admin\nDisallow: /api\nSitemap: ${config.siteUrl}/sitemap.xml\n`);
});

// Link corto a WhatsApp: /whatsapp?texto=...
router.get('/whatsapp', (req, res) => res.redirect(302, configService.linkWhatsapp(req.query.texto)));

module.exports = router;
