// memoire.js · recherche par le sens (RAG), mémoire liée aux fiches et onglet Mémoire (site connecté uniquement).
// ---------- RAG (site connecté uniquement) ----------
let extracteur = null;
export async function vectoriser(texte, prefixe = 'query: ') {
  if (!extracteur) {
    const { pipeline } = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.2');
    extracteur = await pipeline('feature-extraction', 'Xenova/multilingual-e5-small', { dtype: 'q8' });
  }
  const out = await extracteur(prefixe + texte, { pooling: 'mean', normalize: true });
  return Array.from(out.data);
}
export const vectoriserQuestion = async q => '[' + (await vectoriser(q, 'query: ')).map(x => x.toFixed(5)).join(',') + ']';
export function activerMemoireLiee(sb) {
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  return async el => {
    if (!el) return;
    el.innerHTML = '<h3>Mémoire liée</h3><p class="hint">Recherche des échanges proches…</p>';
    const r = await sb.schema('brain').rpc('memoire_proche', { cle_noeud: el.dataset.cle, n: 40 });
    if (r.error) { el.innerHTML = '<h3>Mémoire liée</h3><p class="hint">Indisponible.</p>'; return; }
    const vus = new Map();
    r.data.forEach(x => { if (!vus.has(x.trace_id)) vus.set(x.trace_id, x); });
    const top = [...vus.values()].slice(0, 8);
    if (!top.length) { el.innerHTML = '<h3>Mémoire liée</h3><p class="hint">Aucun échange vectorisé pour l\'instant.</p>'; return; }
    const lien = x => x.source_id === 'outlook-agilos' ? `https://outlook.office365.com/owa/?ItemID=${encodeURIComponent(x.ref_source)}&exvsurl=1&viewmodel=ReadMessageItem` : `https://mail.google.com/mail/#all/${encodeURIComponent(x.ref_source)}`;
    el.innerHTML = `<h3>Mémoire liée (par le sens)</h3><ul class="items">${top.map(x => `<li><a class="linklike" href="${lien(x)}" target="_blank" rel="noopener">${esc(x.titre || '(sans sujet)')}</a> · ${Math.round(x.score * 100)} %<small>${esc(new Date(x.date).toLocaleDateString('fr-BE'))} · ${esc(x.fragment.slice(0, 180))}…</small></li>`).join('')}</ul>`;
  };
}

// ---------- Mémoire (site connecté uniquement) ----------
export async function memoire(sb) {
  const v = document.getElementById('view-memoire');
  if (v.dataset.pret) return;
  v.dataset.pret = '1';
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const jour = d => d ? new Date(d).toLocaleDateString('fr-BE', { year:'numeric', month:'short', day:'numeric' }) : '';
  v.innerHTML = `<div class="mem-head"><h2>Mémoire</h2><span class="hint" id="mem-stats">Chargement…</span></div>
    <div class="filters"><label class="lbl" for="mem-q">Chercher</label><input id="mem-q" type="search" placeholder="Personne ou organisation" style="flex:1 1 220px;max-width:360px;border:1.5px solid var(--line-strong);background:var(--surface);color:var(--ink);border-radius:12px;padding:8px 12px;font:500 14px var(--font)"></div>
    <form class="filters" id="mem-sem-form"><label class="lbl" for="mem-sem">Par le sens</label><input id="mem-sem" type="search" placeholder="Pose une question : « problèmes de licences Qlik chez un client »" style="flex:1 1 320px;max-width:560px;border:1.5px solid var(--line-strong);background:var(--surface);color:var(--ink);border-radius:12px;padding:8px 12px;font:500 14px var(--font)"><button class="btn-ghost" type="submit">Chercher</button><span class="hint" id="mem-sem-msg"></span></form>
    <div class="mem-grid">
      <div class="panel mem-col"><h3>Organisations</h3><ul class="items" id="mem-orgs"></ul></div>
      <div class="panel mem-col"><h3>Personnes</h3><ul class="items" id="mem-pers"></ul></div>
      <div class="panel mem-col mem-fil"><h3 id="mem-fil-t">Derniers échanges</h3><ul class="items" id="mem-fil"></ul></div>
    </div>`;
  const m = sb.schema('memoire');
  const ok = r => { if (r.error) throw r.error; return r.data; };
  try {
    const st = ok(await m.from('v_stats').select('*').single());
    document.getElementById('mem-stats').textContent = st.traces
      ? `${st.traces.toLocaleString('fr-BE')} échanges · ${st.personnes.toLocaleString('fr-BE')} personnes · ${st.organisations.toLocaleString('fr-BE')} organisations · du ${jour(st.debut)} au ${jour(st.fin)}`
      : 'La mémoire est encore vide : la collecte des mails est en cours.';
  } catch (e) { document.getElementById('mem-stats').textContent = 'Mémoire illisible pour ce compte.'; return; }

  const traces = {};
  const ligneTrace = t => { traces[t.id] = t; return `<li class="tr" data-trace="${t.id}"><span class="d">${esc(jour(t.date))}</span> <span class="sens ${t.sens === 'envoye' ? 'envoye' : ''}">${t.sens === 'envoye' ? 'envoyé' : 'reçu'}</span><b class="tt">${esc(t.titre || '(sans sujet)')}</b>${t.resume ? `<small>${esc(t.resume)}</small>` : ''}<div class="tr-detail" hidden></div></li>`; };
  const { data: sess } = await sb.auth.getSession();
  const moi = sess?.session?.user?.email || '';
  const lienBoite = t => t.source_id === 'outlook-agilos'
    ? { url: `https://outlook.office365.com/owa/?ItemID=${encodeURIComponent(t.ref_source)}&exvsurl=1&viewmodel=ReadMessageItem`, label: 'Ouvrir dans Outlook' }
    : t.source_id === 'gmail-perso' ? { url: `https://mail.google.com/mail/?authuser=${encodeURIComponent(moi)}#all/${encodeURIComponent(t.ref_source)}`, label: 'Ouvrir dans Gmail' } : null;
  async function detailTrace(li) {
    const box = li.querySelector('.tr-detail');
    if (!box.hidden) { box.hidden = true; return; }
    box.hidden = false;
    if (box.dataset.pret) return;
    box.dataset.pret = '1';
    box.innerHTML = 'Chargement…';
    const t = traces[li.dataset.trace];
    const [part, org] = await Promise.all([
      m.from('trace_personnes').select('role, personnes(nom, emails)').eq('trace_id', t.id).then(ok),
      t.organisation_id ? m.from('organisations').select('nom').eq('id', t.organisation_id).maybeSingle().then(ok) : Promise.resolve(null)]);
    const qui = r => part.filter(x => x.role === r && x.personnes).map(x => `${esc(x.personnes.nom)} <span class="d">${esc((x.personnes.emails || [])[0] || '')}</span>`).join(', ');
    const lien = lienBoite(t);
    const pj = (t.pieces_jointes || []).length;
    box.innerHTML = `<dl class="tr-dl">
        <dt>Date</dt><dd>${esc(new Date(t.date).toLocaleString('fr-BE', { dateStyle:'full', timeStyle:'short' }))}</dd>
        <dt>Source</dt><dd>${t.source_id === 'outlook-agilos' ? 'Outlook Agilos' : t.source_id === 'gmail-perso' ? 'Gmail perso' : esc(t.source_id)}</dd>
        ${qui('de') ? `<dt>De</dt><dd>${qui('de')}</dd>` : `<dt>De</dt><dd>${t.sens === 'envoye' ? 'toi' : '—'}</dd>`}
        ${qui('a') ? `<dt>À</dt><dd>${qui('a')}</dd>` : ''}
        ${qui('cc') ? `<dt>Cc</dt><dd>${qui('cc')}</dd>` : ''}
        ${org ? `<dt>Organisation</dt><dd>${esc(org.nom)}</dd>` : ''}
        ${pj ? `<dt>Pièces jointes</dt><dd>oui (non lues)</dd>` : ''}
        <dt>Résumé</dt><dd>${t.resume ? esc(t.resume) : '<span class="d">pas encore résumé</span>'}</dd>
      </dl>${lien ? `<a class="btn-ghost tr-open" href="${lien.url}" target="_blank" rel="noopener">${lien.label} ↗</a>` : ''}`;
  }
  async function fil(titre, requete) {
    document.getElementById('mem-fil-t').textContent = titre;
    const ul = document.getElementById('mem-fil');
    ul.innerHTML = '<li>Chargement…</li>';
    const rows = await requete();
    ul.innerHTML = rows.map(ligneTrace).join('') || '<li>Aucun échange.</li>';
  }
  const derniers = () => fil('Derniers échanges', async () => ok(await m.from('traces').select('id,source_id,ref_source,date,sens,titre,resume,pieces_jointes,organisation_id').order('date', { ascending:false }).limit(80)));
  async function listes(q) {
    let qo = m.from('v_organisations').select('id,nom,nb_traces,derniere').order('nb_traces', { ascending:false }).limit(60);
    let qp = m.from('v_personnes').select('id,nom,organisation,nb_traces,derniere_trace').order('nb_traces', { ascending:false }).limit(80);
    if (q) { const k = `%${q.replace(/[%,()]/g, ' ')}%`; qo = qo.ilike('nom', k); qp = qp.or(`nom.ilike.${k},organisation.ilike.${k}`); }
    const [orgs, pers] = await Promise.all([qo.then(ok), qp.then(ok)]);
    document.getElementById('mem-orgs').innerHTML = orgs.map(o => `<li data-org="${o.id}" data-nom="${esc(o.nom)}"><span class="n">${o.nb_traces}</span><b>${esc(o.nom)}</b><small>dernier échange ${esc(jour(o.derniere))}</small></li>`).join('') || '<li>Aucune organisation.</li>';
    document.getElementById('mem-pers').innerHTML = pers.map(p => `<li data-pers="${p.id}" data-nom="${esc(p.nom)}"><span class="n">${p.nb_traces}</span><b>${esc(p.nom)}</b><small>${esc(p.organisation || 'personnel')} · ${esc(jour(p.derniere_trace))}</small></li>`).join('') || '<li>Aucune personne.</li>';
  }
  v.addEventListener('click', async e => {
    if (e.target.closest('.tr-open')) return;
    const tr = e.target.closest('[data-trace]'); if (tr) { if (!e.target.closest('.tr-detail')) detailTrace(tr); return; }
    const li = e.target.closest('[data-org],[data-pers]'); if (!li) return;
    v.querySelectorAll('.mem-col li.on').forEach(x => x.classList.remove('on')); li.classList.add('on');
    if (li.dataset.org) await fil(`Échanges avec ${li.dataset.nom}`, async () => ok(await m.from('traces').select('id,source_id,ref_source,date,sens,titre,resume,pieces_jointes,organisation_id').eq('organisation_id', li.dataset.org).order('date', { ascending:false }).limit(300)));
    else await fil(`Échanges avec ${li.dataset.nom}`, async () => ok(await m.from('trace_personnes').select('traces(id,source_id,ref_source,date,sens,titre,resume,pieces_jointes,organisation_id)').eq('personne_id', li.dataset.pers).limit(500))
      .map(x => x.traces).filter(Boolean).sort((a, b) => b.date.localeCompare(a.date)));
  });
  document.getElementById('mem-sem-form').addEventListener('submit', async e => {
    e.preventDefault();
    const q = document.getElementById('mem-sem').value.trim(); if (!q) return;
    const msg = document.getElementById('mem-sem-msg');
    msg.textContent = 'Préparation du modèle (la première fois, téléchargement d\'environ 120 Mo)…';
    try {
      const v = await vectoriserQuestion(q);
      msg.textContent = '';
      await fil(`Par le sens : « ${q} »`, async () => {
        const rows = ok(await m.rpc('chercher', { q: v, n: 60 }));
        const vus = new Map();
        rows.forEach(r => { if (!vus.has(r.trace_id)) vus.set(r.trace_id, { id: r.trace_id, date: r.date, sens: r.sens, titre: r.titre, source_id: r.source_id, ref_source: r.ref_source, organisation_id: r.organisation_id, resume: `${Math.round(r.score * 100)} % · ${r.fragment.slice(0, 220)}…`, pieces_jointes: [] }); });
        return [...vus.values()];
      });
    } catch (err) { msg.textContent = 'Recherche impossible : ' + (err.message || err); }
  });
  let tempo;
  document.getElementById('mem-q').addEventListener('input', e => { clearTimeout(tempo); tempo = setTimeout(() => listes(e.target.value.trim()), 300); });
  await Promise.all([listes(''), derniers()]);
}
