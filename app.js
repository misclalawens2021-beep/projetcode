require('dotenv').config();
const path = require('path');
const express = require('express');
const session = require('express-session');
const { assurerColonnes } = require('./db/migrer');

const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
// MemoryStore : suffisant en développement. En production, utiliser un store persistant.
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', maxAge: 7 * 24 * 3600 * 1000 },
}));

app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.flash = req.session.flash || null;
  delete req.session.flash;
  next();
});

app.use('/', require('./routes/auth'));
app.use('/', require('./routes/cours'));
app.use('/', require('./routes/quiz'));
app.use('/admin', require('./routes/admin'));

app.use((req, res) => res.status(404).render('erreur', { message: 'Page introuvable.' }));
app.use((err, req, res, next) => {
  console.error(err);
  if (req.path.startsWith('/api/')) return res.status(500).json({ erreur: 'Erreur serveur.' });
  res.status(500).render('erreur', { message: 'Une erreur est survenue. Réessayez dans un instant.' });
});

const port = process.env.PORT || 3000;
assurerColonnes()
  .catch((e) => console.error('Migration de la base :', e.message))
  .finally(() => app.listen(port, () => console.log(`Code de la route : http://localhost:${port}`)));