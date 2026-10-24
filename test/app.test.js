// Pruebas automáticas: npm test
// Levantan la app con una base temporal y verifican las páginas principales.
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'arke-test-'));
process.env.DB_PATH = path.join(tmp, 'test.db');

const { crearApp } = require('../src/server');
const productoRepo = require('../src/repositories/productoRepository');
const categoriaRepo = require('../src/repositories/categoriaRepository');
const auth = require('../src/services/authService');

let server, base;

before(async () => {
  const app = crearApp();
  categoriaRepo.guardar({ id: 169820, nombre: 'Drinkwear', slug: 'drinkwear' });
  categoriaRepo.guardar({ id: 4659, nombre: 'Jarros&Mugs', slug: 'jarrosmugs', padre_id: 169820 });
  productoRepo.guardar({
    id: 1119085, nombre: 'Mug térmico "MAGNO"', slug: 'mug-térmico-magno', codigo: 'T702', proveedor: 'zecat', precio: 26444.25, costo: 22995,
    stock: 6857, descripcion: 'Mug doble pared<script>alert(1)</script>', imagenes: ['/img/logo.webp'],
    variantes: [{ valor: 'Negro', color_hex: '#000000', stock: 100 }], categoriaIds: [4659], destacado: true,
  });
  auth.crearAdmin('admin@arke.test', 'claveSegura123', 'Admin');
  await new Promise((r) => { server = app.listen(0, r); });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => server && server.close());

const get = (p, opts) => fetch(base + p, { redirect: 'manual', ...opts });

test('home responde 200', async () => {
  const r = await get('/');
  assert.equal(r.status, 200);
  const html = await r.text();
  assert.match(html, /No es un regalo/);
  assert.match(html, /<video[^>]+muted[^>]+playsinline/); // sin muted/playsinline el celu no lo reproduce solo
  const video = await get('/video/arke-hero.mp4', { headers: { range: 'bytes=0-99' } });
  assert.equal(video.status, 206); // el servidor responde por partes: el navegador puede adelantar el video
});

test('listado y búsqueda sin tildes', async () => {
  const html = await (await get('/productos?q=termico')).text();
  assert.match(html, /MAGNO/);
});

test('ficha de producto, sin mostrar costo', async () => {
  const r = await get('/productos/1119085/' + encodeURIComponent('mug-térmico-magno'));
  assert.equal(r.status, 200);
  const html = await r.text();
  assert.match(html, /T702/);
  assert.doesNotMatch(html, /22995|22\.995/);
  assert.doesNotMatch(html, /<script>alert/);
});

test('slug incorrecto redirige a la URL canónica', async () => {
  const r = await get('/productos/1119085/otro');
  assert.equal(r.status, 301);
});

test('URLs viejas de Waclis siguen funcionando', async () => {
  assert.equal((await get('/categoria/169820/drinkwear')).status, 200);
  assert.equal((await get('/categoria/169820/drinkwear/4659/jarrosmugs')).status, 200);
  assert.equal((await get('/otros/1107')).headers.get('location'), '/proceso-de-compra');
  assert.match((await get('/productos/21')).headers.get('location'), /pagina=2/);
});

test('API no expone el costo', async () => {
  const j = await (await get('/api/productos/1119085')).json();
  assert.equal(j.codigo, 'T702');
  assert.equal(j.costo, undefined);
  assert.equal(j.proveedor, undefined);
  const s = await (await get('/api/sugerencias?q=mug')).json();
  assert.equal(s.length, 1);
  const l = await (await get('/api/productos')).json();
  assert.equal(l.items[0].proveedor, undefined);
});

test('formulario de contacto valida y guarda', async () => {
  const mal = await get('/contacto', { method: 'POST', body: new URLSearchParams({ nombre: '', email: 'x' }) });
  assert.equal(mal.status, 400);
  const bien = await get('/contacto', { method: 'POST', body: new URLSearchParams({ nombre: 'Ana', email: 'ana@test.com', mensaje: 'Hola' }) });
  assert.equal(bien.status, 303);
});

test('admin protegido y login funciona', async () => {
  assert.equal((await get('/admin')).status, 302);
  const r = await get('/admin/login', { method: 'POST', body: new URLSearchParams({ email: 'admin@arke.test', password: 'claveSegura123' }) });
  assert.equal(r.status, 302);
  const cookie = r.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
  const panel = await get('/admin/productos', { headers: { cookie } });
  assert.equal(panel.status, 200);
  assert.match(await panel.text(), /22\.995/); // en el admin sí se ve el costo
  const malo = await get('/admin/login', { method: 'POST', body: new URLSearchParams({ email: 'admin@arke.test', password: 'mal' }) });
  assert.equal(malo.status, 401);
});

test('sitemap y robots', async () => {
  assert.match(await (await get('/sitemap.xml')).text(), /1119085/);
  assert.match(await (await get('/robots.txt')).text(), /Disallow: \/admin/);
});

async function loginAdmin() {
  const r = await get('/admin/login', { method: 'POST', body: new URLSearchParams({ email: 'admin@arke.test', password: 'claveSegura123' }) });
  return r.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
}
const postAdmin = (cookie, p, datos) => get(p, { method: 'POST', headers: { cookie }, body: new URLSearchParams(datos) });

test('editar desde el panel conserva las URLs de Waclis', async () => {
  const cookie = await loginAdmin();
  await postAdmin(cookie, '/admin/productos/guardar', {
    id: '1119085', nombre: 'Mug térmico MAGNO 2', precio: '26444,25', costo: '22995', stock: '0',
    categorias: '4659', imagenes: '/img/logo.webp', variantes: 'Negro|#000000|100', activo: '1',
  });
  assert.equal(productoRepo.obtenerPorId(1119085).slug, 'mug-térmico-magno');
  await postAdmin(cookie, '/admin/categorias/guardar', { id: '4659', nombre: 'Jarros & Mugs', padre_id: '169820' });
  assert.equal(categoriaRepo.obtenerPorId(4659).slug, 'jarrosmugs');
});

test('recalcular margen valida el valor', async () => {
  const cookie = await loginAdmin();
  await postAdmin(cookie, '/admin/precios', { accion: 'margen', margen: '0' });
  assert.equal(productoRepo.obtenerPorId(1119085).precio, 26444.25); // 0 se rechaza: no deja precio = costo
  await postAdmin(cookie, '/admin/precios', { accion: 'margen', margen: '15,5' });
  assert.equal(productoRepo.obtenerPorId(1119085).precio, 26559.23); // 22995 × 1,155 (acepta coma)
});
