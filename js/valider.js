// valider.js · onglet « Valider » : dossier à sec (sans modèle, gratuit), propositions du moteur à accepter ou refuser, pensées enrichies.
import { vectoriser } from './memoire.js';

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const md = s => (window.marked ? window.marked.parse(String(s ?? '')) : `<pre>${esc(s)}</pre>`);
const jour = d => d ? new Date(d).toLocaleDateString('fr-BE') : '';
const enChaine = v => '[' + v.map(x => x.toFixed(5)).join(',') + ']';

export function activerValider(sb, api) {
  const v = document.getElementById('view-valider');
  const brain = sb.schema('brain');
  const ok = r => { if (r.error) throw r.error; return r.data; };

  v.innerHTML = `
    <div class="valider">
      <form class="panel valider-form" id="sec-form">
        <div class="eyebrow">Dossier à sec</div>
        <textarea id="sec-texte" placeholder="Une question ou une idée : voir ce que le cerveau et la mémoire activent, sans modèle."></textarea>
        <div class="ligne">
          <label><input type="radio" name="genre" value="question" checked> Question</label>
          <label><input type="radio" name="genre" value="idee"> Nouvelle idée</label>
          <span class="sep"></span>
          <button class="btn-primaire" id="sec-go" type="submit">Voir le dossier</button>
          <span class="hint" id="sec-etat">Pour penser vraiment : Claude Code ou Claude Desktop, outils MyBrain.</span>
        </div>
      </form>
      <div class="panel valider-col"><h3>Propositions en attente</h3><div id="props" class="hint">Chargement…</div></div>
      <div class="panel valider-col"><h3>Dossier</h3><div id="sec-dossier" class="hint">Les nœuds activés et les preuves apparaîtront ici.</div></div>
    </div>`;

  function afficherDossier(d) {
    const el = document.getElementById('sec-dossier');
    el.classList.remove('hint');
    const maxA = Math.max(...d.noeuds.map(n => Number(n.activation)), 0.01);
    el.innerHTML = `<p class="hint">${d.noeuds.length} nœuds, ${d.preuves.length} preuves, ${d.stats.taille_car.toLocaleString('fr-BE')} caractères</p>
      <ul class="items">${d.noeuds.map(n => `<li><button class="linklike" data-${n.type === 'idee' ? 'idee' : 'projet'}="${n.ref}">${n.cle}</button> · ${esc(n.titre || n.nom)}<span class="act"><i style="width:${Math.round(100 * Number(n.activation) / maxA)}%"></i></span><small>${esc(n.chemin)}</small></li>`).join('')}</ul>
      ${d.solutions.length ? `<h3>Solutions touchées</h3><ul class="items">${d.solutions.map(s => `<li><button class="linklike" data-solution="${s.ref}">${s.ref} · ${esc(s.titre)}</button></li>`).join('')}</ul>` : ''}
      <h3>Preuves</h3><ul class="items">${d.preuves.map(p => {
        const lien = p.source === 'outlook-agilos' ? `https://outlook.office365.com/owa/?ItemID=${encodeURIComponent(p.ref_source)}&exvsurl=1&viewmodel=ReadMessageItem` : `https://mail.google.com/mail/#all/${encodeURIComponent(p.ref_source)}`;
        return `<li><a class="linklike" href="${lien}" target="_blank" rel="noopener">${esc(p.titre || '(sans sujet)')}</a> · ${esc(jour(p.date))} · ${Math.round(Number(p.score) * 1000) / 10}<small>${esc(p.de || '')}${p.organisation ? ' · ' + esc(p.organisation) : ''} · voies ${esc(p.voies)}</small><small>${esc(String(p.extrait).slice(0, 220))}…</small></li>`; }).join('')}</ul>`;
    api.highlight?.(new Set(d.noeuds.map(n => (n.type === 'idee' ? 'i' : 'p') + n.ref)), new Set());
  }

  const decrire = p => {
    const c = p.contenu;
    switch (p.genre) {
      case 'idee': return `<b>Nouvelle idée</b> : ${esc(c.fiche?.titre)}<small>${esc(c.fiche?.pitch)}</small><small>${(c.liens || []).length} liens · ${(c.projets || []).length} projets · thème ${esc(c.theme)} · ${esc(c.categorie)}</small>${c.verdict ? `<small><b>Verdict</b> : ${esc(c.verdict)}</small>` : ''}`;
      case 'lien': return `<b>Lien</b> ${esc(c.de)} → ${esc(c.a)} · ${esc(c.type)} · poids ${esc(c.poids)}<small>${esc(c.nature)}</small>${c.apport ? `<small>Apport : ${esc(c.apport)}</small>` : ''}`;
      case 'contexte': return `<b>Enrichir</b> ${esc(c.cible)} · ${esc(c.champ)}<small>${esc(c.valeur)}</small>`;
      case 'solution': return `<b>Solution</b> ${esc(c.id || c.titre)}<small>${esc(c.pitch || '')} · idées ${(c.idees || []).join(', ')}</small>`;
      case 'projet_lien': return `<b>Rattacher</b> ${esc(c.idee)} au projet ${esc(c.projet)}<small>${esc(c.usage)} · poids ${esc(c.poids)}</small>`;
      case 'connexion': return `<b>Connexion mémoire</b><small>${esc(c.nature)}</small>`;
      default: return esc(p.genre);
    }
  };
  async function chargerPropositions() {
    const el = document.getElementById('props');
    const props = ok(await brain.from('propositions').select('*, reponses(question, genre, pensee_id)').eq('statut', 'en_attente').order('cree_le'));
    if (!props.length) { el.classList.add('hint'); el.textContent = 'Aucune proposition en attente.'; return; }
    el.classList.remove('hint');
    el.innerHTML = props.map(p => `<div class="prop" data-prop="${p.id}"><small>Pensée ${esc(p.reponses?.pensee_id || '')} · ${esc(jour(p.cree_le))} · ${esc((p.reponses?.question || '').slice(0, 90))}</small>${decrire(p)}
      <div class="actions"><button class="btn-primaire" data-accepter="${p.id}" data-genre="${p.genre}">Accepter</button><button class="btn-ghost" data-refuser="${p.id}">Refuser</button></div></div>`).join('');
  }
  v.addEventListener('click', async e => {
    const acc = e.target.closest('[data-accepter]'), ref = e.target.closest('[data-refuser]');
    if (!acc && !ref) return;
    const id = acc ? acc.dataset.accepter : ref.dataset.refuser;
    const carte = v.querySelector(`[data-prop="${id}"]`);
    carte.querySelectorAll('button').forEach(b => { b.disabled = true; });
    try {
      if (ref) {
        const motif = window.prompt('Motif du refus (facultatif, retenu 30 jours par le moteur) :') ?? '';
        ok(await brain.rpc('refuser_proposition', { p: id, motif: motif || null }));
        carte.classList.add('faite'); carte.querySelector('.actions').innerHTML = '<span class="chip plain">refusée</span>'; return;
      }
      let vecteur = null;
      if (acc.dataset.genre === 'idee') {
        const { data: p } = await brain.from('propositions').select('contenu').eq('id', id).single();
        const f = p.contenu.fiche || {};
        vecteur = enChaine(await vectoriser([f.titre, f.pitch, f.contexte].filter(Boolean).join(' '), 'passage: '));
      }
      const res = ok(await brain.rpc('appliquer_proposition', { p: id, vecteur }));
      carte.classList.add('faite');
      carte.querySelector('.actions').innerHTML = `<span class="chip realise">acceptée · ${esc(JSON.stringify(res))}</span> <button class="btn-ghost" onclick="location.reload()">Recharger le cerveau</button>`;
    } catch (err) {
      carte.querySelector('.actions').innerHTML = `<span class="chip pause">erreur : ${esc(err.message || err)}</span>`;
    }
  });

  document.getElementById('sec-form').addEventListener('submit', async e => {
    e.preventDefault();
    const texte = document.getElementById('sec-texte').value.trim();
    if (!texte) return;
    const genre = v.querySelector('input[name=genre]:checked').value;
    const etat = document.getElementById('sec-etat'), go = document.getElementById('sec-go');
    go.disabled = true;
    try {
      etat.textContent = 'Vectorisation…';
      const q = enChaine(await vectoriser(texte, 'query: '));
      etat.textContent = 'Dossier…';
      const d = ok(await brain.rpc('dossier', { q, question: texte, genre }));
      afficherDossier(d);
      etat.textContent = `${d.noeuds.length} nœuds, ${d.preuves.length} preuves (aucun modèle appelé).`;
    } catch (err) { etat.textContent = 'Erreur : ' + (err.message || err); }
    finally { go.disabled = false; }
  });
  chargerPropositions();
}

// Enrichit l'onglet Pensées avec les réponses du moteur (question, statut, réponse).
export async function enrichirPensees(sb) {
  const { data } = await sb.schema('brain').from('reponses').select('pensee_id, genre, question, statut, modele_effectif, reponse').not('pensee_id', 'is', null);
  for (const r of data || []) {
    const b = document.querySelector(`#view-pensees button[data-journal="${r.pensee_id}"]`);
    const art = b?.closest('article'); if (!art || art.querySelector('.reponse-info')) continue;
    art.insertAdjacentHTML('beforeend', `<div class="reponse-info"><b>${r.genre === 'idee' ? 'Idée' : 'Question'}</b> : ${esc(r.question)}<br>${esc(r.modele_effectif || '')} · ${esc(r.statut)}<details><summary>Réponse</summary><div class="reponse">${md(r.reponse?.reponse_md)}</div></details></div>`);
  }
}
