// ─────────────────────────────────────────────────────────────
// Descarga las imágenes de los productos a public/uploads/productos
// y actualiza la base para que se sirvan desde TU servidor.
//
// IMPORTANTE: hacelo ANTES de dar de baja Waclis, porque hoy las fotos
// están alojadas en api.nextiendas.com (sus servidores).
//
// Uso:  npm run imagenes
// Se puede cortar y volver a correr: sigue desde donde quedó.
// ─────────────────────────────────────────────────────────────
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const config = require('../src/config');
const productoRepo = require('../src/repositories/productoRepository');

const CARPETA = path.join(config.root, 'public', 'uploads', 'productos');
const SIMULTANEAS = 6;

function nombreArchivo(url) {
  const limpio = url.split('?')[0];
  const ext = (path.extname(limpio) || '.jpg').toLowerCase().slice(0, 6);
  const base = path.basename(limpio, path.extname(limpio)).replace(/[^a-z0-9_-]/gi, '_').slice(0, 60);
  const hash = crypto.createHash('md5').update(url).digest('hex').slice(0, 8);
  return `${base}-${hash}${ext}`;
}

async function descargar(url, destino) {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (ARKE descarga de imágenes)' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(destino, buf);
}

async function main() {
  fs.mkdirSync(CARPETA, { recursive: true });
  const pendientes = productoRepo.imagenesRemotas();
  console.log(`\nImágenes remotas para descargar: ${pendientes.length}\n`);

  const yaBajadas = new Map(); // misma URL usada en varios productos -> se baja una vez
  let ok = 0, error = 0, i = 0;

  async function trabajador() {
    while (i < pendientes.length) {
      const img = pendientes[i++];
      try {
        const archivo = nombreArchivo(img.url);
        const destino = path.join(CARPETA, archivo);
        if (!fs.existsSync(destino)) {
          if (!yaBajadas.has(img.url)) yaBajadas.set(img.url, descargar(img.url, destino));
          await yaBajadas.get(img.url);
        }
        productoRepo.actualizarUrlImagen(img.id, `/uploads/productos/${archivo}`);
        ok++;
      } catch (e) {
        error++;
        console.warn(`  ✖ ${img.url} (${e.message})`);
      }
      if ((ok + error) % 200 === 0) console.log(`  ${ok + error}/${pendientes.length}...`);
    }
  }

  await Promise.all(Array.from({ length: SIMULTANEAS }, trabajador));
  console.log(`\n✔ Listo: ${ok} descargadas${error ? `, ${error} con error (volvé a correr el comando para reintentar)` : ''}.\n`);
}

main();
