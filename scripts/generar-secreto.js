// Genera un SESSION_SECRET aleatorio y lo escribe en .env
//   node scripts/generar-secreto.js
// (Si cambiás la clave, se cierran las sesiones abiertas del panel: hay que volver a loguearse.)
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const envPath = path.join(__dirname, '..', '.env');
const ejemplo = path.join(__dirname, '..', '.env.example');
if (!fs.existsSync(envPath)) fs.copyFileSync(ejemplo, envPath);

const secreto = crypto.randomBytes(32).toString('hex'); // 64 caracteres
let env = fs.readFileSync(envPath, 'utf8');
env = /^SESSION_SECRET=.*$/m.test(env)
  ? env.replace(/^SESSION_SECRET=.*$/m, `SESSION_SECRET=${secreto}`)
  : `${env.trimEnd()}\nSESSION_SECRET=${secreto}\n`;
fs.writeFileSync(envPath, env);
console.log('SESSION_SECRET nuevo guardado en .env');
