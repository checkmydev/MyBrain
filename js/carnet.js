// carnet.js · interface du réseau d'idées (carte structurée et organique, fiches, listes, pensées).
export function demarrer(D, hooks = {}) {
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const byId = arr => Object.fromEntries(arr.map(x => [x.id, x]));
  const ideeById = byId(D.idees), projById = byId(D.projets), solById = byId(D.solutions), jById = byId(D.journal);
  const jIdx = Object.fromEntries(D.journal.map((j, k) => [j.id, k]));
  const themeOf = {};
  for (const [k, t] of Object.entries(D.themes)) t.idees.forEach(id => { themeOf[id] = k; });
  const solsOf = id => D.solutions.filter(s => s.idees.includes(id));
  const ideasOfProject = pid => D.idees.filter(i => i.projets.some(x => x.p === pid));
  const usedProjects = [...new Set(D.idees.flatMap(i => i.projets.map(x => x.p)))];
  const catToken = c => D.categories[c]?.token || '--muted';
  const catColor = c => css(catToken(c));
  const jType = t => ({idee:'idée', projets:'projets', discussion:'discussion', projet:'projet'}[t] || t);
  const chipClass = s => ({proto:'proto', realise:'realise', idee:'idee', creuser:'creuser', pause:'pause'}[s] || 'plain');

  const liensOf = id => D.liens.filter(l => l.de === id || l.a === id);
  const forces = D.forces;
  const maxF = Math.max(...Object.values(forces), 1);
  const forceLabel = f => f >= maxF * .6 ? 'forte' : f >= maxF * .3 ? 'moyenne' : 'faible';
  const lastThought = [...D.journal].reverse().find(j => j.active.length);
  const lastIx = lastThought ? jIdx[lastThought.id] : -1;
  const isRecentIdea = id => !!lastThought?.active.includes(id);
  const isRecentLink = l => l.last === lastIx;

  const state = { cats: new Set(Object.keys(D.categories)), projets: true, view: 'struct', focus: null };

  const mine = D.idees.filter(i => i.source === 'carnet').length;
  const consol = D.liens.filter(l => l.acts.length > 1).length;
  document.getElementById('stats').innerHTML =
    `<span><b>${mine}</b>mes idées</span><span><b>${D.idees.length - mine}</b>concepts</span><span><b>${D.liens.length}</b>liens dont ${consol} consolidés</span><span><b>${D.solutions.length}</b>solutions</span><span><b>${D.journal.length}</b>pensées</span>`;

  // ---------- Filtres ----------
  const filters = document.getElementById('filters');
  filters.innerHTML = `<span class="lbl">Pour qui</span>` +
    Object.entries(D.categories).map(([k, c]) => `<button class="fchip" data-cat="${k}" aria-pressed="true"><i class="sw" style="background:var(${c.token})"></i>${esc(c.label)}</button>`).join('') +
    `<span class="sep"></span><button class="fchip" id="f-projets" aria-pressed="true"><i class="sw" style="background:var(--line-strong);border-radius:3px"></i>Projets sur la carte</button>
     <button class="btn-ghost" id="recentrer" type="button">Recentrer</button>`;

  function renderLegend() {
    const common = `<span><i class="ln"></i>Lien</span><span><i class="ln consol"></i>Lien consolidé</span><span><i class="ln tension"></i>Tension</span><span><i class="ln glow"></i>Dernière pensée</span><span><i class="sol"></i>Solution</span><span><i class="dot big"></i>Mon idée</span><span><i class="dot"></i>Concept</span><span><i class="sq"></i>Projet</span>`;
    document.getElementById('legend').innerHTML = common + (state.view === 'struct' ? `<span><i class="zone"></i>Thème</span>` : '');
    document.getElementById('viewhint').textContent = state.view === 'struct'
      ? 'Rangée par thème. Clique sur un nœud ou un lien.'
      : 'Les idées fortes repoussent davantage, les liens forts attirent. Fais glisser les nœuds, zoome pour voir les projets.';
  }

  // ---------- Fiches ----------
  const detail = document.getElementById('detail');
  const catChip = c => `<span class="chip cat" style="background:var(${catToken(c)})">${esc(D.categories[c]?.label)}</span>`;
  const themeChip = id => themeOf[id] ? `<button class="chip theme" data-theme="${themeOf[id]}">${esc(D.themes[themeOf[id]].label)}</button>` : '';
  const typeChip = t => `<span class="chip ${t === 'tension' ? 'tension' : 'plain'}" title="${esc(D.typesLien[t]?.desc)}">${esc(D.typesLien[t]?.label || t)}</span>`;
  const bar = (v, max) => `<span class="bar"><i style="width:${Math.round(100 * v / max)}%"></i></span>`;
  const ideaBtn = id => `<button class="linklike" data-idee="${id}">${id} · ${esc(ideeById[id]?.titre)}</button>`;
  const projBtn = p => `<button class="linklike" data-projet="${p}">${esc(projById[p]?.nom || p)}</button>`;

  function showHome() {
    state.focus = null;
    const mes = D.idees.filter(i => i.source === 'carnet').reverse();
    const top = [...D.idees].sort((a, b) => forces[b.id] - forces[a.id]).slice(0, 6);
    const strong = [...D.liens].sort((a, b) => b.force - a.force).slice(0, 5);
    detail.innerHTML = `<div class="eyebrow">Comment lire le carnet</div><h2>Un réseau qui apprend</h2>
      <p>Une idée seule est faible. Chaque lien, chaque projet qui la concrétise et chaque pensée qui repasse par elle la renforce. Quand une nouvelle idée active deux idées déjà reliées, leur lien se consolide, comme un chemin qu'on emprunte souvent.</p>
      ${lastThought ? `<div><h3>Dernière pensée</h3><ul class="items"><li><button class="linklike" data-journal="${lastThought.id}">${esc(lastThought.titre)}</button><small>${esc(lastThought.note)}</small></li></ul></div>` : ''}
      <div><h3>Idées les plus fortes</h3><ul class="items">${top.map(i => `<li>${ideaBtn(i.id)} · force ${forces[i.id]}${bar(forces[i.id], maxF)}</li>`).join('')}</ul></div>
      <div><h3>Chemins les plus forts</h3><ul class="items">${strong.map(l => `<li><button class="linklike" data-lien="${l.key}">${l.de} ↔ ${l.a}</button> · ${esc(D.typesLien[l.type].label)} · force ${l.force.toFixed(1)}${l.acts.length > 1 ? ` · consolidé ×${l.acts.length}` : ''}<small>${esc(l.nature)}</small></li>`).join('')}</ul></div>
      <div><h3>Mes idées</h3><ul class="items">${mes.map(i => `<li>${ideaBtn(i.id)}<small>${esc(i.pitch)}</small></li>`).join('')}</ul></div>
      <div><h3>Solutions en convergence</h3><ul class="items">${D.solutions.map(s => `<li><button class="linklike" data-solution="${s.id}">${s.id} · ${esc(s.titre)}</button><small>${s.idees.join(', ')} · ${esc(s.statutLabel)}</small></li>`).join('')}</ul></div>`;
    detail.scrollTop = 0;
  }

  function lienLi(l, fromId) {
    const other = l.de === fromId ? l.a : l.de;
    const recu = l.a === fromId;
    const ap = l.apport ? `<small><b>${recu ? 'Apport de ' + l.de : 'Apporte à ' + l.a}</b> : ${esc(l.apport)}</small>` : '';
    return `<li><div class="linkrow">${ideaBtn(other)} ${typeChip(l.type)}<button class="linklike" data-lien="${l.key}" style="font-weight:600;font-size:13px">force ${l.force.toFixed(1)}${l.acts.length > 1 ? ' · consolidé ×' + l.acts.length : ''}</button></div>
      ${bar(l.force, 10)}<small>${esc(l.nature)}</small>${ap}</li>`;
  }

  function showIdee(id) {
    const i = ideeById[id]; if (!i) return showHome();
    state.focus = 'i' + id;
    const L = liensOf(id).sort((a, b) => b.force - a.force);
    const projs = [...i.projets].sort((a, b) => (b.poids || 2) - (a.poids || 2));
    detail.innerHTML = `
      <div class="eyebrow">${i.source === 'carnet' ? 'Mon idée ' + i.id + (i.date ? ' · ' + esc(i.date) : '') : 'Concept tiré des projets · ' + i.id}</div>
      <h2>${esc(i.titre)}</h2>
      <div class="meta">${themeChip(i.id)}${catChip(i.categorie)}<span class="chip ${chipClass(i.statut)}">${esc(i.statutLabel)}</span><span class="chip plain">Force ${forces[id]} · ${forceLabel(forces[id])}</span></div>
      <p>${esc(i.pitch)}</p>
      ${i.contexte ? `<div><h3>Contexte</h3><p class="ctx">${esc(i.contexte)}</p></div>` : ''}
      ${(i.forces?.length || i.risques?.length) ? `<div class="two"><div><h3>Forces</h3><ul class="steps plus">${(i.forces || []).map(x => `<li>${esc(x)}</li>`).join('') || '<li>À compléter</li>'}</ul></div><div><h3>Risques</h3><ul class="steps minus">${(i.risques || []).map(x => `<li>${esc(x)}</li>`).join('') || '<li>À compléter</li>'}</ul></div></div>` : ''}
      ${i.probleme ? `<div><h3>Problème résolu</h3><p>${esc(i.probleme)}</p></div>` : ''}
      ${solsOf(id).length ? `<div><h3>Contribue aux solutions</h3><ul class="items">${solsOf(id).map(s => `<li><button class="linklike" data-solution="${s.id}">${s.id} · ${esc(s.titre)}</button></li>`).join('')}</ul></div>` : ''}
      ${L.length ? `<div><h3>Connexions, de la plus forte à la plus faible</h3><ul class="items">${L.map(l => lienLi(l, id)).join('')}</ul></div>` : ''}
      <div><h3>${i.source === 'carnet' ? 'Expériences qui la nourrissent' : 'Projets dont elle est tirée'}</h3><ul class="items">${projs.map(x => `<li><div class="linkrow">${projBtn(x.p)}<span class="chip plain">${x.poids === 3 ? 'central' : x.poids === 1 ? 'secondaire' : 'brique'}</span></div><small><b>${esc(x.usage)}</b></small><small>${esc(projById[x.p]?.contexte || projById[x.p]?.resume)}</small></li>`).join('')}</ul></div>
      ${i.questions?.length ? `<div><h3>Questions ouvertes</h3><ul class="steps qs">${i.questions.map(q => `<li>${esc(q)}</li>`).join('')}</ul></div>` : ''}
      ${i.construire?.length ? `<div><h3>À construire</h3><ul class="steps">${i.construire.map(c => `<li>${esc(c)}</li>`).join('')}</ul></div>` : ''}
      ${i.etapes?.length ? `<div><h3>Prochaines étapes</h3><ul class="steps">${i.etapes.map(e => `<li class="${e.fait ? 'done' : ''}">${esc(e.t)}</li>`).join('')}</ul></div>` : ''}
      <div class="memoire-liee" data-cle="idee:${i.id}"></div>`;
    detail.scrollTop = 0;
    hooks.memoireLiee?.(detail.querySelector('.memoire-liee'));
  }

  function showLien(key) {
    const l = D.liens.find(x => x.key === key); if (!l) return showHome();
    state.focus = null;
    detail.innerHTML = `
      <div class="eyebrow">Relation</div>
      <h2>${esc(ideeById[l.de].titre)} ↔ ${esc(ideeById[l.a].titre)}</h2>
      <div class="meta">${typeChip(l.type)}<span class="chip plain">Poids ${l.poids}/5</span><span class="chip plain">Force ${l.force.toFixed(1)}/10</span></div>
      ${bar(l.force, 10)}
      <p>${esc(l.nature)}</p>
      ${l.apport ? `<div><h3>Ce que ${l.de} apporte à ${l.a}</h3><p class="ctx">${esc(l.apport)}</p></div>` : ''}
      <div><h3>${esc(D.typesLien[l.type].label)}</h3><p>${esc(D.typesLien[l.type].desc)}</p></div>
      <div><h3>Historique : ${l.acts.length} activation${l.acts.length > 1 ? 's' : ''}</h3><ul class="items">${l.acts.map((a, k) => `<li><button class="linklike" data-journal="${a}">${esc(jById[a]?.titre)}</button><small>${k === 0 ? 'Création du lien' : 'Consolidation : cette pensée est repassée par les deux idées'}</small></li>`).join('')}</ul></div>
      <div><h3>Les deux idées</h3><ul class="items"><li>${ideaBtn(l.de)}</li><li>${ideaBtn(l.a)}</li></ul></div>`;
    detail.scrollTop = 0;
    highlight(new Set(['i' + l.de, 'i' + l.a]), new Set([l.key]));
  }

  function showSolution(sid) {
    const s = solById[sid]; if (!s) return showHome();
    state.focus = 's' + sid;
    const ids = s.idees.map(id => ideeById[id]).filter(Boolean);
    const projs = [...new Set(ids.flatMap(i => i.projets.map(x => x.p)))];
    const inner = D.liens.filter(l => s.idees.includes(l.de) && s.idees.includes(l.a)).sort((a, b) => b.force - a.force);
    const cohesion = inner.reduce((a, l) => a + l.force, 0);
    detail.innerHTML = `
      <div class="eyebrow">Solution · ${s.id}</div>
      <h2>${esc(s.titre)}</h2>
      <div class="meta"><span class="chip ${chipClass(s.statut)}">${esc(s.statutLabel)}</span><span class="chip plain">${ids.length} idées · ${projs.length} projets</span><span class="chip plain">Cohésion ${cohesion.toFixed(0)}</span></div>
      <p>${esc(s.pitch)}</p>
      <div><h3>Idées qui convergent</h3><ul class="items">${ids.map(i => `<li>${ideaBtn(i.id)} · force ${forces[i.id]}<small>${esc(i.pitch)}</small></li>`).join('')}</ul></div>
      ${inner.length ? `<div><h3>Chemins internes</h3><ul class="items">${inner.map(l => `<li><button class="linklike" data-lien="${l.key}">${l.de} ↔ ${l.a}</button> ${typeChip(l.type)} · force ${l.force.toFixed(1)}<small>${esc(l.nature)}</small></li>`).join('')}</ul></div>` : ''}
      <div><h3>Expériences déjà acquises</h3><p>${projs.map(projBtn).join(' · ')}</p></div>
      <div class="memoire-liee" data-cle="solution:${s.id}"></div>`;
    detail.scrollTop = 0;
    hooks.memoireLiee?.(detail.querySelector('.memoire-liee'));
  }

  function showTheme(k) {
    const t = D.themes[k]; if (!t) return showHome();
    state.focus = null;
    detail.innerHTML = `<div class="eyebrow">Thème</div><h2>${esc(t.label)}</h2>
      <ul class="items">${t.idees.map(id => ideeById[id]).sort((a, b) => forces[b.id] - forces[a.id]).map(i => `<li>${ideaBtn(i.id)} · force ${forces[i.id]}${bar(forces[i.id], maxF)}<small>${esc(i.pitch)}</small></li>`).join('')}</ul>`;
    detail.scrollTop = 0;
    highlight(new Set(t.idees.map(id => 'i' + id)));
  }

  function showProjet(pid) {
    const p = projById[pid]; if (!p) return showHome();
    state.focus = 'p' + pid;
    const users = ideasOfProject(pid);
    const exps = D.liensProjets.filter(l => l.de === pid || l.a === pid);
    detail.innerHTML = `
      <div class="eyebrow">Expérience · ${esc(p.famille)}</div>
      <h2>${esc(p.nom)}</h2>
      <div class="path">Claude Code Projects/${esc(p.dossier)}</div>
      <p>${esc(p.resume)}</p>
      ${p.contexte ? `<div><h3>Ce qui a été fait</h3><p class="ctx">${esc(p.contexte)}</p></div>` : ''}
      ${p.lecons?.length ? `<div><h3>Leçons</h3><ul class="steps lecons">${p.lecons.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
      <div><h3>Idées qu'elle nourrit (${users.length})</h3><ul class="items">${users.map(i => `<li>${ideaBtn(i.id)}<small>${esc(i.projets.find(x => x.p === pid).usage)}</small></li>`).join('') || '<li>Aucune pour l\'instant</li>'}</ul></div>
      <div class="memoire-liee" data-cle="projet:${pid}"></div>
      ${exps.length ? `<div><h3>Expériences liées</h3><ul class="items">${exps.map(l => `<li>${projBtn(l.de === pid ? l.a : l.de)}<small>${esc(projById[l.de].nom)} ${esc(l.nature)} ${esc(projById[l.a].nom)}</small></li>`).join('')}</ul></div>` : ''}`;
    detail.scrollTop = 0;
    hooks.memoireLiee?.(detail.querySelector('.memoire-liee'));
  }

  function showJournal(jid) {
    const j = jById[jid]; if (!j) return showHome();
    state.focus = null;
    const created = D.liens.filter(l => l.cree === jid);
    const consolidated = D.liens.filter(l => l.acts.includes(jid) && l.cree !== jid);
    detail.innerHTML = `
      <div class="eyebrow">Pensée · ${esc(j.date)} · ${esc(jType(j.type))}</div>
      <h2>${esc(j.titre)}</h2>
      <p class="ctx">${esc(j.note)}</p>
      ${j.active.length ? `<div><h3>Idées activées (${j.active.length})</h3><p>${j.active.map(id => ideaBtn(id)).join(' · ')}</p></div>` : ''}
      ${created.length ? `<div><h3>Chemins créés (${created.length})</h3><ul class="items">${created.map(l => `<li><button class="linklike" data-lien="${l.key}">${l.de} ↔ ${l.a}</button> ${typeChip(l.type)}<small>${esc(l.nature)}</small></li>`).join('')}</ul></div>` : ''}
      ${consolidated.length ? `<div><h3>Chemins consolidés (${consolidated.length})</h3><ul class="items">${consolidated.map(l => `<li><button class="linklike" data-lien="${l.key}">${l.de} ↔ ${l.a}</button> · force ${l.force.toFixed(1)}<small>${esc(l.nature)}</small></li>`).join('')}</ul></div>` : ''}`;
    detail.scrollTop = 0;
    if (j.active.length) highlight(new Set(j.active.map(id => 'i' + id)), new Set([...created, ...consolidated].map(l => l.key)));
    else clearHighlight();
  }

  // ---------- Vue Idées ----------
  const liste = document.getElementById('view-liste');
  function renderList() {
    const sols = `<div class="group"><div class="group-h"><h2>Solutions en convergence</h2><span>${D.solutions.length} pistes</span></div><div class="list">` +
      D.solutions.map(s => `<button class="card sol-card" data-solution="${s.id}"><div class="eyebrow">Solution ${s.id}</div><h3>${esc(s.titre)}</h3>
        <div class="meta"><span class="chip ${chipClass(s.statut)}">${esc(s.statutLabel)}</span></div><p>${esc(s.pitch)}</p><div class="rel">Idées ${s.idees.join(', ')}</div></button>`).join('') + `</div></div>`;
    liste.innerHTML = sols + Object.entries(D.themes).map(([tk, t]) => {
      const items = t.idees.map(id => ideeById[id]).filter(i => state.cats.has(i.categorie)).sort((a, b) => forces[b.id] - forces[a.id]);
      if (!items.length) return '';
      return `<div class="group"><div class="group-h"><h2>${esc(t.label)}</h2><span>${items.length} idées</span></div><div class="list">` +
        items.map(i => {
          const c = D.categories[i.categorie];
          return `<button class="card ${i.source === 'carnet' ? 'mine' : ''}" data-idee="${i.id}">
            <div class="eyebrow" style="color:var(${c.token})">${i.source === 'carnet' ? 'Mon idée ' : ''}${i.id} · ${esc(c.label)}</div>
            <h3>${esc(i.titre)}</h3>
            <div class="meta"><span class="chip ${chipClass(i.statut)}">${esc(i.statutLabel)}</span><span class="chip plain">force ${forces[i.id]}</span></div>
            <p>${esc(i.pitch)}</p>
            <div class="rel">${liensOf(i.id).length} liens · ${i.projets.length} projets</div></button>`;
        }).join('') + `</div></div>`;
    }).join('');
  }

  // ---------- Vue Projets ----------
  const projList = document.getElementById('projets-list');
  const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const ideaChips = pid => {
    const ids = ideasOfProject(pid);
    return ids.length ? ids.map(i => `<button class="ichip" data-idee="${i.id}" style="background:var(${catToken(i.categorie)})" title="${esc(i.titre)}">${i.id} · ${esc(i.titre)}</button>`).join('')
      : `<span class="ichip none">Aucune idée liée</span>`;
  };
  function renderProjets() {
    const q = norm(document.getElementById('q').value.trim());
    const fams = [...new Set(D.projets.map(p => p.famille))];
    const tops = new Set(D.projets.flatMap(p => p.dossier.split(' + ').map(x => x.split('/')[0].trim())).filter(x => !x.startsWith('~') && !x.startsWith('dossier ')));
    const withCtx = D.projets.filter(p => p.contexte).length;
    projList.innerHTML = `<p class="hint">${D.projets.length} projets issus des ${tops.size} éléments du dossier « Claude Code Projects ». ${withCtx} ont un contexte détaillé et des leçons ; les autres seront approfondis au fil des discussions.</p>` + fams.map(f => {
      const items = D.projets.filter(p => p.famille === f && (!q || norm(p.nom + ' ' + p.dossier + ' ' + p.resume + ' ' + (p.contexte || '') + ' ' + (p.lecons || []).join(' ')).includes(q)));
      if (!items.length) return '';
      return `<div class="group"><div class="group-h"><h2>${esc(f)}</h2><span>${items.length} projet${items.length > 1 ? 's' : ''}</span></div><div class="list">` +
        items.map(p => `<article class="card proj">
          <div class="path">${esc(p.dossier)}</div>
          <h3><button class="linklike" data-projet="${p.id}">${esc(p.nom)}</button></h3>
          <p>${esc(p.resume)}</p>
          ${p.lecons?.length ? `<ul class="lecons">${p.lecons.map(x => `<li>→ ${esc(x)}</li>`).join('')}</ul>` : ''}
          <div class="ichips">${ideaChips(p.id)}</div></article>`).join('') + `</div></div>`;
    }).join('') || '<p class="hint">Aucun projet ne correspond.</p>';
  }
  document.getElementById('q').addEventListener('input', renderProjets);

  // ---------- Vue Pensées ----------
  function renderPensees() {
    document.getElementById('view-pensees').innerHTML = `<div class="group-h" style="margin-bottom:14px"><h2>Journal des pensées</h2><span>Chaque idée, projet ou discussion active des chemins ; ceux qui sont réactivés se consolident.</span></div><div class="timeline">` +
      [...D.journal].reverse().map(j => {
        const created = D.liens.filter(l => l.cree === j.id).length;
        const cons = D.liens.filter(l => l.acts.includes(j.id) && l.cree !== j.id).length;
        return `<article class="thought"><div class="when">${esc(j.date)}<br>${esc(jType(j.type))}</div><div>
          <h3><button class="linklike" data-journal="${j.id}">${esc(j.titre)}</button></h3><p>${esc(j.note)}</p>
          ${j.active.length && j.active.length < 12 ? `<div class="ichips">${j.active.map(id => `<button class="ichip" data-idee="${id}" style="background:var(${catToken(ideeById[id].categorie)})">${id} · ${esc(ideeById[id].titre)}</button>`).join('')}</div>` : ''}
          <div class="counts">${created} chemin${created > 1 ? 's' : ''} créé${created > 1 ? 's' : ''} · ${cons} consolidé${cons > 1 ? 's' : ''}</div></div></article>`;
      }).join('') + `</div>`;
  }

  // ---------- Onglets et vues ----------
  const TABS = ['carte', 'liste', 'projets', 'pensees', 'memoire'];
  function setTab(name) {
    for (const t of TABS) {
      document.getElementById('tab-' + t).setAttribute('aria-selected', t === name);
      document.getElementById('view-' + t).hidden = t !== name;
    }
    filters.hidden = name !== 'carte' && name !== 'liste';
    if (name === 'memoire' && window.ouvrirMemoire) window.ouvrirMemoire();
    if (name === 'carte') { if (state.view === 'struct' && cy) cy.resize(); if (state.view === 'orga' && !org) buildOrganic(); }
  }
  TABS.forEach(t => { document.getElementById('tab-' + t).onclick = () => setTab(t); });
  function setView(v) {
    state.view = v;
    document.getElementById('v-struct').setAttribute('aria-pressed', v === 'struct');
    document.getElementById('v-orga').setAttribute('aria-pressed', v === 'orga');
    document.getElementById('graph').toggleAttribute('hidden', v !== 'struct');
    document.getElementById('organic').toggleAttribute('hidden', v !== 'orga');
    renderLegend();
    if (v === 'orga') buildOrganic(); else if (cy) { cy.resize(); cy.fit(cy.elements(':visible'), 30); }
    if (state.focus) select(state.focus);
  }
  document.getElementById('toggle-fiche').onclick = e => {
    const board = document.getElementById('view-carte');
    const large = board.classList.toggle('wide');
    e.currentTarget.textContent = large ? 'Afficher la fiche' : 'Masquer la fiche';
    e.currentTarget.setAttribute('aria-pressed', large);
    if (state.view === 'struct' && cy) { cy.resize(); cy.fit(cy.elements(':visible'), 30); } else if (org) buildOrganic();
  };
  const ouvrirFiche = () => { const b = document.getElementById('view-carte'); if (b.classList.contains('wide')) document.getElementById('toggle-fiche').click(); };
  document.getElementById('v-struct').onclick = () => setView('struct');
  document.getElementById('v-orga').onclick = () => setView('orga');

  // ---------- Mise en évidence commune aux deux vues ----------
  function select(key) {
    if (state.view === 'struct') {
      if (!cy) return;
      const n = cy.getElementById(key); if (!n.length || !n.visible()) return;
      const keys = new Set(n.closedNeighborhood().nodes().map(x => x.id()));
      highlight(keys, new Set(n.connectedEdges().map(e => e.id())), key);
    } else if (org) {
      const keys = new Set([key]), edges = new Set();
      org.links.forEach(l => { if (l.source.key === key || l.target.key === key) { keys.add(l.source.key); keys.add(l.target.key); edges.add(l.id); } });
      highlight(keys, edges, key);
    }
  }
  function highlight(nodeKeys, edgeKeys, selKey) {
    edgeKeys = edgeKeys || new Set();
    const edgeOn = (id, s, t) => edgeKeys.has(id) || (edgeKeys.size === 0 && nodeKeys.has(s) && nodeKeys.has(t));
    if (state.view === 'struct' && cy) {
      cy.elements().removeClass('sel faded');
      if (!nodeKeys) return;
      cy.nodes().not('.theme').forEach(n => { if (!nodeKeys.has(n.id())) n.addClass('faded'); });
      cy.edges().forEach(e => { if (!edgeOn(e.id(), e.source().id(), e.target().id())) e.addClass('faded'); });
      if (selKey) cy.getElementById(selKey).addClass('sel');
    } else if (org) {
      org.node.classed('faded', d => !!nodeKeys && !nodeKeys.has(d.key)).classed('sel', d => d.key === selKey).classed('show', d => !!nodeKeys && nodeKeys.has(d.key));
      org.link.classed('faded', d => !!nodeKeys && !edgeOn(d.id, d.source.key, d.target.key));
    }
  }
  function clearHighlight() { highlight(null); }

  // ---------- Vue structurée (Cytoscape, disposition déterministe) ----------
  let cy = null;
  function cyStyle() {
    return [
      { selector:'node', style:{ 'font-family':'Urbanist, Segoe UI, sans-serif', 'text-wrap':'wrap', 'color':css('--ink') } },
      { selector:'node.idee', style:{ 'shape':'ellipse', 'width':'data(size)', 'height':'data(size)', 'background-color':'data(color)',
          'label':'data(label)', 'text-valign':'bottom', 'text-margin-y':8, 'font-size':21, 'font-weight':700, 'text-max-width':250,
          'text-background-color':css('--surface'), 'text-background-opacity':.8, 'text-background-padding':2, 'text-background-shape':'roundrectangle' } },
      { selector:'node.mine', style:{ 'font-size':24, 'font-weight':800, 'border-width':7, 'border-color':css('--cyan') } },
      { selector:'node.glow', style:{ 'underlay-color':css('--glow'), 'underlay-opacity':.35, 'underlay-padding':12, 'underlay-shape':'ellipse' } },
      { selector:'node.projet', style:{ 'shape':'round-rectangle', 'width':n => 10 + 5.6 * String(n.data('label')).length, 'height':20, 'padding':'4px',
          'background-color':css('--node-project'), 'border-width':1.5, 'border-color':'data(color)',
          'label':'data(label)', 'text-valign':'center', 'font-size':13, 'min-zoomed-font-size':5, 'color':css('--ink-2') } },
      { selector:'node.theme', style:{ 'shape':'round-rectangle', 'background-color':css('--surface-2'), 'background-opacity':.55,
          'border-width':1.5, 'border-style':'dashed', 'border-color':css('--line-strong'), 'padding':'18px',
          'label':'data(label)', 'text-valign':'top', 'text-halign':'center', 'text-margin-y':-10,
          'font-size':30, 'font-weight':800, 'color':css('--muted'), 'text-transform':'uppercase' } },
      { selector:'node.solution', style:{ 'shape':'hexagon', 'width':120, 'height':104, 'background-color':css('--cyan'),
          'border-width':3, 'border-color':css('--navy'), 'label':'data(label)', 'text-valign':'bottom', 'text-margin-y':6,
          'font-size':26, 'font-weight':800, 'text-max-width':340, 'color':css('--ink'),
          'text-background-color':css('--surface'), 'text-background-opacity':.85, 'text-background-padding':3, 'text-background-shape':'roundrectangle' } },
      { selector:'edge', style:{ 'curve-style':'bezier', 'width':1.2, 'line-color':css('--edge-project'), 'line-style':'dashed' } },
      { selector:'edge.ip', style:{ 'width':e => 0.8 * e.data('w') } },
      { selector:'edge.pp', style:{ 'line-style':'solid', 'line-color':css('--line-strong'), 'width':e => 0.8 * e.data('w') } },
      { selector:'edge.ii', style:{ 'width':e => 1.5 + 1.5 * e.data('force'), 'line-color':css('--edge-idea'), 'line-style':'solid', 'opacity':.85 } },
      { selector:'edge.consol', style:{ 'line-color':css('--emph') } },
      { selector:'edge.tension', style:{ 'line-color':css('--warn'), 'line-style':'dashed' } },
      { selector:'edge.glow', style:{ 'line-color':css('--glow') } },
      { selector:'edge.si', style:{ 'width':5, 'line-color':css('--cyan'), 'line-style':'solid', 'opacity':.7, 'curve-style':'straight' } },
      { selector:'.sel', style:{ 'border-width':9, 'border-color':css('--glow') } },
      { selector:'.faded', style:{ 'opacity':.1 } }
    ];
  }
  function buildStructured() {
    if (typeof cytoscape === 'undefined') {
      document.getElementById('graph').innerHTML = '<p class="hint" style="padding:28px">La vue structurée n\'a pas pu se charger. Essaie la vue organique ou les autres onglets.</p>';
      return;
    }
    const els = [];
    Object.entries(D.themes).forEach(([k, t]) => els.push({ group:'nodes', data:{ id:'t' + k, label:t.label, ref:k }, classes:'theme' }));
    D.idees.forEach(i => els.push({ group:'nodes', data:{ id:'i' + i.id, parent:'t' + themeOf[i.id], label:i.id + ' · ' + i.titre, ref:i.id, cat:i.categorie, color:catColor(i.categorie), size:Math.round(36 + 84 * forces[i.id] / maxF) },
      classes:'idee' + (i.source === 'carnet' ? ' mine' : '') + (isRecentIdea(i.id) ? ' glow' : '') }));
    usedProjects.forEach(pid => {
      const first = ideasOfProject(pid)[0];
      els.push({ group:'nodes', data:{ id:'p' + pid, parent:'t' + themeOf[first.id], label:projById[pid]?.nom || pid, ref:pid, cat:first.categorie, color:catColor(first.categorie) }, classes:'projet' });
    });
    D.solutions.forEach(s => {
      els.push({ group:'nodes', data:{ id:'s' + s.id, label:s.id + ' · ' + s.titre, ref:s.id }, classes:'solution' });
      s.idees.forEach(id => els.push({ group:'edges', data:{ id:'si' + s.id + '_' + id, source:'s' + s.id, target:'i' + id }, classes:'si' }));
    });
    D.liens.forEach(l => els.push({ group:'edges', data:{ id:l.key, source:'i' + l.de, target:'i' + l.a, force:l.force, ref:l.key },
      classes:'ii' + (l.acts.length > 1 ? ' consol' : '') + (l.type === 'tension' ? ' tension' : '') + (isRecentLink(l) ? ' glow' : '') }));
    D.idees.forEach(i => i.projets.forEach(x => els.push({ group:'edges', data:{ id:'u' + i.id + '_' + x.p, source:'i' + i.id, target:'p' + x.p, w:x.poids || 2 }, classes:'ip' })));
    D.liensProjets.forEach((l, k) => { if (usedProjects.includes(l.de) && usedProjects.includes(l.a)) els.push({ group:'edges', data:{ id:'pp' + k, source:'p' + l.de, target:'p' + l.a, w:l.poids }, classes:'pp' }); });
    cy = cytoscape({ container:document.getElementById('graph'), elements:els, style:cyStyle(), minZoom:.03, maxZoom:2.5 });
    cy.on('tap', 'node', e => {
      const n = e.target;
      if (n.hasClass('theme')) return showTheme(n.data('ref'));
      select(n.id());
      if (n.hasClass('idee')) showIdee(n.data('ref'));
      else if (n.hasClass('solution')) showSolution(n.data('ref'));
      else showProjet(n.data('ref'));
    });
    cy.on('tap', 'edge.ii', e => showLien(e.target.data('ref')));
    cy.on('tap', e => { if (e.target === cy) { clearHighlight(); showHome(); } });
    cy.on('mouseover', 'node, edge.ii', () => { document.getElementById('graph').style.cursor = 'pointer'; });
    cy.on('mouseout', 'node, edge.ii', () => { document.getElementById('graph').style.cursor = ''; });
  }
  function layoutStructured() {
    if (!cy) return;
    cy.batch(() => {
      cy.nodes('.idee').forEach(n => n.style('display', state.cats.has(n.data('cat')) ? 'element' : 'none'));
      cy.nodes('.projet').forEach(n => {
        const vis = n.neighborhood('node.idee').some(m => state.cats.has(m.data('cat')));
        n.style('display', state.projets && vis ? 'element' : 'none');
      });
      cy.nodes('.solution').forEach(n => n.style('display', n.neighborhood('node.idee').some(m => state.cats.has(m.data('cat'))) ? 'element' : 'none'));
      cy.nodes('.theme').forEach(n => n.style('display', n.children().some(c => c.hasClass('idee') && state.cats.has(c.data('cat'))) ? 'element' : 'none'));
    });
    cy.elements().removeClass('sel faded');
    const pos = computePositions();
    cy.nodes().not('.theme').forEach(n => { if (pos[n.id()]) n.position(pos[n.id()]); });
    cy.fit(cy.elements(':visible'), 30);
  }
  function computePositions() {
    const g = document.getElementById('graph');
    const ratio = g && g.clientHeight ? g.clientWidth / g.clientHeight : 1.5;
    const pos = {}, cellW = 560, cellH = 430, gap = 160, maxRowW = Math.min(8000, Math.max(2400, 3800 * ratio));
    const visibleIdea = id => state.cats.has(ideeById[id].categorie);
    let x0 = 0, y0 = 0, rowH = 0;
    for (const t of Object.values(D.themes)) {
      const ids = t.idees.filter(visibleIdea);
      if (!ids.length) continue;
      const cols = Math.ceil(Math.sqrt(ids.length)), rows = Math.ceil(ids.length / cols);
      const w = cols * cellW, h = rows * cellH;
      if (x0 > 0 && x0 + w > maxRowW) { x0 = 0; y0 += rowH + gap; rowH = 0; }
      ids.forEach((id, k) => { pos['i' + id] = { x: x0 + (k % cols) * cellW + cellW / 2, y: y0 + Math.floor(k / cols) * cellH + cellH / 2 }; });
      x0 += w + gap; rowH = Math.max(rowH, h);
    }
    const byIdea = {};
    usedProjects.forEach(pid => { const f = ideasOfProject(pid).find(i => pos['i' + i.id]); if (f) (byIdea[f.id] ||= []).push(pid); });
    for (const [iid, ps] of Object.entries(byIdea)) {
      const c = pos['i' + iid], r = 95 + 5 * ps.length;
      ps.forEach((pid, k) => {
        const a = -Math.PI / 2 + 2 * Math.PI * k / ps.length;
        pos['p' + pid] = { x: c.x + 1.3 * r * Math.cos(a), y: c.y + r * Math.sin(a) };
      });
    }
    const ys = Object.values(pos).map(p => p.y);
    const top = (ys.length ? Math.min(...ys) : 0) - 280;
    const sx = D.solutions.map(s => {
      const pts = s.idees.map(id => pos['i' + id]).filter(Boolean);
      return { id: s.id, x: pts.length ? pts.reduce((a, p) => a + p.x, 0) / pts.length : 0 };
    }).sort((a, b) => a.x - b.x);
    for (let k = 1; k < sx.length; k++) if (sx[k].x - sx[k - 1].x < 420) sx[k].x = sx[k - 1].x + 420;
    sx.forEach(s => { pos['s' + s.id] = { x: s.x, y: top }; });
    return pos;
  }

  // ---------- Vue organique (d3-force) ----------
  let org = null;
  function buildOrganic() {
    const svgEl = document.getElementById('organic');
    if (typeof d3 === 'undefined') { if (svgEl) svgEl.outerHTML = '<p class="hint" style="padding:28px">La vue organique n\'a pas pu se charger.</p>'; return; }
    if (org?.sim) org.sim.stop();
    const W = svgEl.clientWidth || 820, H = svgEl.clientHeight || 760;
    const svg = d3.select(svgEl); svg.selectAll('*').remove();
    svg.attr('viewBox', [0, 0, W, H]);
    const root = svg.append('g');
    const zoom = d3.zoom().scaleExtent([.2, 5]).on('zoom', e => { root.attr('transform', e.transform); root.classed('zoomed', e.transform.k > 1.6); });
    svg.call(zoom).on('dblclick.zoom', null);
    svg.on('click', e => { if (e.target === svgEl) { clearHighlight(); showHome(); } });

    const nodes = [], links = [];
    const vis = id => state.cats.has(ideeById[id].categorie);
    D.idees.filter(i => vis(i.id)).forEach(i => nodes.push({ key:'i' + i.id, kind:'idee', ref:i.id, r:9 + 30 * forces[i.id] / maxF,
      cat:i.categorie, theme:themeOf[i.id], mine:i.source === 'carnet', glow:isRecentIdea(i.id), label:i.id + ' · ' + i.titre }));
    const has = new Set(nodes.map(n => n.key));
    D.liens.forEach(l => { if (has.has('i' + l.de) && has.has('i' + l.a)) links.push({ id:l.key, source:'i' + l.de, target:'i' + l.a, kind:'ii', w:l.force, l }); });
    D.solutions.forEach(s => {
      const ids = s.idees.filter(id => has.has('i' + id)); if (!ids.length) return;
      nodes.push({ key:'s' + s.id, kind:'solution', ref:s.id, r:18, label:s.id + ' · ' + s.titre });
      ids.forEach(id => links.push({ id:'si' + s.id + '_' + id, source:'s' + s.id, target:'i' + id, kind:'si', w:1 }));
    });
    if (state.projets) {
      usedProjects.forEach(pid => {
        const ids = ideasOfProject(pid).filter(i => has.has('i' + i.id)); if (!ids.length) return;
        nodes.push({ key:'p' + pid, kind:'projet', ref:pid, r:4.5, label:projById[pid].nom, cat:ids[0].categorie, theme:themeOf[ids[0].id] });
        ids.forEach(i => links.push({ id:'u' + i.id + '_' + pid, source:'p' + pid, target:'i' + i.id, kind:'ip', w:i.projets.find(x => x.p === pid).poids || 2 }));
      });
      const hp = new Set(nodes.map(n => n.key));
      D.liensProjets.forEach((l, k) => { if (hp.has('p' + l.de) && hp.has('p' + l.a)) links.push({ id:'pp' + k, source:'p' + l.de, target:'p' + l.a, kind:'pp', w:l.poids }); });
    }
    const tk = Object.keys(D.themes), anchors = {};
    tk.forEach((k, ix) => { const a = -Math.PI / 2 + 2 * Math.PI * ix / tk.length; anchors[k] = { x: W / 2 + Math.cos(a) * W * .3, y: H / 2 + Math.sin(a) * H * .3 }; });
    const anchorOf = d => (d.theme ? anchors[d.theme] : { x: W / 2, y: H / 2 });
    nodes.forEach(n => { const a = anchorOf(n); n.x = a.x + (Math.random() - .5) * 80; n.y = a.y + (Math.random() - .5) * 80; });

    const link = root.append('g').selectAll('line').data(links).join('line')
      .attr('class', d => 'o-link ' + d.kind + (d.l && d.l.acts.length > 1 ? ' consol' : '') + (d.l?.type === 'tension' ? ' tension' : '') + (d.l && isRecentLink(d.l) ? ' glow' : ''))
      .attr('stroke-width', d => d.kind === 'ii' ? 1 + 0.9 * d.w : d.kind === 'si' ? 2.5 : 0.6 * d.w);
    link.filter(d => d.kind === 'ii').style('cursor', 'pointer').on('click', (e, d) => { e.stopPropagation(); showLien(d.id); });

    const node = root.append('g').selectAll('g').data(nodes).join('g')
      .attr('class', d => 'o-node ' + d.kind + (d.glow ? ' glow' : ''));
    node.filter(d => d.kind === 'solution').append('path')
      .attr('d', d => d3.line()([0, 1, 2, 3, 4, 5].map(k => [d.r * Math.cos(Math.PI / 3 * k), d.r * Math.sin(Math.PI / 3 * k)])) + 'Z')
      .style('fill', 'var(--cyan)').style('stroke', 'var(--navy)').style('stroke-width', 2);
    node.filter(d => d.kind !== 'solution').append('circle').attr('r', d => d.r)
      .style('fill', d => d.kind === 'projet' ? 'var(--node-project)' : `var(${catToken(d.cat)})`)
      .style('stroke', d => d.kind === 'projet' ? `var(${catToken(d.cat)})` : d.mine ? 'var(--cyan)' : 'var(--surface)')
      .style('stroke-width', d => d.kind === 'projet' ? 1.5 : d.mine ? 4 : 1.5);
    node.append('text').text(d => d.label)
      .attr('text-anchor', 'middle').attr('dy', d => d.r + (d.kind === 'projet' ? 10 : 14))
      .style('font-size', d => d.kind === 'projet' ? '9px' : d.kind === 'solution' ? '13px' : (11 + 4 * (d.r - 9) / 30).toFixed(1) + 'px');
    node.append('title').text(d => d.label);
    node.on('click', (e, d) => {
      e.stopPropagation();
      select(d.key);
      if (d.kind === 'idee') showIdee(d.ref); else if (d.kind === 'solution') showSolution(d.ref); else showProjet(d.ref);
    });

    const sim = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(d => d.key)
        .distance(d => d.kind === 'ii' ? 240 - 15 * d.w : d.kind === 'si' ? 120 : d.kind === 'ip' ? 22 + d.target.r : 60)
        .strength(d => d.kind === 'ii' ? .03 + .05 * d.w : d.kind === 'si' ? .2 : d.kind === 'ip' ? .6 : .06))
      .force('charge', d3.forceManyBody().distanceMax(800)
        .strength(d => d.kind === 'idee' ? -(120 + 1500 * forces[d.ref] / maxF) : d.kind === 'solution' ? -500 : -18))
      .force('collide', d3.forceCollide(d => d.r + (d.kind === 'projet' ? 2 : 10)).iterations(2))
      .force('x', d3.forceX(d => anchorOf(d).x).strength(d => d.kind === 'idee' ? .035 : .01))
      .force('y', d3.forceY(d => anchorOf(d).y).strength(d => d.kind === 'idee' ? .035 : .01))
      .alphaDecay(.02);
    node.call(d3.drag()
      .on('start', (e, d) => { if (!e.active) sim.alphaTarget(.25).restart(); d.fx = d.x; d.fy = d.y; })
      .on('drag', (e, d) => { d.fx = e.x; d.fy = e.y; })
      .on('end', (e, d) => { if (!e.active) sim.alphaTarget(0); d.fx = null; d.fy = null; }));
    let fitted = false;
    sim.on('tick', () => {
      link.attr('x1', d => d.source.x).attr('y1', d => d.source.y).attr('x2', d => d.target.x).attr('y2', d => d.target.y);
      node.attr('transform', d => `translate(${d.x},${d.y})`);
      if (!fitted && sim.alpha() < .08) {
        fitted = true;
        const xs = nodes.map(n => n.x), ys = nodes.map(n => n.y);
        const x0 = Math.min(...xs) - 60, x1 = Math.max(...xs) + 60, y0 = Math.min(...ys) - 60, y1 = Math.max(...ys) + 80;
        const k = Math.min(W / (x1 - x0), H / (y1 - y0), 1.4);
        svg.transition().duration(600).call(zoom.transform, d3.zoomIdentity.translate(W / 2 - k * (x0 + x1) / 2, H / 2 - k * (y0 + y1) / 2).scale(k));
      }
    });
    org = { sim, node, link, links, zoom, svg };
    if (state.focus) select(state.focus);
  }

  function applyFilters() {
    renderList();
    layoutStructured();
    if (state.view === 'orga') buildOrganic();
  }

  filters.addEventListener('click', e => {
    const b = e.target.closest('[data-cat]');
    if (b) {
      const k = b.dataset.cat;
      state.cats.has(k) ? state.cats.delete(k) : state.cats.add(k);
      b.setAttribute('aria-pressed', state.cats.has(k));
      applyFilters(); showHome();
    }
  });
  document.getElementById('f-projets').onclick = e => {
    state.projets = !state.projets;
    e.currentTarget.setAttribute('aria-pressed', state.projets);
    applyFilters();
  };
  document.getElementById('recentrer').onclick = () => {
    clearHighlight(); showHome();
    if (state.view === 'struct' && cy) cy.fit(cy.elements(':visible'), 30);
    else if (org) buildOrganic();
  };

  document.addEventListener('click', e => {
    const t = e.target.closest('[data-idee],[data-projet],[data-solution],[data-theme],[data-lien],[data-journal]'); if (!t) return;
    if (document.getElementById('view-carte').hidden) setTab('carte');
    ouvrirFiche();
    if (t.dataset.solution) { select('s' + t.dataset.solution); showSolution(t.dataset.solution); }
    else if (t.dataset.theme) showTheme(t.dataset.theme);
    else if (t.dataset.lien) showLien(t.dataset.lien);
    else if (t.dataset.journal) showJournal(t.dataset.journal);
    else if (t.dataset.idee) { select('i' + t.dataset.idee); showIdee(t.dataset.idee); }
    else { select('p' + t.dataset.projet); showProjet(t.dataset.projet); }
  });

  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const restyle = () => { if (cy) { cy.nodes().forEach(n => { if (n.data('cat')) n.data('color', catColor(n.data('cat'))); }); cy.style(cyStyle()); } };
  mq.addEventListener ? mq.addEventListener('change', restyle) : mq.addListener(restyle);
  new MutationObserver(restyle).observe(document.documentElement, { attributes:true, attributeFilter:['data-theme'] });

  buildStructured();
  renderLegend();
  applyFilters();
  renderProjets();
  renderPensees();
  showHome();
  return { select, highlight, clearHighlight, showIdee, showProjet, showSolution, showJournal, showHome, setTab, forces };
}
