// modele.js · charge le cerveau (Supabase ou export intégré) et prépare les index. Les forces viennent des données (vues SQL ou export v3).
export async function chargerDepuisSupabase(sb) {
  const q = (t, o = 'ordre') => sb.schema('brain').from(t).select('*').order(o).then(r => { if (r.error) throw r.error; return r.data; });
  const [cats, themes, types, idees, projets, ip, pensees, acts, liens, lp, sols, si] = await Promise.all([
    q('categories'), q('themes'), q('types_lien', 'id'), q('v_idees'), q('projets'), q('idee_projets'), q('pensees'),
    q('pensee_activations', 'pensee_id'), q('v_liens'), q('liens_projets', 'de'), q('solutions'), q('solution_idees')]);
  const D = { version: 3, categories: {}, themes: {}, typesLien: {} };
  cats.forEach(c => { D.categories[c.id] = { label: c.label, token: c.token }; });
  themes.forEach(t => { D.themes[t.id] = { label: t.label, idees: idees.filter(i => i.theme === t.id).map(i => i.id) }; });
  types.forEach(t => { D.typesLien[t.id] = { label: t.label, desc: t.description }; });
  D.idees = idees.map(i => ({ id: i.id, source: i.source, categorie: i.categorie, titre: i.titre, date: i.date_idee, statut: i.statut,
    statutLabel: i.statut_label, type: i.type, pitch: i.pitch, probleme: i.probleme, contexte: i.contexte, forces: i.forces, risques: i.risques,
    construire: i.construire, questions: i.questions, etapes: i.etapes, force: i.force, niveau: i.niveau,
    projets: ip.filter(x => x.idee_id === i.id).map(x => ({ p: x.projet_id, usage: x.usage, poids: x.poids })) }));
  D.projets = projets.map(p => ({ id: p.id, nom: p.nom, dossier: p.dossier, famille: p.famille, resume: p.resume, contexte: p.contexte, lecons: p.lecons }));
  D.liens = liens.map(l => ({ de: l.de, a: l.a, type: l.type, poids: l.poids, nature: l.nature, apport: l.apport, cree: l.cree,
    force: Number(l.force), activations: l.activations, derniereActivation: l.derniere_activation }));
  D.liensProjets = lp.map(l => ({ de: l.de, a: l.a, nature: l.nature, poids: l.poids }));
  D.solutions = sols.map(s => ({ id: s.id, titre: s.titre, statut: s.statut, statutLabel: s.statut_label, pitch: s.pitch,
    idees: si.filter(x => x.solution_id === s.id).map(x => x.idee_id) }));
  D.journal = pensees.map(j => ({ id: j.id, date: j.date, type: j.type, titre: j.titre, note: j.note,
    active: acts.filter(a => a.pensee_id === j.id).map(a => a.idee_id) }));
  return D;
}

// Index et champs dérivés attendus par carnet.js. Les forces ne sont plus recalculées ici.
export function preparer(D) {
  const jIdx = Object.fromEntries(D.journal.map((j, k) => [j.id, k]));
  D.liens.forEach((l, k) => {
    l.key = 'l' + k;
    l.acts = l.activations ?? [l.cree];
    l.force = l.force != null && Number.isFinite(+l.force) ? +l.force : Number(l.poids);
    l.last = Math.max(...l.acts.map(a => jIdx[a] ?? 0));
  });
  D.forces = Object.fromEntries(D.idees.map(i => [i.id, Number(i.force) || 0]));
  return D;
}
