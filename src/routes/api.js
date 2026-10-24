// ─────────────────────────────────────────────────────────────
// API REST (JSON) — el "backend puro"
// ─────────────────────────────────────────────────────────────
// La usa el front para el buscador predictivo, y sirve si mañana
// querés hacer una app móvil o conectar otro sistema.
//
//   GET /api/categorias
//   GET /api/productos?q=&categoria=&min=&max=&stock=&orden=&pagina=
//   GET /api/productos/:id
//   GET /api/sugerencias?q=
const express = require('express');
const catalogo = require('../services/catalogoService');
const configService = require('../services/configService');

const router = express.Router();

/** Saca los datos internos antes de responder: costo y proveedor no son para el público */
function publico(p) {
  const { costo, proveedor, busqueda, busqueda_nombre, vistas, ...resto } = p;
  if (configService.obtener().mostrar_precios !== '1') delete resto.precio;
  return { ...resto, url: catalogo.urlProducto(p) };
}

router.get('/categorias', (req, res) => {
  res.json(catalogo.arbolCategorias());
});

router.get('/productos', (req, res) => {
  const categoriaId = parseInt(req.query.categoria, 10) || undefined;
  const r = catalogo.buscarProductos(req.query, { categoriaId });
  res.json({ total: r.total, pagina: r.pagina, paginas: r.paginas, items: r.items.map(publico) });
});

router.get('/productos/:id', (req, res) => {
  const d = catalogo.detalleProducto(Number(req.params.id), { contarVista: false });
  if (!d) return res.status(404).json({ error: 'Producto no encontrado' });
  res.json({ ...publico(d.producto), categoria: d.categoria });
});

router.get('/sugerencias', (req, res) => {
  res.json(catalogo.sugerencias(req.query.q).map(publico));
});

module.exports = router;
