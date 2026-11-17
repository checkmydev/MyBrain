// app.js · démarrage : export intégré (artefact) ou Supabase après connexion (site).
import { chargerDepuisSupabase, preparer } from './modele.js';
import { demarrer } from './carnet.js';
import { memoire, activerMemoireLiee } from './memoire.js';

const inline = JSON.parse(document.getElementById('data').textContent || '{}');
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
    const { data } = await sb.auth.getSession();
    if (!data.session) login.hidden = false;
    else {
      if (location.hash.includes('access_token')) history.replaceState(null, '', location.pathname);
      try {
        const D = preparer(await chargerDepuisSupabase(sb));
        if (!D.idees.length) throw new Error('vide');
        document.getElementById('logout').hidden = false;
        const api = demarrer(D, { memoireLiee: activerMemoireLiee(sb) });
        document.getElementById('tab-memoire').hidden = false;
        window.ouvrirMemoire = () => memoire(sb);
        window.MYBRAIN_API = { sb, D, ...api };
      } catch (err) {
        login.hidden = false;
        msg.textContent = "Connecté, mais les données ne sont pas lisibles : ce compte n'est pas propriétaire, ou le réseau n'a pas encore été importé.";
      }
    }
  }
}
