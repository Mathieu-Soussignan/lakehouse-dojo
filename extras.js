// Extras : examen blanc, palette de commandes, thème, sauvegarde, carte de profil, export notebooks Databricks, passeport d'équipe Keyrus, traducteur.
(function () {
  const D = window.DOJO;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const $ = id => document.getElementById(id);
  const strip = h => String(h).replace(/<[^>]+>/g, '');
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const modOf = id => D.modules.find(m => m.id === id);
  let CTX = null;

  /* ---------- thème ---------- */
  const THEME_KEY = 'lakehouse-dojo-theme', THEMES = [['system', 'Système'], ['light', 'Clair'], ['dark', 'Sombre']];
  const getTheme = () => { try { return localStorage.getItem(THEME_KEY) || 'system'; } catch (e) { return 'system'; } };
  function applyTheme(t) { if (t === 'system') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t); }
  function cycleTheme() { const i = (THEMES.findIndex(x => x[0] === getTheme()) + 1) % THEMES.length; try { localStorage.setItem(THEME_KEY, THEMES[i][0]); } catch (e) { } applyTheme(THEMES[i][0]); }
  const themeLabel = () => THEMES.find(x => x[0] === getTheme())[1];
  applyTheme(getTheme());

  /* ---------- fenêtre modale ---------- */
  function modal(html) {
    let m = $('modal'); if (!m) { m = document.createElement('div'); m.id = 'modal'; m.className = 'modal'; document.body.appendChild(m); m.addEventListener('click', e => { if (e.target === m || e.target.closest('[data-close]')) m.hidden = true; }); }
    m.innerHTML = '<div class="modal-box" role="dialog" aria-modal="true">' + html + '</div>'; m.hidden = false; return m;
  }

  /* ---------- palette de commandes ---------- */
  let palItems = null, palSel = 0, palList = [];
  const TABS = [['#accueil', 'Accueil'], ['#parcours', 'Parcours'], ['#atelier', 'Simulateurs'], ['#labo', 'Labo SQL'], ['#examen', 'Examen blanc'], ['#quiz', 'Quiz'], ['#cartes', 'Flashcards'], ['#labs', 'Labs Databricks'], ['#memo', 'Mémo, Playbooks et Traducteur']];
  function buildItems() {
    const I = TABS.map(t => ({ t: t[1], s: 'Aller à cette page', k: 'Page', h: t[0] }));
    D.modules.forEach((m, i) => I.push({
      t: (i + 1) + '. ' + m.title, s: m.sub, k: 'Module', h: '#module-' + m.id,
      x: strip(m.points.join(' ') + ' ' + m.traps.join(' ') + ' ' + (m.ask || []).join(' ') + ' ' + (m.answers || []).join(' '))
    }));
    (window.SIMS || []).forEach(s => I.push({ t: s.title, s: s.tag, k: 'Simulateur', h: '#sim-' + s.id }));
    ((window.LAB && window.LAB.MISSIONS) || []).forEach((m, i) => I.push({ t: 'Mission ' + i + ' · ' + m.title, s: strip(m.brief).slice(0, 100), k: 'Labo SQL', h: '#labo-' + m.id }));
    (D.playbooks || []).forEach(p => I.push({ t: p.title, s: p.tag + ' — ' + strip(p.reco).slice(0, 90), k: 'Playbook', h: '#memo', x: strip(p.ctx + ' ' + p.diag + ' ' + p.reco + ' ' + p.trap) }));
    D.glossary.forEach(g => I.push({ t: g[0], s: g[1], k: 'Glossaire', h: '#memo' }));
    return I;
  }
  function palRender(q) {
    const tk = q.toLowerCase().split(/\s+/).filter(Boolean);
    palList = (palItems || []).map(it => {
      const hay = (it.t + ' ' + it.s + ' ' + (it.x || '')).toLowerCase(); if (!tk.every(t => hay.includes(t))) return null;
      return { it, sc: tk.reduce((s, t) => s + (it.t.toLowerCase().includes(t) ? 4 : 0) + (it.s.toLowerCase().includes(t) ? 2 : 0) + 1, 0) + (it.k === 'Module' ? 0.5 : 0) };
    }).filter(Boolean).sort((a, b) => b.sc - a.sc).slice(0, 10).map(x => x.it);
    palSel = 0; $('pal-l').innerHTML = palList.length ? palList.map((it, i) => '<li><button data-i="' + i + '" class="' + (i === 0 ? 'on' : '') + '"><span class="kind">' + it.k + '</span><b>' + esc(it.t) + '</b><small>' + esc(it.s) + '</small></button></li>').join('') : '<li class="fine pal-empty">Aucun résultat. Essaie un terme comme VACUUM, MERGE, Unity Catalog, Skew, Fabric ou DirectQuery.</li>';
  }
  function palGo(i) { const it = palList[i]; if (!it) return; closePal(); location.hash = it.h; }
  function openPal() {
    palItems = palItems || buildItems();
    let p = $('pal');
    if (!p) {
      p = document.createElement('div'); p.id = 'pal'; p.className = 'modal'; p.innerHTML = '<div class="pal-box" role="dialog" aria-modal="true" aria-label="Recherche"><input id="pal-q" type="text" autocomplete="off" placeholder="Chercher un module, un playbook, un terme, une mission…" aria-label="Rechercher"><ul id="pal-l"></ul><p class="fine pal-foot"><kbd>↑</kbd> <kbd>↓</kbd> pour choisir · <kbd>↵</kbd> pour ouvrir · <kbd>Échap</kbd> pour fermer</p></div>';
      document.body.appendChild(p);
      p.addEventListener('click', e => { if (e.target === p) closePal(); const b = e.target.closest('[data-i]'); if (b) palGo(+b.dataset.i); });
      $('pal-q').addEventListener('input', e => palRender(e.target.value));
      $('pal-q').addEventListener('keydown', e => {
        const bs = $('pal-l').querySelectorAll('[data-i]');
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); palSel = (palSel + (e.key === 'ArrowDown' ? 1 : -1) + bs.length) % Math.max(bs.length, 1); bs.forEach((b, i) => b.classList.toggle('on', i === palSel)); if (bs[palSel]) bs[palSel].scrollIntoView({ block: 'nearest' }); }
        else if (e.key === 'Enter') { e.preventDefault(); palGo(palSel); }
        else if (e.key === 'Escape') closePal();
      });
    }
    p.hidden = false; $('pal-q').value = ''; palRender(''); $('pal-q').focus();
  }
  const closePal = () => { const p = $('pal'); if (p) p.hidden = true; };
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openPal(); }
    else if (e.key === 'Escape') { const m = $('modal'); if (m) m.hidden = true; }
  });

  /* ---------- sauvegarde de progression ---------- */
  function exportProgress() {
    const txt = JSON.stringify({ app: 'lakehouse-dojo', v: 1, at: new Date().toISOString(), state: CTX.S });
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type: 'application/json' })); a.download = 'ma-progression-lakehouse-dojo.json';
    document.body.appendChild(a); a.click(); a.remove();
  }
  function importProgress(file) {
    const r = new FileReader();
    r.onload = () => {
      try { const j = JSON.parse(r.result); if (j.app !== 'lakehouse-dojo' || !j.state || typeof j.state !== 'object') throw new Error('format'); CTX.replaceS(j.state); CTX.toast('Progression restaurée'); }
      catch (e) { CTX.toast('Fichier non reconnu : choisis un export du Lakehouse Dojo'); }
    };
    r.readAsText(file);
  }

  /* ---------- export des labs en notebooks Databricks (.ipynb) ---------- */
  const isSql = s => /^\s*(--|CREATE\b|SELECT\b|MERGE\b|DESCRIBE\b|EXPLAIN\b|SHOW\b|INSERT\b|COPY\b|RESTORE\b|OPTIMIZE\b|VACUUM\b|%sql\b)/i.test(s);
  const toLines = s => String(s).split('\n').map((l, i, a) => i < a.length - 1 ? l + '\n' : l);
  const mdCell = s => ({ cell_type: 'markdown', metadata: {}, source: toLines(s) });
  const codeCell = s => {
    const clean = String(s).trim();
    const body = isSql(clean) && !/^\s*%sql/i.test(clean) ? '%sql\n' + clean : clean;
    return { cell_type: 'code', execution_count: null, metadata: {}, outputs: [], source: toLines(body) };
  };
  function moduleCells(m, idx) {
    const cells = [
      mdCell('# Module ' + idx + ' · ' + m.title + '\n*' + m.sub + '*\n\n### L\'essentiel à retenir\n' + m.points.map(p => '- ' + strip(p)).join('\n') + '\n\n### Pièges classiques\n' + m.traps.map(t => '- ⚠ ' + strip(t)).join('\n'))
    ];
    (m.code || []).forEach(c => {
      cells.push(mdCell('### Exemple : ' + c.t));
      cells.push(codeCell(c.c));
    });
    cells.push(mdCell('## Lab pratique · ' + m.lab.title + ' (' + m.lab.time + ')\n\n' + m.lab.steps.map((s, i) => (i + 1) + '. ' + strip(s)).join('\n') + '\n\n> 💡 *Exécute tes essais dans la cellule ci-dessous, puis compare avec la solution de référence.*'));
    cells.push(codeCell('# Ton espace de travail pour le lab "' + m.lab.title + '"\n'));
    cells.push(mdCell('### Solution de référence du Lab'));
    cells.push(codeCell(m.lab.sol));
    return cells;
  }
  function downloadNotebook(modId) {
    let cells = [], fname = 'lakehouse-dojo-labs.ipynb';
    if (modId === 'all') {
      cells.push(mdCell('# Lakehouse Dojo · Carnet complet des 11 Labs Databricks\nCe notebook regroupe les rappels de cours, extraits de code et travaux pratiques des 11 modules du **Lakehouse Dojo**.\nImporte-le directement dans **Databricks Free Edition** ou ton workspace Azure Databricks (`Workspace > Import`).'));
      D.modules.forEach((m, i) => { cells = cells.concat(moduleCells(m, i + 1)); });
    } else {
      const m = modOf(modId); if (!m) return;
      const idx = D.modules.indexOf(m) + 1;
      cells = moduleCells(m, idx);
      fname = 'dojo-lab-' + String(idx).padStart(2, '0') + '-' + m.id + '.ipynb';
    }
    const nb = { nbformat: 4, nbformat_minor: 5, metadata: { kernelspec: { display_name: 'Python 3', language: 'python', name: 'python3' }, language_info: { name: 'python' } }, cells };
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(nb, null, 2)], { type: 'application/x-ipynb+json' }));
    a.download = fname;
    document.body.appendChild(a); a.click(); a.remove();
    if (CTX) CTX.toast('Notebook téléchargé : ' + fname);
  }

  /* ---------- passeport & classement d'équipe Keyrus (sans serveur) ---------- */
  const b64e = s => btoa(encodeURIComponent(s).replace(/%([0-9A-F]{2})/g, (_, p) => String.fromCharCode('0x' + p)));
  const b64d = s => decodeURIComponent(Array.from(atob(s), c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
  function getName() { try { return localStorage.getItem('lakehouse-dojo-name') || ''; } catch (e) { return ''; } }
  function setName(n) { try { localStorage.setItem('lakehouse-dojo-name', n); } catch (e) { } }
  function myToken() {
    const P = CTX.profile(), name = getName() || 'Consultant Keyrus';
    const payload = {
      n: name.slice(0, 40),
      xp: P.xp,
      b: P.belt.name,
      s: P.seals.length,
      m: P.missions,
      sm: P.sims,
      d: P.domains.map(x => Math.round(x.score * 100)),
      tr: CTX.S.track || 'all'
    };
    return 'DOJO1:' + b64e(JSON.stringify(payload));
  }
  function importTokens(raw) {
    const matches = String(raw).match(/DOJO1:[A-Za-z0-9+/=]+/g) || [];
    if (!matches.length) return 0;
    const peers = (CTX.S.peers || []).slice();
    let added = 0;
    matches.forEach(tok => {
      try {
        const p = JSON.parse(b64d(tok.slice(6)));
        if (!p || typeof p.n !== 'string' || typeof p.xp !== 'number' || !Array.isArray(p.d)) return;
        const clean = {
          n: p.n.trim().slice(0, 40) || 'Collègue',
          xp: Math.max(0, Math.min(2500, Math.round(p.xp))),
          s: Math.max(0, Math.min(20, Number(p.s) || 0)),
          m: Math.max(0, Math.min(15, Number(p.m) || 0)),
          sm: Math.max(0, Math.min(20, Number(p.sm) || 0)),
          d: p.d.slice(0, 7).map(v => Math.max(0, Math.min(100, Number(v) || 0))),
          tr: p.tr || 'all'
        };
        const idx = peers.findIndex(x => x.n.toLowerCase() === clean.n.toLowerCase());
        if (idx >= 0) peers[idx] = clean; else peers.push(clean);
        added++;
      } catch (e) { }
    });
    if (added) { CTX.S.peers = peers; CTX.save(); }
    return added;
  }
  function loadDemoPeers() {
    CTX.S.peers = [
      { n: 'Sarah M. (Practice BI)', xp: 780, s: 7, m: 6, sm: 9, d: [100, 100, 50, 75, 50, 100, 25], tr: 'bi' },
      { n: 'Thomas L. (Data Eng)', xp: 1140, s: 10, m: 9, sm: 13, d: [88, 100, 88, 100, 88, 75, 75], tr: 'de' },
      { n: 'Amine K. (Sprint Express)', xp: 520, s: 5, m: 5, sm: 8, d: [75, 75, 50, 75, 62, 50, 25], tr: 'express' }
    ];
    CTX.save();
  }
  function openTeamModal(onUpdate) {
    const render = () => {
      const name = getName(), tok = myToken(), peers = CTX.S.peers || [];
      const m = modal(
        '<h2>Dojo d\'équipe Keyrus · Partage sans serveur</h2>' +
        '<p class="muted">Chaque collaborateur avance à son rythme : copie ton jeton de progression dans le canal Teams de l\'équipe et colle ceux de tes collègues pour comparer vos radars et animer le classement.</p>' +
        '<div class="hstack"><label for="t-nm" class="fine">Ton prénom / nom</label><input id="t-nm" class="search" style="max-width:240px" value="' + esc(name) + '" placeholder="Ex. Mathieu (Keyrus)"><button id="t-copy" class="b-primary">Copier mon jeton Teams</button></div>' +
        '<pre class="mini" style="word-break:break-all;white-space:pre-wrap;font-size:11px">' + esc(tok) + '</pre>' +
        '<h3>Ajouter des collègues</h3>' +
        '<textarea id="t-in" placeholder="Colle ici un ou plusieurs messages Teams contenant un code DOJO1:…"></textarea>' +
        '<div class="hstack between"><div class="hstack"><button id="t-add" class="b-primary">Importer dans mon classement</button>' +
        (!peers.length ? '<button id="t-demo" class="small">Charger 3 profils démo Keyrus</button>' : '<button id="t-clear" class="small b-warn">Vider la liste (' + peers.length + ')</button>') +
        '</div><button data-close>Fermer</button></div>'
      );
      const inp = m.querySelector('#t-nm');
      inp.oninput = () => { setName(inp.value.trim()); m.querySelector('pre.mini').textContent = myToken(); if (onUpdate) onUpdate(); };
      m.querySelector('#t-copy').onclick = e => {
        setName(inp.value.trim());
        const t = myToken();
        try { navigator.clipboard.writeText('Mon passeport Lakehouse Dojo (' + (inp.value.trim() || 'Keyrus') + ' · ' + CTX.profile().xp + ' XP) :\n' + t); } catch (err) { }
        e.target.textContent = '✓ Copié pour Teams !';
        setTimeout(() => e.target.textContent = 'Copier mon jeton Teams', 1600);
        if (onUpdate) onUpdate();
      };
      m.querySelector('#t-add').onclick = () => {
        const n = importTokens(m.querySelector('#t-in').value);
        if (n) { CTX.toast(n + ' profil(s) collègue(s) importé(s)'); if (onUpdate) onUpdate(); m.hidden = true; }
        else CTX.toast('Aucun jeton DOJO1:… trouvé dans le texte collé');
      };
      const demo = m.querySelector('#t-demo');
      if (demo) demo.onclick = () => { loadDemoPeers(); CTX.toast('3 profils démo Keyrus ajoutés'); if (onUpdate) onUpdate(); m.hidden = true; };
      const clr = m.querySelector('#t-clear');
      if (clr) clr.onclick = () => { CTX.S.peers = []; CTX.S.comparePeer = null; CTX.save(); if (onUpdate) onUpdate(); render(); };
    };
    render();
  }

  /* ---------- carte de profil ---------- */
  function drawCard(name) {
    const P = CTX.profile(), c = document.createElement('canvas'); c.width = 1200; c.height = 630; const g = c.getContext('2d');
    const bg = g.createLinearGradient(0, 0, 1200, 630); bg.addColorStop(0, '#0a1a20'); bg.addColorStop(1, '#11333d'); g.fillStyle = bg; g.fillRect(0, 0, 1200, 630);
    g.strokeStyle = 'rgba(79,196,214,.12)'; g.lineWidth = 1; for (let x = 0; x < 1200; x += 40) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 630); g.stroke(); }
    for (let y = 0; y < 630; y += 40) { g.beginPath(); g.moveTo(0, y); g.lineTo(1200, y); g.stroke(); }
    g.fillStyle = '#e2eef0'; g.font = '700 54px "Bricolage Grotesque", Georgia, serif'; g.fillText('Lakehouse', 64, 100); g.fillStyle = '#4fc4d6'; g.fillText('Dojo', 316, 100);
    const trk = (D.tracks && D.tracks[CTX.S.track || 'all']) || { label: 'Parcours Databricks' };
    g.fillStyle = '#8fabb2'; g.font = '500 22px Figtree, Segoe UI, sans-serif'; g.fillText('Keyrus · ' + trk.label, 64, 140);
    g.fillStyle = '#e2eef0'; g.font = '700 44px Figtree, Segoe UI, sans-serif'; g.fillText(name || 'Consultant Keyrus', 64, 250);
    g.fillStyle = P.belt.color; g.fillRect(64, 290, 360, 34); g.strokeStyle = 'rgba(255,255,255,.35)'; g.strokeRect(64, 290, 360, 34); g.fillRect(222, 282, 44, 50); g.strokeRect(222, 282, 44, 50);
    g.fillStyle = '#e2eef0'; g.font = '700 34px Figtree, Segoe UI, sans-serif'; g.fillText('Ceinture ' + P.belt.name, 64, 385);
    g.fillStyle = '#4fc4d6'; g.font = '700 64px Figtree, Segoe UI, sans-serif'; g.fillText(P.xp + ' XP', 64, 460);
    g.fillStyle = '#8fabb2'; g.font = '500 22px Figtree, Segoe UI, sans-serif'; g.fillText(P.seals.length + ' sceaux · ' + P.missions + ' missions SQL · ' + P.sims + ' simulateurs', 64, 505);
    // sceaux
    P.seals.slice(0, 12).forEach((s, i) => { const x = 64 + (i % 6) * 62, y = 535 + Math.floor(i / 6) * 48; g.strokeStyle = '#e0574c'; g.lineWidth = 3; g.strokeRect(x, y, 40, 40); g.fillStyle = '#e0574c'; g.font = '700 22px Georgia, serif'; g.fillText(s.l, x + 12, y + 29); });
    // radar
    const cx = 900, cy = 330, R = 190, n = P.domains.length, pt = (i, r) => [cx + Math.cos(-Math.PI / 2 + i * 2 * Math.PI / n) * r, cy + Math.sin(-Math.PI / 2 + i * 2 * Math.PI / n) * r];
    g.lineWidth = 1; [0.25, 0.5, 0.75, 1].forEach(k => { g.beginPath(); P.domains.forEach((_, i) => { const p = pt(i, R * k); i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]); }); g.closePath(); g.strokeStyle = 'rgba(143,171,178,.35)'; g.stroke(); });
    g.beginPath(); P.domains.forEach((d, i) => { const p = pt(i, Math.max(8, R * d.score)); i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]); }); g.closePath(); g.fillStyle = 'rgba(79,196,214,.3)'; g.fill(); g.strokeStyle = '#4fc4d6'; g.lineWidth = 3; g.stroke();
    g.fillStyle = '#8fabb2'; g.font = '600 18px Figtree, Segoe UI, sans-serif'; P.domains.forEach((d, i) => { const p = pt(i, R + 24); g.textAlign = Math.abs(p[0] - cx) < 10 ? 'center' : p[0] > cx ? 'left' : 'right'; g.fillText(d.n, p[0], p[1] + 6); }); g.textAlign = 'left';
    return c;
  }
  function openCard() {
    let name = getName();
    const render = () => { const c = drawCard(name); const url = c.toDataURL('image/png'); const m = modal('<h2>Ma carte de profil</h2><img class="card-img" alt="Carte de profil" src="' + url + '"><div class="hstack"><label for="nm" class="fine">Nom affiché</label><input id="nm" class="search" style="max-width:240px" value="' + esc(name) + '" placeholder="Consultant Keyrus"><a class="btn b-primary" id="dl" href="' + url + '" download="carte-lakehouse-dojo.png">Télécharger l\'image</a><button data-close>Fermer</button></div><p class="fine">L\'image se construit dans ton navigateur : rien n\'est envoyé nulle part.</p>'); const inp = m.querySelector('#nm'); inp.onchange = () => { name = inp.value.trim(); setName(name); render(); }; };
    render();
  }

  /* ---------- traducteur de compétences ---------- */
  const TR = {
    snowflake: { label: 'Snowflake', surprises: ['Le calcul n\'est plus un « warehouse » unique : cluster Spark pour le code, SQL warehouse pour le SQL. Deux outils, deux factures.', 'Les données sont dans votre stockage, en fichiers ouverts. Rien n\'est « chez l\'éditeur ».', 'On écrit du Python et du SQL côte à côte : le notebook devient l\'outil de travail, pas seulement un éditeur de requêtes.'], rows: [['Virtual warehouse', 'SQL warehouse (et clusters)', 'Tailles T-shirt et arrêt automatique des deux côtés. Côté Spark, un cluster s\'ajoute pour le code.'], ['Database / Schema', 'Catalogue / Schéma', 'Nommage à trois niveaux identique.'], ['Stage', 'Volume / external location', 'Zone de fichiers gouvernée.'], ['Snowpipe', 'Auto Loader', 'Ingestion incrémentale de fichiers.'], ['Streams et Tasks', 'Change Data Feed et Jobs', 'Le CDF expose les changements, les jobs orchestrent.'], ['Dynamic Tables', 'Materialized views et streaming tables', 'Dans les pipelines déclaratifs.'], ['Time Travel', 'Time travel Delta', 'Borné par la rétention de VACUUM, pas par un réglage de compte.'], ['Zero-copy clone', 'SHALLOW CLONE', 'Copie des métadonnées seulement.'], ['Clustering keys', 'Liquid clustering', 'CLUSTER BY dans les deux cas.'], ['Snowpark', 'PySpark', 'DataFrame à évaluation paresseuse.'], ['Row access / masking policies', 'Row filters / column masks', 'Rattachés à Unity Catalog.']] },
    sqlserver: { label: 'SQL Server / Synapse', surprises: ['Pas d\'index à poser : on organise les fichiers (clustering) et le moteur ignore ceux qui ne servent pas.', 'Pas de verrous de lignes : la concurrence est optimiste, un conflit se détecte au commit et l\'écriture est à rejouer.', 'Une instruction n\'est pas une transaction sur plusieurs tables : l\'atomicité est par table.'], rows: [['Base / schéma / table', 'Catalogue / schéma / table', 'Un niveau de plus à bien choisir : le catalogue.'], ['Index cluster et non cluster', 'Liquid clustering et data skipping', 'On ne tune plus des structures, on choisit des colonnes de filtre.'], ['Linked server', 'Lakehouse Federation', 'Une connection et un foreign catalog. Lecture seule, avec pushdown.'], ['SQL Server Agent', 'Lakeflow Jobs', 'Tâches, dépendances, paramètres, relance ciblée (Repair run).'], ['SSIS / Data Factory', 'Data Factory ou Jobs', 'ADF reste un bon orchestrateur transverse ; les jobs suffisent quand tout est dans Databricks.'], ['Sécurité au niveau ligne', 'Row filters et column masks', 'Attachés à la table dans Unity Catalog.'], ['Table temporaire #t', 'Temp view', 'Vue de session : hors catalogue, disparaît avec le cluster.'], ['Procédure stockée', 'Notebook, script SQL ou tâche de job', 'Le code vit dans des fichiers versionnés avec Git, pas dans la base.']] },
    hadoop: { label: 'Hadoop / Hive', surprises: ['Le stockage et le calcul sont séparés : on éteint tous les clusters sans rien perdre.', 'Les tables ne sont plus des dossiers Hive mais des tables Delta avec un journal transactionnel : UPDATE et MERGE existent enfin.', 'Le metastore Hive n\'est plus le référentiel : Unity Catalog le remplace, avec gouvernance et lineage.'], rows: [['HDFS', 'ADLS (stockage objet) et volumes', 'Les chemins deviennent des URL abfss.'], ['Hive metastore', 'Unity Catalog', 'Le hive_metastore reste visible mais c\'est l\'ancien modèle.'], ['Tables ORC ou Parquet partitionnées', 'Tables Delta (liquid clustering)', 'Le partitionnement n\'est plus le réflexe par défaut.'], ['YARN', 'Clusters éphémères ou serverless', 'Un cluster par job est normal et peu cher.'], ['Oozie', 'Lakeflow Jobs', 'Dépendances, planning, paramètres, notifications.'], ['Ranger', 'Privilèges Unity Catalog', 'GRANT sur des groupes, héritage descendant.'], ['HiveQL', 'Spark SQL', 'Proche, avec des extensions (QUALIFY, EXCEPT, GROUP BY ALL).'], ['MapReduce / Tez', 'Spark et Photon', 'Le même code passe de 10 Mo à 10 To.']] },
    airflow: { label: 'Airflow / dbt', surprises: ['Un job Databricks n\'est pas un DAG de code Python : c\'est une définition (YAML ou interface) de tâches et de dépendances.', 'Le Repair run relance les tâches en échec et leurs dépendantes : l\'idempotence reste votre responsabilité.', 'dbt fonctionne sur Databricks (tâche dbt dans un job), mais les pipelines déclaratifs couvrent une partie de son rôle.'], rows: [['DAG', 'Job', 'Un graphe de tâches avec des dépendances.'], ['Operator', 'Type de tâche', 'Notebook, SQL, pipeline, Python, dbt, If/else, For each.'], ['XCom', 'Task values', 'Petites valeurs passées d\'une tâche à l\'autre.'], ['Variables et connections', 'Secrets et paramètres de job', 'Les secrets vivent dans des secret scopes, souvent adossés à Key Vault.'], ['Sensor', 'Trigger sur arrivée de fichier ou mise à jour de table', 'Le déclencheur est une propriété du job.'], ['Backfill', 'Run avec des paramètres différents', 'Rejouer un jour passé suppose des tâches idempotentes.'], ['Modèle dbt', 'Requête SQL, materialized view ou pipeline déclaratif', 'Au choix selon l\'incrémental et la qualité voulus.'], ['Tests dbt', 'Expectations', 'Garder, écarter ou faire échouer les lignes qui violent la règle.']] },
    python: { label: 'Python / pandas', surprises: ['Un DataFrame Spark n\'est pas un DataFrame pandas : il est distribué et paresseux. Rien ne s\'exécute avant une action.', 'toPandas() ramène tout sur le driver : à réserver aux petits résultats.', 'Le notebook garde un état caché : l\'ordre d\'exécution prime sur l\'ordre d\'affichage.'], rows: [['pandas DataFrame', 'Spark DataFrame', 'Distribué, immuable, évalué à la demande.'], ['df.apply(fonction)', 'Fonctions natives ou pandas UDF', 'Une UDF Python sort du moteur optimisé : à éviter si une fonction native existe.'], ['Script lancé par cron', 'Job planifié', 'Avec paramètres, relance ciblée et historique des runs.'], ['requirements.txt', '%pip ou bibliothèques de cluster', 'Placer %pip en tête du notebook : il relance l\'interpréteur.'], ['Fichiers locaux', 'Volumes Unity Catalog', 'Un chemin /Volumes/catalogue/schéma/volume/… gouverné.'], ['Tests pytest', 'Fonctions pures sur des DataFrames', 'Extraire la logique des notebooks pour la tester.'], ['pandas API on Spark', 'pyspark.pandas', 'Une passerelle quand on a déjà du code pandas.']] }
  };
  function translatorHtml(bg) {
    const t = TR[bg] || TR.snowflake;
    return '<h2>Traducteur de compétences</h2><p class="muted">Tu connais déjà un autre outil ? Choisis-le : voici ce qui se transpose, et ce qui va te surprendre.</p><div class="seg" role="tablist">' + Object.keys(TR).map(k => '<button data-bg="' + k + '" class="' + (k === bg ? 'on' : '') + '">' + TR[k].label + '</button>').join('') + '</div>' +
      '<div class="surprise"><b>Ce qui va te surprendre</b><ul>' + t.surprises.map(s => '<li>' + esc(s) + '</li>').join('') + '</ul></div>' +
      '<div class="scroll"><table class="plain"><tr><th>' + t.label + '</th><th>Databricks</th><th>À retenir</th></tr>' + t.rows.map(r => '<tr><td>' + esc(r[0]) + '</td><td><b>' + esc(r[1]) + '</b></td><td class="muted">' + esc(r[2]) + '</td></tr>').join('') + '</table></div>';
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-bg]'); if (!b || !$('translator')) return;
    CTX.S.bg = b.dataset.bg; CTX.save(); $('translator').innerHTML = translatorHtml(b.dataset.bg);
  });

  /* ---------- examen blanc ---------- */
  let X = null, timer = null;
  const PASS = 0.7, N = 20, DURATION = 30 * 60 * 1000;
  function buildExam() {
    const pool = D.modules.flatMap(m => m.quiz.map(q => ({ ...q, m: m.id }))).concat(D.exam || []);
    const byMod = {}; shuffle(pool).forEach(q => (byMod[q.m] = byMod[q.m] || []).push(q));
    let qs = Object.values(byMod).map(l => l.shift()); // au moins une question par module
    qs = qs.concat(shuffle(Object.values(byMod).flat())).slice(0, N);
    return shuffle(qs).map(q => { const opts = shuffle(q.o.map((t, i) => ({ t, ok: i === q.a }))); return { m: q.m, q: q.q, o: opts.map(x => x.t), a: opts.findIndex(x => x.ok), e: q.e }; });
  }
  const fmt = ms => { const s = Math.max(0, Math.round(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  function finishExam() {
    clearInterval(timer); X.done = true; X.end = Date.now();
    const ok = X.qs.filter((q, i) => X.ans[i] === q.a).length, pct = ok / X.qs.length, S = CTX.S;
    S.exam = S.exam || { best: 0, xp: 0, attempts: [] };
    S.exam.attempts = [{ at: new Date().toISOString().slice(0, 10), s: ok, n: X.qs.length }].concat(S.exam.attempts).slice(0, 8);
    if (pct > S.exam.best) S.exam.best = pct;
    let first = false; if (pct >= PASS && !S.exam.xp) { S.exam.xp = 50; first = true; }
    CTX.save(); if (pct >= PASS) { CTX.confetti(); } CTX.reward();
    return first;
  }
  function examView(root) {
    clearInterval(timer);
    const S = CTX.S, ex = S.exam || { best: 0, attempts: [] };
    if (!X) {
      root.innerHTML = '<div class="head"><h1>Examen blanc</h1><p class="muted">' + N + ' questions de scénario tirées d\'une banque de ' + (D.modules.reduce((s, m) => s + m.quiz.length, 0) + (D.exam || []).length) + ' questions, 30 minutes, un seul essai par question, la correction à la fin. Seuil de réussite : 70 %, comme la certification Data Engineer Associate dont il s\'inspire.</p></div>' +
        '<section class="panel"><div class="hstack between"><div><h2>Prêt ?</h2><p class="muted">Chaque tirage couvre l\'ensemble des 11 modules. Le bilan par domaine t\'indique précisément où réviser.</p></div><button id="ex-start" class="b-primary">Démarrer l\'examen</button></div>' +
        (ex.attempts.length ? '<h3>Tes essais</h3><table class="plain"><tr><th>Date</th><th>Score</th><th></th></tr>' + ex.attempts.map(a => '<tr><td>' + a.at + '</td><td>' + a.s + ' / ' + a.n + ' (' + Math.round(100 * a.s / a.n) + ' %)</td><td>' + (a.s / a.n >= PASS ? '<span class="pill ok">réussi</span>' : '<span class="pill">à retenter</span>') + '</td></tr>').join('') + '</table>' : '') + '</section>';
      $('ex-start').onclick = () => { X = { qs: buildExam(), i: 0, ans: {}, flag: {}, start: Date.now(), done: false }; examView(root); };
      return;
    }
    if (X.done) {
      const ok = X.qs.filter((q, i) => X.ans[i] === q.a).length, pct = ok / X.qs.length, doms = {};
      X.qs.forEach((q, i) => { const d = doms[q.m] = doms[q.m] || { ok: 0, n: 0 }; d.n++; if (X.ans[i] === q.a) d.ok++; });
      const wrong = X.qs.map((q, i) => ({ q, i })).filter(x => X.ans[x.i] !== x.q.a);
      root.innerHTML = '<div class="head"><h1>' + (pct >= PASS ? 'Réussi' : 'Pas encore') + ' : ' + Math.round(pct * 100) + ' %</h1><p class="muted">' + ok + ' bonnes réponses sur ' + X.qs.length + ' en ' + fmt(X.end - X.start) + '. Seuil : 70 %.' + (pct >= PASS && S.exam.xp === 50 ? ' <span class="pill ok">+50 XP</span>' : '') + '</p></div>' +
        '<section class="panel"><h2>Bilan par module</h2>' + Object.keys(doms).map(id => { const d = doms[id], p = d.ok / d.n, m = modOf(id); return '<div class="dom"><a href="#module-' + id + '">' + esc(m.title) + '</a><div class="bar"><i style="width:' + Math.round(p * 100) + '%;background:' + (p >= PASS ? 'var(--ok)' : 'var(--bad)') + '"></i></div><span class="fine">' + d.ok + ' / ' + d.n + '</span></div>'; }).join('') + '</section>' +
        (wrong.length ? '<section class="panel"><h2>À revoir (' + wrong.length + ')</h2>' + wrong.map(w => '<div class="rev"><p><b>' + esc(w.q.q) + '</b></p><p class="bad-line">Ta réponse : ' + (X.ans[w.i] != null ? esc(w.q.o[X.ans[w.i]]) : 'aucune') + '</p><p class="ok-line">Bonne réponse : ' + esc(w.q.o[w.q.a]) + '</p><p class="muted">' + esc(w.q.e) + '</p><a href="#module-' + w.q.m + '" class="fine">Réviser : ' + esc(modOf(w.q.m).title) + '</a></div>').join('') + '</section>' : '<section class="panel"><h2>Sans faute</h2><p class="muted">Rien à revoir.</p></section>') +
        '<div class="hstack"><button id="ex-again" class="b-primary">Refaire un examen</button><a class="btn" href="#accueil">Retour à l\'accueil</a></div>';
      $('ex-again').onclick = () => { X = null; examView(root); };
      return;
    }
    const q = X.qs[X.i], left = DURATION - (Date.now() - X.start), answered = Object.keys(X.ans).length;
    root.innerHTML = '<div class="head"><div class="hstack between"><p class="crumb">Examen blanc · question ' + (X.i + 1) + ' sur ' + X.qs.length + '</p><span id="ex-timer" class="pill timer">' + fmt(left) + '</span></div><div class="bar"><i style="width:' + Math.round(100 * answered / X.qs.length) + '%"></i></div></div>' +
      '<section class="panel"><h2>' + esc(q.q) + '</h2>' + q.o.map((o, k) => '<button class="opt' + (X.ans[X.i] === k ? ' picked' : '') + '" data-k="' + k + '">' + esc(o) + '</button>').join('') + '</section>' +
      '<div class="hstack"><button id="ex-prev"' + (X.i ? '' : ' disabled') + '>← Précédente</button><button id="ex-next"' + (X.i < X.qs.length - 1 ? '' : ' disabled') + '>Suivante →</button><button id="ex-flag" class="' + (X.flag[X.i] ? 'b-warn' : '') + '">' + (X.flag[X.i] ? '⚑ Marquée' : '⚐ Marquer') + '</button></div>' +
      '<section class="panel"><div class="qgrid">' + X.qs.map((_, i) => '<button data-g="' + i + '" class="qn' + (i === X.i ? ' cur' : '') + (X.ans[i] != null ? ' ans' : '') + (X.flag[i] ? ' flag' : '') + '">' + (i + 1) + '</button>').join('') + '</div>' +
      '<div class="hstack between"><span class="fine">' + answered + ' répondue(s) sur ' + X.qs.length + (Object.values(X.flag).some(Boolean) ? ' · des questions sont marquées' : '') + '</span><button id="ex-end" class="' + (X.confirm ? 'b-warn' : '') + '">' + (X.confirm ? 'Confirmer : terminer maintenant' : 'Terminer l\'examen') + '</button></div></section>';
    root.querySelectorAll('[data-k]').forEach(b => b.onclick = () => { X.ans[X.i] = +b.dataset.k; X.confirm = false; examView(root); });
    root.querySelectorAll('[data-g]').forEach(b => b.onclick = () => { X.i = +b.dataset.g; X.confirm = false; examView(root); });
    $('ex-prev').onclick = () => { X.i--; examView(root); }; $('ex-next').onclick = () => { X.i++; examView(root); };
    $('ex-flag').onclick = () => { X.flag[X.i] = !X.flag[X.i]; examView(root); };
    $('ex-end').onclick = () => { if (!X.confirm && answered < X.qs.length) { X.confirm = true; examView(root); } else { finishExam(); examView(root); } };
    timer = setInterval(() => {
      if (!root.isConnected) return clearInterval(timer);
      const l = DURATION - (Date.now() - X.start), t = $('ex-timer'); if (t) { t.textContent = fmt(l); t.classList.toggle('late', l < 5 * 60 * 1000); }
      if (l <= 0) { finishExam(); examView(root); }
    }, 1000);
  }

  window.Extras = {
    init(ctx) { CTX = ctx; }, exam: (root, ctx) => { CTX = ctx; examView(root); },
    themeLabel, cycleTheme, openPalette: openPal, exportProgress, importProgress, openCard,
    downloadNotebook, openTeamModal, getName, translatorHtml, modal
  };
})();
