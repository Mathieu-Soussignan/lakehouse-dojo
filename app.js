// Lakehouse Dojo : navigation, parcours personnalisés Keyrus, progression, quiz, flashcards, classement d'équipe.
(function () {
  const D = window.DOJO, SIMS = window.SIMS, KEY = 'lakehouse-dojo-v1', DAY = 864e5;
  const LEITNER = [0, 1, 3, 7, 14, 30];
  const blank = () => ({ done: {}, labs: {}, quiz: {}, cards: {}, notes: {}, asked: {}, projet: {}, sims: {}, board: false, track: 'all', peers: [], comparePeer: null, sprint: {}, lab: { done: {}, hints: {}, drafts: {}, follow: {} } });
  let S = blank();
  try { Object.assign(S, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { } };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const $ = id => document.getElementById(id);
  const mod = id => D.modules.find(m => m.id === id);
  const simsOf = m => SIMS.filter(s => s.mod === m.id);
  const num = m => D.modules.indexOf(m) + 1;
  const PARTS = { J1: 'Les fondations', J2: 'Construire', J3: 'Livrer', 'Après': 'Passer expert' };
  const DOMAINS = [['Plateforme', ['m1', 'm2']], ['Gouvernance', ['m3']], ['Développement', ['m4', 'm5']], ['Delta Lake', ['m6']], ['Orchestration', ['m7', 'm9']], ['SQL et BI', ['m8']], ['Production', ['m10', 'm11']]];
  const BELTS = [[0, 'blanche', '#f3f2ec'], [100, 'jaune', '#f0c531'], [250, 'orange', '#ea8a2d'], [450, 'verte', '#3f9b5a'], [700, 'bleue', '#2f72cf'], [1000, 'marron', '#7b4d2c'], [1300, 'noire', '#20201f']];

  const allCards = () => D.modules.flatMap(m => m.cards.map((c, i) => ({ id: m.id + '-' + i, m, q: c[0], a: c[1] })));
  const dueCards = () => allCards().filter(c => !S.cards[c.id] || S.cards[c.id].d <= Date.now());
  const anchored = () => Object.values(S.cards).filter(c => c.b >= 2).length;
  const quizOk = m => (S.quiz[m.id] || 0) >= 0.8;
  const proofs = m => [!!S.done[m.id], simsOf(m).every(s => S.sims[s.id]), !!S.labs[m.id], quizOk(m)];
  const cnt = o => Object.values(o).filter(Boolean).length;
  const labDone = id => !!(S.lab && S.lab.done && S.lab.done[id] != null);
  const labXp = () => Object.values((S.lab && S.lab.done) || {}).reduce((a, b) => a + b, 0);
  const xp = () => cnt(S.done) * 20 + cnt(S.labs) * 40 + D.modules.filter(quizOk).length * 30 + cnt(S.sims) * 15 + anchored() * 2 + labXp() + ((S.exam && S.exam.xp) || 0);
  const beltIdx = v => BELTS.reduce((k, b, i) => v >= b[0] ? i : k, 0);
  const beltHtml = i => '<span class="belt" style="--belt:' + BELTS[i][2] + '" role="img" aria-label="Ceinture ' + BELTS[i][1] + '"></span>';
  const curTrack = () => (D.tracks && D.tracks[S.track]) ? S.track : 'all';

  const SEALS = [
    ['P', 'Premier pas', 'Un module maîtrisé', () => cnt(S.done) >= 1],
    ['M', 'Mains dans le moteur', 'Trois labs réalisés', () => cnt(S.labs) >= 3],
    ['S', 'Sans faute', 'Un quiz à 100 %', () => Object.values(S.quiz).some(v => v === 1)],
    ['E', 'Explorateur', 'Six missions de simulateur réussies', () => cnt(S.sims) >= 6],
    ['J', 'Gardien du journal', 'Mission Delta réussie', () => !!S.sims.delta],
    ['U', 'Chirurgien Spark', 'Simulateurs Expectations et Spark UI réussis', () => !!(S.sims.dlt && S.sims.sparkui)],
    ['L', 'Mémoire longue', 'Vingt flashcards ancrées', () => anchored() >= 20],
    ['C', 'Socle complet', 'Huit premiers modules maîtrisés', () => D.modules.slice(0, 8).every(m => S.done[m.id])],
    ['D', 'Détective', 'Registre des défauts établi', () => labDone('m1')],
    ['Z', 'Bilan bouclé', 'Silver, rejets et doublons réconciliés', () => labDone('m3')],
    ['I', 'Idempotent', 'Upsert rejouable sans dégât', () => labDone('m7')],
    ['K', 'Maître Lanterne', 'Lot de 3 jours et alerte SQL validés', () => labDone('m8') && labDone('m9')],
    ['Y', 'Bilingue Spark', 'École PySpark (6 paliers) ou 3 missions validées en PySpark', () => ['s1', 's2', 's3', 's4', 's5', 's6'].every(labDone) || Object.keys((S.lab && S.lab.pyDone) || {}).length >= 3],
    ['X', 'Certifiable', 'Examen blanc réussi à 70 %', () => !!(S.exam && S.exam.best >= 0.7)],
    ['N', 'Ceinture noire', '1 300 XP atteints', () => xp() >= 1300]
  ];
  const earned = () => SEALS.filter(s => s[3]()).map(s => s[1]);

  /* ---------- récompenses ---------- */
  let prev = { xp: xp(), belt: beltIdx(xp()), seals: earned() };
  function toast(msg) {
    const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; $('toasts').appendChild(t);
    setTimeout(() => t.remove(), 3200);
  }
  function confetti() {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const c = document.createElement('canvas'); c.className = 'confetti'; document.body.appendChild(c);
    const w = c.width = innerWidth, h = c.height = innerHeight, g = c.getContext('2d');
    const P = Array.from({ length: 90 }, (_, i) => ({ x: w / 2, y: h * 0.35, vx: (Math.random() - 0.5) * 14, vy: -Math.random() * 12 - 3, c: BELTS[1 + i % 5][2], r: 4 + Math.random() * 4, a: Math.random() * 6 }));
    let n = 0;
    setTimeout(() => c.remove(), 3500);
    (function tick() {
      g.clearRect(0, 0, w, h);
      P.forEach(p => { p.x += p.vx; p.y += p.vy; p.vy += 0.35; p.a += 0.2; g.save(); g.translate(p.x, p.y); g.rotate(p.a); g.fillStyle = p.c; g.fillRect(-p.r, -p.r / 2, p.r * 2, p.r); g.restore(); });
      if (++n < 110) requestAnimationFrame(tick); else c.remove();
    })();
  }
  function reward() {
    const v = xp(), b = beltIdx(v), s = earned();
    if (v > prev.xp) toast('+' + (v - prev.xp) + ' XP');
    s.filter(x => !prev.seals.includes(x)).forEach(x => toast('Sceau obtenu : ' + x));
    if (b > prev.belt) { toast('Nouvelle ceinture : ' + BELTS[b][1]); confetti(); }
    prev = { xp: v, belt: b, seals: s };
    pushScore();
  }

  /* ---------- rail ---------- */
  const TABS = [['', 'Accueil'], ['parcours', 'Parcours'], ['atelier', 'Simulateurs'], ['labo', 'Labo SQL'], ['examen', 'Examen blanc'], ['quiz', 'Quiz'], ['cartes', 'Flashcards'], ['labs', 'Labs Databricks'], ['memo', 'Mémo & Playbooks']];
  const ctx = {
    get S() { return S; }, save, confetti, reward, toast, profile,
    replaceS(s) { S = Object.assign(blank(), s); prev = { xp: xp(), belt: beltIdx(xp()), seals: earned() }; save(); render(); }
  };
  function profile() {
    const v = xp(), b = beltIdx(v), score = ms => ms.reduce((t, id) => t + proofs(mod(id)).filter(Boolean).length, 0) / (ms.length * 4);
    return { xp: v, belt: { name: BELTS[b][1], color: BELTS[b][2] }, seals: SEALS.filter(s => s[3]()).map(s => ({ l: s[0], name: s[1] })), missions: Object.keys((S.lab && S.lab.done) || {}).length, sims: cnt(S.sims), domains: DOMAINS.map(d => ({ n: d[0], score: score(d[1]) })) };
  }
  let tab = '';
  function rail() {
    const v = xp(), b = beltIdx(v), nx = BELTS[b + 1], lo = BELTS[b][0], due = dueCards().length;
    const trk = D.tracks[curTrack()];
    $('rail').innerHTML = '<a class="brand" href="#accueil">Lakehouse <span>Dojo</span></a>' +
      '<div class="me">' + beltHtml(b) + '<div><b>Ceinture ' + BELTS[b][1] + '</b> <small>' + v + ' XP</small></div>' +
      '<div class="bar"><i style="width:' + (nx ? Math.min(100, 100 * (v - lo) / (nx[0] - lo)) : 100) + '%"></i></div>' +
      '<small class="fine">Rythme : ' + esc(trk.label) + '</small></div>' +
      '<div class="links">' + TABS.map(([r, l]) => '<a class="' + (tab === r ? 'on' : '') + '" href="#' + (r || 'accueil') + '">' + l +
        (r === 'cartes' && due ? '<span class="count">' + due + '</span>' : '') + (r === 'labo' || r === 'examen' ? '<span class="count new">top</span>' : '') + '</a>').join('') + '</div>' +
      '<div class="rail-tools"><button class="small" id="palette-btn">Rechercher <kbd>Ctrl K</kbd></button><button class="small" id="team-btn">Dojo Keyrus · Équipe</button><button class="small" id="theme-btn">Thème : ' + window.Extras.themeLabel() + '</button></div>';
  }

  /* ---------- sélecteur de parcours sur-mesure ---------- */
  function trackBar() {
    const tk = curTrack(), t = D.tracks[tk];
    const doneProofs = t.mods.reduce((s, id) => s + proofs(mod(id)).filter(Boolean).length, 0), totProofs = t.mods.length * 4;
    const pct = Math.round(100 * doneProofs / totProofs);
    return '<section class="panel"><div class="hstack between"><div><span class="eyebrow">Au rythme de chacun · Keyrus</span><h2>Choisis ton parcours d\'apprentissage</h2></div><span class="pill">' + t.time + '</span></div>' +
      '<div class="seg" role="tablist">' + Object.keys(D.tracks).map(k => '<button data-track="' + k + '" class="' + (k === tk ? 'on' : '') + '">' + esc(D.tracks[k].label) + '</button>').join('') + '</div>' +
      '<p class="muted">' + t.desc + '</p>' +
      '<div class="hstack between"><span class="fine">Progression sur ce parcours : <b>' + doneProofs + ' / ' + totProofs + ' preuves</b> (' + pct + ' %)</span>' +
      '<span class="fine">Modules ciblés : ' + t.mods.map(id => '<a href="#module-' + id + '">M' + num(mod(id)) + '</a>').join(' · ') + '</span></div>' +
      '<div class="bar"><i style="width:' + pct + '%"></i></div>' +
      (t.steps ? '<div class="surprise" style="margin-top:4px"><b>Feuille de route Sprint Express (2 h chrono pour rattraper la formation)</b><div style="display:flex;flex-direction:column;gap:6px;margin-top:8px">' +
        t.steps.map((st, i) => '<label class="chk"><input type="checkbox" data-sprint="' + i + '"' + (S.sprint && S.sprint[i] ? ' checked' : '') + '><span>' + st + '</span></label>').join('') + '</div></div>' : '') +
      '</section>';
  }

  /* ---------- accueil ---------- */
  function radar() {
    const n = DOMAINS.length, R = 78, pt = (i, r) => { const a = -Math.PI / 2 + i * 2 * Math.PI / n; return [Math.cos(a) * r, Math.sin(a) * r]; };
    const score = ms => ms.reduce((t, id) => t + proofs(mod(id)).filter(Boolean).length, 0) / (ms.length * 4);
    const poly = r => DOMAINS.map((_, i) => pt(i, r).map(x => x.toFixed(1)).join(',')).join(' ');
    const val = DOMAINS.map((d, i) => pt(i, Math.max(4, R * score(d[1]))).map(x => x.toFixed(1)).join(',')).join(' ');
    const peer = (S.peers && S.comparePeer != null) ? S.peers[S.comparePeer] : null;
    const peerVal = peer && Array.isArray(peer.d) ? DOMAINS.map((_, i) => pt(i, Math.max(4, R * ((peer.d[i] || 0) / 100))).map(x => x.toFixed(1)).join(',')).join(' ') : '';
    return '<div style="display:flex;flex-direction:column;align-items:center;gap:6px"><svg class="radar" viewBox="-180 -112 360 224" role="img" aria-label="Radar des compétences par domaine">' +
      [0.25, 0.5, 0.75, 1].map(k => '<polygon points="' + poly(R * k) + '" fill="none" stroke="var(--line)" stroke-width="1"/>').join('') +
      DOMAINS.map((_, i) => { const p = pt(i, R); return '<line x1="0" y1="0" x2="' + p[0].toFixed(1) + '" y2="' + p[1].toFixed(1) + '" stroke="var(--line)" stroke-width="1"/>'; }).join('') +
      (peerVal ? '<polygon points="' + peerVal + '" fill="var(--gold)" fill-opacity=".22" stroke="var(--gold)" stroke-width="2" stroke-dasharray="4 3"/>' : '') +
      '<polygon points="' + val + '" fill="var(--lake)" fill-opacity=".28" stroke="var(--lake)" stroke-width="2"/>' +
      DOMAINS.map((d, i) => { const p = pt(i, R + 12); return '<text x="' + p[0].toFixed(1) + '" y="' + (p[1] + 3).toFixed(1) + '" text-anchor="' + (Math.abs(p[0]) < 8 ? 'middle' : p[0] > 0 ? 'start' : 'end') + '">' + d[0] + '</text>'; }).join('') + '</svg>' +
      (peer ? '<div class="fine"><span style="color:var(--lake)">■ Toi</span> · <span style="color:var(--gold)">▨ ' + esc(peer.n) + '</span> <button class="col" id="clear-peer">(masquer)</button></div>' : '') + '</div>';
  }
  function localBoardHtml() {
    const peers = S.peers || [], meName = (window.Extras && window.Extras.getName()) || 'Toi (Keyrus)';
    const myP = profile();
    const all = [{ me: true, n: meName, xp: myP.xp, s: myP.seals.length, m: myP.missions, sm: myP.sims, tr: curTrack() }]
      .concat(peers.map((p, idx) => ({ me: false, idx, ...p })))
      .sort((a, b) => b.xp - a.xp);
    return '<section class="panel"><div class="hstack between"><div><h2>Dojo d\'équipe Keyrus</h2><p class="muted">Envoie ton lien magique 1-clic dans Teams ou compare ton radar avec celui de tes collègues.</p></div>' +
      '<div class="hstack"><button id="magic-link-btn" class="b-primary">🔗 Copier mon lien magique (1-clic)</button><button id="team-open">Gérer / Importer</button></div></div>' +
      '<div class="lb">' + all.map((r, i) => {
        const b = beltIdx(r.xp), trLabel = (D.tracks[r.tr || 'all'] || D.tracks.all).label;
        const isComp = !r.me && S.comparePeer === r.idx;
        return '<div class="lb-row' + (r.me ? ' me-row' : '') + '" style="grid-template-columns:24px minmax(0,1fr) auto auto">' +
          '<span class="rk">' + (i + 1) + '</span>' +
          '<span class="nm">' + esc(r.n) + (r.me ? ' <small class="muted">(toi)</small>' : '') + ' <span class="pill">' + esc(trLabel) + '</span> <small class="fine">' + r.s + ' sceaux · ' + r.m + '/16 Labo · ' + r.sm + '/15 sim.</small></span>' +
          (!r.me ? '<button class="small' + (isComp ? ' b-done' : '') + '" data-peer="' + r.idx + '">' + (isComp ? 'Radar affiché' : 'Comparer radar') + '</button>' : '<span></span>') +
          '<span class="pts">' + beltHtml(b) + r.xp + ' XP</span></div>';
      }).join('') + '</div></section>';
  }
  function home() {
    const v = xp(), b = beltIdx(v), nx = BELTS[b + 1], tk = curTrack(), trk = D.tracks[tk];
    const nextInTrack = trk.mods.map(mod).find(m => m && proofs(m).includes(false));
    const next = nextInTrack || D.modules.find(m => proofs(m).includes(false));
    return '<section class="panel hero"><div class="head" style="gap:14px">' +
      '<span class="eyebrow">Keyrus · Databricks Lakehouse Dojo</span><h1>Monte en compétences sur Databricks, à ton rythme</h1>' +
      '<p class="lead">Onze modules, quinze simulateurs interactifs, une École PySpark pas-à-pas + le pipeline de la Banque Lanterne dans ton navigateur, des playbooks d\'architecture client et des notebooks prêts pour Databricks Free Edition.</p>' +
      beltHtml(b) +
      '<div class="xp">' + v + ' <small>XP · ceinture ' + BELTS[b][1] + (nx ? ' · encore ' + (nx[0] - v) + ' XP avant la ceinture ' + nx[1] : '') + '</small></div>' +
      '<div class="hstack">' + (next ? '<a class="btn b-primary" href="#module-' + next.id + '">' + (v ? 'Continuer (' + esc(trk.label) + ') : ' : 'Commencer : ') + esc(next.title) + '</a>' : '') +
      '<a class="btn" href="#labo-s1">🌱 École PySpark (Débuter)</a><a class="btn" href="#labo-m0">🏦 Labo Banque Lanterne</a></div></div>' + radar() + '</section>' +

      trackBar() +

      '<section class="panel"><div class="hstack between"><h2>Le chemin</h2><span class="muted">Chaque anneau se remplit avec la leçon, le simulateur, le lab et le quiz. Les modules de ton parcours sont surlignés.</span></div><div class="journey">' +
      D.modules.map(m => {
        const inTrk = trk.mods.includes(m.id);
        return '<a class="stop' + (inTrk ? '' : ' dim') + '" href="#module-' + m.id + '"><span class="ring" style="--p:' + proofs(m).filter(Boolean).length * 25 + '"><b>' + num(m) + '</b></span>' + esc(m.title) + '</a>';
      }).join('') + '</div></section>' +

      localBoardHtml() +

      '<section class="panel" id="board" hidden><div class="hstack between"><h2>Classement en direct</h2><span id="board-act"></span></div><div class="lb" id="board-body"></div></section>' +

      '<section class="panel"><h2>Sceaux (' + earned().length + ' / ' + SEALS.length + ')</h2><div class="seals">' + SEALS.map(s => '<div class="seal' + (s[3]() ? '' : ' off') + '"><i>' + s[0] + '</i><span><b>' + s[1] + '</b><small>' + s[2] + '</small></span></div>').join('') + '</div></section>' +

      '<section class="panel"><h2>Plan sur quatre semaines</h2><div class="scroll"><table class="plain"><tr><th>Quand</th><th>Objectif</th><th>Modules</th></tr>' +
      D.plan.map(s => '<tr><td><b>' + s.when + '</b></td><td>' + s.what + '</td><td>' + s.mods.map(id => '<a href="#module-' + id + '">' + num(mod(id)) + '</a>').join(' · ') + '</td></tr>').join('') + '</table></div></section>' +

      '<section class="panel"><div class="hstack between"><div class="head"><h2>Projet fil rouge</h2><p class="muted">Un pipeline complet que tu peux montrer et expliquer en entretien ou avant-vente : c\'est lui qui te rend crédible.</p></div>' +
      '<button id="bundle-btn" class="b-primary">🧰 Générer le Starter Kit Asset Bundle</button></div>' +
      D.projet.map((t, i) => '<label class="chk"><input type="checkbox" id="pj' + i + '" data-projet="' + i + '"' + (S.projet[i] ? ' checked' : '') + '><span>' + t + '</span></label>').join('') + '</section>' +

      '<div class="hstack"><button id="card-btn" class="b-primary">Ma carte de profil</button><button id="save-btn">Sauvegarder ma progression</button><button id="load-btn">Restaurer</button><input type="file" id="load-file" accept="application/json,.json" hidden><button id="export">Copier mes notes</button><button id="reset">Réinitialiser ma progression</button></div><div id="export-out"></div>';
  }

  /* ---------- parcours et module ---------- */
  const PIPS = ['Leçon', 'Simulateur', 'Lab', 'Quiz'];
  const mcard = m => {
    const p = proofs(m), tk = curTrack(), inTrk = D.tracks[tk].mods.includes(m.id);
    return '<a class="mcard' + (p.every(Boolean) ? ' full' : '') + (inTrk ? '' : ' dim') + '" href="#module-' + m.id + '"><span class="num">' + (p.every(Boolean) ? '✓' : num(m)) + '</span>' +
      '<span><b>' + esc(m.title) + '</b><small>' + esc(m.sub) + '</small></span><span class="pips">' +
      (tk !== 'all' && inTrk ? '<span class="pip on">★ Parcours</span>' : '') +
      PIPS.map((l, i) => '<span class="pip' + (p[i] ? ' on' : '') + '">' + l + '</span>').join('') + '</span></a>';
  };
  function parcours() {
    let html = '<div class="head"><h1>Parcours</h1><p class="muted">Quatre preuves par module : la leçon comprise, la mission du simulateur, le lab réalisé, le quiz à 80 %.</p></div>' + trackBar(), last = '';
    D.modules.forEach(m => {
      if (m.day !== last) { if (last) html += '</div>'; last = m.day; html += '<h2>' + PARTS[m.day] + '</h2><div class="list">'; }
      html += mcard(m);
    });
    return html + '</div>';
  }
  const simFrame = s => '<section class="simframe"><header><span class="eyebrow">Simulateur</span><h2>' + esc(s.title) + '</h2><p class="muted">' + esc(s.tag) + '</p>' +
    '<span class="mission' + (S.sims[s.id] ? ' done' : '') + '" data-mission="' + s.id + '">' + (S.sims[s.id] ? 'Mission réussie · ' : 'Mission · ') + esc(s.mission) + '</span></header><div class="sim" data-sim="' + s.id + '"></div></section>';
  const codeBlock = (c, key) => '<div class="codehead"><span>' + esc(c.t) + '</span><button data-copy="' + key + '">Copier</button></div><pre id="code' + key + '">' + esc(c.c) + '</pre>';
  function moduleView(id) {
    const m = mod(id); if (!m) return parcours();
    const i = D.modules.indexOf(m), pv = D.modules[i - 1], nx = D.modules[i + 1];
    return '<div class="head"><p class="crumb"><a href="#parcours">Parcours</a> / ' + PARTS[m.day] + ' / module ' + (i + 1) + '</p><h1>' + esc(m.title) + '</h1><p class="muted">' + esc(m.sub) + '</p></div>' +
      simsOf(m).map(simFrame).join('') +
      '<section class="panel"><h2>L\'essentiel</h2><ul class="pts">' + m.points.map(p => '<li>' + p + '</li>').join('') + '</ul></section>' +
      (m.code.length ? '<section class="panel"><h2>Code à connaître</h2>' + m.code.map((c, k) => codeBlock(c, k)).join('') + '</section>' : '') +
      '<section class="panel"><h2>Pièges</h2><ul class="traps">' + m.traps.map(t => '<li>' + t + '</li>').join('') + '</ul></section>' +
      '<section class="panel"><div class="head"><h2>Questions d\'architecture & Retours de formation</h2><p class="muted">Les vraies questions posées en formation et en mission chez nos clients : déplie chaque point pour lire la synthèse et le réflexe consultant Keyrus.</p></div>' +
      m.ask.map((q, k) => '<div class="ask-item"><label class="chk"><input type="checkbox" id="ask' + k + '" data-ask="' + m.id + '-' + k + '"' + (S.asked[m.id + '-' + k] ? ' checked' : '') + '><span><b>' + q + '</b></span></label>' +
        (m.answers && m.answers[k] ? '<details class="ans-box"><summary>💡 Voir la réponse terrain & le réflexe Keyrus</summary><div class="expl" style="margin-top:6px">' + m.answers[k] + '</div></details>' : '') + '</div>').join('') + '</section>' +
      '<section class="panel"><div class="hstack between"><h2>Lab · ' + esc(m.lab.title) + '</h2><span class="pill">' + m.lab.time + ' dans Databricks</span></div><ol class="pts">' + m.lab.steps.map(s => '<li>' + s + '</li>').join('') + '</ol>' +
      '<details><summary>Voir la solution</summary>' + codeBlock({ t: 'Solution du lab', c: m.lab.sol }, 'sol') + '</details>' +
      '<div class="hstack"><button data-lab="' + m.id + '" class="' + (S.labs[m.id] ? 'b-done' : '') + '">' + (S.labs[m.id] ? '✓ Lab réalisé' : 'J\'ai réalisé ce lab') + '</button>' +
      '<button data-nb="' + m.id + '">⬇ Exporter ce lab en Notebook (.ipynb)</button></div></section>' +
      '<section class="panel"><h2>Mes notes</h2><textarea id="note" data-note="' + m.id + '" placeholder="Ce que j\'ai compris, ce qui reste flou, comment on l\'applique sur mon projet…">' + esc(S.notes[m.id] || '') + '</textarea></section>' +
      '<div class="hstack"><a class="btn b-primary" href="#quiz-' + m.id + '">Passer le quiz (' + m.quiz.length + ' questions)</a>' +
      '<button data-done="' + m.id + '" class="' + (S.done[m.id] ? 'b-done' : '') + '">' + (S.done[m.id] ? '✓ Leçon comprise' : 'J\'ai compris la leçon') + '</button>' +
      (pv ? '<a class="btn" href="#module-' + pv.id + '">← ' + esc(pv.title) + '</a>' : '') + (nx ? '<a class="btn" href="#module-' + nx.id + '">' + esc(nx.title) + ' →</a>' : '') + '</div>';
  }
  function atelier() {
    return '<div class="head"><h1>Simulateurs</h1><p class="muted">Quinze mécanismes à manipuler directement dans le navigateur. Chacun a une mission : ' + cnt(S.sims) + ' réussies sur ' + SIMS.length + '.</p></div><div class="list">' +
      SIMS.map(s => '<a class="mcard' + (S.sims[s.id] ? ' full' : '') + '" href="#sim-' + s.id + '"><span class="num">' + (S.sims[s.id] ? '✓' : num(mod(s.mod))) + '</span><span><b>' + esc(s.title) + '</b><small>' + esc(s.tag) + '</small></span>' +
        '<span class="pips"><span class="pip">' + esc(mod(s.mod).title) + '</span></span></a>').join('') + '</div>';
  }
  function simView(id) {
    const s = SIMS.find(x => x.id === id); if (!s) return atelier();
    return '<div class="head"><p class="crumb"><a href="#atelier">Simulateurs</a> / ' + esc(mod(s.mod).title) + '</p></div>' + simFrame(s) +
      '<div class="hstack"><a class="btn" href="#module-' + s.mod + '">Lire la leçon associée</a><a class="btn" href="#atelier">Tous les simulateurs</a></div>';
  }

  /* ---------- quiz ---------- */
  let Q = null;
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  function quizHome() {
    return '<div class="head"><h1>Quiz</h1><p class="muted">Chaque réponse est expliquée. Un module est validé à partir de 80 %.</p></div>' +
      '<section class="panel"><h2>Mélange de 10 questions</h2><p class="muted">Tirées au hasard dans tous les modules : le bon test avant un entretien client ou une certification.</p><div><a class="btn b-primary" href="#quiz-mix">Démarrer</a></div></section><div class="list">' +
      D.modules.map(m => '<a class="mcard" href="#quiz-' + m.id + '"><span class="num">' + num(m) + '</span><span><b>' + esc(m.title) + '</b><small>' + m.quiz.length + ' questions</small></span>' +
        '<span class="pips"><span class="pip' + (quizOk(m) ? ' on' : '') + '">' + (S.quiz[m.id] != null ? 'meilleur score ' + Math.round(S.quiz[m.id] * 100) + ' %' : 'à faire') + '</span></span></a>').join('') + '</div>';
  }
  function quizStart(id) {
    const qs = id === 'mix' ? shuffle(D.modules.flatMap(m => m.quiz.map(q => ({ q, m })))).slice(0, 10) : mod(id).quiz.map(q => ({ q, m: mod(id) }));
    Q = { id, qs, i: 0, score: 0, picked: null };
  }
  function quizView(id) {
    if (!Q || Q.id !== id) quizStart(id);
    if (Q.i >= Q.qs.length) {
      const r = Q.score / Q.qs.length;
      return '<div class="head"><h1>' + Q.score + ' sur ' + Q.qs.length + '</h1><p class="muted">' + (r >= 0.8 ? 'Validé. Passe au lab si ce n\'est pas fait.' : 'Pas encore 80 %. Relis les explications, puis retente.') + '</p></div>' +
        '<div class="hstack"><button id="retry" class="b-primary">Recommencer</button>' + (id !== 'mix' ? '<a class="btn" href="#module-' + id + '">Revoir le module</a>' : '') + '<a class="btn" href="#quiz">Tous les quiz</a></div>';
    }
    const { q, m } = Q.qs[Q.i], done = Q.picked !== null;
    return '<div class="head"><p class="crumb"><a href="#quiz">Quiz</a> / ' + esc(m.title) + ' · question ' + (Q.i + 1) + ' sur ' + Q.qs.length + '</p>' +
      '<div class="bar"><i style="width:' + (100 * (Q.i + (done ? 1 : 0)) / Q.qs.length) + '%"></i></div></div>' +
      '<section class="panel"><h2>' + esc(q.q) + '</h2>' +
      q.o.map((o, k) => '<button class="opt' + (done && k === q.a ? ' right' : done && k === Q.picked ? ' wrong' : '') + '" data-opt="' + k + '"' + (done ? ' disabled' : '') + '>' + esc(o) + '</button>').join('') +
      (done ? '<div class="expl"><b>' + (Q.picked === q.a ? 'Exact. ' : 'Pas tout à fait. ') + '</b>' + esc(q.e) + '</div><div><button id="nextq" class="b-primary">' + (Q.i + 1 < Q.qs.length ? 'Question suivante' : 'Voir le résultat') + '</button></div>' : '') + '</section>';
  }

  /* ---------- flashcards ---------- */
  let F = null, fcMod = 'due';
  function buildDeck(filter) {
    const all = allCards();
    if (filter === 'track') { const ms = D.tracks[curTrack()].mods; return shuffle(all.filter(c => ms.includes(c.m.id))); }
    if (filter === 'all') return shuffle(all);
    if (mod(filter)) return all.filter(c => c.m.id === filter);
    return shuffle(dueCards()).slice(0, 20);
  }
  function cardsView() {
    if (!F) F = { list: buildDeck(fcMod), i: 0, back: false };
    const total = allCards().length, due = dueCards().length, anc = anchored(), learning = Object.values(S.cards).filter(c => c.b === 1).length;
    const head = '<div class="head"><h1>Flashcards · Répétition espacée</h1><p class="muted">Système Leitner en 5 boîtes : une carte sue revient plus tard (1, 3, 7, 14, 30 jours), une carte à revoir revient dès la prochaine série.</p></div>' +
      '<section class="panel"><div class="fc-kpis">' +
      '<div class="fc-kpi"><span class="fine">À réviser aujourd\'hui</span><b>' + due + '</b><span class="fine">cartes arrivées à échéance</span></div>' +
      '<div class="fc-kpi"><span class="fine">En apprentissage</span><b>' + learning + '</b><span class="fine">boîte 1 (rappel à J+1)</span></div>' +
      '<div class="fc-kpi"><span class="fine">Ancrées (mémoire longue)</span><b style="color:var(--ok)">' + anc + ' / ' + total + '</b><span class="fine">boîtes 2 à 5 (+2 XP / carte)</span></div>' +
      '</div><div class="hstack between" style="margin-top:4px"><div class="seg">' +
      [['due', 'À réviser (' + due + ')'], ['track', 'Mon parcours'], ['all', 'Toutes (' + total + ')']].map(([k, lbl]) => '<button data-fc="' + k + '" class="' + (fcMod === k ? 'on' : '') + '">' + lbl + '</button>').join('') +
      '</div><select id="fc-mod" aria-label="Filtrer par module" style="padding:6px 10px;border:1px solid var(--line);border-radius:8px;background:var(--surface);color:var(--ink)"><option value="">Filtrer par module…</option>' +
      D.modules.map((m, idx) => '<option value="' + m.id + '"' + (fcMod === m.id ? ' selected' : '') + '>' + (idx + 1) + '. ' + esc(m.title) + ' (' + m.cards.length + ')</option>').join('') +
      '</select></div></section>';
    if (F.i >= F.list.length) {
      const left = dueCards().length;
      return head + '<section class="panel"><h2>' + (left ? 'Série terminée' : 'Tu es à jour sur tes révisions !') + '</h2><p class="muted">' +
        (left ? 'Il reste ' + left + ' carte(s) arrivée(s) à échéance aujourd\'hui.' : 'Toutes les cartes dues aujourd\'hui ont été révisées. Tu peux lancer une série libre sur ton parcours ou un module spécifique.') +
        '</p><div class="hstack"><button id="again" class="b-primary">' + (left ? 'Série suivante (' + Math.min(20, left) + ' cartes)' : 'Refaire une série libre') + '</button><a class="btn" href="#parcours">Retour au parcours</a></div></section>';
    }
    const c = F.list[F.i], st = S.cards[c.id] || { b: 0 }, b = st.b || 0, nextDays = LEITNER[Math.min(b + 1, 5)];
    const dots = '<span class="fc-boxes" title="Boîte Leitner ' + b + ' / 5">' + [1, 2, 3, 4, 5].map(k => '<i class="' + (k <= b ? 'on' : '') + '"></i>').join('') + ' <small>Boîte ' + b + '/5</small></span>';
    return head +
      '<div class="head"><div class="hstack between"><span class="crumb">Carte <b>' + (F.i + 1) + '</b> sur <b>' + F.list.length + '</b> · <a href="#module-' + c.m.id + '">Module ' + num(c.m) + ' : ' + esc(c.m.title) + '</a></span>' + dots + '</div>' +
      '<div class="bar"><i style="width:' + Math.round(100 * (F.i + (F.back ? 1 : 0.35)) / F.list.length) + '%"></i></div></div>' +
      '<button class="flip' + (F.back ? ' back' : '') + '" id="flip" aria-label="Retourner la carte"><span class="flip-in">' +
      '<span class="face"><span class="fc-top"><span class="pill">Question · ' + esc(c.m.title) + '</span><span>' + (F.i + 1) + ' / ' + F.list.length + '</span></span>' +
      '<span class="fc-mid"><span class="eyebrow">Question</span><span class="fc-q">' + esc(c.q) + '</span></span>' +
      '<span class="fc-bot"><span>Réfléchis avant de retourner</span><span>Cliquer ou <kbd>Espace</kbd> pour retourner ↻</span></span></span>' +
      '<span class="face b"><span class="fc-top"><span class="pill ok">Réponse · ' + esc(c.m.title) + '</span><span>' + (F.i + 1) + ' / ' + F.list.length + '</span></span>' +
      '<span class="fc-mid"><span class="eyebrow">Réponse à retenir</span><span class="fc-a">' + esc(c.a) + '</span></span>' +
      '<span class="fc-bot"><span>Évalue ta maîtrise ci-dessous</span><span><kbd>1</kbd> À revoir · <kbd>2</kbd> Je maîtrise</span></span></span>' +
      '</span></button>' +
      (F.back
        ? '<div class="fc-act"><button data-grade="0" class="b-warn"><b>↻ À revoir</b><small>Retour en boîte 0 · Prochain rappel immédiat (<kbd>1</kbd>)</small></button>' +
          '<button data-grade="1" class="b-primary"><b>✓ Je savais</b><small>Passe en boîte ' + Math.min(b + 1, 5) + ' · Rappel dans ' + nextDays + ' jour' + (nextDays > 1 ? 's' : '') + ' (<kbd>2</kbd>)</small></button></div>'
        : '<div class="hstack between"><button id="show" class="b-primary" style="flex:1;padding:12px 18px">Voir la réponse <kbd>Espace</kbd></button></div>');
  }
  function labsView() {
    return '<div class="head"><h1>Labs Databricks & Starter Kit</h1><p class="muted">À réaliser dans Databricks Free Edition (gratuite et sans carte bancaire) ou sur un workspace de formation. Télécharge les notebooks prêts à l\'emploi (<code>.ipynb</code>) avec rappels de cours, énoncés et solutions.</p></div>' +
      '<section class="panel"><div class="hstack between"><div><h2>Pack complet des 11 Labs & Starter Kit Asset Bundle</h2><p class="muted">Importe les 11 TP dans Databricks (<code>Workspace &gt; Import</code>) ou génère le squelette industriel de ton projet fil rouge.</p></div>' +
      '<div class="hstack"><button data-nb="all" class="b-primary">⬇ Télécharger les 11 Labs (.ipynb)</button><button id="bundle-btn">🧰 Starter Kit Asset Bundle</button></div></div></section>' +
      '<div class="list">' +
      D.modules.map(m => '<div class="mcard' + (S.labs[m.id] ? ' full' : '') + '"><span class="num">' + (S.labs[m.id] ? '✓' : num(m)) + '</span>' +
        '<a href="#module-' + m.id + '" style="text-decoration:none;color:inherit"><b>' + esc(m.lab.title) + '</b><small>' + esc(m.title) + ' · ' + m.lab.time + '</small></a>' +
        '<span class="pips"><button class="small" data-nb="' + m.id + '">⬇ .ipynb</button><a class="btn small" href="#module-' + m.id + '">Ouvrir</a></span></div>').join('') + '</div>';
  }
  const SQL_TO_PY = [
    ['Lire une table', 'SELECT * FROM clients', 'df = spark.table("clients")', 'Pointe vers la table sans rien charger en mémoire (lazy).'],
    ['Choisir des colonnes', 'SELECT id, nom FROM t', 'df.select("id", "nom")', 'Un simple texte suffit quand on ne transforme pas la colonne.'],
    ['Renommer une colonne', 'SELECT nom AS client FROM t', 'df.select(F.col("nom").alias("client"))', '.alias("...") renomme n\'importe quelle expression de colonne.'],
    ['Filtrer (1 condition)', 'WHERE montant > 0', 'df.filter(F.col("montant") > 0)', 'On accepte aussi la syntaxe SQL : df.filter("montant > 0").'],
    ['Filtrer (ET / OU)', 'WHERE a > 0 AND b = \'EUR\'', 'df.filter((F.col("a") > 0) & (F.col("b") == "EUR"))', 'Parenthèses obligatoires autour de chaque condition avec & et |.'],
    ['Tester NULL / NOT NULL', 'WHERE email IS NULL', 'df.filter(F.col("email").isNull())', 'Ou .isNotNull() pour les valeurs présentes.'],
    ['Créer ou remplacer une colonne', 'SELECT *, upper(trim(nom)) AS nom', 'df.withColumn("nom", F.upper(F.trim("nom")))', 'Remplace "nom" si elle existe, sinon l\'ajoute à la fin.'],
    ['Condition CASE WHEN', 'CASE WHEN x > 0 THEN \'OK\' ELSE \'KO\' END', 'F.when(F.col("x") > 0, "OK").otherwise("KO")', 'On peut chaîner plusieurs .when(...) avant .otherwise(...).'],
    ['Supprimer une colonne', 'SELECT * EXCEPT (rejet) FROM t', 'df.drop("rejet")', 'Retire une ou plusieurs colonnes du DataFrame.'],
    ['Dédoublonner', 'SELECT DISTINCT * FROM t', 'df.dropDuplicates()', 'Ou df.dropDuplicates(["id"]) sur une clé précise.'],
    ['Grouper et agréger', 'SELECT seg, count(*) AS n, sum(mt) AS tot\nFROM t GROUP BY seg', 'df.groupBy("seg").agg(\n  F.count("*").alias("n"),\n  F.sum("mt").alias("tot"))', 'Déclenche un Shuffle (Exchange) entre les partitions.'],
    ['Trier', 'ORDER BY tot DESC, seg ASC', 'df.orderBy(F.desc("tot"), F.asc("seg"))', 'Équivalent : .sort(F.desc("tot")).'],
    ['Joindre deux tables', 't JOIN c USING (compte_id)\n-- ou LEFT JOIN', 't.join(c, "compte_id")\nt.join(c, "compte_id", "left")', 'Passer le nom de clé en chaîne évite de dupliquer la colonne.'],
    ['Trouver les absents (Anti-join)', 't LEFT ANTI JOIN c USING (compte_id)', 't.join(c, "compte_id", "left_anti")', 'Ne garde que les lignes de t absentes de c (idéal en qualité).'],
    ['Fenêtre (QUALIFY row_number)', 'QUALIFY row_number() OVER (\n  PARTITION BY id ORDER BY dt DESC) = 1', 'w = Window.partitionBy("id").orderBy(F.desc("dt"))\ndf.withColumn("rn", F.row_number().over(w)).filter("rn = 1")', 'Permet de garder la ligne la plus récente par clé avant un MERGE.'],
    ['Écrire une table Delta', 'CREATE OR REPLACE TABLE silver_t AS …', 'df.write.mode("overwrite").saveAsTable("silver_t")', 'C\'est une action : elle déclenche tout le plan et écrit dans Delta.']
  ];
  function memoView() {
    return '<div class="head"><h1>Mémo, Dictionnaire PySpark & Playbooks</h1><p class="muted">Le dictionnaire SQL ⇄ PySpark pour partir de zéro, les scénarios d\'architecture en mission client chez Keyrus, le traducteur d\'outils et le glossaire.</p></div>' +
      '<section class="panel"><div class="hstack between"><div><h2>🐍 Dictionnaire visuel SQL ⇄ PySpark (Partir de zéro)</h2><p class="muted">Tu connais le SQL mais tu débutes en Spark ? Voici la traduction exacte des 16 gestes essentiels.</p></div>' +
      '<div class="hstack"><a class="btn b-primary" href="#labo-s1">Pratiquer dans l\'École PySpark →</a><a class="btn" href="#sim-pyspark">Simulateur brique par brique</a></div></div>' +
      '<div class="scroll"><table class="plain"><tr><th>Intention</th><th>En SQL</th><th>En PySpark (DataFrame API)</th><th>Règle à retenir</th></tr>' +
      SQL_TO_PY.map(r => '<tr><td><b>' + esc(r[0]) + '</b></td><td><code>' + esc(r[1]) + '</code></td><td><code>' + esc(r[2]) + '</code></td><td class="muted">' + esc(r[3]) + '</td></tr>').join('') +
      '</table></div></section>' +
      '<section class="panel"><h2>Playbooks d\'architecture en mission (Cas clients Keyrus)</h2><p class="muted">Six situations réelles fréquemment rencontrées en projet ou en entretien technique.</p><div class="list">' +
      (D.playbooks || []).map(p => '<details class="playbook"><summary><b>' + esc(p.title) + '</b> <span class="pill">' + esc(p.tag) + '</span></summary>' +
        '<div class="pb-body"><p><b>Contexte client :</b> ' + p.ctx + '</p><p><b>Diagnostic :</b> ' + p.diag + '</p>' +
        '<div class="note ok"><b>Recommandation Databricks :</b> ' + p.reco + '</div>' +
        '<div class="note bad"><b>Piège à éviter :</b> ' + p.trap + '</div></div></details>').join('') + '</div></section>' +
      '<section class="panel" id="translator">' + window.Extras.translatorHtml(S.bg || 'snowflake') + '</section>' +
      '<section class="panel"><h2>Glossaire (' + D.glossary.length + ' termes)</h2><input class="search" id="gsearch" placeholder="Filtrer un terme (ex. Liquid clustering, AQE, Spill, DABs)…" aria-label="Filtrer le glossaire"><div class="scroll"><table class="plain" id="gtable">' +
      D.glossary.map(g => '<tr><td><b>' + esc(g[0]) + '</b></td><td>' + esc(g[1]) + '</td></tr>').join('') + '</table></div></section>';
  }

  /* ---------- routeur ---------- */
  function render() {
    const h = location.hash.replace(/^#/, ''), k = h.indexOf('-'), r = k < 0 ? h : h.slice(0, k), arg = k < 0 ? '' : h.slice(k + 1);
    let html;
    if (r === 'peer' && arg) {
      const res = window.Extras.importTokens(arg);
      if (res.count) { S.comparePeer = res.lastIdx; save(); confetti(); toast('🎉 Profil de ' + res.lastName + ' importé et superposé sur ton radar !'); }
      location.hash = '#accueil';
      return;
    }
    if (r === 'labo') { tab = 'labo'; $('view').innerHTML = ''; rail(); window.SQLLab.mount($('view'), ctx, arg); return; }
    if (r === 'examen') { tab = 'examen'; $('view').innerHTML = ''; rail(); window.Extras.exam($('view'), ctx); return; }
    if (r === 'parcours') { html = parcours(); tab = 'parcours'; }
    else if (r === 'module') { html = moduleView(arg); tab = 'parcours'; }
    else if (r === 'atelier') { html = atelier(); tab = 'atelier'; }
    else if (r === 'sim') { html = simView(arg); tab = 'atelier'; }
    else if (r === 'quiz') { html = arg && (arg === 'mix' || mod(arg)) ? quizView(arg) : (Q = null, quizHome()); tab = 'quiz'; }
    else if (r === 'cartes') { html = cardsView(); tab = 'cartes'; }
    else if (r === 'labs') { html = labsView(); tab = 'labs'; }
    else if (r === 'memo') { html = memoView(); tab = 'memo'; }
    else { html = home(); tab = ''; }
    $('view').innerHTML = html; rail();
    $('view').querySelectorAll('[data-sim]').forEach(el => { const s = SIMS.find(x => x.id === el.dataset.sim); s.mount(el, () => winSim(s.id)); });
    if (tab === '') drawBoard();
  }
  function winSim(id) {
    if (S.sims[id]) return;
    S.sims[id] = true; save();
    const s = SIMS.find(x => x.id === id);
    document.querySelectorAll('[data-mission="' + id + '"]').forEach(el => { el.classList.add('done'); el.textContent = 'Mission réussie · ' + s.mission; });
    rail(); reward();
  }
  window.addEventListener('hashchange', () => { Q = null; F = null; render(); window.scrollTo(0, 0); });

  /* ---------- événements ---------- */
  function copyText(txt, btn, label) {
    const ok = () => { btn.textContent = 'Copié'; setTimeout(() => btn.textContent = label, 1400); };
    try { navigator.clipboard.writeText(txt).then(ok).catch(() => { }); } catch (e) { }
  }
  function notesMd() {
    let md = '# Mes notes Databricks (Keyrus Lakehouse Dojo)\n\n';
    D.modules.forEach((m, i) => {
      md += '## ' + (i + 1) + '. ' + m.title + '\n\n' + (S.notes[m.id] || '(pas de note)') + '\n\n';
      const open = m.ask.filter((q, k) => !S.asked[m.id + '-' + k]);
      if (open.length) md += 'Questions encore ouvertes :\n' + open.map(q => '- ' + q.replace(/<[^>]+>/g, '')).join('\n') + '\n\n';
    });
    return md;
  }
  let armed = false;
  document.addEventListener('click', e => {
    if (e.target.closest('.sim, .lab')) return;
    const t = e.target.closest('button'); if (!t) return;
    const d = t.dataset;
    if (t.id === 'palette-btn') { window.Extras.openPalette(); return; }
    if (t.id === 'bundle-btn') { window.Extras.openBundleModal(); return; }
    if (t.id === 'magic-link-btn') { copyText(window.Extras.myMagicLink(), t, '🔗 Copier mon lien magique (1-clic)'); toast('Lien magique copié : colle-le dans Teams !'); return; }
    if (t.id === 'team-btn' || t.id === 'team-open') { window.Extras.openTeamModal(() => render()); return; }
    if (t.id === 'theme-btn') { window.Extras.cycleTheme(); rail(); return; }
    if (t.id === 'card-btn') { window.Extras.openCard(); return; }
    if (t.id === 'save-btn') { window.Extras.exportProgress(); return; }
    if (t.id === 'load-btn') { $('load-file').click(); return; }
    if (t.id === 'clear-peer') { S.comparePeer = null; save(); render(); return; }
    if (d.peer != null) { const idx = +d.peer; S.comparePeer = S.comparePeer === idx ? null : idx; save(); render(); return; }
    if (d.track) { S.track = d.track; save(); render(); return; }
    if (d.fc) { fcMod = d.fc; F = { list: buildDeck(fcMod), i: 0, back: false }; render(); return; }
    if (d.nb) { window.Extras.downloadNotebook(d.nb); return; }
    if (d.copy != null) { const pre = $('code' + d.copy); copyText(pre.textContent, t, 'Copier'); const r = document.createRange(); r.selectNodeContents(pre); const s = getSelection(); s.removeAllRanges(); s.addRange(r); return; }
    if (t.id === 'export') { const md = notesMd(); $('export-out').innerHTML = '<textarea id="export-ta" readonly aria-label="Notes au format Markdown"></textarea>'; $('export-ta').value = md; $('export-ta').select(); copyText(md, t, 'Copier mes notes'); return; }
    if (t.id === 'reset') { if (!armed) { armed = true; t.textContent = 'Confirmer : tout effacer'; t.className = 'b-warn'; return; } armed = false; S = Object.assign(blank(), { board: S.board, peers: S.peers }); prev = { xp: 0, belt: 0, seals: [] }; }
    else if (t.id === 'join') { S.board = true; save(); pushScore(true); drawBoard(); return; }
    else if (t.id === 'leave') { leaveBoard(); return; }
    else if (d.lab) S.labs[d.lab] = !S.labs[d.lab];
    else if (d.done) S.done[d.done] = !S.done[d.done];
    else if (d.opt != null) { Q.picked = +d.opt; if (Q.picked === Q.qs[Q.i].q.a) Q.score++; }
    else if (t.id === 'nextq') {
      Q.i++; Q.picked = null;
      if (Q.i >= Q.qs.length) { const r = Q.score / Q.qs.length; if (Q.id !== 'mix' && r > (S.quiz[Q.id] || 0)) S.quiz[Q.id] = r; if (r >= 0.8) confetti(); }
    }
    else if (t.id === 'retry') quizStart(Q.id);
    else if (t.id === 'flip' || t.id === 'show') F.back = t.id === 'show' ? true : !F.back;
    else if (d.grade != null) grade(d.grade === '1');
    else if (t.id === 'again') { if (fcMod === 'due' && !dueCards().length) fcMod = 'all'; F = { list: buildDeck(fcMod), i: 0, back: false }; }
    else return;
    save(); render(); reward();
  });
  function grade(known) {
    const c = F.list[F.i], cur = S.cards[c.id] ? S.cards[c.id].b : 0, b = known ? Math.min(cur + 1, 5) : 0;
    S.cards[c.id] = { b, d: Date.now() + LEITNER[b] * DAY }; F.i++; F.back = false;
  }
  document.addEventListener('keydown', e => {
    if (tab !== 'cartes' || !F || F.i >= F.list.length || /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    if (e.key === ' ') { e.preventDefault(); F.back = !F.back; render(); }
    else if (F.back && (e.key === '1' || e.key === '2')) { grade(e.key === '2'); save(); render(); reward(); }
  });
  document.addEventListener('change', e => {
    if (e.target.id === 'load-file' && e.target.files[0]) { window.Extras.importProgress(e.target.files[0]); e.target.value = ''; return; }
    if (e.target.id === 'fc-mod' && e.target.value) { fcMod = e.target.value; F = { list: buildDeck(fcMod), i: 0, back: false }; render(); return; }
    const d = e.target.dataset;
    if (d.ask) { S.asked[d.ask] = e.target.checked; save(); }
    if (d.projet != null) { S.projet[d.projet] = e.target.checked; save(); }
    if (d.sprint != null) { S.sprint = S.sprint || {}; S.sprint[d.sprint] = e.target.checked; save(); }
  });
  document.addEventListener('input', e => {
    const d = e.target.dataset;
    if (d.note) { S.notes[d.note] = e.target.value; save(); }
    if (e.target.id === 'gsearch') { const v = e.target.value.toLowerCase(); $('gtable').querySelectorAll('tr').forEach(tr => { tr.hidden = !tr.textContent.toLowerCase().includes(v); }); }
  });

  /* ---------- classement en direct (facultatif : capacités db + user) ---------- */
  let B = null, pushTimer = null;
  async function initBoard() {
    if (!window.claude || !window.claude.use) return;
    const [db, user] = await Promise.all([window.claude.use('db'), window.claude.use('user')]);
    if (!db || !user) return;
    const uid = await user.id(); if (!uid) return;
    B = { db, user, uid, rows: null, state: 'loading', last: null, writing: false, again: false };
    const timer = setTimeout(() => { if (B.state === 'loading') { B.state = 'slow'; drawBoard(); } }, 10000);
    db.collection('scores').onSnapshot(snap => {
      B.rows = snap.docs.map(d => { const x = d.data() || {}; return { id: d.id, xp: Math.max(0, Math.min(2500, Number(x.xp) || 0)) }; });
      if (!snap.metadata.fromCache) clearTimeout(timer);
      B.state = 'ready'; drawBoard();
    }, () => { clearTimeout(timer); B.state = 'error'; drawBoard(); });
    drawBoard();
  }
  function pushScore(force) {
    if (!B || !S.board) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(async () => {
      if (B.writing) { B.again = true; return; }
      const v = xp(); if (v === B.last && !force) return;
      B.writing = true;
      try { await B.db.doc('scores/' + B.uid).set({ xp: v }); B.last = v; } catch (e) { B.state = 'readonly'; drawBoard(); }
      B.writing = false; if (B.again) { B.again = false; pushScore(); }
    }, force ? 0 : 1200);
  }
  async function leaveBoard() {
    S.board = false; save();
    try { await B.db.doc('scores/' + B.uid).delete(); B.last = null; } catch (e) { }
    drawBoard();
  }
  async function drawBoard() {
    const el = $('board'); if (!el || !B) return;
    el.hidden = false;
    const act = $('board-act'), body = $('board-body');
    act.innerHTML = B.state === 'readonly' ? '' : S.board ? '<button id="leave">Quitter le classement</button>' : '<button id="join" class="b-primary">Rejoindre le classement</button>';
    const note = t => { body.textContent = ''; const p = document.createElement('p'); p.className = 'muted'; p.textContent = t; body.appendChild(p); };
    if (B.state === 'loading') return note('Chargement du classement…');
    if (B.state === 'slow') return note('Le classement est injoignable pour l\'instant.');
    if (B.state === 'error') return note('Le classement n\'est pas disponible.');
    const rows = (B.rows || []).slice().sort((a, b) => b.xp - a.xp).slice(0, 20);
    if (!rows.length) return note(S.board ? 'Ton score arrive.' : 'Personne n\'a encore rejoint le classement.');
    const ps = await B.user.profiles(rows.map(r => r.id));
    if ($('board-body') !== body) return;
    body.textContent = '';
    rows.forEach((r, i) => {
      const p = ps[r.id] || {}, row = document.createElement('div'); row.className = 'lb-row' + (r.id === B.uid ? ' me-row' : '');
      const rk = document.createElement('span'); rk.className = 'rk'; rk.textContent = i + 1;
      const img = document.createElement('img'); img.alt = ''; if (p.avatarUrl) img.src = p.avatarUrl;
      const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = (p.name || 'Quelqu\'un') + (r.id === B.uid ? ' (toi)' : '');
      const pts = document.createElement('span'); pts.className = 'pts'; pts.innerHTML = beltHtml(beltIdx(r.xp)); pts.appendChild(document.createTextNode(r.xp + ' XP'));
      row.append(rk, img, nm, pts); body.appendChild(row);
    });
    if (B.state === 'readonly') { const p = document.createElement('p'); p.className = 'fine'; p.textContent = 'Ton accès à cette page est en lecture seule : tu vois le classement sans y figurer.'; body.appendChild(p); }
  }

  window.Extras.init(ctx);
  render();
  initBoard();
})();
