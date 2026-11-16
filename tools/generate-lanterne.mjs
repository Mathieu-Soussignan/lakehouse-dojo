// Génère data/lanterne.js : le jeu de données fictif « Banque Lanterne » du Lab SQL.
// Déterministe (graine fixe) : relancer le script redonne exactement les mêmes fichiers.
// Usage : node tools/generate-lanterne.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
let seed = 20260716;
const rnd = () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const pick = a => a[Math.floor(rnd() * a.length)];
const pad = (n, w) => String(n).padStart(w, '0');
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const noAccent = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const round2 = n => Math.round(n * 100) / 100;
const iso = d => d.toISOString().slice(0, 10);

/* ---------- agences ---------- */
const AG = [
  ['Paris 8e', '75008', 'Île-de-France'], ['Versailles', '78000', 'Île-de-France'], ['Créteil', '94000', 'Île-de-France'],
  ['Rennes', '35000', 'Bretagne'], ['Brest', '29200', 'Bretagne'], ['Vannes', '56000', 'Bretagne'],
  ['Toulouse', '31000', 'Occitanie'], ['Montpellier', '34000', 'Occitanie'], ['Perpignan', '66000', 'Occitanie'],
  ['Lyon', '69002', 'Auvergne-Rhône-Alpes'], ['Grenoble', '38000', 'Auvergne-Rhône-Alpes'], ['Annecy', '74000', 'Auvergne-Rhône-Alpes'],
  ['Lille', '59000', 'Hauts-de-France'], ['Amiens', '80000', 'Hauts-de-France'], ['Arras', '62000', 'Hauts-de-France'],
  ['Strasbourg', '67000', 'Grand Est'], ['Metz', '57000', 'Grand Est'], ['Nancy', '54000', 'Grand Est'],
  ['Bordeaux', '33000', 'Nouvelle-Aquitaine'], ['Poitiers', '86000', 'Nouvelle-Aquitaine'], ['Limoges', '87000', 'Nouvelle-Aquitaine'],
  ['Marseille', '13001', 'Provence-Alpes-Côte d\'Azur'], ['Nice', '06000', 'Provence-Alpes-Côte d\'Azur'], ['Avignon', '84000', 'Provence-Alpes-Côte d\'Azur']
].map((a, i) => ({ id: 'AG' + pad(i + 1, 2), ville: a[0], cp: a[1], region: a[2] }));
const agencesCsv = 'agence_id,nom,region\n' + AG.map(a => [a.id, a.ville, a.region].join(',')).join('\n') + '\n';

/* ---------- clients ---------- */
const NOMS = 'Moreau Lambert Fontaine Girard Roux Vidal Perrin Marchand Chevalier Faure Blanc Garnier Rolland Masson Clement Barbier Henry Leclerc Brun Meunier Dupuis Collet Renard Gauthier Nicolas Lopez Fabre Carpentier Guerin Boyer Lemaire Baron Pires Hubert Berger Jacquet Schmitt Weber Noel Aubert Bailly Colin Charpentier Descamps Etienne Giraud Huet Julien Klein Labbe Maillard Navarro Olivier Pichon Quentin Riviere Salmon Thibault Urbain Vasseur'.split(' ');
const PRENOMS = ['Louise', 'Hugo', 'Emma', 'Lucas', 'Chloé', 'Nathan', 'Léa', 'Théo', 'Manon', 'Gabriel', 'Camille', 'Arthur', 'Inès', 'Jules', 'Sarah', 'Adam', 'Zoé', 'Maxime', 'Clara', 'Antoine', 'Julie', 'Paul', 'Alice', 'Victor', 'Eva', 'Romain', 'Lina', 'Axel', 'Anaïs', 'Mathis'];
const agenceWeights = AG.flatMap((a, i) => Array(i % 5 === 0 ? 1 : i % 3 === 0 ? 4 : 2).fill(a));
const clients = NOMS.map((nom, i) => {
  const ag = pick(agenceWeights), prenom = pick(PRENOMS), r = rnd();
  return {
    id: 'CLI' + pad(i + 1, 4), nom: nom.toUpperCase(), prenom, agence: ag,
    email: noAccent(prenom) + '.' + noAccent(nom) + '@exemple.fr',
    naissance: new Date(Date.UTC(int(1950, 2003), int(0, 11), int(1, 28))),
    entree: new Date(Date.UTC(int(2008, 2025), int(0, 11), int(1, 28))),
    segment: r < 0.65 ? 'PARTICULIER' : r < 0.8 ? 'PATRIMONIAL' : 'PROFESSIONNEL'
  };
});
const dmy = d => pad(d.getUTCDate(), 2) + '/' + pad(d.getUTCMonth() + 1, 2) + '/' + d.getUTCFullYear();
const dirty = shuffle(clients.map((_, i) => i)).slice(0, 9);          // 9 noms mal formés
const noEmail = shuffle(clients.map((_, i) => i)).slice(0, 7);        // 7 e-mails manquants
const clientRows = clients.map((c, i) => {
  let nom = c.nom;
  const k = dirty.indexOf(i);
  if (k >= 0) nom = [c.nom.toLowerCase(), c.nom[0] + c.nom.slice(1).toLowerCase(), c.nom + ' ', ' ' + c.nom][k % 4];
  return [c.id, nom, c.prenom, noEmail.includes(i) ? '' : c.email, dmy(c.naissance), dmy(c.entree), c.segment, c.agence.id, c.agence.ville, c.agence.cp].join(';');
});
const dupClients = shuffle(clients.map((_, i) => i).filter(i => !dirty.includes(i))).slice(0, 4).map(i => clientRows[i]);
const clientsCsv = 'client_id;nom;prenom;email;date_naissance;date_entree;segment;agence_id;ville;code_postal\n' + clientRows.concat(dupClients).join('\n') + '\n';

/* ---------- comptes ---------- */
const comptes = []; let nc = 1;
clients.forEach(c => {
  const n = rnd() < 0.4 ? 2 : 1;
  for (let k = 0; k < n; k++) {
    const r = rnd();
    comptes.push({ id: 'CPT' + pad(1000000 + nc * 37, 7), client: c.id, type: k === 0 ? (c.segment === 'PROFESSIONNEL' ? 'PRO' : 'COURANT') : 'EPARGNE', devise: r < 0.88 ? 'EUR' : pick(['USD', 'GBP', 'CHF']), ouverture: iso(c.entree) });
    nc++;
  }
});
['CLI0099', 'CLI0098', 'CLI0097'].forEach(cid => { comptes.push({ id: 'CPT' + pad(1000000 + nc * 37, 7), client: cid, type: 'COURANT', devise: 'EUR', ouverture: '2019-04-02' }); nc++; });
const comptesCsv = 'compte_id,client_id,type_compte,devise_ref,date_ouverture\n' + comptes.map(c => [c.id, c.client, c.type, c.devise, c.ouverture].join(',')).join('\n') + '\n';

/* ---------- transactions ---------- */
const CAT = {
  CREDIT: [['salaire', 1400, 3200], ['virement_recu', 30, 900], ['remboursement', 8, 220]],
  DEBIT: [['courses', 6, 140], ['loyer', 380, 1500], ['carburant', 20, 95], ['restaurant', 9, 80], ['abonnement', 4, 40], ['retrait', 20, 200]],
  FRAIS: [['frais_tenue_compte', 1, 9], ['frais_carte', 2, 24]]
};
const CANAL = ['CARTE', 'VIREMENT', 'PRELEVEMENT', 'GUICHET', 'MOBILE'];
const WEIGHT = [0.9, 0.95, 1, 1.05, 1.1, 1.15]; // l'activité monte de janvier à juin
const acct = comptes.slice(0, comptes.length); // y compris les comptes sans client : leurs opérations existent
const tx = [];
for (let m = 0; m < 6; m++) {
  const n = Math.round(525 * WEIGHT[m]);
  for (let k = 0; k < n; k++) {
    const c = pick(acct), r = rnd(), type = r < 0.22 ? 'CREDIT' : r < 0.92 ? 'DEBIT' : 'FRAIS', cat = pick(CAT[type]);
    const amount = round2((cat[1] + rnd() * (cat[2] - cat[1])) * (c.devise === 'EUR' ? 1 : c.devise === 'GBP' ? 0.9 : 1.1)) * (type === 'CREDIT' ? 1 : -1);
    const day = int(1, [31, 28, 31, 30, 31, 30][m]);
    tx.push({
      m, ts: Date.UTC(2026, m, day, int(6, 21), int(0, 59), int(0, 59)), compte: c.id, montant: amount, devise: c.devise, type, categorie: cat[0],
      canal: type === 'FRAIS' ? 'PRELEVEMENT' : pick(CANAL), statut: 'VALIDEE', libelle: cat[0].replace('_', ' ')
    });
  }
}
tx.sort((a, b) => a.ts - b.ts).forEach((t, i) => { t.id = 'TX' + pad(i + 1, 7); });
const stamp = ts => new Date(ts).toISOString().replace('T', ' ').slice(0, 19);
const idx = shuffle(tx.map((_, i) => i));
const take = n => idx.splice(0, n);
const D = { montant_nul: 22, date_future: 17, compte_inconnu: 26, signe_incoherent: 31, devise_mal_formee: 40, doublon_exact: 35 };
take(D.montant_nul).forEach(i => { tx[i].montant = 0; });
take(D.date_future).forEach(i => { tx[i].ts = Date.UTC(2026, 6, int(1, 28), int(6, 21), int(0, 59), 0); tx[i].file = 5; });
take(D.compte_inconnu).forEach(i => { tx[i].compte = 'CPT9' + pad(int(0, 999999), 6); });
let signe = 0;
for (const i of idx.slice()) { if (signe >= D.signe_incoherent) break; if (tx[i].type === 'DEBIT') { tx[i].montant = Math.abs(tx[i].montant); idx.splice(idx.indexOf(i), 1); signe++; } }
take(D.devise_mal_formee).forEach(i => { const t = tx[i]; t.devise = [t.devise.toLowerCase(), ' ' + t.devise, t.devise + ' ', t.devise[0] + t.devise.slice(1).toLowerCase()][int(0, 3)]; });
const toRow = t => [t.id, t.compte, stamp(t.ts), t.montant.toFixed(2), t.devise, t.type, t.categorie, t.canal, t.statut, t.libelle].join(',');
const dupIdx = idx.slice(0, D.doublon_exact); // lignes encore intactes
const files = {};
const byFile = Array.from({ length: 6 }, () => []);
tx.forEach(t => byFile[t.file != null ? t.file : t.m].push(t));
dupIdx.forEach(i => { const t = tx[i], f = t.file != null ? t.file : t.m; byFile[f].splice(int(0, byFile[f].length), 0, t); });
const TXH = 'transaction_id,compte_id,horodatage,montant,devise,type_operation,categorie,canal,statut,libelle\n';
byFile.forEach((rows, m) => { files['transactions/2026-' + pad(m + 1, 2) + '.csv'] = TXH + rows.map(toRow).join('\n') + '\n'; });

/* ---------- taux de change (jours ouvrés, sauf trois jours fériés) ---------- */
const FERIES = ['2026-01-01', '2026-04-06', '2026-05-01'];
const rates = { USD: 1.08, GBP: 0.86, CHF: 0.95 }, tauxRows = [];
for (let d = Date.UTC(2026, 0, 1); d <= Date.UTC(2026, 5, 30); d += 864e5) {
  const dt = new Date(d), wd = dt.getUTCDay();
  if (wd === 0 || wd === 6 || FERIES.includes(iso(dt))) continue;
  for (const cur of ['USD', 'GBP', 'CHF']) { rates[cur] *= 1 + (rnd() - 0.5) * 0.008; tauxRows.push([iso(dt), cur, rates[cur].toFixed(4)].join(',')); }
}
const tauxCsv = 'jour,devise,taux\n' + tauxRows.join('\n') + '\n';

/* ---------- arrivées de juillet : nouvelles opérations + annulations ---------- */
const clean = tx.filter(t => t.montant !== 0 && t.ts < Date.UTC(2026, 6, 1) && !t.compte.startsWith('CPT9') && !(t.type === 'DEBIT' && t.montant > 0));
const cancellable = shuffle(clean.filter(t => t.type !== 'FRAIS'));
const arrivals = {}; let nextId = tx.length + 1; const newJuly = [];
for (let d = 1; d <= 3; d++) {
  const rows = [];
  for (let k = 0; k < 48; k++) {
    const c = pick(comptes.filter(x => !x.client.match(/CLI009[789]/))), r = rnd(), type = r < 0.25 ? 'CREDIT' : 'DEBIT', cat = pick(CAT[type]);
    const t = { id: 'TX' + pad(nextId++, 7), ts: Date.UTC(2026, 6, d, int(6, 21), int(0, 59), int(0, 59)), compte: c.id, montant: round2(cat[1] + rnd() * (cat[2] - cat[1])) * (type === 'CREDIT' ? 1 : -1), devise: c.devise, type, categorie: cat[0], canal: pick(CANAL), statut: 'VALIDEE', libelle: cat[0].replace('_', ' ') };
    rows.push(t); newJuly.push(t);
  }
  const cancels = cancellable.splice(0, 8).map(t => ({ ...t, statut: 'ANNULEE' }));
  if (d === 3) { cancels.push({ ...newJuly[0], statut: 'ANNULEE' }); cancels.push({ ...arrivals.cancelled1[0] }); } // une annulation d'une opération de juillet, une déjà annulée
  if (d === 1) arrivals.cancelled1 = cancels.slice(0, 1);
  arrivals['2026-07-0' + d] = { rows: rows.concat(cancels), news: rows.length, cancels: cancels.length };
  files['arrivees/transactions_2026-07-0' + d + '.csv'] = TXH + shuffle(rows.concat(cancels)).map(toRow).join('\n') + '\n';
}
files['clients.csv'] = clientsCsv; files['comptes.csv'] = comptesCsv; files['agences.csv'] = agencesCsv; files['taux_change.csv'] = tauxCsv;

const stats = { ...D, lignes_transactions: Object.keys(files).filter(f => f.startsWith('transactions/')).reduce((n, f) => n + files[f].trim().split('\n').length - 1, 0), clients_lignes: clientRows.length + dupClients.length, clients_distincts: clients.length, noms_mal_formes: dirty.length, emails_manquants: noEmail.length, comptes: comptes.length, agences: AG.length };
mkdirSync(join(ROOT, 'data'), { recursive: true });
writeFileSync(join(ROOT, 'data', 'lanterne.js'), '// Fichier généré par tools/generate-lanterne.mjs : ne pas modifier à la main.\n// Données entièrement fictives (Banque Lanterne).\nwindow.LANTERNE = ' + JSON.stringify({ stats, files }) + ';\n');
console.log(JSON.stringify(stats, null, 1));
console.log('taille data/lanterne.js :', Math.round(Object.values(files).join('').length / 1024) + ' Ko de CSV');
