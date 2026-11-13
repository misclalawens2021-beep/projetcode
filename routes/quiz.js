const router = require('express').Router();
const db = require('../config/db');
const { requireLogin, wrap } = require('../middleware/auth');

const NB_EXERCICE = 10;
const NB_EXAMEN = 40;
const DUREE_EXAMEN = 30 * 60;   // secondes
const SEUIL_EXAMEN = 35;        // bonnes réponses sur 40
const seuil = (nb) => Math.ceil((nb * SEUIL_EXAMEN) / NB_EXAMEN);

// Questions échouées et jamais réussies depuis ($1 = utilisateur)
const SQL_ERREURS = `
  SELECT DISTINCT tq.question_id AS id
  FROM tentative_question tq
  JOIN tentative t ON t.id = tq.tentative_id
  JOIN question q ON q.id = tq.question_id
  WHERE t.utilisateur_id = $1 AND tq.reussie = FALSE AND q.actif = TRUE
    AND NOT EXISTS (
      SELECT 1 FROM tentative_question tq2
      JOIN tentative t2 ON t2.id = tq2.tentative_id
      WHERE t2.utilisateur_id = t.utilisateur_id AND tq2.question_id = tq.question_id
        AND tq2.reussie = TRUE AND t2.fin > t.fin)`;

// Questions jamais vues par l'élève, en exercice comme en examen ($1 = utilisateur)
const SQL_NON_VUES = `
  SELECT q.id FROM question q
  WHERE q.actif = TRUE AND NOT EXISTS (
    SELECT 1 FROM tentative_question tq JOIN tentative t ON t.id = tq.tentative_id
    WHERE t.utilisateur_id = $1 AND tq.question_id = q.id)`;

function melanger(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Examen : on sert d'abord des questions jamais vues, puis les plus ratées ou les plus anciennes.
// Environ 20 % de questions déjà vues sont conservées pour la révision tant qu'il reste assez de nouveautés.
async function tirerExamen(userId) {
  const nonVues = await db.all(`${SQL_NON_VUES} ORDER BY random()`, [userId]);
  const vues = await db.all(
    `SELECT tq.question_id AS id FROM tentative_question tq
     JOIN tentative t ON t.id = tq.tentative_id JOIN question q ON q.id = tq.question_id
     WHERE t.utilisateur_id = $1 AND q.actif = TRUE
     GROUP BY tq.question_id
     ORDER BY (SUM(CASE WHEN tq.reussie = FALSE THEN 1 ELSE 0 END) > 0) DESC, MAX(t.debut) ASC, random()`, [userId]);
  const cibleVues = Math.min(vues.length, Math.round(NB_EXAMEN * 0.2));
  const nbNonVues = Math.min(nonVues.length, NB_EXAMEN - cibleVues);
  const nbVues = Math.min(vues.length, NB_EXAMEN - nbNonVues);
  return melanger([...nonVues.slice(0, nbNonVues), ...vues.slice(0, nbVues)].map((r) => r.id));
}

async function creerTentative(userId, type, themeId, ids, duree) {
  return db.tx(async (t) => {
    const [{ id }] = await t.all(
      'INSERT INTO tentative(utilisateur_id, type, theme_id, nb_questions, duree_max_sec) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [userId, type, themeId, ids.length, duree]);
    await t.run(
      'INSERT INTO tentative_question(tentative_id, question_id, position) SELECT $1, x.q, x.p FROM unnest($2::int[], $3::int[]) AS x(q, p)',
      [id, ids, ids.map((_, i) => i + 1)]);
    return id;
  });
}

// Une question est réussie si les réponses cochées = exactement les réponses correctes
async function terminer(id) {
  await db.run(`
    UPDATE tentative_question tq SET reussie = (
      NOT EXISTS (SELECT 1 FROM reponse r WHERE r.question_id = tq.question_id AND r.est_correcte
                  AND r.id NOT IN (SELECT rd.reponse_id FROM reponse_donnee rd
                                   WHERE rd.tentative_id = tq.tentative_id AND rd.question_id = tq.question_id))
      AND NOT EXISTS (SELECT 1 FROM reponse_donnee rd JOIN reponse r ON r.id = rd.reponse_id
                      WHERE rd.tentative_id = tq.tentative_id AND rd.question_id = tq.question_id AND NOT r.est_correcte)
      AND EXISTS (SELECT 1 FROM reponse_donnee rd WHERE rd.tentative_id = tq.tentative_id AND rd.question_id = tq.question_id)
    ) WHERE tq.tentative_id = $1`, [id]);
  await db.run(
    `UPDATE tentative SET fin = now(),
       score = (SELECT COUNT(*) FROM tentative_question WHERE tentative_id = $1 AND reussie = TRUE)
     WHERE id = $1 AND fin IS NULL`, [id]);
}

async function getTentative(id, userId) {
  const n = Number(id);
  if (!Number.isInteger(n)) return null;
  return db.one(
    'SELECT *, EXTRACT(EPOCH FROM (now() - debut))::int AS ecoule FROM tentative WHERE id = $1 AND utilisateur_id = $2', [n, userId]);
}

// ---------- Pages publiques ----------
router.get('/', wrap(async (req, res) => {
  const c = await db.one(
    'SELECT (SELECT COUNT(*) FROM question WHERE actif = TRUE)::int AS "nbQuestions", (SELECT COUNT(*) FROM theme)::int AS "nbThemes"');
  res.render('home', { c });
}));

router.get('/exercices', wrap(async (req, res) => {
  const themes = await db.all(
    `SELECT t.*, COUNT(q.id)::int AS nb FROM theme t
     LEFT JOIN question q ON q.theme_id = t.id AND q.actif = TRUE GROUP BY t.id ORDER BY t.id`);
  res.render('exercices', { themes, NB_EXERCICE });
}));

router.get('/examen', wrap(async (req, res) => {
  let nonVues = null;
  if (req.session.user) nonVues = (await db.all(SQL_NON_VUES, [req.session.user.id])).length;
  res.render('examen', { NB_EXAMEN, DUREE_MIN: DUREE_EXAMEN / 60, SEUIL_EXAMEN, nonVues });
}));

// ---------- Démarrage d'une tentative ----------
router.post('/exercices/:themeId/demarrer', requireLogin, wrap(async (req, res) => {
  const themeId = Number(req.params.themeId);
  const rows = Number.isInteger(themeId)
    ? await db.all('SELECT id FROM question WHERE theme_id = $1 AND actif = TRUE ORDER BY random() LIMIT $2', [themeId, NB_EXERCICE])
    : [];
  if (!rows.length) {
    req.session.flash = { type: 'info', msg: 'Ce thème ne contient pas encore de question.' };
    return res.redirect('/exercices');
  }
  const id = await creerTentative(req.session.user.id, 'exercice', themeId, rows.map((r) => r.id), null);
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
  const rows = await db.all(`SELECT id FROM (${SQL_ERREURS}) e ORDER BY random() LIMIT $2`, [req.session.user.id, NB_EXERCICE]);
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
  const qs = await db.all(
    `SELECT q.id, q.enonce, q.image, q.credit, q.credit_url FROM tentative_question tq
     JOIN question q ON q.id = tq.question_id WHERE tq.tentative_id = $1 ORDER BY tq.position`, [t.id]);
  const rs = await db.all('SELECT id, question_id, libelle FROM reponse WHERE question_id = ANY($1::int[]) ORDER BY id', [qs.map((q) => q.id)]);
  const sv = await db.all('SELECT question_id, reponse_id FROM reponse_donnee WHERE tentative_id = $1', [t.id]);
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
  if (!Number.isInteger(qid) || ids.some((i) => !Number.isInteger(i))) return res.status(400).json({ erreur: 'Requête invalide.' });
  const tq = await db.one('SELECT 1 AS ok FROM tentative_question WHERE tentative_id = $1 AND question_id = $2', [t.id, qid]);
  if (!tq) return res.status(400).json({ erreur: 'Question inconnue.' });

  const rs = await db.all('SELECT id, est_correcte FROM reponse WHERE question_id = $1', [qid]);
  const valides = new Set(rs.map((r) => r.id));
  if (ids.some((i) => !valides.has(i))) return res.status(400).json({ erreur: 'Réponse invalide.' });

  await db.tx(async (x) => {
    await x.run('DELETE FROM reponse_donnee WHERE tentative_id = $1 AND question_id = $2', [t.id, qid]);
    if (ids.length) {
      await x.run('INSERT INTO reponse_donnee(tentative_id, question_id, reponse_id) SELECT $1, $2, x.r FROM unnest($3::int[]) AS x(r)', [t.id, qid, ids]);
    }
  });

  // En examen, aucune correction n'est renvoyée avant la fin
  if (t.type !== 'exercice') return res.json({ ok: true });
  const correctes = rs.filter((r) => r.est_correcte).map((r) => r.id);
  const reussie = correctes.length === ids.length && correctes.every((c) => ids.includes(c));
  const q = await db.one('SELECT explication FROM question WHERE id = $1', [qid]);
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
  const qs = await db.all(
    `SELECT tq.position, tq.reussie, q.id, q.enonce, q.image, q.credit, q.credit_url, q.explication
     FROM tentative_question tq JOIN question q ON q.id = tq.question_id
     WHERE tq.tentative_id = $1 ORDER BY tq.position`, [t.id]);
  const rs = await db.all(
    `SELECT r.id, r.question_id, r.libelle, r.est_correcte, (rd.reponse_id IS NOT NULL) AS choisie
     FROM reponse r LEFT JOIN reponse_donnee rd ON rd.reponse_id = r.id AND rd.tentative_id = $1
     WHERE r.question_id = ANY($2::int[]) ORDER BY r.id`, [t.id, qs.map((q) => q.id)]);
  qs.forEach((q) => { q.reponses = rs.filter((r) => r.question_id === q.id); });
  const s = seuil(t.nb_questions);
  res.render('resultat', { t, qs, seuil: s, reussi: t.type === 'examen' && t.score >= s, pct: Math.round((100 * t.score) / t.nb_questions) });
}));

// ---------- Suivi ----------
router.get('/profil', requireLogin, wrap(async (req, res) => {
  const uid = req.session.user.id;
  const ex = await db.one(
    "SELECT COUNT(*)::int AS nb, AVG(score) AS moyenne, MAX(score) AS meilleur FROM tentative WHERE utilisateur_id = $1 AND type = 'examen' AND fin IS NOT NULL", [uid]);
  const themes = await db.all(
    `SELECT th.nom, COUNT(*)::int AS total, SUM(CASE WHEN tq.reussie THEN 1 ELSE 0 END)::int AS ok
     FROM tentative_question tq JOIN tentative t ON t.id = tq.tentative_id
     JOIN question q ON q.id = tq.question_id JOIN theme th ON th.id = q.theme_id
     WHERE t.utilisateur_id = $1 AND t.fin IS NOT NULL GROUP BY th.id
     ORDER BY SUM(CASE WHEN tq.reussie THEN 1 ELSE 0 END)::numeric / COUNT(*)`, [uid]);
  const dernieres = await db.all(
    `SELECT t.id, t.type, t.score, t.nb_questions, t.fin, th.nom AS theme
     FROM tentative t LEFT JOIN theme th ON th.id = t.theme_id
     WHERE t.utilisateur_id = $1 AND t.fin IS NOT NULL ORDER BY t.fin DESC LIMIT 10`, [uid]);
  const { n: nbErreurs } = await db.one(`SELECT COUNT(*)::int AS n FROM (${SQL_ERREURS}) e`, [uid]);
  res.render('profil', { ex, themes, dernieres, nbErreurs, seuil });
}));

module.exports = router;