// Cours rédigés par thème (HTML simple). « resume » s'affiche sur la liste des cours.
const fig = (f, legende) => `<figure><img src="/img/questions/${f}.svg" alt="${legende}"><figcaption>${legende}</figcaption></figure>`;
module.exports = {
  'Signalisation': {
    titre: 'La signalisation routière',
    resume: 'Reconnaître la forme et la couleur des panneaux, comprendre les feux et les marquages au sol.',
    contenu: `
<h2>La forme et la couleur donnent le sens</h2>
<ul>
  <li><strong>Triangle à bordure rouge</strong> : un danger à venir (virage, passage piéton, etc.).</li>
  <li><strong>Disque à bordure rouge</strong> : une interdiction (vitesse maximale, dépassement interdit…).</li>
  <li><strong>Disque à fond bleu</strong> : une obligation (direction obligatoire, vitesse minimale…).</li>
  <li><strong>Carré ou rectangle bleu</strong> : une indication (parking, hôpital, direction).</li>
</ul>
${fig('panneau-danger', 'Un triangle à bordure rouge annonce un danger')}
<h2>Les panneaux de priorité</h2>
<p>Le <strong>STOP</strong> (octogone rouge) impose un arrêt complet, même si la route semble libre. Le <strong>« Cédez le passage »</strong> (triangle pointe en bas) impose de ralentir et de laisser passer les véhicules de la route abordée. Le <strong>sens interdit</strong> est un disque rouge barré d'une bande blanche.</p>
<h2>Les feux tricolores</h2>
<ul>
  <li><strong>Vert</strong> : passage autorisé, à condition de ne pas bloquer le carrefour.</li>
  <li><strong>Orange fixe</strong> : arrêt obligatoire, sauf si l'on ne peut plus s'arrêter en sécurité.</li>
  <li><strong>Rouge</strong> : arrêt derrière la ligne d'arrêt.</li>
</ul>
<p>Au passage à niveau, les feux rouges clignotants imposent l'arrêt : il est interdit de s'engager, même sans train en vue.</p>
<h2>Les marquages au sol</h2>
<ul>
  <li><strong>Ligne continue</strong> : interdiction de la franchir ou de la chevaucher.</li>
  <li><strong>Ligne discontinue</strong> : franchissable pour dépasser ou changer de voie, si c'est sans danger.</li>
</ul>
${fig('ligne-continue', 'Une ligne continue ne se franchit pas')}
<div class="retenir"><h3>À retenir</h3><p>Les ordres d'un agent de la circulation passent avant les feux, qui passent avant les panneaux, qui passent avant les règles générales de priorité.</p></div>`,
  },
  'Priorités': {
    titre: 'Les priorités',
    resume: 'Priorité à droite, panneaux, ronds-points, véhicules prioritaires : qui passe en premier ?',
    contenu: `
<h2>L'ordre à respecter</h2>
<ol>
  <li>Les ordres d'un agent de la circulation.</li>
  <li>Les feux tricolores.</li>
  <li>Les panneaux de priorité (STOP, cédez le passage, route prioritaire).</li>
  <li>La règle générale : la <strong>priorité à droite</strong>.</li>
</ol>
<h2>La priorité à droite</h2>
<p>À une intersection sans panneau ni feu, on cède le passage aux véhicules qui arrivent de la droite.</p>
${fig('priorite-droite', 'Sans signalisation, je cède au véhicule qui vient de ma droite')}
<h2>Les panneaux</h2>
<ul>
  <li><strong>Losange jaune bordé de blanc</strong> : route prioritaire, vous passez en premier aux intersections jusqu'au panneau de fin de priorité (losange barré).</li>
  <li><strong>« Cédez le passage »</strong> et <strong>STOP</strong> : on laisse passer les véhicules de l'autre route.</li>
</ul>
<h2>Les ronds-points</h2>
<p>Quand l'entrée est signalée par un « Cédez le passage », les véhicules déjà engagés sur l'anneau sont prioritaires. On met son clignotant pour annoncer la sortie.</p>
${fig('rond-point-cedez', 'À l\'entrée, je cède le passage aux véhicules engagés dans le rond-point')}
<h2>Cas particuliers</h2>
<ul>
  <li><strong>Tourner à gauche</strong> : on coupe la route des véhicules qui arrivent en face, donc on leur cède le passage.</li>
  <li><strong>Tourner dans une rue</strong> : on cède le passage aux piétons qui traversent cette rue.</li>
  <li><strong>Véhicules prioritaires</strong> (sirène et gyrophare) : on facilite leur passage en se serrant à droite ou en s'arrêtant si nécessaire.</li>
  <li><strong>Bus qui quitte son arrêt en agglomération</strong> : on ralentit et, au besoin, on s'arrête pour le laisser repartir.</li>
  <li><strong>Voie d'accélération</strong> : on prend la vitesse de la circulation, puis on s'insère en cédant le passage.</li>
</ul>
<div class="retenir"><h3>À retenir</h3><p>En cas de doute, on ralentit : mieux vaut perdre quelques secondes que causer un accident.</p></div>`,
  },
  'Vitesse et distances': {
    titre: 'Vitesse, distances de sécurité et d\'arrêt',
    resume: 'Les limitations de vitesse, la règle des 2 secondes et ce qui allonge le freinage.',
    contenu: `
<h2>Les limitations générales</h2>
<table>
  <thead><tr><th>Route</th><th>Temps sec</th><th>Pluie</th></tr></thead>
  <tbody>
    <tr><td>Agglomération</td><td>50 km/h</td><td>50 km/h</td></tr>
    <tr><td>Route à double sens sans séparateur central</td><td>80 km/h*</td><td>80 km/h*</td></tr>
    <tr><td>Route à chaussées séparées</td><td>110 km/h</td><td>100 km/h</td></tr>
    <tr><td>Autoroute</td><td>130 km/h</td><td>110 km/h</td></tr>
  </tbody>
</table>
<p class="discret">* Certaines routes sont relevées à 90 km/h par décision locale, avec des panneaux. Les panneaux locaux l'emportent toujours sur la limite générale. Par brouillard avec moins de 50 mètres de visibilité : 50 km/h partout.</p>
<h2>La distance de sécurité</h2>
<p>On garde au moins <strong>2 secondes</strong> d'intervalle avec le véhicule qui précède. Pour la mesurer, on choisit un repère fixe : quand le véhicule de devant le dépasse, on compte « vingt-et-un, vingt-deux ».</p>
${fig('distance-securite', 'La distance de sécurité correspond à 2 secondes d\'intervalle')}
<h2>La distance d'arrêt</h2>
<p><strong>Distance d'arrêt = distance de réaction + distance de freinage.</strong></p>
<ul>
  <li>La distance de réaction correspond à environ 1 seconde de trajet. À 90 km/h, on parcourt 25 mètres par seconde.</li>
  <li>La distance de freinage est multipliée par 4 quand la vitesse double.</li>
  <li>Sur chaussée mouillée, la distance de freinage peut doubler.</li>
</ul>
${fig('freinage-vitesse', 'Vitesse doublée : distance de freinage multipliée par 4')}
<div class="retenir"><h3>À retenir</h3><p>La vitesse maximale autorisée n'est pas la vitesse conseillée : pluie, brouillard et fatigue obligent à rouler plus lentement.</p></div>`,
  },
  'Conduite et sécurité': {
    titre: 'Conduite et sécurité',
    resume: 'Alcool, stupéfiants, téléphone, ceinture, fatigue, éclairage et entretien du véhicule.',
    contenu: `
<h2>Alcool, stupéfiants et médicaments</h2>
<ul>
  <li><strong>Alcool</strong> : maximum 0,5 g/L de sang (0,25 mg/L d'air expiré), et 0,2 g/L en permis probatoire.</li>
  <li><strong>Stupéfiants</strong> : conduite interdite, même après une petite consommation.</li>
  <li><strong>Médicaments</strong> : un pictogramme de niveau 3 (rouge) signifie qu'il ne faut pas conduire sans l'avis d'un médecin ou d'un pharmacien.</li>
</ul>
<h2>Les distractions</h2>
<p>Tenir un téléphone en main est interdit, tout comme porter un casque ou des écouteurs. Un système mains libres intégré au véhicule et un GPS fixé sur un support restent autorisés.</p>
${fig('telephone', 'Téléphone en main et écouteurs : interdits au volant')}
<h2>La ceinture et l'appui-tête</h2>
<ul>
  <li>La ceinture est obligatoire pour tous les occupants, devant comme derrière.</li>
  <li>Le bord supérieur de l'appui-tête se règle au niveau du sommet du crâne, au plus près de la tête.</li>
</ul>
<h2>La fatigue</h2>
<p>Sur un long trajet, on fait une pause d'au moins 15 minutes toutes les 2 heures environ, sans attendre de s'endormir.</p>
<h2>Éclairage et signalisation</h2>
<ul>
  <li><strong>Feux de croisement</strong> : la nuit, par brouillard ou forte pluie, et dans les tunnels.</li>
  <li><strong>Feux de détresse</strong> : en cas de panne ou d'arrêt d'urgence sur la chaussée, ou pour signaler un bouchon ou un ralentissement brutal.</li>
</ul>
<h2>Les pneumatiques</h2>
<p>La profondeur minimale des sculptures est de <strong>1,6 mm</strong>. On contrôle aussi régulièrement la pression.</p>
<div class="retenir"><h3>À retenir</h3><p>Avant de partir : état des pneus, éclairage en marche, ceinture bouclée, téléphone rangé.</p></div>`,
  },
  'Permis et documents': {
    titre: 'Le permis, les points et les documents',
    resume: 'Permis probatoire, capital de points, assurance, contrôle technique et papiers du véhicule.',
    contenu: `
<h2>Le permis et le capital de points</h2>
<ul>
  <li>La <strong>conduite accompagnée</strong> est possible dès <strong>15 ans</strong>.</li>
  <li>Le <strong>permis probatoire</strong> dure 3 ans (2 ans après une conduite accompagnée). Il démarre avec 6 points, qui augmentent progressivement jusqu'à 12.</li>
  <li>Quand le capital tombe à zéro, le permis est <strong>invalidé</strong>.</li>
  <li>Alcool maximal en permis probatoire : 0,2 g/L de sang.</li>
</ul>
${fig('permis-probatoire', 'Le permis probatoire dure 3 ans')}
<h2>Les documents à pouvoir présenter</h2>
<p>Lors d'un contrôle, on doit pouvoir présenter son <strong>permis de conduire</strong> et le <strong>certificat d'immatriculation</strong> (carte grise) du véhicule.</p>
<h2>L'assurance</h2>
<p>L'assurance <strong>responsabilité civile</strong> (au tiers) est obligatoire pour faire circuler un véhicule à moteur. Elle couvre les dommages causés aux autres.</p>
<h2>Le contrôle technique</h2>
<p>Pour une voiture particulière neuve, le premier contrôle technique a lieu au plus tard 4 ans après la première mise en circulation, puis tous les 2 ans.</p>
<h2>Les démarches</h2>
<ul>
  <li><strong>Déménagement</strong> : on met à jour l'adresse de la carte grise dans le mois.</li>
  <li><strong>Vente du véhicule</strong> : on remplit un certificat de cession avec l'acheteur et on déclare la vente en ligne.</li>
</ul>
<div class="retenir"><h3>À retenir</h3><p>Les délais et démarches administratives évoluent : vérifie-les sur le site officiel de l'administration avant d'agir.</p></div>`,
  },
  'Usagers et environnement': {
    titre: 'Les autres usagers et l\'environnement',
    resume: 'Piétons, cyclistes, enfants, dépassement, angle mort et écoconduite.',
    contenu: `
<h2>Les piétons</h2>
<ul>
  <li>On cède le passage au piéton engagé sur un passage piéton, quitte à s'arrêter.</li>
  <li>Une <strong>canne blanche</strong> signale une personne aveugle ou malvoyante : on s'arrête et on la laisse traverser.</li>
  <li><strong>Zone de rencontre</strong> : 20 km/h maximum, les piétons sont prioritaires et peuvent marcher sur la chaussée.</li>
  <li>Dans une <strong>zone 30</strong>, la vitesse est limitée à 30 km/h.</li>
</ul>
${fig('passage-pieton', 'On cède le passage au piéton engagé')}
<h2>Les cyclistes</h2>
<p>Pour dépasser un cycliste, on laisse une distance latérale d'au moins <strong>1 m en agglomération</strong> et <strong>1,5 m hors agglomération</strong>.</p>
${fig('cycliste-depassement', 'Distance latérale minimale pour dépasser un cycliste')}
<h2>Les enfants</h2>
<p>Avant 10 ans, l'enfant voyage retenu par un dispositif adapté à sa taille et à son poids (siège auto, rehausseur).</p>
<h2>Changer de voie et dépasser</h2>
<ul>
  <li>Avant de se déporter : rétroviseurs, clignotant, puis coup d'œil dans l'angle mort.</li>
  <li>Le dépassement est interdit sans visibilité suffisante : virage, sommet de côte.</li>
</ul>
${fig('angle-mort', 'L\'angle mort : un coup d\'œil avant de changer de voie')}
<h2>Klaxon et écoconduite</h2>
<ul>
  <li>En agglomération, le klaxon est réservé au <strong>danger immédiat</strong>.</li>
  <li>Pour consommer moins : anticiper les ralentissements, garder une vitesse stable et vérifier la pression des pneus.</li>
</ul>
<div class="retenir"><h3>À retenir</h3><p>Plus un usager est vulnérable (piéton, cycliste, enfant), plus on réduit sa vitesse et on augmente sa marge de sécurité.</p></div>`,
  },
};
