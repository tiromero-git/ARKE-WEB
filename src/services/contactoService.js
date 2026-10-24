// BLL: formulario de contacto
const repo = require('../repositories/generalRepository');

const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Valida y guarda un mensaje. Devuelve { ok, errores }.
 * "website" es un campo oculto (honeypot): los humanos no lo ven,
 * los robots de spam lo completan -> lo descartamos sin avisar.
 */
function enviarMensaje(datos = {}) {
  if (datos.website) return { ok: true, spam: true };

  const m = {
    nombre: String(datos.nombre || '').trim().slice(0, 120),
    email: String(datos.email || '').trim().slice(0, 160),
    celular: String(datos.celular || '').trim().slice(0, 40),
    mensaje: String(datos.mensaje || '').trim().slice(0, 3000),
  };
  const errores = [];
  if (!m.nombre) errores.push('Ingresá tu nombre.');
  if (!EMAIL_OK.test(m.email)) errores.push('Ingresá un email válido.');
  if (errores.length) return { ok: false, errores, datos: m };

  repo.crearMensaje(m);
  return { ok: true };
}

module.exports = { enviarMensaje };
