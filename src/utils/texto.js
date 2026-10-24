// Funciones de ayuda para textos

/** "Botella Térmica ÁRMIN" -> "botella termica armin" */
function normalizar(texto = '') {
  return String(texto)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // saca tildes
    .toLowerCase()
    .trim();
}

/** "Mug térmico MAGNO" -> "mug-termico-magno" */
function slugify(texto = '') {
  return normalizar(texto)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'producto';
}

/** Saca etiquetas HTML (para metadescripciones y búsqueda) */
function sinHtml(html = '') {
  return String(html || '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Limpia HTML que viene de afuera dejando solo etiquetas seguras.
 * (Evita que alguien meta <script> en una descripción.)
 */
function htmlSeguro(html = '') {
  const permitidas = ['b', 'strong', 'i', 'em', 'u', 'br', 'p', 'ul', 'ol', 'li', 'h4', 'h5', 'table', 'tr', 'td', 'th', 'tbody', 'thead'];
  return String(html || '')
    .replace(/<(script|style|iframe|object|embed)[\s\S]*?<\/\1>/gi, '')
    .replace(/<\/?([a-z0-9]+)[^>]*>/gi, (tag, nombre) => {
      nombre = nombre.toLowerCase();
      if (!permitidas.includes(nombre)) return ''; // etiqueta no permitida: se descarta
      return tag.startsWith('</') ? `</${nombre}>` : `<${nombre}>`; // sin atributos
    })
    .replace(/&nbsp;/g, ' ')
    .trim();
}

/** 26444.25 -> "$ 26.444,25" (formato argentino) */
function precio(valor) {
  const n = Number(valor || 0);
  return '$ ' + n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

module.exports = { normalizar, slugify, sinHtml, htmlSeguro, precio };
