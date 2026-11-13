// Import (ou mise à jour) des thèmes, questions, images et cours.
// Relançable sans risque : une question déjà présente (même énoncé) est mise à jour, pas dupliquée.
require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const data = require('./questions');
const cours = require('./cours');

const IMG = '/img/questions/';

(async () => {
  await db.query(`CREATE TABLE IF NOT EXISTS cours (
    id INT AUTO_INCREMENT PRIMARY KEY,
    theme_id INT NOT NULL UNIQUE,
    titre VARCHAR(160) NOT NULL,
    resume VARCHAR(255) NOT NULL DEFAULT '',
    contenu MEDIUMTEXT NOT NULL,
    FOREIGN KEY (theme_id) REFERENCES theme(id) ON DELETE CASCADE)`);

  let ajoutees = 0;
  for (const t of data) {
    const [r] = await db.query(
      'INSERT INTO theme(nom, description) VALUES (?, ?) ON DUPLICATE KEY UPDATE description = VALUES(description), id = LAST_INSERT_ID(id)',
      [t.nom, t.description]);
    const themeId = r.insertId;
    for (const q of t.questions) {
      const [[existe]] = await db.query('SELECT id FROM question WHERE enonce = ? AND theme_id = ?', [q.enonce, themeId]);
      if (existe) {
        await db.query('UPDATE question SET image = ?, explication = ? WHERE id = ?', [IMG + q.image, q.explication, existe.id]);
        continue;
      }
      const [qr] = await db.query('INSERT INTO question(theme_id, enonce, explication, image) VALUES (?, ?, ?, ?)', [themeId, q.enonce, q.explication, IMG + q.image]);
      await db.query('INSERT INTO reponse(question_id, libelle, est_correcte) VALUES ?', [q.reponses.map(([l, c]) => [qr.insertId, l, c])]);
      ajoutees++;
    }
    const c = cours[t.nom];
    if (c) {
      await db.query(
        'INSERT INTO cours(theme_id, titre, resume, contenu) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE titre = VALUES(titre), resume = VALUES(resume), contenu = VALUES(contenu)',
        [themeId, c.titre, c.resume, c.contenu]);
    }
  }
  console.log(`${ajoutees} nouvelle(s) question(s) ajoutée(s), cours mis à jour.`);

  const email = process.env.ADMIN_EMAIL || 'admin@coderoute.local';
  const mdp = process.env.ADMIN_PASSWORD || 'ChangeMe123!';
  await db.query("INSERT IGNORE INTO utilisateur(pseudo, email, mot_de_passe, role) VALUES ('Admin', ?, ?, 'admin')", [email, await bcrypt.hash(mdp, 10)]);
  console.log(`Compte administrateur : ${email} (mot de passe défini dans .env)`);
  await db.end();
})().catch((e) => { console.error(e); process.exit(1); });
