// Crée les tables si besoin, puis importe (ou met à jour) thèmes, questions, images et cours.
// Relançable sans risque : une question déjà présente (même énoncé) est mise à jour, pas dupliquée.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const data = require('./questions');
const cours = require('./cours');

const IMG = '/img/questions/';

(async () => {
  await db.run(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));

  let ajoutees = 0;
  for (const t of data) {
    const theme = await db.one(
      `INSERT INTO theme(nom, description) VALUES ($1, $2)
       ON CONFLICT (nom) DO UPDATE SET description = EXCLUDED.description RETURNING id`, [t.nom, t.description]);
    for (const q of t.questions) {
      const existe = await db.one('SELECT id FROM question WHERE enonce = $1 AND theme_id = $2', [q.enonce, theme.id]);
      if (existe) {
        // Une photo téléchargée (ou une image envoyée via l'admin) n'est jamais remplacée par le dessin
        await db.run(
          `UPDATE question SET explication = $1,
             image = CASE WHEN image IS NULL OR image LIKE '/img/questions/%' THEN $2 ELSE image END
           WHERE id = $3`, [q.explication, IMG + q.image, existe.id]);
        continue;
      }
      const nouvelle = await db.one(
        'INSERT INTO question(theme_id, enonce, explication, image) VALUES ($1, $2, $3, $4) RETURNING id',
        [theme.id, q.enonce, q.explication, IMG + q.image]);
      await db.run(
        'INSERT INTO reponse(question_id, libelle, est_correcte) SELECT $1, x.l, x.c FROM unnest($2::text[], $3::boolean[]) AS x(l, c)',
        [nouvelle.id, q.reponses.map((r) => r[0]), q.reponses.map((r) => r[1] === 1)]);
      ajoutees++;
    }
    const c = cours[t.nom];
    if (c) {
      await db.run(
        `INSERT INTO cours(theme_id, titre, resume, contenu) VALUES ($1, $2, $3, $4)
         ON CONFLICT (theme_id) DO UPDATE SET titre = EXCLUDED.titre, resume = EXCLUDED.resume, contenu = EXCLUDED.contenu`,
        [theme.id, c.titre, c.resume, c.contenu]);
    }
  }
  console.log(`${ajoutees} nouvelle(s) question(s) ajoutée(s), cours mis à jour.`);

  const email = process.env.ADMIN_EMAIL || 'admin@coderoute.local';
  const mdp = process.env.ADMIN_PASSWORD || 'ChangeMe123!';
  await db.run(
    "INSERT INTO utilisateur(pseudo, email, mot_de_passe, role) VALUES ('Admin', $1, $2, 'admin') ON CONFLICT (email) DO NOTHING",
    [email, await bcrypt.hash(mdp, 10)]);
  console.log(`Compte administrateur : ${email} (mot de passe défini dans .env)`);
})().catch((e) => { console.error(e.message); process.exitCode = 1; }).finally(() => db.end());