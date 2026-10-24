-- ─────────────────────────────────────────────────────────────
-- Esquema de la base de datos de ARKE
-- (se ejecuta solo al iniciar; "IF NOT EXISTS" evita pisar datos)
-- ─────────────────────────────────────────────────────────────

-- Categorías en árbol: una categoría puede tener una "padre".
-- Ej: Drinkwear (padre) -> Botellas (hija)
CREATE TABLE IF NOT EXISTS categorias (
  id          INTEGER PRIMARY KEY,
  nombre      TEXT    NOT NULL,
  slug        TEXT    NOT NULL,
  padre_id    INTEGER REFERENCES categorias(id) ON DELETE SET NULL,
  orden       INTEGER NOT NULL DEFAULT 0,
  destacada   INTEGER NOT NULL DEFAULT 0,  -- 1 = aparece en la home
  imagen      TEXT
);

CREATE TABLE IF NOT EXISTS productos (
  id               INTEGER PRIMARY KEY,
  nombre           TEXT    NOT NULL,
  slug             TEXT    NOT NULL,
  codigo           TEXT,                     -- código del proveedor (ej. T702)
  proveedor        TEXT,                     -- zecat, cdo, etc.
  descripcion      TEXT,                     -- HTML simple
  ficha_tecnica    TEXT,                     -- HTML simple (opcional)
  precio           REAL    NOT NULL DEFAULT 0, -- precio de venta (con el que se muestra)
  costo            REAL,                     -- costo del proveedor: SOLO se ve en el panel admin
  stock            INTEGER NOT NULL DEFAULT 0,
  cantidad_minima  INTEGER NOT NULL DEFAULT 1,
  destacado        INTEGER NOT NULL DEFAULT 0,
  activo           INTEGER NOT NULL DEFAULT 1,
  vistas           INTEGER NOT NULL DEFAULT 0,
  busqueda         TEXT,                     -- texto normalizado (sin tildes) para el buscador
  busqueda_nombre  TEXT,                     -- solo nombre + código normalizados (para priorizar resultados)
  creado_en        TEXT    NOT NULL DEFAULT (datetime('now')),
  actualizado_en   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_productos_activo ON productos(activo);
CREATE INDEX IF NOT EXISTS idx_productos_nombre ON productos(nombre);

-- Relación muchos a muchos producto <-> categoría
CREATE TABLE IF NOT EXISTS producto_categorias (
  producto_id  INTEGER NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  categoria_id INTEGER NOT NULL REFERENCES categorias(id) ON DELETE CASCADE,
  PRIMARY KEY (producto_id, categoria_id)
);

CREATE TABLE IF NOT EXISTS producto_imagenes (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  producto_id  INTEGER NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  url          TEXT    NOT NULL,      -- URL externa o ruta local (/uploads/...)
  url_original TEXT,                  -- de dónde se descargó
  orden        INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_imagenes_producto ON producto_imagenes(producto_id);

-- Variantes (ej. Color: Negro, stock 1659)
CREATE TABLE IF NOT EXISTS producto_variantes (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  producto_id  INTEGER NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  atributo     TEXT    NOT NULL DEFAULT 'Color',
  valor        TEXT    NOT NULL,
  color_hex    TEXT,
  stock        INTEGER NOT NULL DEFAULT 0,
  precio       REAL
);
CREATE INDEX IF NOT EXISTS idx_variantes_producto ON producto_variantes(producto_id);

-- Mensajes que llegan por el formulario de contacto
CREATE TABLE IF NOT EXISTS mensajes (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre    TEXT NOT NULL,
  email     TEXT NOT NULL,
  celular   TEXT,
  mensaje   TEXT,
  leido     INTEGER NOT NULL DEFAULT 0,
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Usuarios del panel de administración
CREATE TABLE IF NOT EXISTS usuarios (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL UNIQUE,
  nombre        TEXT,
  password_hash TEXT NOT NULL,
  creado_en     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Logos de "Nuestros clientes"
CREATE TABLE IF NOT EXISTS clientes (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  logo   TEXT NOT NULL,
  orden  INTEGER NOT NULL DEFAULT 0
);

-- Configuración general editable desde el panel (clave/valor)
CREATE TABLE IF NOT EXISTS configuracion (
  clave TEXT PRIMARY KEY,
  valor TEXT
);
