# ARKE Web — sitio propio (front + backend)

Réplica del sitio de **arke.com.ar** (hoy hecho con Waclis/Nextiendas), pero con el código, los datos y el dominio **bajo tu control**.

- Catálogo completo importado del sitio actual: categorías, productos, colores, stock, fotos y descripciones.
- **Mismas URLs** que el sitio de Waclis (`/productos/1119085/mug-térmico-magno`, `/categoria/169820/drinkwear`...), así no se pierden los links de Google, Instagram o WhatsApp.
- Sin carrito cotizador: cada producto tiene **"Consultar por WhatsApp"**, con el producto, el color y la cantidad ya escritos en el mensaje.
- **Panel de administración** propio en `/admin`: productos, categorías, precios masivos, mensajes de contacto, logos de clientes y configuración.

---

## 1. Qué necesitás instalar (una sola vez)

1. **Node.js 24 LTS** → https://nodejs.org (botón "LTS"). Instalalo con las opciones por defecto.
2. **Visual Studio Code** (ya lo tenés).

Para comprobar que quedó instalado, abrí una terminal (en VS Code: *Terminal → New Terminal*) y escribí:

```bash
node -v
```

Tiene que mostrar `v24...` (sirve cualquier versión desde la 22.13).

## 2. Ponerlo en marcha en tu compu

Abrí la carpeta `arke-web` en VS Code y en la terminal ejecutá:

```bash
npm install          # descarga las 3 librerías que usa el proyecto
copy .env.example .env    # (en Windows; en Mac/Linux: cp .env.example .env)
node scripts/generar-secreto.js   # pone un SESSION_SECRET aleatorio en .env
npm run importar     # carga el catálogo de data/arke-export.json en la base
npm start            # levanta el sitio
```

Abrí **http://localhost:3000** en el navegador. 🎉

- Panel admin: **http://localhost:3000/admin**. La primera vez te pide crear tu usuario y contraseña.
- Mientras programás conviene usar `npm run dev`: reinicia solo cada vez que guardás un archivo.
- `npm test` corre las pruebas automáticas.

> Las fotos de los productos todavía se cargan desde los servidores de Waclis (`api.nextiendas.com`). Mientras Waclis siga activo, se ven igual.
> **Antes de dar de baja Waclis** corré `npm run imagenes`: descarga todas las fotos a `public/uploads/productos` y las pasa a tu servidor.

## 3. Cómo está organizado (igual que los TP en capas de C#)

```
arke-web/
├─ src/
│  ├─ server.js            ← arranque de la app (como el Program.cs)
│  ├─ config.js            ← configuración (.env)
│  ├─ routes/              ← UI / controladores: reciben cada pedido HTTP
│  │   ├─ web.js           ←   páginas públicas (home, productos, ficha, contacto...)
│  │   ├─ api.js           ←   API REST en JSON (/api/...) → el "backend puro"
│  │   └─ admin.js         ←   panel de administración
│  ├─ services/            ← BLL: reglas de negocio (catálogo, login, contacto, config)
│  ├─ repositories/        ← DAL: todo el SQL está acá
│  ├─ db/                  ← conexión SQLite + schema.sql (las tablas)
│  ├─ middleware/          ← cosas que corren antes de las rutas (ej: exigir login)
│  └─ utils/               ← funciones de ayuda (formato de precios, slugs...)
├─ views/                  ← HTML (plantillas EJS); views/admin = panel
├─ public/                 ← lo que baja el navegador: css, js, imágenes
├─ scripts/                ← importar datos, descargar imágenes, crear admin
├─ data/                   ← arke-export.json (catálogo exportado) y arke.db (la base)
└─ test/                   ← pruebas automáticas
```

Cómo viaja un pedido, por ejemplo al abrir un producto:

```
Navegador → routes/web.js → services/catalogoService.js → repositories/productoRepository.js → SQLite
                         ← views/producto.ejs (HTML) ←
```

**Tecnologías**: Node.js + Express (servidor web), EJS (plantillas HTML), SQLite (base de datos en un archivo, incluida en Node) y JavaScript puro en el navegador. Es el mismo lenguaje (JavaScript) en el front y en el back.

### Base de datos

Tablas: `productos`, `producto_imagenes`, `producto_variantes`, `categorias`, `producto_categorias`, `mensajes`, `usuarios`, `clientes`, `configuracion`. Están en `src/db/schema.sql`.
La base es el archivo `data/arke.db`; podés abrirla con **DB Browser for SQLite** para ver los datos.

### API

| Método | Ruta | Devuelve |
|---|---|---|
| GET | `/api/categorias` | árbol de categorías |
| GET | `/api/productos?q=&categoria=&min=&max=&stock=&orden=&pagina=` | listado paginado |
| GET | `/api/productos/:id` | detalle de un producto |
| GET | `/api/sugerencias?q=` | buscador predictivo |

El **costo** de los productos nunca sale por la API ni por las páginas públicas: solo se ve en el panel.

## 4. El panel `/admin`

- **Productos**: buscar, editar (nombre, precio, costo, stock, colores, fotos, categorías), ocultar, destacar en la home, crear nuevos.
- **Precios masivos**: subir o bajar un % (todo o por categoría), o recalcular precio = costo + margen.
- **Categorías**: renombrar, ordenar, elegir cuáles van destacadas en la home.
- **Mensajes**: lo que entra por el formulario de contacto.
- **Clientes**: logos para la sección "Nuestros clientes".
- **Configuración**: WhatsApp, teléfono, email, redes, mostrar/ocultar precios y stock, Google Analytics y Meta Pixel.

## 5. Actualizar el catálogo

`data/arke-export.json` es una foto del catálogo de arke.com.ar del 05/10/2026.

- `npm run importar` vuelve a cargar todo (pisa precios y stock con lo del archivo).
- `npm run importar -- --solo-nuevos` agrega solo los productos que no tenías.

Más adelante, con los accesos API de Zecat, CDO y Promoproductos, se puede sumar una sincronización automática de stock y precios.

## 6. Publicarlo (cuando lo decidamos)

Todavía **no** hay que tocar Waclis ni el dominio. Cuando esté aprobado:

1. Correr `npm run imagenes` (fotos a tu servidor).
2. Subir el proyecto a un hosting con Node (Render, Railway, un VPS de DonWeb o Hostinger, etc.).
3. Configurar `.env` con `NODE_ENV=production`, `SITE_URL=https://www.arke.com.ar` y un `SESSION_SECRET` nuevo.
4. Probar en una dirección temporal, y recién ahí apuntar el dominio arke.com.ar (DNS en NIC.ar) al hosting nuevo.
5. Dar de baja Waclis.
