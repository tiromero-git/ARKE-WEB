// Crea (o actualiza la contraseña de) un usuario del panel.
// Uso: npm run crear-admin -- tu@email.com TuClaveSegura "Tu Nombre"
const auth = require('../src/services/authService');

const [email, password, nombre] = process.argv.slice(2);
if (!email || !password) {
  console.log('Uso: npm run crear-admin -- email contraseña "Nombre"');
  process.exit(1);
}
try {
  auth.crearAdmin(email, password, nombre);
  console.log(`✔ Usuario ${email} listo. Entrá en /admin`);
} catch (e) {
  console.error('✖', e.message);
  process.exit(1);
}
