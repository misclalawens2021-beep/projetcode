(() => {
  const data = JSON.parse(document.getElementById('quiz-data').textContent);
  const { id, type, questions, saved } = data;
  const root = document.getElementById('quiz');
  const bar = document.getElementById('progression');
  const timerEl = document.getElementById('minuteur');
  const answers = {};
  questions.forEach((q) => { if (saved[q.id]) answers[q.id] = saved[q.id]; });

  const esc = (s) => { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; };

  async function api(action, body) {
    const r = await fetch(`/api/tentative/${id}/${action}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.erreur || 'Erreur serveur.');
    return j;
  }

  // Ordre des réponses mélangé (Fisher-Yates)
  questions.forEach((q) => {
    for (let k = q.reponses.length - 1; k > 0; k--) {
      const j = Math.floor(Math.random() * (k + 1));
      [q.reponses[k], q.reponses[j]] = [q.reponses[j], q.reponses[k]];
    }
  });

  let terminee = false;
  async function terminer() {
    if (terminee) return;
    terminee = true;
    try { location.href = (await api('terminer')).url; }
    catch (e) { terminee = false; root.insertAdjacentHTML('beforeend', `<p class="flash flash-ko" role="alert">${esc(e.message)}</p>`); }
  }

  // En exercice, on reprend à la première question sans réponse
  let i = type === 'exercice' ? questions.findIndex((q) => !answers[q.id]) : 0;
  if (i === -1) { terminer(); return; }

  function render() {
    const q = questions[i];
    const sel = new Set(answers[q.id] || []);
    const derniere = i === questions.length - 1;
    bar.style.width = `${(i / questions.length) * 100}%`;
    root.innerHTML = `
      <div class="media">${q.image ? `<img src="${esc(q.image)}" alt="Illustration de la question">` : '<p class="sans-image">Question sans illustration</p>'}</div>
      <div class="corps">
        <p class="compteur">Question ${i + 1} sur ${questions.length}</p>
        <h2 class="enonce">${esc(q.enonce)}</h2>
        <div class="reponses">
          <p class="consigne">Une ou plusieurs réponses possibles.</p>
          <ul class="choix">${q.reponses.map((r) => `
            <li><label class="choix-item" data-id="${r.id}">
              <input type="checkbox" value="${r.id}" ${sel.has(r.id) ? 'checked' : ''}><span>${esc(r.libelle)}</span>
            </label></li>`).join('')}</ul>
          <div id="correction" role="status"></div>
          <div class="actions">
            ${type === 'examen' && i > 0 ? '<button class="btn btn-clair" id="precedent" type="button">Précédente</button>' : ''}
            <button class="btn" id="valider" type="button">${type === 'exercice' ? 'Valider' : (derniere ? 'Terminer l\'examen' : 'Question suivante')}</button>
          </div>
        </div>
      </div>`;

    const msg = document.getElementById('correction');
    const valider = document.getElementById('valider');
    const precedent = document.getElementById('precedent');
    if (precedent) precedent.onclick = () => { i--; render(); };

    valider.onclick = async () => {
      const choisies = [...root.querySelectorAll('input:checked')].map((x) => Number(x.value));
      if (type === 'exercice' && !choisies.length) { msg.innerHTML = '<p class="flash flash-info">Cochez au moins une réponse.</p>'; return; }
      valider.disabled = true;
      try {
        answers[q.id] = choisies;
        const res = await api('repondre', { questionId: q.id, reponses: choisies });
        if (type === 'examen') { derniere ? terminer() : (i++, render()); return; }

        root.querySelectorAll('.choix-item').forEach((el) => {
          const rid = Number(el.dataset.id);
          el.querySelector('input').disabled = true;
          if (res.correctes.includes(rid)) el.classList.add('juste');
          else if (choisies.includes(rid)) el.classList.add('faux');
        });
        msg.innerHTML = `<div class="retour ${res.reussie ? 'retour-ok' : 'retour-ko'}">
          <strong>${res.reussie ? 'Bonne réponse.' : 'Réponse incorrecte.'}</strong>
          ${res.explication ? `<p>${esc(res.explication)}</p>` : ''}</div>`;
        valider.textContent = derniere ? 'Voir le résultat' : 'Question suivante';
        valider.disabled = false;
        valider.onclick = () => { if (derniere) { bar.style.width = '100%'; terminer(); } else { i++; render(); } };
      } catch (e) {
        msg.innerHTML = `<p class="flash flash-ko" role="alert">${esc(e.message)}</p>`;
        valider.disabled = false;
      }
    };
  }

  if (timerEl && data.restant !== null) {
    let restant = Math.max(0, data.restant);
    const tick = () => {
      const m = String(Math.floor(restant / 60)).padStart(2, '0');
      const s = String(restant % 60).padStart(2, '0');
      timerEl.textContent = `${m}:${s}`;
      timerEl.classList.toggle('urgent', restant <= 300);
      if (restant <= 0) { terminer(); return; }
      restant--;
      setTimeout(tick, 1000);
    };
    tick();
  }

  render();
})();
