// BLL: login del panel de administración
// Las contraseñas NUNCA se guardan en texto plano: se guarda un "hash" con scrypt
// (viene incluido en Node, no hace falta instalar nada).
const crypto = require('node:crypto');
const repo = require('../repositories/generalRepository');

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verificarPassword(password, guardado) {
  const [salt, hash] = String(guardado || '').split(':');
  if (!salt || !hash) return false;
  const calculado = crypto.scryptSync(password, salt, 64);
  const esperado = Buffer.from(hash, 'hex');
  return esperado.length === calculado.length && crypto.timingSafeEqual(esperado, calculado);
}

function crearAdmin(email, password, nombre) {
  if (!email || !password || password.length < 8) throw new Error('Email y contraseña (mínimo 8 caracteres) son obligatorios');
  repo.crearUsuario({ email, nombre, password_hash: hashPassword(password) });
}

/** Devuelve el usuario si email/clave son correctos, si no null */
function login(email, password) {
  const u = repo.usuarioPorEmail(email || '');
  if (!u || !verificarPassword(password || '', u.password_hash)) return null;
  return { id: u.id, email: u.email, nombre: u.nombre };
}

module.exports = { hashPassword, verificarPassword, crearAdmin, login, hayUsuarios: () => repo.contarUsuarios() > 0 };
