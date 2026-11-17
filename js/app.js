// app.js · démarrage : export intégré (artefact) ou Supabase après connexion (site).
import { chargerDepuisSupabase, preparer } from './modele.js';
import { demarrer } from './carnet.js';
import { memoire, activerMemoireLiee } from './memoire.js';
import { activerValider, enrichirPensees } from './valider.js';

const inline = JSON.parse(document.getElementById('data').textContent.trim() || '{}');
if (inline.idees) {
  demarrer(preparer(inline));
} else {
  const cfg = window.MYBRAIN;
  const login = document.getElementById('login');
  const msg = document.getElementById('login-msg');
  if (!cfg || !window.supabase) { login.hidden = false; msg.textContent = 'Configuration Supabase absente.'; }
  else {
    const sb = window.supabase.createClient(cfg.url, cfg.anonKey);
    document.getElementById('login-form').addEventListener('submit', async e => {
      e.preventDefault();
      const email = document.getElementById('login-email').value.trim();
      if (!email) return;
      msg.textContent = 'Envoi du lien…';
      const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname, shouldCreateUser: false } });
      msg.textContent = error ? "Ce compte n'est pas autorisé ou l'envoi a échoué. Vérifie l'adresse." : 'Lien envoyé. Ouvre le mail et clique sur le lien pour te connecter.';
    });
    document.getElementById('logout').onclick = async () => { await sb.auth.signOut(); location.reload(); };
    let session = null;
    try {
      const { data, error } = await sb.auth.getSession();
      if (error) throw error;
      session = data.session;
    } catch (err) {
      console.error(err);
      login.hidden = false;
      msg.textContent = 'Session illisible : reconnecte-toi.';
    }
    if (session === null && login.hidden) login.hidden = false;
    if (session) {
      if (location.hash.includes('access_token')) history.replaceState(null, '', location.pathname);
      let D = null;
      try {
        D = preparer(await chargerDepuisSupabase(sb));
        if (!D.idees.length) throw new Error('vide');
      } catch (err) {
        console.error(err);
        D = null;
        login.hidden = false;
        msg.textContent = "Connecté, mais les données ne sont pas lisibles : ce compte n'est pas propriétaire, ou le réseau n'a pas encore été importé.";
      }
      if (D) {
        document.getElementById('logout').hidden = false;
        const api = demarrer(D, { memoireLiee: activerMemoireLiee(sb) });
        document.getElementById('tab-memoire').hidden = false;
        window.ouvrirMemoire = () => memoire(sb);
        window.MYBRAIN_API = { sb, D, ...api };
        const tabValider = document.getElementById('tab-valider');
        tabValider.hidden = false;
        window.ouvrirValider = () => { if (!window.VALIDER_PRET) { activerValider(sb, api); window.VALIDER_PRET = true; } };
        enrichirPensees(sb);
        sb.schema('brain').from('propositions').select('id', { count: 'exact', head: true }).eq('statut', 'en_attente')
          .then(({ count }) => { if (count) tabValider.textContent = `Valider (${count})`; });
      }
    }
  }
}
