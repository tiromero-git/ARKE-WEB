// ─────────────────────────────────────────────────────────────
// Capa de acceso a datos: conexión a la base SQLite
// ─────────────────────────────────────────────────────────────
// Usamos el módulo "node:sqlite" que ya viene con Node (>= 22.13),
// así no hay que instalar nada extra ni compilar drivers.
// La base es un único archivo: data/arke.db
//
// Si en el futuro querés pasar a SQL Server o PostgreSQL, sólo hay que
// cambiar ESTA carpeta (db) y los repositorios. Los servicios y las rutas
// no se enteran (por eso separamos en capas).

const path = require('node:path');
const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');
const config = require('../config');

let db = null;

function getDb() {
  if (db) return db;

  fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
  db = new DatabaseSync(config.dbPath);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');

  // Crea las tablas si no existen
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  db.exec(schema);
  return db;
}

/** Ejecuta una función dentro de una transacción (todo o nada). */
function transaction(fn) {
  const conn = getDb();
  conn.exec('BEGIN');
  try {
    const result = fn(conn);
    conn.exec('COMMIT');
    return result;
  } catch (err) {
    conn.exec('ROLLBACK');
    throw err;
  }
}

/** Convierte las filas "null prototype" de node:sqlite en objetos comunes. */
function plain(row) {
  return row ? { ...row } : row;
}

function close() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = { getDb, transaction, plain, close };
