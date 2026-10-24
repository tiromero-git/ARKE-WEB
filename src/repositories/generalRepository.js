// DAL: tablas chicas (configuración, mensajes, usuarios, clientes)
const { getDb, plain } = require('../db/database');

// ── Configuración (clave / valor) ──────────────────────────────
function obtenerConfiguracion() {
  const filas = getDb().prepare('SELECT clave, valor FROM configuracion').all();
  return Object.fromEntries(filas.map((f) => [f.clave, f.valor]));
}

function guardarConfiguracion(obj) {
  const st = getDb().prepare('INSERT INTO configuracion (clave, valor) VALUES (?, ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor');
  for (const [k, v] of Object.entries(obj)) st.run(k, v == null ? null : String(v));
}

// ── Mensajes de contacto ───────────────────────────────────────
function crearMensaje(m) {
  getDb().prepare('INSERT INTO mensajes (nombre, email, celular, mensaje) VALUES (?,?,?,?)').run(m.nombre, m.email, m.celular || null, m.mensaje || null);
}
function listarMensajes() {
  return getDb().prepare('SELECT * FROM mensajes ORDER BY id DESC LIMIT 500').all().map(plain);
}
function marcarMensajeLeido(id) {
  getDb().prepare('UPDATE mensajes SET leido = 1 WHERE id = ?').run(id);
}
function eliminarMensaje(id) {
  getDb().prepare('DELETE FROM mensajes WHERE id = ?').run(id);
}

// ── Usuarios admin ────────────────────────────────────────────
function usuarioPorEmail(email) {
  return plain(getDb().prepare('SELECT * FROM usuarios WHERE email = ?').get(String(email).toLowerCase().trim()));
}
function crearUsuario(u) {
  getDb()
    .prepare('INSERT INTO usuarios (email, nombre, password_hash) VALUES (?,?,?) ON CONFLICT(email) DO UPDATE SET password_hash = excluded.password_hash, nombre = excluded.nombre')
    .run(String(u.email).toLowerCase().trim(), u.nombre || null, u.password_hash);
}
function contarUsuarios() {
  return getDb().prepare('SELECT COUNT(*) AS n FROM usuarios').get().n;
}

// ── Clientes (logos) ──────────────────────────────────────────
function listarClientes() {
  return getDb().prepare('SELECT * FROM clientes ORDER BY orden, id').all().map(plain);
}
function crearCliente(c) {
  getDb().prepare('INSERT INTO clientes (nombre, logo, orden) VALUES (?,?,?)').run(c.nombre, c.logo, Number(c.orden) || 0);
}
function eliminarCliente(id) {
  getDb().prepare('DELETE FROM clientes WHERE id = ?').run(id);
}

module.exports = {
  obtenerConfiguracion, guardarConfiguracion,
  crearMensaje, listarMensajes, marcarMensajeLeido, eliminarMensaje,
  usuarioPorEmail, crearUsuario, contarUsuarios,
  listarClientes, crearCliente, eliminarCliente,
};
