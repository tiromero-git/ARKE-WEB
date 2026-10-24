// BLL: configuración del sitio (datos de contacto, textos, opciones)
const repo = require('../repositories/generalRepository');

// Valores por defecto = lo que hoy tiene arke.com.ar
const DEFAULTS = {
  nombre_sitio: 'Arke Agency',
  titulo_sitio: 'Arke Agency | Merchandising y Diseño para Empresas',
  descripcion_sitio: 'Impulsamos tu marca con productos de merchandising y diseño pensados para empresas. Personalización estratégica para fidelizar, posicionar y comunicar.',
  whatsapp: '5491144302638',
  telefono: '1144302638',
  email: 'arke.informacion@gmail.com',
  instagram: 'https://www.instagram.com/arke.agency/',
  linkedin: 'https://www.linkedin.com/company/106331085/',
  mensaje_whatsapp: '¡Hola ARKE! Quiero hacer una consulta.',
  mostrar_precios: '1',
  mostrar_stock: '1',
  margen_sugerido: '20', // el margen real del catálogo importado de Waclis (15–20%)
  google_site_verification: 'EG7_S7Ah2309vdv6q7V0eUO8KHFLWQXYI83s-vjUb0E',
  google_analytics_id: '', // ej: G-XXXXXXX
  meta_pixel_id: '',
};

let cache = null;

function obtener() {
  if (!cache) cache = { ...DEFAULTS, ...repo.obtenerConfiguracion() };
  return cache;
}

function guardar(datos) {
  const permitido = {};
  for (const k of Object.keys(DEFAULTS)) {
    if (k in datos) permitido[k] = String(datos[k] ?? '').trim();
  }
  // checkboxes: si no vienen en el form, es porque están destildados
  for (const k of ['mostrar_precios', 'mostrar_stock']) permitido[k] = datos[k] ? '1' : '0';
  permitido.whatsapp = (permitido.whatsapp || '').replace(/\D/g, '');
  repo.guardarConfiguracion(permitido);
  cache = null;
}

/** Arma el link de WhatsApp con un mensaje precargado */
function linkWhatsapp(texto) {
  const c = obtener();
  return `https://wa.me/${c.whatsapp}?text=${encodeURIComponent(texto || c.mensaje_whatsapp)}`;
}

module.exports = { obtener, guardar, linkWhatsapp, DEFAULTS };
