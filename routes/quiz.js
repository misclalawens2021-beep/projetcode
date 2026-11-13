const router = require('express').Router();
const db = require('../config/db');
const { requireLogin, wrap } = require('../middleware/auth');

const NB_EXERCICE = 10;
const NB_EXAMEN = 40;
const DUREE_EXAMEN = 30 * 60;   // secondes
const SEUIL_EXAMEN = 35;        // bonnes réponses sur 40
const seuil = (nb) => Math.ceil((nb * SEUIL_EXAMEN) / NB_EXAMEN);

// Questions échouées et jamais réussies depuis
const SQL_ERREURS = `
  SELECT DISTINCT tq.question_id AS id
  FROM tentative_question tq
  JOIN tentative t ON t.id = tq.tentative_id
  JOIN question q ON q.id = tq.question_id
  WHERE t.utilisateur_id = ? AND tq.reussie = 0 AND q.actif = 1
    AND NOT EXISTS (
      SELECT 1 FROM tentative_question tq2
      JOIN tentative t2 ON t2.id = tq2.tentative_id
      WHERE t2.utilisateur_id = t.utilisateur_id AND tq2.question_id = tq.question_id
        AND tq2.reussie = 1 AND t2.fin > t.fin)`;

function melanger(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Examen : on sert d'abord des questions jamais vues par l'élève (exercices ou examens),
// et on complète avec les plus anciennes ou les plus ratées. Environ 20 % de questions
// déjà vues sont conservées pour la révision tant qu'il reste assez de nouveautés.
const SQL_NON_VUES = `
  SELECT q.id FROM question q
  WHERE q.actif = 1 AND NOT EXISTS (
    SELECT 1 FROM tentative_question tq JOIN tentative t ON t.id = tq.tentative_id
    WHERE t.utilisateur_id = ? AND tq.question_id = q.id)`;

async function tirerExamen(userId) {
  const [nonVues] = await db.query(`${SQL_NON_VUES} ORDER BY RAND()`, [userId]);
  const [vues] = await db.query(
    `SELECT tq.question_id AS id FROM tentative_question tq
     JOIN tentative t ON t.id = tq.tentative_id JOIN question q ON q.id = tq.question_id
     WHERE t.utilisateur_id = ? AND q.actif = 1
     GROUP BY tq.question_id
     ORDER BY (SUM(tq.reussie = 0) > 0) DESC, MAX(t.debut) ASC, RAND()`, [userId]);
  const cibleVues = Math.min(vues.length, Math.round(NB_EXAMEN * 0.2));
  const nbNonVues = Math.min(nonVues.length, NB_EXAMEN - cibleVues);
  const nbVues = Math.min(vues.length, NB_EXAMEN - nbNonVues);
  return melanger([...nonVues.slice(0, nbNonVues), ...vues.slice(0, nbVues)].map((r) => r.id));
}

async function creerTentative(userId, type, themeId, ids, duree) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [r] = await conn.query(
      'INSERT INTO tentative(utilisateur_id, type, theme_id, nb_questions, duree_max_sec) VALUES (?, ?, ?, ?, ?)',
      [userId, type, themeId, ids.length, duree]);
    await conn.query('INSERT INTO tentative_question(tentative_id, question_id, position) VALUES ?',
      [ids.map((q, i) => [r.insertId, q, i + 1])]);
    await conn.commit();
    return r.insertId;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

// Une question est réussie si les réponses cochées = exactement les réponses correctes
async function terminer(id) {
  await db.query(`
    UPDATE tentative_question tq SET reussie = (
      NOT EXISTS (SELECT 1 FROM reponse r WHERE r.question_id = tq.question_id AND r.est_correcte = 1
                  AND r.id NOT IN (SELECT rd.reponse_id FROM reponse_donnee rd
                                   WHERE rd.tentative_id = tq.tentative_id AND rd.question_id = tq.question_id))
      AND NOT EXISTS (SELECT 1 FROM reponse_donnee rd JOIN reponse r ON r.id = rd.reponse_id
                      WHERE rd.tentative_id = tq.tentative_id AND rd.question_id = tq.question_id AND r.est_correcte = 0)
      AND EXISTS (SELECT 1 FROM reponse_donnee rd WHERE rd.tentative_id = tq.tentative_id AND rd.question_id = tq.question_id)
    ) WHERE tq.tentative_id = ?`, [id]);
  await db.query(
    `UPDATE tentative SET fin = NOW(),
       score = (SELECT COUNT(*) FROM tentative_question WHERE tentative_id = ? AND reussie = 1)
     WHERE id = ? AND fin IS NULL`, [id, id]);
}

async function getTentative(id, userId) {
  const [[t]] = await db.query(
    'SELECT *, TIMESTAMPDIFF(SECOND, debut, NOW()) AS ecoule FROM tentative WHERE id = ? AND utilisateur_id = ?', [id, userId]);
  return t;
}

// ---------- Pages publiques ----------
router.get('/', wrap(async (req, res) => {
  const [[c]] = await db.query('SELECT (SELECT COUNT(*) FROM question WHERE actif = 1) AS nbQuestions, (SELECT COUNT(*) FROM theme) AS nbThemes');
  res.render('home', { c });
}));

router.get('/exercices', wrap(async (req, res) => {
  const [themes] = await db.query(
    `SELECT t.*, COUNT(q.id) AS nb FROM theme t
     LEFT JOIN question q ON q.theme_id = t.id AND q.actif = 1 GROUP BY t.id ORDER BY t.id`);
  res.render('exercices', { themes, NB_EXERCICE });
}));

router.get('/examen', wrap(async (req, res) => {
  let nonVues = null;
  if (req.session.user) nonVues = (await db.query(SQL_NON_VUES, [req.session.user.id]))[0].length;
  res.render('examen', { NB_EXAMEN, DUREE_MIN: DUREE_EXAMEN / 60, SEUIL_EXAMEN, nonVues });
}));

// ---------- Démarrage d'une tentative ----------
router.post('/exercices/:themeId/demarrer', requireLogin, wrap(async (req, res) => {
  const [rows] = await db.query('SELECT id FROM question WHERE theme_id = ? AND actif = 1 ORDER BY RAND() LIMIT ?', [req.params.themeId, NB_EXERCICE]);
  if (!rows.length) {
    req.session.flash = { type: 'info', msg: 'Ce thème ne contient pas encore de question.' };
    return res.redirect('/exercices');
  }
  const id = await creerTentative(req.session.user.id, 'exercice', req.params.themeId, rows.map((r) => r.id), null);
  res.redirect(`/tentative/${id}`);
}));

router.post('/examen/demarrer', requireLogin, wrap(async (req, res) => {
  const ids = await tirerExamen(req.session.user.id);
  if (!ids.length) {
    req.session.flash = { type: 'info', msg: 'Aucune question disponible pour le moment.' };
    return res.redirect('/examen');
  }
  const id = await creerTentative(req.session.user.id, 'examen', null, ids, DUREE_EXAMEN);
  res.redirect(`/tentative/${id}`);
}));

router.post('/revision/demarrer', requireLogin, wrap(async (req, res) => {
  const [rows] = await db.query(`${SQL_ERREURS} ORDER BY RAND() LIMIT ?`, [req.session.user.id, NB_EXERCICE]);
  if (!rows.length) {
    req.session.flash = { type: 'info', msg: 'Aucune erreur à réviser : bravo !' };
    return res.redirect('/profil');
  }
  const id = await creerTentative(req.session.user.id, 'exercice', null, rows.map((r) => r.id), null);
  res.redirect(`/tentative/${id}`);
}));

// ---------- Passage d'un quiz ----------
router.get('/tentative/:id', requireLogin, wrap(async (req, res) => {
  const t = await getTentative(req.params.id, req.session.user.id);
  if (!t) return res.status(404).render('erreur', { message: 'Tentative introuvable.' });
  if (t.fin) return res.redirect(`/tentative/${t.id}/resultat`);
  if (t.duree_max_sec && t.ecoule > t.duree_max_sec) {
    await terminer(t.id);
    return res.redirect(`/tentative/${t.id}/resultat`);
  }
  const [qs] = await db.query(
    'SELECT q.id, q.enonce, q.image, q.credit, q.credit_url FROM tentative_question tq JOIN question q ON q.id = tq.question_id WHERE tq.tentative_id = ? ORDER BY tq.position', [t.id]);
  const [rs] = await db.query('SELECT id, question_id, libelle FROM reponse WHERE question_id IN (?) ORDER BY id', [qs.map((q) => q.id)]);
  const [sv] = await db.query('SELECT question_id, reponse_id FROM reponse_donnee WHERE tentative_id = ?', [t.id]);
  const saved = {};
  sv.forEach((s) => { (saved[s.question_id] = saved[s.question_id] || []).push(s.reponse_id); });

  const data = {
    id: t.id,
    type: t.type,
    restant: t.duree_max_sec ? t.duree_max_sec - t.ecoule : null,
    saved,
    questions: qs.map((q) => ({ ...q, reponses: rs.filter((r) => r.question_id === q.id).map((r) => ({ id: r.id, libelle: r.libelle })) })),
  };
  res.render('quiz', { t, json: JSON.stringify(data).replace(/</g, '\\u003c') });
}));

router.post('/api/tentative/:id/repondre', requireLogin, wrap(async (req, res) => {
  const t = await getTentative(req.params.id, req.session.user.id);
  if (!t || t.fin) return res.status(400).json({ erreur: 'Tentative terminée ou introuvable.' });
  if (t.duree_max_sec && t.ecoule > t.duree_max_sec + 10) return res.status(400).json({ erreur: 'Temps écoulé.' });

  const qid = Number(req.body.questionId);
  const ids = [...new Set((Array.isArray(req.body.reponses) ? req.body.reponses : []).map(Number))];
  const [[tq]] = await db.query('SELECT 1 AS ok FROM tentative_question WHERE tentative_id = ? AND question_id = ?', [t.id, qid]);
  if (!tq) return res.status(400).json({ erreur: 'Question inconnue.' });

  const [rs] = await db.query('SELECT id, est_correcte FROM reponse WHERE question_id = ?', [qid]);
  const valides = new Set(rs.map((r) => r.id));
  if (ids.some((i) => !valides.has(i))) return res.status(400).json({ erreur: 'Réponse invalide.' });

  await db.query('DELETE FROM reponse_donnee WHERE tentative_id = ? AND question_id = ?', [t.id, qid]);
  if (ids.length) await db.query('INSERT INTO reponse_donnee(tentative_id, question_id, reponse_id) VALUES ?', [ids.map((i) => [t.id, qid, i])]);

  // En examen, aucune correction n'est renvoyée avant la fin
  if (t.type !== 'exercice') return res.json({ ok: true });
  const correctes = rs.filter((r) => r.est_correcte).map((r) => r.id);
  const reussie = correctes.length === ids.length && correctes.every((c) => ids.includes(c));
  const [[q]] = await db.query('SELECT explication FROM question WHERE id = ?', [qid]);
  res.json({ ok: true, correctes, reussie, explication: q.explication });
}));

router.post('/api/tentative/:id/terminer', requireLogin, wrap(async (req, res) => {
  const t = await getTentative(req.params.id, req.session.user.id);
  if (!t) return res.status(404).json({ erreur: 'Tentative introuvable.' });
  await terminer(t.id);
  res.json({ url: `/tentative/${t.id}/resultat` });
}));

router.get('/tentative/:id/resultat', requireLogin, wrap(async (req, res) => {
  const t = await getTentative(req.params.id, req.session.user.id);
  if (!t) return res.status(404).render('erreur', { message: 'Tentative introuvable.' });
  if (!t.fin) return res.redirect(`/tentative/${t.id}`);
  const [qs] = await db.query(
    `SELECT tq.position, tq.reussie, q.id, q.enonce, q.image, q.credit, q.credit_url, q.explication
     FROM tentative_question tq JOIN question q ON q.id = tq.question_id
     WHERE tq.tentative_id = ? ORDER BY tq.position`, [t.id]);
  const [rs] = await db.query(
    `SELECT r.id, r.question_id, r.libelle, r.est_correcte, (rd.reponse_id IS NOT NULL) AS choisie
     FROM reponse r LEFT JOIN reponse_donnee rd ON rd.reponse_id = r.id AND rd.tentative_id = ?
     WHERE r.question_id IN (?) ORDER BY r.id`, [t.id, qs.map((q) => q.id)]);
  qs.forEach((q) => { q.reponses = rs.filter((r) => r.question_id === q.id); });
  const s = seuil(t.nb_questions);
  res.render('resultat', { t, qs, seuil: s, reussi: t.type === 'examen' && t.score >= s, pct: Math.round((100 * t.score) / t.nb_questions) });
}));

// ---------- Suivi ----------
router.get('/profil', requireLogin, wrap(async (req, res) => {
  const uid = req.session.user.id;
  const [[ex]] = await db.query(
    "SELECT COUNT(*) AS nb, AVG(score) AS moyenne, MAX(score) AS meilleur FROM tentative WHERE utilisateur_id = ? AND type = 'examen' AND fin IS NOT NULL", [uid]);
  const [themes] = await db.query(
    `SELECT th.nom, COUNT(*) AS total, SUM(tq.reussie) AS ok
     FROM tentative_question tq JOIN tentative t ON t.id = tq.tentative_id
     JOIN question q ON q.id = tq.question_id JOIN theme th ON th.id = q.theme_id
     WHERE t.utilisateur_id = ? AND t.fin IS NOT NULL GROUP BY th.id ORDER BY SUM(tq.reussie) / COUNT(*)`, [uid]);
  const [dernieres] = await db.query(
    `SELECT t.id, t.type, t.score, t.nb_questions, t.fin, th.nom AS theme
     FROM tentative t LEFT JOIN theme th ON th.id = t.theme_id
     WHERE t.utilisateur_id = ? AND t.fin IS NOT NULL ORDER BY t.fin DESC LIMIT 10`, [uid]);
  const [erreurs] = await db.query(SQL_ERREURS, [uid]);
  res.render('profil', { ex, themes, dernieres, nbErreurs: erreurs.length, seuil });
}));

module.exports = router;