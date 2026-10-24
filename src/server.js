// ─────────────────────────────────────────────────────────────
// Punto de entrada de la aplicación ARKE
// ─────────────────────────────────────────────────────────────
//  Capas (igual que en los TP de C#):
//    routes/        -> "UI / Controladores": reciben el pedido HTTP
//    services/      -> "BLL": reglas de negocio
//    repositories/  -> "DAL": SQL contra la base
//    db/            -> conexión y esquema
//    views/         -> HTML (plantillas EJS)  |  public/ -> CSS, JS, imágenes
const path = require('node:path');
const express = require('express');
const cookieSession = require('cookie-session');
const config = require('./config');
const configService = require('./services/configService');
const catalogo = require('./services/catalogoService');
const texto = require('./utils/texto');
const { getDb } = require('./db/database');

function crearApp() {
  getDb(); // abre la base y crea tablas si hace falta

  const app = express();
  app.set('view engine', 'ejs');
  app.set('views', path.join(config.root, 'views'));
  app.set('trust proxy', 1); // por si se publica detrás de un proxy (Render, Railway, etc.)
  app.disable('x-powered-by');

  // Cabeceras básicas de seguridad
  app.use((req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('X-Frame-Options', 'SAMEORIGIN');
    res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  app.use(express.static(path.join(config.root, 'public'), { maxAge: config.isProd ? '7d' : 0 }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(express.json({ limit: '1mb' }));
  app.use(
    cookieSession({
      name: 'arke_sesion',
      keys: [config.sessionSecret],
      maxAge: 8 * 60 * 60 * 1000, // 8 horas
      sameSite: 'lax',
      httpOnly: true,
      secure: config.isProd,
    })
  );

  // Variables disponibles en TODAS las vistas
  app.use((req, res, next) => {
    res.locals.cfg = configService.obtener();
    res.locals.categoriasMenu = catalogo.arbolCategorias();
    res.locals.urlCategoria = catalogo.urlCategoria;
    res.locals.urlProducto = catalogo.urlProducto;
    res.locals.fmt = texto;
    res.locals.siteUrl = config.siteUrl;
    res.locals.rutaActual = req.path;
    res.locals.query = req.query;
    res.locals.seo = null;
    res.locals.titulo = null;
    res.locals.pagina = '';
    next();
  });

  app.use('/api', require('./routes/api'));
  app.use('/admin', require('./routes/admin'));
  app.use('/', require('./routes/web'));

  // 404
  app.use((req, res) => {
    if (req.path.startsWith('/api')) return res.status(404).json({ error: 'No encontrado' });
    res.status(404).render('404', { titulo: 'Página no encontrada' });
  });

  // Errores
  app.use((err, req, res, next) => {
    console.error(err);
    if (req.path.startsWith('/api')) return res.status(500).json({ error: 'Error interno' });
    res.status(500).render('404', { titulo: 'Ups, algo salió mal', error: true });
  });

  return app;
}

if (require.main === module) {
  crearApp().listen(config.port, () => {
    console.log(`\n  ARKE web funcionando en http://localhost:${config.port}`);
    console.log(`  Panel admin:            http://localhost:${config.port}/admin\n`);
  });
}

module.exports = { crearApp };
