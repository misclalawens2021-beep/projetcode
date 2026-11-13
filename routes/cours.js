const router = require('express').Router();
const db = require('../config/db');
const { wrap } = require('../middleware/auth');

router.get('/cours', wrap(async (req, res) => {
  const cours = await db.all(
    'SELECT c.id, c.titre, c.resume, t.nom FROM cours c JOIN theme t ON t.id = c.theme_id ORDER BY c.theme_id');
  res.render('cours', { cours });
}));

router.get('/cours/:id', wrap(async (req, res) => {
  const liste = await db.all('SELECT id FROM cours ORDER BY theme_id');
  const i = liste.findIndex((c) => String(c.id) === req.params.id);
  if (i === -1) return res.status(404).render('erreur', { message: 'Cours introuvable.' });
  const c = await db.one('SELECT c.*, t.nom AS theme FROM cours c JOIN theme t ON t.id = c.theme_id WHERE c.id = $1', [liste[i].id]);
  res.render('cours-detail', { c, precedent: liste[i - 1] || null, suivant: liste[i + 1] || null });
}));

module.exports = router;