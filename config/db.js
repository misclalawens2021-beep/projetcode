// Accès à PostgreSQL (Supabase). DATABASE_URL = chaîne de connexion « Session pooler » du tableau de bord.
const { Pool, types } = require('pg');
require('dotenv').config();

// COUNT / SUM / AVG reviennent en texte par défaut : on les convertit en nombres.
types.setTypeParser(20, (v) => parseInt(v, 10));
types.setTypeParser(1700, (v) => parseFloat(v));

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL manquante : copiez la chaîne de connexion Supabase dans le fichier .env (voir .env.example).');
}
const local = /@(localhost|127\.0\.0\.1)/.test(url || '');

const pool = new Pool({
  connectionString: url,
  ssl: local ? false : { rejectUnauthorized: false },
  max: 10,
});
pool.on('error', (e) => console.error('Connexion PostgreSQL :', e.message));

const all = async (sql, params = []) => (await pool.query(sql, params)).rows;
const one = async (sql, params = []) => (await all(sql, params))[0] || null;
const run = (sql, params = []) => pool.query(sql, params);

// Transaction : tx(async (t) => { await t.run(...); const rows = await t.all(...); })
async function tx(fn) {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const r = await fn({ all: async (s, p = []) => (await c.query(s, p)).rows, run: (s, p = []) => c.query(s, p) });
    await c.query('COMMIT');
    return r;
  } catch (e) {
    await c.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

module.exports = { pool, all, one, run, tx, end: () => pool.end() };