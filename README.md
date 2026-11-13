# Code Route

Site gratuit d'exercices et d'examens blancs du code de la route (Node.js, Express, MySQL, EJS).

## Installation

1. Créer la base : `mysql -u root -p < db/schema.sql`
2. Copier `.env.example` en `.env` et renseigner l'accès MySQL, `SESSION_SECRET` et le compte admin
3. `npm install`
4. `npm run seed` (importe les thèmes et questions, crée le compte administrateur)
5. `npm start`, puis ouvrir http://localhost:3000

## Mise à jour d'une installation existante

Remplacer les fichiers, puis relancer `npm install` et `npm run seed`. Le seed ajoute les nouvelles questions, leurs images et les cours sans dupliquer les questions déjà présentes.

## Fonctionnement

- **Cours** (`/cours`) : un cours par thème, avec un bouton pour s'entraîner ensuite sur ce thème.
- **Exercices** : 10 questions par thème, illustrées, avec correction immédiate. Le profil permet de réviser ses erreurs.
- **Examen blanc** : 40 questions, 30 minutes, 35 bonnes réponses minimum. Les questions jamais vues par l'élève sont servies en priorité (environ 20 % de révision tant qu'il reste assez de nouveautés), puis les plus anciennes ou les plus ratées. Correction à la fin.
- Une question est réussie si les réponses cochées correspondent exactement aux bonnes réponses.
- **Administration** (`/admin`) : ajouter, modifier, archiver des questions (avec image), créer des thèmes.
- **Images** : `public/img/questions/` (SVG). Les images envoyées via l'admin vont dans `public/uploads/`.
- **Polices** : Lilita One et Nunito, chargées depuis Google Fonts (repli sur des polices système hors ligne).

## Passer en production

- Remplacer le store de sessions par défaut (MemoryStore) par un store persistant.
- Mettre `cookie.secure = true` derrière HTTPS et ajouter une limite de tentatives sur la connexion.
- Changer le mot de passe administrateur.
