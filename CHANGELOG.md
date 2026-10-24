# Bitácora de cambios — ARKE Web

Acá queda anotado cada avance del sitio, en criollo: **qué** cambió, **por qué** y, cuando sirve,
cómo se compara con C#. El detalle línea por línea está en el historial de git
(en GitHub: pestaña *Commits*, y en cada commit se ve el antes/después en verde y rojo).

Cómo se usa: cada vez que se hace un commit con algo visible o importante, se agrega una entrada
arriba de todo con la fecha. Los commits llevan un prefijo para saber de qué se trata:
`feat:` funcionalidad nueva · `fix:` arreglo · `docs:` documentación · `test:` pruebas · `chore:` mantenimiento.

---

## 2026-10-24 — Video en el hero de la home

**Qué cambió.** El hero (la primera franja de la home) ahora tiene de fondo el video
`public/video/arke-hero.mp4` (Full HD, 24 s, 3,8 MB): un mosaico de productos con logos que se
mueve. Encima, las mismas 3 frases rotando. La grilla de íconos se sacó porque el video la reemplaza.

**Cómo está armado** (por capas, de atrás hacia adelante):
1. `<video autoplay muted loop playsinline>`: `muted` y `playsinline` son obligatorios para que
   los celulares lo reproduzcan solos. `object-fit: cover` lo estira sin deformarlo.
2. Un velo con degradé oscuro (`#2c2b26`, el color de texto de la marca) del lado del texto,
   para que se lea; a la derecha casi transparente para que se vean los productos.
3. Los textos en blanco, con la segunda línea en arena (el oliva no contrasta sobre fondo oscuro).
4. Controles semitransparentes: flechas, puntos y un botón de pausa.

**Detalles de funcionamiento** (en `public/js/app.js`):
- Botón de pausa: cualquier animación de más de 5 segundos tiene que poder frenarse (accesibilidad).
- Si el visitante tiene activado "reducir movimiento" o "ahorro de datos", el video no arranca solo.
- Cuando scrolleás y el hero sale de pantalla, el video se pausa (ahorra batería); al volver, sigue.

**Tests:** 11/11. El de la home ahora controla que el video tenga `muted`/`playsinline` y que el
servidor lo entregue por partes (código 206), que es lo que permite adelantarlo.

## 2026-10-24 — Arreglos de seguridad y de URLs

**Slugs de Waclis protegidos.** Al editar un producto o una categoría desde el panel, el slug
(la parte final de la URL, ej. `mug-térmico-magno`) se volvía a generar desde el nombre y perdía
las tildes. Afectaba a 212 productos y 6 categorías. Ahora los existentes conservan el suyo.
*En C#:* es cargar la entidad del repositorio antes de mapear el DTO del formulario, en vez de
crear una nueva y pisar campos que el formulario no trae.

**Margen validado.** "Recalcular precio = costo + margen" aceptaba `0` (dejaba precio = costo)
y fallaba con coma (`15,5`). Ahora acepta coma y solo valores entre 0 y 200%. El margen sugerido
pasó de 35% a 20%, que es el real del catálogo importado.

**La API ya no muestra el proveedor.** `/api/productos` devolvía `proveedor` (zecat, cdo...),
y con el código cualquiera podía ir directo al mayorista. Ahora se saca igual que el costo.

**Clave de sesión propia.** El `.env` tenía la clave de ejemplo: con ella alguien podría
fabricarse una cookie de admin. Nuevo script `node scripts/generar-secreto.js`; el `.bat` lo
corre solo al crear el `.env`, y en producción la app no arranca sin una clave propia.

**Tests:** 11/11 (se sumaron "editar desde el panel conserva las URLs de Waclis" y
"recalcular margen valida el valor").

## 2026-10-05 — Versión inicial (armada en Cowork)

- Réplica de arke.com.ar con Node.js + Express 5 + EJS + SQLite, en capas
  (routes → services → repositories → db), como los TP de C#.
- Catálogo de Waclis importado: 35 categorías, 1.179 productos, ~2.950 variantes.
- Mismas URLs que Waclis, botón "Consultar por WhatsApp" en lugar de carrito.
- Panel `/admin`: productos, categorías, precios masivos, mensajes, clientes y configuración.
- `INICIAR-ARKE.bat` para levantar todo con doble clic.
