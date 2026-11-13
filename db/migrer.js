// Ajoute les colonnes de crédit photo si elles n'existent pas encore (sans toucher aux données).
const db = require('../config/db');

async function assurerColonnes() {
  const [cols] = await db.query(
    `SELECT COLUMN_NAME AS nom FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'question' AND COLUMN_NAME IN ('credit', 'credit_url')`);
  const presentes = new Set(cols.map((c) => c.nom));
  if (!presentes.has('credit')) await db.query('ALTER TABLE question ADD COLUMN credit VARCHAR(255) NULL');
  if (!presentes.has('credit_url')) await db.query('ALTER TABLE question ADD COLUMN credit_url VARCHAR(500) NULL');
}

module.exports = { assurerColonnes };