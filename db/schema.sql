CREATE DATABASE IF NOT EXISTS code_route CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE code_route;

CREATE TABLE IF NOT EXISTS utilisateur (
  id INT AUTO_INCREMENT PRIMARY KEY,
  pseudo VARCHAR(30) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  mot_de_passe VARCHAR(255) NOT NULL,
  role ENUM('eleve','admin') NOT NULL DEFAULT 'eleve',
  cree_le DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS theme (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nom VARCHAR(80) NOT NULL UNIQUE,
  description VARCHAR(255) NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS question (
  id INT AUTO_INCREMENT PRIMARY KEY,
  theme_id INT NOT NULL,
  enonce TEXT NOT NULL,
  image VARCHAR(255) NULL,
  explication TEXT NULL,
  actif TINYINT(1) NOT NULL DEFAULT 1,
  FOREIGN KEY (theme_id) REFERENCES theme(id)
);

CREATE TABLE IF NOT EXISTS reponse (
  id INT AUTO_INCREMENT PRIMARY KEY,
  question_id INT NOT NULL,
  libelle VARCHAR(500) NOT NULL,
  est_correcte TINYINT(1) NOT NULL DEFAULT 0,
  FOREIGN KEY (question_id) REFERENCES question(id) ON DELETE CASCADE
);

-- Un passage : exercice (par thème / révision) ou examen blanc
CREATE TABLE IF NOT EXISTS tentative (
  id INT AUTO_INCREMENT PRIMARY KEY,
  utilisateur_id INT NOT NULL,
  type ENUM('exercice','examen') NOT NULL,
  theme_id INT NULL,
  nb_questions INT NOT NULL,
  duree_max_sec INT NULL,
  debut DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fin DATETIME NULL,
  score INT NULL,
  FOREIGN KEY (utilisateur_id) REFERENCES utilisateur(id) ON DELETE CASCADE,
  FOREIGN KEY (theme_id) REFERENCES theme(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS tentative_question (
  tentative_id INT NOT NULL,
  question_id INT NOT NULL,
  position INT NOT NULL,
  reussie TINYINT(1) NULL,
  PRIMARY KEY (tentative_id, question_id),
  FOREIGN KEY (tentative_id) REFERENCES tentative(id) ON DELETE CASCADE,
  FOREIGN KEY (question_id) REFERENCES question(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS reponse_donnee (
  tentative_id INT NOT NULL,
  question_id INT NOT NULL,
  reponse_id INT NOT NULL,
  PRIMARY KEY (tentative_id, question_id, reponse_id),
  FOREIGN KEY (tentative_id) REFERENCES tentative(id) ON DELETE CASCADE,
  FOREIGN KEY (question_id) REFERENCES question(id) ON DELETE CASCADE,
  FOREIGN KEY (reponse_id) REFERENCES reponse(id) ON DELETE CASCADE
);

-- Cours rédigés, un par thème
CREATE TABLE IF NOT EXISTS cours (
  id INT AUTO_INCREMENT PRIMARY KEY,
  theme_id INT NOT NULL UNIQUE,
  titre VARCHAR(160) NOT NULL,
  resume VARCHAR(255) NOT NULL DEFAULT '',
  contenu MEDIUMTEXT NOT NULL,
  FOREIGN KEY (theme_id) REFERENCES theme(id) ON DELETE CASCADE
);
