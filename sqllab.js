// Labo SQL : un vrai moteur SQL (DuckDB-WASM) dans le navigateur, sur les données de la Banque Lanterne.
// Les missions comparent le travail de l'utilisateur à une chaîne de référence calculée par le même moteur.
(function () {
  const L = window.LAB;
  const DUCK = 'https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.29.0/+esm';
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const $ = (r, s) => r.querySelector(s);
  const BASE = ['bronze_agences', 'bronze_clients', 'bronze_comptes', 'bronze_transactions', 'bronze_taux', 'arrivee_20260701', 'arrivee_20260702', 'arrivee_20260703'];
  const PENALTY = [0, 0.15, 0.35, 0.6];

  /* ---------- moteur ---------- */
  const E = { state: 'idle', conn: null, error: '', waiters: [] };
  function loadScript(src) { return new Promise((ok, ko) => { const s = document.createElement('script'); s.src = src; s.charset = 'utf-8'; s.onload = ok; s.onerror = () => ko(new Error('Impossible de charger ' + src)); document.head.appendChild(s); }); }
  async function boot(status) {
    if (E.state === 'ready') return;
    if (E.state === 'loading') return new Promise((ok, ko) => E.waiters.push({ ok, ko, status }));
    E.state = 'loading';
    const say = m => { status && status(m); E.waiters.forEach(w => w.status && w.status(m)); };
    try {
      say('Chargement des données de la Banque Lanterne…');
      if (!window.LANTERNE) await loadScript('data/lanterne.js');
      say('Chargement du moteur DuckDB (environ 7 Mo, une seule fois)…');
      const duckdb = await import(DUCK);
      const bundle = await duckdb.selectBundle(duckdb.getJsDelivrBundles());
      const worker = new Worker(URL.createObjectURL(new Blob(['importScripts("' + bundle.mainWorker + '");'], { type: 'text/javascript' })));
      const db = new duckdb.AsyncDuckDB(new duckdb.VoidLogger(), worker);
      await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
      E.db = db; E.conn = await db.connect();
      for (const [name, text] of Object.entries(window.LANTERNE.files)) await db.registerFileText(name, text);
      say('Lecture des fichiers (couche bronze)…');
      for (const s of split(L.INGEST)) await E.conn.query(s);
      say('Calcul de la chaîne de référence…');
      for (const s of split(L.REF)) await E.conn.query(s);
      E.state = 'ready'; E.waiters.forEach(w => w.ok()); E.waiters = [];
    } catch (e) {
      E.state = 'error'; E.error = String(e && e.message || e); E.waiters.forEach(w => w.ko(e)); E.waiters = [];
      throw e;
    }
  }

  function stripComments(s) { return s.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '').trim(); }
  function split(sql) {
    const out = []; let cur = '', q = null, i = 0;
    while (i < sql.length) {
      const c = sql[i], n = sql[i + 1];
      if (q) { cur += c; if (c === q) { if (n === q) { cur += n; i++; } else q = null; } }
      else if (c === '\'' || c === '"') { q = c; cur += c; }
      else if (c === '-' && n === '-') { while (i < sql.length && sql[i] !== '\n') { cur += sql[i]; i++; } continue; }
      else if (c === '/' && n === '*') { const e = sql.indexOf('*/', i + 2), end = e < 0 ? sql.length : e + 2; cur += sql.slice(i, end); i = end; continue; }
      else if (c === ';') { out.push(cur); cur = ''; }
      else cur += c;
      i++;
    }
    out.push(cur);
    return out.map(s => s.trim()).filter(s => stripComments(s));
  }
  function cell(v, t) {
    if (v === null || v === undefined) return null;
    if (typeof v === 'bigint') return Number(v);
    if (/^Date/.test(t)) return new Date(Number(v)).toISOString().slice(0, 10);
    if (/^Timestamp/.test(t)) return new Date(Number(v)).toISOString().replace('T', ' ').slice(0, 19);
    if (typeof v === 'object') { const n = Number(String(v)); return Number.isNaN(n) ? String(v) : n; }
    return v;
  }
  async function query(sql) {
    const t0 = performance.now(), r = await E.conn.query(sql);
    const cols = r.schema.fields.map(f => f.name), types = r.schema.fields.map(f => String(f.type)), vecs = cols.map((_, i) => r.getChildAt(i)), rows = [];
    for (let j = 0; j < r.numRows; j++) rows.push(vecs.map((v, i) => cell(v.get(j), types[i])));
    return { cols, types, rows, ms: Math.round(performance.now() - t0) };
  }
  async function runScript(sql) {
    const stmts = split(sql); if (!stmts.length) throw new Error('Le script est vide.');
    let last = null, affected = 0, ms = 0;
    for (let i = 0; i < stmts.length; i++) {
      try { const r = await query(stmts[i]); ms += r.ms; if (r.cols.length === 1 && r.cols[0] === 'Count' && /^\s*(insert|update|delete)/i.test(stmts[i])) affected += Number(r.rows[0][0]); else if (r.cols.length) last = r; }
      catch (e) { const err = new Error(String(e.message || e)); err.stmt = i + 1; err.of = stmts.length; throw err; }
    }
    return { last, affected, ms, count: stmts.length };
  }
  const tableExists = async n => (await query('SELECT count(*) FROM information_schema.tables WHERE table_schema = \'main\' AND table_name = \'' + n + '\'')).rows[0][0] > 0;

  /* ---------- comparaison ---------- */
  const keyOf = (row, fl) => row.filter((_, i) => !fl.includes(i)).map(v => v === null ? 'NULL' : typeof v === 'number' ? String(Math.round(v * 1e6) / 1e6) : String(v)).join(' | ');
  const miniTable = (cols, rows) => '<div class="grid-wrap" style="margin-top:6px;max-height:160px"><table class="grid"><thead><tr>' + cols.map(c => '<th>' + esc(c) + '</th>').join('') + '</tr></thead><tbody>' +
    rows.slice(0, 3).map(r => '<tr>' + r.map(v => v === null ? '<td class="nul">NULL</td>' : '<td>' + esc(typeof v === 'number' && !Number.isInteger(v) ? v.toLocaleString('fr-FR', { maximumFractionDigits: 4 }) : v) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>';
  function compare(user, ref, o) {
    o = o || {};
    if (user.cols.length !== ref.cols.length) return { ok: false, msg: 'Je m\'attends à <strong>' + ref.cols.length + ' colonne(s)</strong> (<code>' + esc(ref.cols.join(', ')) + '</code>), ta requête en renvoie <strong>' + user.cols.length + '</strong>.' };
    const fl = ref.types.map((t, i) => /Float|Decimal/.test(t) ? i : -1).filter(i => i >= 0), tol = o.tol || 0.005;
    const grp = rs => { const m = new Map(); rs.forEach(r => { const k = keyOf(r, fl); if (!m.has(k)) m.set(k, { fls: [], row: r }); m.get(k).fls.push(fl.map(i => r[i])); }); return m; };
    const gu = grp(user.rows), gr = grp(ref.rows), missing = [], extra = [];
    gr.forEach((v, k) => {
      const u = gu.get(k);
      if (!u || u.fls.length !== v.fls.length) missing.push(v.row);
      else if (fl.length && v.fls.some((vv, j) => vv.some((n, c) => Math.abs(n - u.fls.slice().sort((p, q) => p[0] - q[0])[j][c]) > tol))) { missing.push(v.row); extra.push(u.row); }
    });
    gu.forEach((v, k) => { if (!gr.has(k)) extra.push(v.row); });
    let order = true;
    if (o.ordered && !missing.length && !extra.length) order = user.rows.every((r, i) => keyOf(r, fl) === keyOf(ref.rows[i], fl));
    if (!missing.length && !extra.length && order && user.rows.length === ref.rows.length) return { ok: true };
    if (!order) return { ok: false, msg: 'Les bonnes lignes sont là, mais pas <strong>dans le bon ordre</strong> : vérifie ton <code>ORDER BY</code>.' };
    let msg = user.rows.length === ref.rows.length ? 'Le nombre de lignes est bon (<strong>' + ref.rows.length + '</strong>) mais certaines valeurs diffèrent.' : 'Tu renvoies <strong>' + user.rows.length + ' ligne(s)</strong>, j\'en attends <strong>' + ref.rows.length + '</strong>.';
    if (missing.length) msg += '<br><b>Attendu (référence) mais absent ou différent :</b>' + miniTable(ref.cols, missing);
    if (extra.length) msg += '<br><b>Présent dans ton résultat mais inattendu :</b>' + miniTable(user.cols, extra);
    return { ok: false, msg };
  }
  const sel = (cols, from) => 'SELECT ' + (cols ? cols.join(', ') : '*') + ' FROM ' + from;

  async function checkMission(m, c) {
    // m0 : valeur attendue en dur ; autres : requête de référence ou table de référence
    if (m.idempotent) return checkIdempotent(m, c);
    if (m.table || m.tables) {
      for (const t of (m.tables || [m.table])) {
        if (!(await tableExists(t.name))) return { ok: false, msg: 'La table <code>' + t.name + '</code> n\'existe pas. Crée-la avec <code>CREATE OR REPLACE TABLE ' + t.name + ' AS …</code>.' };
        const ref = await query(sel(t.cols, t.ref));
        let user;
        try { user = await query(sel(t.cols || ref.cols, t.name)); } catch (e) { return { ok: false, msg: 'Il manque une colonne dans <code>' + t.name + '</code>. Colonnes attendues : <code>' + esc(ref.cols.join(', ')) + '</code>.' }; }
        const r = compare(user, ref, t);
        if (!r.ok) {
          for (const v of (m.variants || []).filter(v => !v.table || v.table === t.name)) { const vr = await query(v.sql); if (vr.cols.length === ref.cols.length && compare(user, vr, t).ok) return { ok: false, msg: v.msg }; }
          return { ok: false, msg: '<code>' + t.name + '</code> : ' + r.msg };
        }
      }
      return { ok: true };
    }
    const user = c.last; if (!user) return { ok: false, msg: 'Ta requête ne renvoie aucun résultat : termine par un <code>SELECT</code>.' };
    const ref = m.expect.rows ? { cols: ['v'], types: ['Int64'], rows: m.expect.rows } : await query(m.expect.sql);
    const r = compare(user, ref, m.expect);
    if (r.ok) return r;
    for (const v of (m.variants || [])) { const vr = await query(v.sql); if (vr.cols.length === ref.cols.length && compare(user, vr, m.expect).ok) return { ok: false, msg: v.msg }; }
    return r;
  }
  async function checkIdempotent(m, c) {
    const id = m.idempotent;
    if (!(await tableExists(id.name))) return { ok: false, msg: 'La table <code>' + id.name + '</code> n\'existe pas : fais d\'abord la mission 3, ou charge la solution de référence.' };
    await E.conn.query('CREATE OR REPLACE TABLE ' + id.name + ' AS SELECT * FROM ' + id.reset);
    const ref = await query('SELECT * FROM ' + id.ref);
    await runScript(c.editor);
    let r = compare(await query('SELECT * FROM ' + id.name), ref);
    if (!r.ok) return { ok: false, msg: 'Après <strong>un</strong> passage de ton script, <code>' + id.name + '</code> n\'est pas dans l\'état attendu (' + r.msg + ')' };
    const before = (await query('SELECT count(*), count_if(statut = \'ANNULEE\') FROM ' + id.name)).rows[0];
    await runScript(c.editor);
    const after = (await query('SELECT count(*), count_if(statut = \'ANNULEE\') FROM ' + id.name)).rows[0];
    if (before.join() !== after.join()) return { ok: false, msg: 'Ton script <strong>n\'est pas idempotent</strong> : après le premier passage la table compte ' + before[0] + ' lignes dont ' + before[1] + ' annulées ; après le second, ' + after[0] + ' dont ' + after[1] + '. Rejouer un job ne doit jamais dupliquer ni défaire.' };
    return { ok: true, extra: 'Deux passages, mêmes compteurs : <strong>' + after[0] + ' lignes, ' + after[1] + ' annulées</strong>.' };
  }

  /* ---------- éditeur ---------- */
  const KW = new Set('SELECT FROM WHERE GROUP BY ORDER LIMIT JOIN LEFT RIGHT INNER OUTER FULL CROSS ON USING AS WITH UNION ALL DISTINCT CASE WHEN THEN ELSE END AND OR NOT NULL IS IN EXISTS CREATE OR REPLACE TABLE VIEW INSERT INTO UPDATE SET DELETE VALUES ANTI SEMI QUALIFY OVER PARTITION EXCLUDE HAVING DESC ASC BETWEEN LIKE DATE TIMESTAMP TRUE FALSE DROP ALTER SCHEMA IF'.split(' '));
  const RE = /(--[^\n]*)|('(?:[^']|'')*')|\b(\d+(?:\.\d+)?)\b|\b([A-Za-z_][A-Za-z0-9_]*)\b/g;
  function hl(s) {
    let out = '', last = 0;
    s.replace(RE, (m, c, str, num, id, off) => {
      out += esc(s.slice(last, off)); last = off + m.length;
      if (c) out += '<i class="c">' + esc(m) + '</i>'; else if (str) out += '<i class="s">' + esc(m) + '</i>'; else if (num) out += '<i class="n">' + m + '</i>';
      else if (KW.has(m.toUpperCase())) out += '<i class="k">' + m + '</i>'; else if (s[last] === '(') out += '<i class="f">' + m + '</i>'; else out += m;
      return m;
    });
    return out + esc(s.slice(last)) + '\n';
  }

  /* ---------- rendu des résultats ---------- */
  function grid(r) {
    const num = r.types.map(t => /Int|Float|Decimal/.test(t));
    const body = r.rows.slice(0, 200).map(row => '<tr>' + row.map((v, i) => v === null ? '<td class="nul">NULL</td>' : '<td' + (num[i] ? ' class="num"' : '') + '>' + esc(typeof v === 'number' && !Number.isInteger(v) ? v.toLocaleString('fr-FR', { maximumFractionDigits: 4 }) : v) + '</td>').join('') + '</tr>').join('');
    return '<div class="grid-wrap"><table class="grid"><thead><tr>' + r.cols.map(c => '<th>' + esc(c) + '</th>').join('') + '</tr></thead><tbody>' + body + '</tbody></table></div>' + (r.rows.length > 200 ? '<p class="fine">200 premières lignes sur ' + r.rows.length + '.</p>' : '');
  }
  function chart(r) {
    const ni = r.types.findIndex(t => /Int|Float|Decimal/.test(t)), li = r.types.findIndex((t, i) => i !== ni && !/Int|Float|Decimal/.test(t));
    if (ni < 0 || li < 0 || r.rows.length < 2 || r.rows.length > 40) return null;
    const max = Math.max(...r.rows.map(x => Math.abs(x[ni]))) || 1, h = 22;
    return '<svg class="bars" viewBox="0 0 640 ' + (r.rows.length * h + 8) + '" role="img" aria-label="Graphique en barres">' + r.rows.map((x, i) => {
      const w = Math.max(1, Math.abs(x[ni]) / max * 400), y = i * h + 4;
      return '<text x="150" y="' + (y + 14) + '" text-anchor="end">' + esc(String(x[li]).slice(0, 22)) + '</text><rect x="158" y="' + y + '" width="' + w + '" height="16" rx="3"/><text x="' + (164 + w) + '" y="' + (y + 13) + '" class="v">' + esc(Number(x[ni]).toLocaleString('fr-FR', { maximumFractionDigits: 2 })) + '</text>';
    }).join('') + '</svg>';
  }

  /* ---------- diagramme de flux (Sankey) ---------- */
  function sankey(nodes, links, W, H) {
    const gap = 10, pad = 8, nw = 12, cols = [...new Set(nodes.map(n => n.c))].sort((a, b) => a - b);
    const tot = c => nodes.filter(n => n.c === c).reduce((s, n) => s + n.v, 0);
    const maxN = Math.max(...cols.map(c => nodes.filter(n => n.c === c).length)), scale = (H - pad * 2 - gap * (maxN - 1)) / Math.max(...cols.map(tot));
    const step = (W - pad * 2 - nw - 150) / (cols.length - 1), byId = {};
    cols.forEach((c, ci) => { let y = pad; nodes.filter(n => n.c === c).forEach(n => { n.h = Math.max(5, n.v * scale); n.y = y; n.x = pad + 90 + ci * step; n.so = 0; n.to = 0; y += n.h + gap; byId[n.id] = n; }); });
    const paths = links.map(l => {
      const s = byId[l.s], t = byId[l.t], h = Math.max(1, l.v * scale), x0 = s.x + nw, x1 = t.x, xm = (x0 + x1) / 2, sy = s.y + s.so, ty = t.y + t.to; s.so += h; t.to += h;
      return '<path class="' + (l.k || 'ok') + '" d="M' + x0 + ' ' + sy + ' C' + xm + ' ' + sy + ' ' + xm + ' ' + ty + ' ' + x1 + ' ' + ty + ' L' + x1 + ' ' + (ty + h) + ' C' + xm + ' ' + (ty + h) + ' ' + xm + ' ' + (sy + h) + ' ' + x0 + ' ' + (sy + h) + ' Z"><title>' + esc(s.l + ' → ' + t.l + ' : ' + l.v) + '</title></path>';
    }).join('');
    const rects = nodes.map(n => '<rect class="nd ' + (n.k || '') + '" x="' + n.x + '" y="' + n.y + '" width="' + nw + '" height="' + n.h + '" rx="2"/>' + (n.c === cols[cols.length - 1] ? '<text x="' + (n.x + nw + 6) + '" y="' + (n.y + Math.min(n.h, 20) / 2 + 4) + '">' : '<text x="' + (n.x - 6) + '" y="' + (n.y + Math.min(n.h, 20) / 2 + 4) + '" text-anchor="end">') + esc(n.l) + ' <tspan class="v">' + n.v.toLocaleString('fr-FR') + '</tspan></text>').join('');
    return '<svg class="sankey" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Le trajet des lignes de la bronze à la gold">' + paths + rects + '</svg>';
  }
  async function flowHtml() {
    const g = async sql => (await query(sql)).rows;
    if (!(await tableExists('silver_transactions')) || !(await tableExists('rejets'))) return '';
    const [[bronze]] = await g('SELECT count(*) FROM bronze_transactions'), [[silver]] = await g('SELECT count(*) FROM silver_transactions'), [[nrej]] = await g('SELECT count(*) FROM rejets');
    const rej = await g('SELECT rejet, count(*) FROM rejets GROUP BY 1 ORDER BY 2 DESC'), dup = bronze - silver - nrej;
    const nodes = [{ id: 'b', l: 'bronze', v: bronze, c: 0, k: 'ok' }, { id: 's', l: 'silver', v: silver, c: 1, k: 'ok' }, { id: 'd', l: 'doublons', v: dup, c: 1, k: 'dup' }], links = [{ s: 'b', t: 's', v: silver, k: 'ok' }, { s: 'b', t: 'd', v: dup, k: 'dup' }];
    rej.forEach(([k, v], i) => { nodes.push({ id: 'r' + i, l: k, v, c: 1, k: 'bad' }); links.push({ s: 'b', t: 'r' + i, v, k: 'bad' }); });
    let note = '<code>bronze ' + bronze + ' = silver ' + silver + ' + rejets ' + nrej + ' + doublons ' + dup + '</code>';
    if (await tableExists('gold_flux')) {
      const [[gold]] = await g('SELECT coalesce(sum(operations), 0) FROM gold_flux'), lost = silver - gold;
      nodes.push({ id: 'g', l: 'gold', v: gold, c: 2, k: 'ok' }); links.push({ s: 's', t: 'g', v: gold, k: 'ok' });
      if (lost > 0) { nodes.push({ id: 'p', l: 'perdues', v: lost, c: 2, k: 'bad' }); links.push({ s: 's', t: 'p', v: lost, k: 'bad' }); }
    }
    return '<h3>Le trajet de tes lignes</h3><div class="scroll"><div style="min-width:600px">' + sankey(nodes, links, 720, 250) + '</div></div><p class="fine">' + note + '</p>';
  }

  /* ---------- vue ---------- */
  function mount(root, ctx, missionId) {
    const S = ctx.S; S.lab = S.lab || { done: {}, hints: {}, drafts: {}, follow: {} };
    const LS = S.lab, MS = L.MISSIONS;
    const cur = MS.find(m => m.id === missionId) || MS.find(m => !LS.done[m.id]) || MS[0];
    const total = MS.reduce((s, m) => s + m.xp, 0), earned = Object.values(LS.done).reduce((s, v) => s + v, 0);
    root.innerHTML =
      '<div class="head"><p class="crumb"><a href="#accueil">Accueil</a> / Labo SQL</p><h1>Labo SQL : la Banque Lanterne</h1>' +
      '<p class="muted">Un vrai moteur SQL tourne dans ton navigateur, sur une banque fictive dont les fichiers contiennent des défauts. Tu les mesures, tu les nettoies en bronze → silver → gold, et chaque mission est vérifiée contre une chaîne de référence. <span class="pill">' + earned + ' / ' + total + ' XP</span></p></div>' +
      '<div class="lab">' +
        '<aside class="lab-side panel"><h3>Missions</h3><ol class="mlist">' + MS.map((m, i) => '<li><a href="#labo-' + m.id + '" class="' + (m.id === cur.id ? 'on' : '') + (LS.done[m.id] != null ? ' done' : '') + '"><span class="mn">' + (LS.done[m.id] != null ? '✓' : i) + '</span>' + esc(m.title) + '<small>' + m.xp + ' XP</small></a></li>').join('') + '</ol>' +
        '<h3>Tables</h3><div id="schema" class="schema"><p class="fine">Le moteur démarre…</p></div>' +
        '<details class="dialect"><summary>Ce moteur et Databricks</summary><table class="plain"><tr><th>Ici (DuckDB)</th><th>Databricks</th></tr>' + L.DIALECT.map(d => '<tr><td><code>' + esc(d[0]) + '</code></td><td><code>' + esc(d[1]) + '</code><br><span class="fine">' + esc(d[2]) + '</span></td></tr>').join('') + '</table></details>' +
        '<button id="lab-reset" class="small">Réinitialiser le labo</button></aside>' +
        '<div class="lab-main">' +
          '<section class="panel" id="brief"><div class="hstack between"><span class="eyebrow">Mission ' + MS.indexOf(cur) + '</span><span class="pill">' + cur.xp + ' XP</span></div><h2>' + esc(cur.title) + '</h2><p class="brief">' + cur.brief + '</p>' +
          (cur.rules ? '<table class="plain rules">' + cur.rules.map(r => '<tr><td><code>' + r[0] + '</code></td><td>' + r[1] + '</td></tr>').join('') + '</table>' : '') + '<div id="needs"></div></section>' +
          '<section class="panel"><div class="editor"><pre class="hl" id="hl" aria-hidden="true"></pre><textarea id="sql" spellcheck="false" aria-label="Éditeur SQL" autocapitalize="off"></textarea></div>' +
          '<div class="hstack"><button id="run" class="b-primary" disabled>▶ Exécuter <kbd>Ctrl</kbd>+<kbd>↵</kbd></button><button id="validate" disabled>✔ Valider la mission</button><button id="hint">💡 Indice <span id="hint-n"></span></button><button id="starter" class="small">Remettre le point de départ</button></div><div id="hint-box"></div></section>' +
          '<section class="panel" id="result"><div id="boot" class="boot"><span class="spin"></span><span id="boot-msg">Démarrage du moteur…</span></div></section>' +
          '<section class="panel" id="verdict" hidden></section>' +
        '</div></div>';

    const ta = $(root, '#sql'), pre = $(root, '#hl'), res = $(root, '#result'), ver = $(root, '#verdict');
    ta.value = LS.drafts[cur.id] != null ? LS.drafts[cur.id] : cur.starter;
    const paint = () => { pre.innerHTML = hl(ta.value); pre.scrollTop = ta.scrollTop; pre.scrollLeft = ta.scrollLeft; };
    ta.addEventListener('input', () => { paint(); LS.drafts[cur.id] = ta.value; ctx.save(); });
    ta.addEventListener('scroll', () => { pre.scrollTop = ta.scrollTop; pre.scrollLeft = ta.scrollLeft; });
    ta.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); run(); }
      else if (e.key === 'Tab') { e.preventDefault(); const s = ta.selectionStart; ta.setRangeText('  ', s, ta.selectionEnd, 'end'); ta.dispatchEvent(new Event('input')); }
    });
    paint();

    const hintN = () => LS.hints[cur.id] || 0;
    const showHints = () => {
      const n = hintN(); $(root, '#hint-n').textContent = n ? '(' + n + '/3)' : '';
      $(root, '#hint-box').innerHTML = cur.hints.slice(0, n).map((h, i) => '<div class="hint"><b>Indice ' + (i + 1) + (i === 2 ? ' · solution' : '') + '</b>' + (i === 2 ? '<pre>' + esc(h) + '</pre>' : '<p>' + h + '</p>') + '</div>').join('') + (n ? '<p class="fine">Récompense actuelle : ' + Math.round(cur.xp * (1 - PENALTY[n])) + ' XP.</p>' : '');
    };
    showHints();
    $(root, '#hint').onclick = () => { if (hintN() < 3) { LS.hints[cur.id] = hintN() + 1; ctx.save(); showHints(); } };
    $(root, '#starter').onclick = () => { ta.value = cur.starter; ta.dispatchEvent(new Event('input')); };

    async function schema() {
      const box = $(root, '#schema'); if (!box) return;
      const r = await query('SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_schema = \'main\' ORDER BY table_name, ordinal_position');
      const by = {}; r.rows.forEach(([t, c, d]) => (by[t] = by[t] || []).push([c, d]));
      const counts = {}; for (const t of Object.keys(by)) counts[t] = (await query('SELECT count(*) FROM ' + t)).rows[0][0];
      box.innerHTML = Object.keys(by).map(t => '<details><summary><b>' + t + '</b> <span class="fine">' + counts[t].toLocaleString('fr-FR') + '</span></summary><ul>' + by[t].map(c => '<li><button class="col" data-ins="' + c[0] + '">' + c[0] + '</button> <span class="fine">' + c[1].toLowerCase() + '</span></li>').join('') + '</ul><button class="small" data-ins="SELECT * FROM ' + t + ' LIMIT 10;">Aperçu</button></details>').join('');
    }
    root.addEventListener('click', e => {
      const b = e.target.closest('[data-ins]'); if (!b) return;
      const t = b.dataset.ins; if (/^SELECT /.test(t)) { ta.value = t; ta.dispatchEvent(new Event('input')); run(); } else { ta.setRangeText(t, ta.selectionStart, ta.selectionEnd, 'end'); ta.dispatchEvent(new Event('input')); ta.focus(); }
    });

    async function needs() {
      const box = $(root, '#needs'); if (!box || !cur.needs) return;
      const miss = []; for (const n of cur.needs) if (!(await tableExists(n))) miss.push(n);
      box.innerHTML = miss.length ? '<div class="note warn">Cette mission part de <code>' + miss.join('</code>, <code>') + '</code>, que tu n\'as pas encore construite. <button id="provision" class="small">Charger la version de référence (sans XP)</button></div>' : '';
      const p = $(root, '#provision'); if (p) p.onclick = async () => { for (const n of miss) await E.conn.query('CREATE OR REPLACE TABLE ' + n + ' AS SELECT * FROM ref.' + n); await schema(); await needs(); };
    }
    const err = e => '<div class="note bad"><b>Erreur' + (e.stmt && e.of > 1 ? ' (instruction ' + e.stmt + ' sur ' + e.of + ')' : '') + '</b><pre class="errtxt">' + esc(String(e.message).replace(/^(Catalog|Binder|Parser|Conversion|Invalid Input|Constraint) Error: /, '$1 : ').slice(0, 600)) + '</pre></div>';
    let tab = 'table', lastRes = null;
    const showResult = (r, info) => {
      lastRes = r;
      const ch = r && chart(r);
      res.innerHTML = '<div class="hstack between"><b>Résultat</b><span class="fine">' + (r ? r.rows.length.toLocaleString('fr-FR') + ' ligne(s) · ' : '') + info + '</span>' +
        '<div class="hstack">' + (r && r.rows.length ? '<button class="small" id="dl-csv">⬇ CSV</button>' : '') +
        (ch ? '<span class="seg"><button data-tab="table" class="' + (tab === 'table' ? 'on' : '') + '">Tableau</button><button data-tab="chart" class="' + (tab === 'chart' ? 'on' : '') + '">Graphique</button></span>' : '') + '</div></div>' +
        (r ? (tab === 'chart' && ch ? ch : grid(r)) : '<p class="muted">Aucune ligne à afficher.</p>');
      res.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { tab = b.dataset.tab; showResult(r, info); });
      const dl = $(res, '#dl-csv');
      if (dl) dl.onclick = () => {
        const csv = [r.cols.join(',')].concat(r.rows.map(row => row.map(v => v === null ? '' : typeof v === 'string' && /[,;"\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v).join(','))).join('\n');
        const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = 'resultat-' + cur.id + '.csv';
        document.body.appendChild(a); a.click(); a.remove();
      };
    };
    async function run(silent) {
      if (E.state !== 'ready') return null;
      const text = ta.value.slice(ta.selectionStart, ta.selectionEnd).trim() ? ta.value.slice(ta.selectionStart, ta.selectionEnd) : ta.value;
      try { const r = await runScript(text); showResult(r.last, (r.affected ? r.affected + ' ligne(s) modifiée(s) · ' : '') + r.ms + ' ms'); await schema(); await needs(); return r; }
      catch (e) { res.innerHTML = err(e); return null; }
    }
    $(root, '#run').onclick = () => run();
    $(root, '#lab-reset').onclick = async () => {
      if (E.state !== 'ready') return;
      const t = (await query('SELECT table_name FROM information_schema.tables WHERE table_schema = \'main\'')).rows.map(r => r[0]);
      for (const n of t.filter(n => !BASE.includes(n))) await E.conn.query('DROP TABLE ' + n);
      for (const s of split(L.INGEST)) await E.conn.query(s);
      await schema(); await needs(); res.innerHTML = '<p class="muted">Labo réinitialisé : la bronze est intacte, tes tables sont supprimées.</p>';
    };

    $(root, '#validate').onclick = async () => {
      const btn = $(root, '#validate'); btn.disabled = true; ver.hidden = false; ver.innerHTML = '<div class="boot"><span class="spin"></span>Vérification…</div>';
      try {
        const m = cur, n = hintN(); let r = null;
        if (!m.idempotent) { r = await run(); if (!r) { ver.hidden = true; return; } }
        const out = await checkMission(m, { last: r && r.last, editor: ta.value });
        if (!out.ok) {
          let up = '';
          for (const nd of (m.needs || [])) { try { if (!compare(await query('SELECT * FROM ' + nd), await query('SELECT * FROM ref.' + nd), { tol: 0.011 }).ok) up += '<p>⚠ Ta table <code>' + nd + '</code> ne correspond pas à la référence : l\'erreur vient peut-être d\'une mission précédente.</p>'; } catch (e) { /* table absente : déjà signalé */ } }
          ver.innerHTML = '<div class="note bad"><b>Pas encore.</b><p>' + out.msg + '</p>' + up + '</div>';
        }
        else {
          const gain = Math.round(m.xp * (1 - PENALTY[n])), first = LS.done[m.id] == null;
          if (first) { LS.done[m.id] = gain; ctx.save(); ctx.confetti(); ctx.reward(); }
          const pyTitle = (m.id === 'm7' || m.id === 'm8') ? 'Équivalent Databricks (MERGE)' : 'Équivalent PySpark';
          ver.innerHTML = '<div class="note ok"><b>Mission réussie' + (first ? ' · +' + gain + ' XP' : ' (déjà validée)') + '</b>' + (out.extra ? '<p>' + out.extra + '</p>' : '') + (m.after ? '<p>' + m.after + '</p>' : '') + '</div>' +
            (m.followup ? '<div class="follow" id="follow"></div>' : '') + '<div id="flow"></div>' +
            '<details open><summary>' + pyTitle + '</summary><pre>' + esc(m.py) + '</pre></details>' +
            '<div class="hstack">' + (MS[MS.indexOf(m) + 1] ? '<a class="btn b-primary" href="#labo-' + MS[MS.indexOf(m) + 1].id + '">Mission suivante →</a>' : '<a class="btn b-primary" href="#accueil">Retour à l\'accueil</a>') + '</div>';
          if (m.flow || m.id === 'm4' || m.id === 'm5' || m.id === 'm9') { const h = await flowHtml(); if (h) $(root, '#flow').innerHTML = h; }
          if (m.followup) followup(m);
        }
      } catch (e) { ver.innerHTML = err(e); }
      btn.disabled = false;
    };
    function followup(m) {
      const f = m.followup, box = $(root, '#follow'), done = LS.follow[m.id];
      box.innerHTML = '<h3>' + esc(f.q) + '</h3>' + f.options.map((o, i) => '<button class="opt' + (done != null && i === f.answer ? ' right' : '') + '" data-o="' + i + '"' + (done != null ? ' disabled' : '') + '>' + esc(o) + '</button>').join('') + (done != null ? '<div class="expl">' + f.explain + '</div>' : '');
      box.querySelectorAll('[data-o]').forEach(b => b.onclick = () => {
        if (+b.dataset.o === f.answer) { LS.follow[m.id] = true; LS.done[m.id] += f.xp; ctx.save(); ctx.reward(); followup(m); }
        else { b.classList.add('wrong'); b.disabled = true; }
      });
    }

    // démarrage du moteur
    boot(m => { const el = $(root, '#boot-msg'); if (el) el.textContent = m; }).then(async () => {
      if (!root.isConnected) return;
      res.innerHTML = '<p class="muted">Le moteur est prêt. Écris ta requête puis <kbd>Ctrl</kbd>+<kbd>↵</kbd>.</p>';
      $(root, '#run').disabled = false; $(root, '#validate').disabled = false;
      await schema(); await needs();
    }).catch(e => { if (root.isConnected) res.innerHTML = '<div class="note bad"><b>Le moteur SQL n\'a pas pu démarrer.</b><p>Il se télécharge depuis un CDN public (connexion internet requise, environ 7 Mo). Vérifie ta connexion ou un éventuel proxy d\'entreprise, puis recharge la page.</p><pre class="errtxt">' + esc(E.error) + '</pre></div>'; });
  }

  window.SQLLab = { mount, _e: E, _query: query };
})();
