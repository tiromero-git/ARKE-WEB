// Configuración de la app leída de variables de entorno (.env)
// Node 22+ puede leer el archivo .env solo con: process.loadEnvFile()
const path = require('node:path');
const fs = require('node:fs');

const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) process.loadEnvFile(envPath);

const root = path.join(__dirname, '..');
const isProd = process.env.NODE_ENV === 'production';

// Con la clave de sesión cualquiera podría fabricarse una cookie de admin.
// En producción no arrancamos sin una clave propia; en tu compu solo avisamos.
let sessionSecret = process.env.SESSION_SECRET || '';
if (sessionSecret.length < 32 || sessionSecret.startsWith('cambiame')) {
  if (isProd) throw new Error('Falta un SESSION_SECRET propio en .env. Generalo con: node scripts/generar-secreto.js');
  console.warn('  [!] SESSION_SECRET de ejemplo. Generá uno con: node scripts/generar-secreto.js');
  sessionSecret = sessionSecret || 'clave-solo-para-desarrollo';
}

module.exports = {
  root,
  port: Number(process.env.PORT || 3000),
  siteUrl: (process.env.SITE_URL || 'http://localhost:3000').replace(/\/$/, ''),
  dbPath: process.env.DB_PATH ? path.resolve(root, process.env.DB_PATH) : path.join(root, 'data', 'arke.db'),
  sessionSecret,
  isProd,
  productosPorPagina: 21, // igual que el sitio actual
};
