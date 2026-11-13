-- Schéma PostgreSQL (Supabase). Relançable sans risque.

CREATE TABLE IF NOT EXISTS utilisateur (
  id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  pseudo VARCHAR(30) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  mot_de_passe VARCHAR(255) NOT NULL,
  role VARCHAR(10) NOT NULL DEFAULT 'eleve' CHECK (role IN ('eleve', 'admin')),
  cree_le TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS theme (
  id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nom VARCHAR(80) NOT NULL UNIQUE,
  description VARCHAR(255) NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS question (
  id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  theme_id INT NOT NULL REFERENCES theme(id),
  enonce TEXT NOT NULL,
  image VARCHAR(255),
  credit VARCHAR(255),
  credit_url VARCHAR(500),
  explication TEXT,
  actif BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS reponse (
  id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  question_id INT NOT NULL REFERENCES question(id) ON DELETE CASCADE,
  libelle VARCHAR(500) NOT NULL,
  est_correcte BOOLEAN NOT NULL DEFAULT FALSE
);

-- Un passage : exercice (par thème / révision) ou examen blanc
CREATE TABLE IF NOT EXISTS tentative (
  id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  utilisateur_id INT NOT NULL REFERENCES utilisateur(id) ON DELETE CASCADE,
  type VARCHAR(10) NOT NULL CHECK (type IN ('exercice', 'examen')),
  theme_id INT REFERENCES theme(id) ON DELETE SET NULL,
  nb_questions INT NOT NULL,
  duree_max_sec INT,
  debut TIMESTAMPTZ NOT NULL DEFAULT now(),
  fin TIMESTAMPTZ,
  score INT
);

CREATE TABLE IF NOT EXISTS tentative_question (
  tentative_id INT NOT NULL REFERENCES tentative(id) ON DELETE CASCADE,
  question_id INT NOT NULL REFERENCES question(id) ON DELETE CASCADE,
  position INT NOT NULL,
  reussie BOOLEAN,
  PRIMARY KEY (tentative_id, question_id)
);

CREATE TABLE IF NOT EXISTS reponse_donnee (
  tentative_id INT NOT NULL REFERENCES tentative(id) ON DELETE CASCADE,
  question_id INT NOT NULL REFERENCES question(id) ON DELETE CASCADE,
  reponse_id INT NOT NULL REFERENCES reponse(id) ON DELETE CASCADE,
  PRIMARY KEY (tentative_id, question_id, reponse_id)
);

-- Cours rédigés, un par thème
CREATE TABLE IF NOT EXISTS cours (
  id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  theme_id INT NOT NULL UNIQUE REFERENCES theme(id) ON DELETE CASCADE,
  titre VARCHAR(160) NOT NULL,
  resume VARCHAR(255) NOT NULL DEFAULT '',
  contenu TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_question_theme ON question(theme_id);
CREATE INDEX IF NOT EXISTS idx_reponse_question ON reponse(question_id);
CREATE INDEX IF NOT EXISTS idx_tentative_utilisateur ON tentative(utilisateur_id);
CREATE INDEX IF NOT EXISTS idx_tq_question ON tentative_question(question_id);

-- Sécurité Supabase : sans RLS, les tables (dont les mots de passe hachés) seraient lisibles
-- via l'API publique avec la clé « anon ». Sans politique, seul notre serveur (connexion
-- directe à Postgres) peut lire et écrire.
ALTER TABLE utilisateur ENABLE ROW LEVEL SECURITY;
ALTER TABLE theme ENABLE ROW LEVEL SECURITY;
ALTER TABLE question ENABLE ROW LEVEL SECURITY;
ALTER TABLE reponse ENABLE ROW LEVEL SECURITY;
ALTER TABLE tentative ENABLE ROW LEVEL SECURITY;
ALTER TABLE tentative_question ENABLE ROW LEVEL SECURITY;
ALTER TABLE reponse_donnee ENABLE ROW LEVEL SECURITY;
ALTER TABLE cours ENABLE ROW LEVEL SECURITY;