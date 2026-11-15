// Rappel du dimanche : lit les abonnements par locus_rappel(cle) (supabase/rappel.sql) et envoie la notification.
import webpush from 'web-push';

const SB = 'https://rzcpjsffpvuvbdtqymms.supabase.co', KEY = 'sb_publishable_mJNXDji0NMOmLFqo3GusGg_JBkFhJmC';
const cle = process.env.LOCUS_CLE, horaire = process.env.HORAIRE || '', test = !horaire;

if (!cle) { console.log('::warning::Secret LOCUS_CLE manquant : rien envoyé.'); process.exit(0); }
if (!test) {
  const off = new Intl.DateTimeFormat('en', { timeZone: 'Europe/Zurich', timeZoneName: 'shortOffset' })
    .formatToParts(new Date()).find(p => p.type === 'timeZoneName').value;   // « GMT+1 » ou « GMT+2 »
  const bon = off === 'GMT+2' ? '7 7 * * 0' : '7 8 * * 0';
  if (horaire !== bon) { console.log(`Pas le bon horaire (${horaire}, Zurich ${off}) : rien à faire.`); process.exit(0); }
}
const r = await fetch(SB + '/rest/v1/rpc/locus_rappel', {
  method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ cle })
});
const d = await r.json().catch(() => null);
if (!r.ok || !d) { console.log('::error::locus_rappel :', r.status, JSON.stringify(d)); process.exit(1); }
if (d.bilan_fait && !test) { console.log(`Bilan de ${d.semaine} déjà rempli : pas de notification.`); process.exit(0); }
const msg = JSON.stringify({ title: 'Ta semaine', body: 'Calme, énergie, productivité : trois touches.',
  url: 'bibliotheque/?bilan=1', tag: 'bilan' });
let ok = 0;
for (const a of d.abonnements || []) {
  try {
    await webpush.sendNotification(a.sub, msg, { TTL: 12 * 3600, urgency: 'normal',
      vapidDetails: { subject: 'https://gottonic.github.io/orga/', publicKey: a.pub, privateKey: a.priv } });
    ok++; console.log('Envoyé :', a.appareil);
  } catch (e) { console.log(`::warning::${a.appareil} : ${e.statusCode || ''} ${e.body || e.message}`); }
}
console.log(`${ok} notification(s) sur ${(d.abonnements || []).length} appareil(s), semaine ${d.semaine}.`);
