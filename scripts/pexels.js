// Remplace des dessins par de vraies photos de Pexels (clé gratuite : https://www.pexels.com/api/).
//
//   npm run images                       télécharge les photos manquantes
//   npm run images -- --simulation       affiche les recherches sans rien télécharger
//   npm run images -- --seulement=stop,feu-orange     ne traite que ces illustrations
//   npm run images -- --force            refait aussi celles qui ont déjà une photo
//   npm run images -- --svg              revient aux dessins d'origine
//
// Les crédits des photographes sont enregistrés en base (affichés sur le site) et dans
// public/img/photos/credits.json. Le script peut être relancé : il reprend où il s'est arrêté.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('../config/db');
const requetes = require('../db/pexels-requetes');

const API = process.env.PEXELS_API_URL || 'https://api.pexels.com/v1/search';
const DOSSIER = path.join(__dirname, '..', 'public', 'img', 'photos');
const FICHIER_CREDITS = path.join(DOSSIER, 'credits.json');

const args = process.argv.slice(2);
const FORCE = args.includes('--force');
const SIMULATION = args.includes('--simulation');
const RESTAURER = args.includes('--svg');
const seul = args.find((a) => a.startsWith('--seulement='));
const SEULEMENT = seul ? seul.slice('--seulement='.length).split(',').map((s) => s.trim()) : null;

const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const cleDe = (image) => path.basename(image, path.extname(image));

class ArretScript extends Error {}

async function chercher(requete, cle) {
  const url = `${API}?${new URLSearchParams({ query: requete, per_page: '15', orientation: 'landscape', locale: 'en-US' })}`;
  const rep = await fetch(url, { headers: { Authorization: cle } });
  if (rep.status === 401 || rep.status === 403) throw new ArretScript('Clé Pexels refusée : vérifiez PEXELS_API_KEY dans .env.');
  if (rep.status === 429) throw new ArretScript('Limite Pexels atteinte (200 requêtes par heure). Relancez plus tard : le script reprendra où il s\'est arrêté.');
  if (!rep.ok) throw new Error(`Pexels a répondu ${rep.status}`);
  return (await rep.json()).photos || [];
}

async function telecharger(photo, fichier) {
  const rep = await fetch(photo.src.large);
  if (!rep.ok) throw new Error(`téléchargement impossible (${rep.status})`);
  if (!(rep.headers.get('content-type') || '').startsWith('image/')) throw new Error('la réponse n\'est pas une image');
  fs.writeFileSync(fichier, Buffer.from(await rep.arrayBuffer()));
}

function ecrireCredits(credits) {
  fs.writeFileSync(FICHIER_CREDITS, JSON.stringify(credits, null, 2));
  const lignes = ['# Crédits photos', '', 'Photos fournies par [Pexels](https://www.pexels.com).', ''];
  for (const [k, c] of Object.entries(credits)) lignes.push(`- ${k}.jpg : ${c.photographe} ([photo](${c.url}))`);
  fs.writeFileSync(path.join(DOSSIER, 'CREDITS.md'), lignes.join('\n') + '\n');
}

(async () => {
  fs.mkdirSync(DOSSIER, { recursive: true });
  const credits = fs.existsSync(FICHIER_CREDITS) ? JSON.parse(fs.readFileSync(FICHIER_CREDITS, 'utf8')) : {};
  const lignes = await db.all("SELECT id, image FROM question WHERE image LIKE '/img/questions/%' OR image LIKE '/img/photos/%' ORDER BY id");

  if (RESTAURER) {
    let n = 0;
    for (const l of lignes.filter((x) => x.image.startsWith('/img/photos/'))) {
      const k = cleDe(l.image);
      await db.run('UPDATE question SET image = $1, credit = NULL, credit_url = NULL WHERE id = $2', [`/img/questions/${k}.svg`, l.id]);
      fs.rmSync(path.join(DOSSIER, `${k}.jpg`), { force: true });
      delete credits[k];
      n++;
    }
    ecrireCredits(credits);
    console.log(`${n} illustration(s) remise(s) en dessin.`);
    return;
  }

  const cle = process.env.PEXELS_API_KEY;
  if (!SIMULATION && !cle) {
    console.error('Clé manquante : ajoutez PEXELS_API_KEY=votre_clé dans le fichier .env (clé gratuite sur https://www.pexels.com/api/).');
    process.exitCode = 1;
    return;
  }

  const utilisees = new Set(Object.values(credits).map((c) => c.id));
  const bilan = { ajoutees: 0, dessins: 0, deja: 0, sansResultat: 0, erreurs: 0 };
  try {
    for (const l of lignes) {
      const k = cleDe(l.image);
      if (SEULEMENT && !SEULEMENT.includes(k)) continue;
      const requete = requetes[k];
      if (!requete) { bilan.dessins++; continue; }
      if (l.image.startsWith('/img/photos/') && !FORCE) { bilan.deja++; continue; }
      if (SIMULATION) { console.log(`${k} → « ${requete} »`); continue; }

      if (credits[k]) utilisees.delete(credits[k].id);
      try {
        const photos = await chercher(requete, cle);
        const photo = photos.find((p) => !utilisees.has(p.id) && p.width >= 900);
        if (!photo) { console.log(`– ${k} : aucune photo adaptée, le dessin est conservé`); bilan.sansResultat++; continue; }
        await telecharger(photo, path.join(DOSSIER, `${k}.jpg`));
        await db.run('UPDATE question SET image = $1, credit = $2, credit_url = $3 WHERE id = $4',
          [`/img/photos/${k}.jpg`, `Photo : ${photo.photographer} / Pexels`, photo.url, l.id]);
        credits[k] = { id: photo.id, photographe: photo.photographer, url: photo.url, requete };
        utilisees.add(photo.id);
        ecrireCredits(credits);
        console.log(`✓ ${k} : photo de ${photo.photographer}`);
        bilan.ajoutees++;
      } catch (e) {
        if (e instanceof ArretScript) throw e;
        console.log(`✗ ${k} : ${e.message}`);
        bilan.erreurs++;
      }
      await pause(400);
    }
  } catch (e) {
    if (!(e instanceof ArretScript)) throw e;
    console.error(e.message);
    process.exitCode = 1;
  }
  if (!SIMULATION) {
    console.log(`\nTerminé : ${bilan.ajoutees} photo(s) ajoutée(s), ${bilan.deja} déjà en place, ${bilan.dessins} dessin(s) conservé(s) volontairement, ${bilan.sansResultat} sans résultat, ${bilan.erreurs} erreur(s).`);
  }
})().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => db.end());