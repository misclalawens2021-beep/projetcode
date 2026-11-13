// Permet d'utiliser async/await dans les routes Express 4
const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

function requireLogin(req, res, next) {
  if (!req.session.user) {
    req.session.flash = { type: 'info', msg: 'Connectez-vous pour continuer.' };
    return res.redirect('/connexion');
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(403).render('erreur', { message: 'Accès réservé aux administrateurs.' });
  }
  next();
}

module.exports = { wrap, requireLogin, requireAdmin };
