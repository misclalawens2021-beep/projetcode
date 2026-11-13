const router = require('express').Router();
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const db = require('../config/db');
const { wrap, requireAdmin } = require('../middleware/auth');

const EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
const upload = multer({
  storage: multer.diskStorage({
    destination: path.join(__dirname, '..', 'public', 'uploads'),
    filename: (req, file, cb) => cb(null, crypto.randomBytes(12).toString('hex') + EXT[file.mimetype]),
  }),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, Boolean(EXT[file.mimetype])),
});

const NB_CHOIX = 6;
router.use(requireAdmin);

router.get('/', wrap(async (req, res) => {
  const [questions] = await db.query(
    'SELECT q.id, q.enonce, q.actif, t.nom AS theme FROM question q JOIN theme t ON t.id = q.theme_id ORDER BY t.nom, q.id');
  const [themes] = await db.query('SELECT * FROM theme ORDER BY nom');
  res.render('admin/liste', { questions, themes });
}));

router.post('/themes', wrap(async (req, res) => {
  const nom = (req.body.nom || '').trim();
  if (nom) await db.query('INSERT IGNORE INTO theme(nom, description) VALUES (?, ?)', [nom.slice(0, 80), (req.body.description || '').trim().slice(0, 255)]);
  res.redirect('/admin');
}));

async function formData(question) {
  const [themes] = await db.query('SELECT * FROM theme ORDER BY nom');
  let reponses = [];
  if (question && question.id) [reponses] = await db.query('SELECT * FROM reponse WHERE question_id = ? ORDER BY id', [question.id]);
  while (reponses.length < NB_CHOIX) reponses.push({ id: '', libelle: '', est_correcte: 0 });
  return { themes, reponses, question: question || { enonce: '', explication: '', theme_id: '' }, erreur: null };
}

router.get('/questions/nouvelle', wrap(async (req, res) => res.render('admin/form', await formData())));

router.get('/questions/:id/modifier', wrap(async (req, res) => {
  const [[q]] = await db.query('SELECT * FROM question WHERE id = ?', [req.params.id]);
  if (!q) return res.status(404).render('erreur', { message: 'Question introuvable.' });
  res.render('admin/form', await formData(q));
}));

async function sauver(req, res, id) {
  const b = req.body;
  const choix = [];
  for (let i = 0; i < NB_CHOIX; i++) {
    choix.push({ id: Number(b[`rid_${i}`]) || null, libelle: (b[`libelle_${i}`] || '').trim(), correcte: b[`correcte_${i}`] ? 1 : 0 });
  }
  const remplis = choix.filter((c) => c.libelle);
  let erreur = null;
  if (!(b.enonce || '').trim()) erreur = 'Saisissez l\'énoncé de la question.';
  else if (!b.theme_id) erreur = 'Choisissez un thème.';
  else if (remplis.length < 2) erreur = 'Saisissez au moins deux réponses.';
  else if (!remplis.some((c) => c.correcte)) erreur = 'Cochez au moins une bonne réponse.';
  if (erreur) {
    const d = await formData(id ? { id, ...b } : { ...b });
    d.reponses = choix.map((c) => ({ id: c.id || '', libelle: c.libelle, est_correcte: c.correcte }));
    d.erreur = erreur;
    return res.status(400).render('admin/form', d);
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const image = req.file ? '/uploads/' + req.file.filename : null;
    let qid = id;
    if (id) {
      await conn.query('UPDATE question SET theme_id = ?, enonce = ?, explication = ?, image = COALESCE(?, image) WHERE id = ?',
        [b.theme_id, b.enonce.trim(), (b.explication || '').trim(), image, id]);
    } else {
      const [r] = await conn.query('INSERT INTO question(theme_id, enonce, explication, image) VALUES (?, ?, ?, ?)',
        [b.theme_id, b.enonce.trim(), (b.explication || '').trim(), image]);
      qid = r.insertId;
    }
    for (const c of choix) {
      if (c.id && c.libelle) await conn.query('UPDATE reponse SET libelle = ?, est_correcte = ? WHERE id = ? AND question_id = ?', [c.libelle, c.correcte, c.id, qid]);
      else if (c.id) await conn.query('DELETE FROM reponse WHERE id = ? AND question_id = ?', [c.id, qid]);
      else if (c.libelle) await conn.query('INSERT INTO reponse(question_id, libelle, est_correcte) VALUES (?, ?, ?)', [qid, c.libelle, c.correcte]);
    }
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
  req.session.flash = { type: 'ok', msg: 'Question enregistrée.' };
  res.redirect('/admin');
}

router.post('/questions', upload.single('image'), wrap((req, res) => sauver(req, res, null)));
router.post('/questions/:id', upload.single('image'), wrap((req, res) => sauver(req, res, Number(req.params.id))));

// Une question archivée n'est plus tirée au sort, mais l'historique des élèves est conservé
router.post('/questions/:id/archiver', wrap(async (req, res) => {
  await db.query('UPDATE question SET actif = 1 - actif WHERE id = ?', [req.params.id]);
  res.redirect('/admin');
}));

module.exports = router;
