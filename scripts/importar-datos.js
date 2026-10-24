// ─────────────────────────────────────────────────────────────
// Importa el catálogo exportado de arke.com.ar (Waclis) a nuestra base
// Uso:  npm run importar                 (usa data/arke-export.json)
//       npm run importar -- otro.json
//       npm run importar -- --solo-nuevos   (no pisa productos ya cargados)
// ─────────────────────────────────────────────────────────────
const path = require('node:path');
const fs = require('node:fs');
const config = require('../src/config');
const { getDb, transaction } = require('../src/db/database');
const categoriaRepo = require('../src/repositories/categoriaRepository');
const productoRepo = require('../src/repositories/productoRepository');
const { slugify, htmlSeguro } = require('../src/utils/texto');

const args = process.argv.slice(2);
const soloNuevos = args.includes('--solo-nuevos');
const archivo = path.resolve(config.root, args.find((a) => !a.startsWith('--')) || 'data/arke-export.json');

// Categorías que hoy aparecen destacadas en la home (con sus fotos)
const DESTACADAS = [169820, 170181, 170180, 170183];
// Productos que hoy aparecen en "Destacados"
const PRODUCTOS_DESTACADOS = [1119085, 1119057, 1118007];

/** "/categoria/170178/bolsos-y-mochilas/4662/mochilas" -> [{id:170178,slug}, {id:4662,slug}] */
function idsDeHref(href) {
  const partes = decodeURIComponent(new URL(href, 'https://x').pathname).split('/').filter(Boolean).slice(1);
  const res = [];
  for (let i = 0; i + 1 < partes.length; i += 2) res.push({ id: Number(partes[i]), slug: partes[i + 1] });
  return res.filter((x) => Number.isInteger(x.id));
}

/** "BOLSOS Y MOCHILAS" -> "Bolsos y mochilas" */
function nombreLindo(s) {
  s = String(s || '').trim();
  const letras = s.replace(/[^a-záéíóúñü]/gi, '');
  const mayus = letras.replace(/[^A-ZÁÉÍÓÚÑÜ]/g, '').length;
  if (letras && mayus / letras.length > 0.7) s = s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  return s;
}

function numero(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function main() {
  if (!fs.existsSync(archivo)) {
    console.error(`No encuentro ${archivo}`);
    process.exit(1);
  }
  const data = JSON.parse(fs.readFileSync(archivo, 'utf8'));
  getDb();

  // ── 1. Categorías ───────────────────────────────────────────
  let nCat = 0;
  transaction(() => {
    const guardarCat = (nodo, padreId, orden) => {
      const ids = idsDeHref(nodo.href);
      const yo = ids[ids.length - 1];
      if (!yo) return;
      const existente = categoriaRepo.obtenerPorId(yo.id);
      const imgLocal = path.join(config.root, 'public', 'img', `cat-${yo.id}.jpg`);
      categoriaRepo.guardar({
        id: yo.id,
        nombre: existente?.nombre || nombreLindo(nodo.name),
        slug: yo.slug,
        padre_id: padreId,
        orden,
        destacada: existente ? existente.destacada : DESTACADAS.includes(yo.id),
        imagen: existente?.imagen || (fs.existsSync(imgLocal) ? `/img/cat-${yo.id}.jpg` : null),
      });
      nCat++;
      (nodo.subs || []).forEach((s, i) => guardarCat(s, yo.id, i));
    };
    (data.categories || []).forEach((c, i) => guardarCat(c, null, i));
  });

  // ── 2. Productos ────────────────────────────────────────────
  const total = data.products.length;
  let nProd = 0, saltados = 0;
  // el orden del export es "más vistos" -> lo usamos como puntaje inicial
  const ordenOriginal = new Map(data.products.map((p, i) => [String(p.id), total - i]));
  const catsValidas = new Set(categoriaRepo.listarTodas().map((c) => c.id));

  for (const p of data.products) {
    const id = Number(p.id);
    if (!id || !p.name) continue;
    if (soloNuevos && productoRepo.obtenerPorId(id)) { saltados++; continue; }

    // Variantes (colores) sin repetir
    const variantes = [];
    const vistos = new Set();
    for (const v of p.vars || []) {
      const valor = String(v.value || '').trim();
      if (!valor || vistos.has(valor)) continue;
      vistos.add(valor);
      variantes.push({ atributo: v.atributo || 'Color', valor, color_hex: v.color || null, stock: numero(v.stock), precio: v.price ? numero(v.price) : null });
    }

    const tabDesc = (p.tabs || []).find((t) => /descrip/i.test(t.id)) || (p.tabs || [])[0];
    const tabFicha = (p.tabs || []).find((t) => /ficha|tecnic/i.test(t.id));
    const categoriaIds = [...new Set((p.cats || []).flatMap((h) => idsDeHref(h).map((x) => x.id)))].filter((c) => catsValidas.has(c));
    const primeraImg = (p.imgs || [])[0] || '';
    const proveedor = primeraImg.match(/images_proveedores\/([a-z0-9]+)_images/i)?.[1] || (primeraImg.includes('arke.com.ar/uploads') ? 'propio' : null);
    const stockVariantes = variantes.reduce((a, v) => a + v.stock, 0);

    productoRepo.guardar({
      id,
      nombre: p.name.trim(),
      slug: p.slug || slugify(p.name),
      codigo: p.code || null,
      proveedor,
      descripcion: htmlSeguro(tabDesc?.html || ''),
      ficha_tecnica: tabFicha ? htmlSeguro(tabFicha.html) : null,
      precio: numero(p.price),
      costo: p.cost ? numero(p.cost) : null,
      stock: p.stock != null && p.stock !== '' ? numero(String(p.stock).replace(/\D/g, '')) : stockVariantes,
      cantidad_minima: Math.max(1, numero(p.min) || 1),
      destacado: PRODUCTOS_DESTACADOS.includes(id),
      activo: 1,
      imagenes: (p.imgs || []).map((u) => ({ url: u, url_original: u })),
      variantes,
      categoriaIds,
    });
    getDb().prepare('UPDATE productos SET vistas = ? WHERE id = ? AND vistas = 0').run(ordenOriginal.get(String(p.id)) || 0, id);
    nProd++;
    if (nProd % 100 === 0) process.stdout.write(`  ${nProd}/${total} productos...\n`);
  }

  console.log(`\n✔ Importación terminada: ${nCat} categorías, ${nProd} productos${saltados ? `, ${saltados} ya existían` : ''}.`);
  console.log(`  Base de datos: ${config.dbPath}\n`);
}

main();
