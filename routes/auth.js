const router = require('express').Router();
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { wrap } = require('../middleware/auth');

router.get('/inscription', (req, res) => res.render('inscription', { erreur: null, valeurs: {} }));

router.post('/inscription', wrap(async (req, res) => {
  const pseudo = (req.body.pseudo || '').trim();
  const email = (req.body.email || '').trim().toLowerCase();
  const mdp = req.body.mot_de_passe || '';
  const fail = (erreur) => res.status(400).render('inscription', { erreur, valeurs: { pseudo, email } });

  if (pseudo.length < 3 || pseudo.length > 30) return fail('Le pseudo doit faire entre 3 et 30 caractères.');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail('Saisissez une adresse e-mail valide.');
  if (mdp.length < 8) return fail('Le mot de passe doit faire au moins 8 caractères.');

  const [[existe]] = await db.query('SELECT id FROM utilisateur WHERE email = ?', [email]);
  if (existe) return fail('Un compte existe déjà avec cette adresse e-mail.');

  const hash = await bcrypt.hash(mdp, 10);
  const [r] = await db.query('INSERT INTO utilisateur(pseudo, email, mot_de_passe) VALUES (?, ?, ?)', [pseudo, email, hash]);
  req.session.regenerate((err) => {
    if (err) throw err;
    req.session.user = { id: r.insertId, pseudo, role: 'eleve' };
    req.session.flash = { type: 'ok', msg: 'Compte créé. Bienvenue !' };
    res.redirect('/exercices');
  });
}));

router.get('/connexion', (req, res) => res.render('connexion', { erreur: null, email: '' }));

router.post('/connexion', wrap(async (req, res) => {
  const email = (req.body.email || '').trim().toLowerCase();
  const [[u]] = await db.query('SELECT * FROM utilisateur WHERE email = ?', [email]);
  const ok = u && await bcrypt.compare(req.body.mot_de_passe || '', u.mot_de_passe);
  if (!ok) return res.status(401).render('connexion', { erreur: 'E-mail ou mot de passe incorrect.', email });
  req.session.regenerate((err) => {
    if (err) throw err;
    req.session.user = { id: u.id, pseudo: u.pseudo, role: u.role };
    res.redirect('/exercices');
  });
}));

router.post('/deconnexion', (req, res) => req.session.destroy(() => res.redirect('/')));

module.exports = router;
