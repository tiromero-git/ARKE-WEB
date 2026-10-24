// Middleware: protege las rutas del panel /admin
function requiereLogin(req, res, next) {
  if (req.session && req.session.usuario) return next();
  const volver = encodeURIComponent(req.originalUrl);
  return res.redirect(`/admin/login?volver=${volver}`);
}

module.exports = { requiereLogin };
