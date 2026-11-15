// Simulateurs interactifs du Lakehouse Dojo.
// Chaque simulateur : { id, mod, title, tag, mission, mount(root, win) }.
// mount dessine dans root ; win() signale que la mission est réussie.
(function () {
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const alive = root => root.isConnected;
  const money = n => Math.round(n).toLocaleString('fr-FR') + ' $';
  const SIMS = [];

  /* ---------- 1. Architecture ---------- */
  SIMS.push({
    id: 'archi', mod: 'm1', title: 'Qui fait quoi dans la plateforme',
    tag: 'Explore les deux plans et suis le trajet d\'une requête.',
    mission: 'Ouvre les 6 composants.',
    mount(root, win) {
      const C = {
        ui: ['Interface web et notebooks', 'Tu écris le code ici. L\'interface ne calcule rien : elle envoie les commandes au plan de calcul.'],
        jobs: ['Ordonnanceur de jobs', 'Il déclenche les traitements planifiés et suit leur état, tâche par tâche.'],
        uc: ['Unity Catalog', 'Il sait où sont les tables et qui a le droit de les lire. Chaque requête passe par lui.'],
        compute: ['Cluster : driver + workers', 'Les machines qui exécutent Spark. Le driver planifie, les workers lisent et transforment les données.'],
        conn: ['Access Connector', 'L\'identité managée Azure par laquelle la plateforme accède à ton stockage, sans mot de passe.'],
        store: ['Stockage ADLS : tables Delta', 'Tes données, en fichiers Parquet ouverts, dans ton compte de stockage. Elles ne quittent pas ton abonnement.']
      };
      const PATH = [['ui', 'Tu lances une cellule dans un notebook.'], ['uc', 'Unity Catalog vérifie tes droits et donne l\'emplacement de la table.'],
        ['compute', 'Le driver construit le plan et le distribue aux workers.'], ['conn', 'Le cluster s\'authentifie auprès du stockage.'],
        ['store', 'Les workers lisent les fichiers Parquet utiles.'], ['compute', 'Les workers agrègent, le driver rassemble le résultat.'], ['ui', 'Le résultat s\'affiche sous ta cellule.']];
      const st = { mode: 'classique', sel: 'ui', seen: new Set(['ui']), step: -1 };
      const box = k => `<button class="node${st.sel === k ? ' sel' : ''}${st.step >= 0 && PATH[st.step][0] === k ? ' pulse' : ''}${st.seen.has(k) ? ' seen' : ''}" data-k="${k}">${C[k][0]}</button>`;
      const draw = () => {
        const serverless = st.mode === 'serverless';
        root.innerHTML = `
          <div class="seg"><button data-mode="classique" class="${serverless ? '' : 'on'}">Calcul classique</button><button data-mode="serverless" class="${serverless ? 'on' : ''}">Serverless</button></div>
          <div class="zones">
            <div class="zone z-dbx"><span class="zlabel">Plan de contrôle · compte Databricks</span><div class="nodes">${box('ui')}${box('jobs')}${box('uc')}</div>
              ${serverless ? `<span class="zlabel" style="margin-top:14px">Plan de calcul serverless · compte Databricks</span><div class="nodes">${box('compute')}</div>` : ''}</div>
            <div class="zone z-you"><span class="zlabel">Ton abonnement Azure</span>
              ${serverless ? '' : `<div class="nodes">${box('compute')}</div>`}<div class="nodes">${box('conn')}${box('store')}</div></div>
          </div>
          <div class="sim-note"><b>${st.step >= 0 ? 'Étape ' + (st.step + 1) + ' sur ' + PATH.length : C[st.sel][0]}</b><br>${st.step >= 0 ? PATH[st.step][1] : C[st.sel][1]}
            ${st.step < 0 && st.sel === 'compute' ? '<br><i>' + (serverless ? 'En serverless, les machines sont chez Databricks : démarrage en quelques secondes, rien à administrer.' : 'En classique, les VM tournent dans ton abonnement : tu choisis leur taille et tu les paies à Azure.') + '</i>' : ''}</div>
          <div class="sim-actions"><button class="b-primary" data-run="1"${st.step >= 0 ? ' disabled' : ''}>Suivre une requête</button><span class="muted">${st.seen.size} / 6 composants ouverts</span></div>`;
      };
      root.onclick = e => {
        const b = e.target.closest('button'); if (!b) return;
        if (b.dataset.mode) st.mode = b.dataset.mode;
        if (b.dataset.k && st.step < 0) { st.sel = b.dataset.k; st.seen.add(st.sel); if (st.seen.size === 6) win(); }
        if (b.dataset.run) {
          st.step = 0;
          const t = setInterval(() => { if (!alive(root)) return clearInterval(t); st.step++; if (st.step >= PATH.length) { st.step = -1; clearInterval(t); } draw(); }, 1300);
        }
        draw();
      };
      draw();
    }
  });

  /* ---------- 2. Coût du calcul ---------- */
  SIMS.push({
    id: 'cout', mod: 'm2', title: 'La facture d\'un pipeline nocturne',
    tag: 'Même traitement, même cluster : seul le type de calcul change.',
    mission: 'Passe sous 250 $ par mois sans toucher aux workers ni à la durée.',
    mount(root, win) {
      const st = { type: 'all', workers: 8, hours: 2, auto: false };
      const DBU = 0.75, VM = 0.29, RATE = { all: 0.55, job: 0.30 }, DAYS = 22;
      const cost = s => {
        const billed = s.type === 'job' ? s.hours : (s.auto ? s.hours + 0.5 : 24);
        const base = (s.workers + 1) * billed * DAYS;
        return { billed, dbu: base * DBU * RATE[s.type], vm: base * VM };
      };
      const ref = cost({ type: 'all', workers: 8, hours: 2, auto: false }), refTotal = ref.dbu + ref.vm;
      const draw = () => {
        const c = cost(st), total = c.dbu + c.vm, pct = Math.max(2, 100 * total / refTotal);
        root.innerHTML = `
          <div class="sim-cols">
            <div class="ctrl">
              <label>Type de calcul</label>
              <div class="seg"><button data-type="all" class="${st.type === 'all' ? 'on' : ''}">All-purpose</button><button data-type="job" class="${st.type === 'job' ? 'on' : ''}">Job compute</button></div>
              <label for="sw">Workers : <b>${st.workers}</b></label><input id="sw" type="range" min="1" max="20" value="${st.workers}" data-f="workers">
              <label for="sh">Durée du traitement : <b>${st.hours} h par jour</b></label><input id="sh" type="range" min="1" max="8" value="${st.hours}" data-f="hours">
              <label class="chk"><input id="sa" type="checkbox" data-f="auto"${st.auto ? ' checked' : ''}${st.type === 'job' ? ' disabled' : ''}> Auto-termination après 30 min d'inactivité</label>
            </div>
            <div>
              <div class="big">${money(total)}<small> par mois</small></div>
              <div class="stack" style="width:${pct}%"><i class="s-dbu" style="flex:${c.dbu}"></i><i class="s-vm" style="flex:${c.vm}"></i></div>
              <div class="legend"><span><i class="s-dbu"></i>DBU Databricks ${money(c.dbu)}</span><span><i class="s-vm"></i>VM Azure ${money(c.vm)}</span></div>
              <p class="muted">Cluster facturé <b>${c.billed} h par jour</b>${st.type === 'all' && !st.auto ? ' : il reste allumé jour et nuit' : st.type === 'job' ? ' : il n\'existe que le temps du run' : ''}. Configuration de départ : ${money(refTotal)}.</p>
            </div>
          </div>
          <p class="fine">Tarifs indicatifs pour raisonner en ordres de grandeur, pas un devis.</p>`;
        if (total < 250 && st.workers === 8 && st.hours === 2) win();
      };
      root.onclick = e => { const b = e.target.closest('button[data-type]'); if (b) { st.type = b.dataset.type; draw(); } };
      root.onchange = e => { const f = e.target.dataset.f; if (!f) return; st[f] = f === 'auto' ? e.target.checked : +e.target.value; draw(); };
      draw();
    }
  });

  /* ---------- 3. Droits Unity Catalog ---------- */
  SIMS.push({
    id: 'droits', mod: 'm3', title: 'Pourquoi l\'analyste ne voit rien',
    tag: 'Accorde les privilèges un par un et relance la requête.',
    mission: 'Fais réussir la requête du groupe analystes.',
    mount(root, win) {
      const st = { cat: false, sch: false, sel: false, res: null, kind: 'managed', dropped: false };
      const G = [['cat', 'USE CATALOG', 'ventes'], ['sch', 'USE SCHEMA', 'ventes.silver'], ['sel', 'SELECT', 'ventes.silver.clients']];
      const draw = () => {
        root.innerHTML = `
          <div class="sim-cols">
            <div>
              <div class="tree"><div class="lvl ${st.cat ? 'open' : ''}"><span>Catalogue <b>ventes</b></span>
                <div class="lvl ${st.sch ? 'open' : ''}"><span>Schéma <b>silver</b></span>
                  <div class="lvl ${st.sel ? 'open' : ''}"><span>Table <b>clients</b></span></div></div></div></div>
              <p class="muted" style="margin:10px 0 6px">Privilèges du groupe <b>analystes</b></p>
              ${G.map(g => `<label class="chk"><input type="checkbox" id="g-${g[0]}" data-g="${g[0]}"${st[g[0]] ? ' checked' : ''}> <code>GRANT ${g[1]}</code> sur ${g[2]}</label>`).join('')}
            </div>
            <div>
              <pre class="mini">SELECT * FROM ventes.silver.clients;</pre>
              <button class="b-primary" data-run="1">Exécuter en tant qu'analyste</button>
              <div class="result ${st.res === null ? '' : st.res ? 'ok' : 'ko'}">${st.res === null ? 'Aucune exécution pour l\'instant.' : st.res === true
                ? '<table class="t"><tr><th>id</th><th>nom</th><th>pays</th></tr><tr><td>1</td><td>Durand</td><td>FR</td></tr><tr><td>2</td><td>Martin</td><td>BE</td></tr></table>'
                : '<b>PERMISSION_DENIED</b><br>' + esc(st.res)}</div>
            </div>
          </div>
          <div class="sim-sub"><b>Et si on supprime la table ?</b>
            <div class="seg"><button data-kind="managed" class="${st.kind === 'managed' ? 'on' : ''}">Table managée</button><button data-kind="external" class="${st.kind === 'external' ? 'on' : ''}">Table externe</button></div>
            <button data-drop="1">${st.dropped ? 'Recréer la table' : 'DROP TABLE clients'}</button>
            <div class="files"><span class="chip ${st.dropped ? 'gone' : 'live'}">métadonnée Unity Catalog</span>
              <span class="chip ${st.dropped && st.kind === 'managed' ? 'gone' : 'live'}">fichiers Parquet dans ADLS</span></div>
            <span class="muted">${!st.dropped ? 'La table existe.' : st.kind === 'managed' ? 'Managée : les données partent avec la table (UNDROP reste possible quelques jours).' : 'Externe : seule la métadonnée disparaît, les fichiers restent dans ton stockage.'}</span>
          </div>`;
      };
      root.onchange = e => { const g = e.target.dataset.g; if (g) { st[g] = e.target.checked; st.res = null; draw(); } };
      root.onclick = e => {
        const b = e.target.closest('button'); if (!b) return;
        if (b.dataset.run) {
          st.res = !st.cat ? 'Il manque USE CATALOG sur le catalogue ventes.' : !st.sch ? 'Il manque USE SCHEMA sur le schéma ventes.silver.' : !st.sel ? 'Il manque SELECT sur la table ventes.silver.clients.' : true;
          if (st.res === true) win();
        }
        if (b.dataset.kind) { st.kind = b.dataset.kind; st.dropped = false; }
        if (b.dataset.drop) st.dropped = !st.dropped;
        draw();
      };
      draw();
    }
  });

  /* ---------- 4. Notebook ---------- */
  SIMS.push({
    id: 'notebook', mod: 'm4', title: 'Un notebook, cellule par cellule',
    tag: 'Exécute les cellules, puis vide l\'état pour voir ce qui survit.',
    mission: 'Provoque une erreur, puis fais passer toutes les cellules au vert.',
    mount(root, win) {
      const CELLS = [
        ['sql', 'CREATE SCHEMA IF NOT EXISTS dojo', s => { s.schema = true; return 'OK'; }],
        ['python', 'bronze = spark.read.table("samples.nyctaxi.trips")\nbronze.write.mode("overwrite").saveAsTable("dojo.courses_bronze")', s => { if (!s.schema) throw 'SCHEMA_NOT_FOUND : le schéma dojo n\'existe pas.'; s.vBronze = true; s.tBronze = true; return 'Table dojo.courses_bronze créée.'; }],
        ['python', 'silver = bronze.filter("trip_distance > 0")\nsilver.write.mode("overwrite").saveAsTable("dojo.courses_silver")', s => { if (!s.vBronze) throw 'NameError : name \'bronze\' is not defined'; s.tSilver = true; return 'Table dojo.courses_silver créée.'; }],
        ['sql', 'SELECT jour, count(*) AS courses\nFROM dojo.courses_silver GROUP BY jour', s => { if (!s.tSilver) throw 'TABLE_OR_VIEW_NOT_FOUND : dojo.courses_silver'; return '<div class="bars"><i style="height:45%"></i><i style="height:70%"></i><i style="height:100%"></i><i style="height:60%"></i><i style="height:82%"></i></div>'; }],
        ['md', '# Pipeline courses\nBronze brut, Silver filtré, agrégat par jour.', () => '<b>Pipeline courses</b><br>Bronze brut, Silver filtré, agrégat par jour.']
      ];
      const st = { s: {}, out: CELLS.map(() => null), n: 0, err: false, note: '' };
      const run = i => { try { st.out[i] = { ok: true, v: CELLS[i][2](st.s), n: ++st.n }; } catch (m) { st.out[i] = { ok: false, v: esc(m), n: ++st.n }; st.err = true; } };
      const draw = () => {
        root.innerHTML = `
          <div class="sim-actions"><button data-all="1">Tout exécuter</button><button data-clear="1">Vider l'état (clear state)</button>
            <span class="muted">Variables en mémoire : ${st.s.vBronze ? '<code>bronze</code>' : 'aucune'} · Tables : ${[st.s.tBronze && 'courses_bronze', st.s.tSilver && 'courses_silver'].filter(Boolean).join(', ') || 'aucune'}</span></div>
          ${CELLS.map((c, i) => `<div class="cell ${st.out[i] ? (st.out[i].ok ? 'ok' : 'ko') : ''}">
            <div class="cell-h"><button class="run" data-i="${i}" aria-label="Exécuter la cellule ${i + 1}">▶</button><span class="lang">%${c[0]}</span><span class="muted">${st.out[i] ? '[' + st.out[i].n + ']' : '[ ]'}</span></div>
            <pre class="mini">${esc(c[1])}</pre>${st.out[i] ? `<div class="cell-o">${st.out[i].v}</div>` : ''}</div>`).join('')}
          ${st.note ? `<div class="sim-note">${st.note}</div>` : ''}`;
        if (st.err && st.out.every(o => o && o.ok)) win();
      };
      root.onclick = e => {
        const b = e.target.closest('button'); if (!b) return;
        if (b.dataset.i != null) { run(+b.dataset.i); st.note = st.out[+b.dataset.i].ok ? '' : 'Une cellule dépend de ce que les précédentes ont laissé : des variables en mémoire, ou des tables sur le stockage.'; }
        if (b.dataset.all) { CELLS.forEach((c, i) => run(i)); st.note = ''; }
        if (b.dataset.clear) { st.s.vBronze = false; st.out = CELLS.map(() => null); st.note = 'État vidé. La variable <code>bronze</code> a disparu, mais les tables sont toujours là : elles vivent sur le stockage, pas dans le notebook. Essaie de relancer seulement la 3e cellule.'; }
        draw();
      };
      draw();
    }
  });

  /* ---------- 5. Spark : paresse et shuffle ---------- */
  SIMS.push({
    id: 'spark', mod: 'm5', title: 'Paresse et shuffle',
    tag: 'Empile des transformations : rien ne bouge avant l\'action.',
    mission: 'Exécute un plan qui contient un filtre et un groupBy.',
    mount(root, win) {
      const INIT = [['a', 'b', 'c', 'a'], ['b', 'b', 'c', 'a'], ['c', 'a', 'b', 'c'], ['a', 'c', 'b', 'b']];
      const NAME = { a: 'bleu', b: 'or', c: 'rouge' };
      let st;
      const reset = () => { st = { parts: INIT.map(p => p.slice()), plan: [], running: false, msg: 'Quatre partitions, douze lignes. Ajoute des transformations.', stages: 0, counts: null }; };
      reset();
      const draw = () => {
        root.innerHTML = `
          <div class="sim-actions"><button data-add="filter"${st.running ? ' disabled' : ''}>+ filter(couleur ≠ rouge)</button><button data-add="group"${st.running ? ' disabled' : ''}>+ groupBy(couleur).count()</button>
            <button class="b-primary" data-go="1"${st.running || !st.plan.length ? ' disabled' : ''}>▶ Action : show()</button><button data-reset="1">Réinitialiser</button></div>
          <div class="plan">Plan : ${st.plan.length ? st.plan.map(p => `<span class="chip ${p === 'group' ? 'wide' : 'narrow'}">${p === 'filter' ? 'filter · étroite' : 'groupBy · large'}</span>`).join(' → ') : '<span class="muted">vide</span>'}</div>
          <div class="parts">${st.parts.map((p, i) => `<div class="part"><span class="zlabel">Partition ${i + 1}</span><div class="dots">${p.map(k => `<i class="dot d-${k}"></i>`).join('')}</div></div>`).join('')}</div>
          <div class="sim-note">${st.msg}${st.counts ? '<br><b>Résultat :</b> ' + Object.keys(st.counts).map(k => NAME[k] + ' = ' + st.counts[k]).join(', ') + ' · <b>' + st.stages + ' stage' + (st.stages > 1 ? 's' : '') + '</b>' : ''}</div>`;
      };
      root.onclick = e => {
        const b = e.target.closest('button'); if (!b) return;
        if (b.dataset.reset) reset();
        if (b.dataset.add) { st.plan.push(b.dataset.add); st.msg = 'Spark a noté l\'intention. Aucune donnée n\'a bougé : c\'est l\'évaluation paresseuse.'; }
        if (b.dataset.go) {
          const hasF = st.plan.includes('filter'), hasG = st.plan.includes('group');
          const reorder = hasF && hasG && st.plan.indexOf('filter') > st.plan.indexOf('group');
          const steps = [];
          if (hasF) steps.push(() => { st.parts = st.parts.map(p => p.filter(k => k !== 'c')); st.msg = 'Stage 1 · filter : chaque partition se filtre seule, sur place. Aucun échange.' + (reorder ? ' Catalyst a remonté le filtre avant le groupBy.' : ''); });
          if (hasG) steps.push(() => { const all = st.parts.flat(); st.parts = ['a', 'b', 'c', null].map(k => all.filter(x => x === k)); st.msg = 'Shuffle : les lignes de même couleur doivent se retrouver ensemble. Elles traversent le réseau, un nouveau stage commence.'; });
          steps.push(() => { const all = st.parts.flat(); st.counts = {}; all.forEach(k => st.counts[k] = (st.counts[k] || 0) + 1); st.stages = 1 + (hasG ? 1 : 0); st.msg = 'Action terminée.'; st.running = false; if (hasF && hasG) win(); });
          st.running = true; st.parts = INIT.map(p => p.slice()); st.counts = null; st.msg = 'L\'action déclenche tout le plan…';
          steps.forEach((f, i) => setTimeout(() => { if (alive(root)) { f(); draw(); } }, 1100 * (i + 1)));
        }
        draw();
      };
      draw();
    }
  });

  /* ---------- 6. Delta Lake ---------- */
  SIMS.push({
    id: 'delta', mod: 'm6', title: 'Le journal de transactions Delta',
    tag: 'Chaque commande écrit un commit. Remonte le temps, puis fais le ménage.',
    mission: 'Fais un UPDATE, lance VACUUM, puis essaie de relire la version 0.',
    mount(root, win) {
      const NEW = [['Rossi', 'IT'], ['Nowak', 'PL'], ['Silva', 'PT'], ['Jansen', 'NL'], ['Garcia', 'ES'], ['Kovac', 'HR']];
      // phys : les fichiers sur le disque. ent : les périodes pendant lesquelles le journal référence un fichier.
      const st = {
        phys: { 1: { rows: [{ id: 1, nom: 'Durand', pays: 'FR' }, { id: 2, nom: 'Martin', pays: 'FR' }], gone: false }, 2: { rows: [{ id: 3, nom: 'Schmidt', pays: 'DE' }], gone: false } },
        ent: [{ n: 1, add: 0, rem: null }, { n: 2, add: 0, rem: null }],
        log: [{ v: 0, op: 'CREATE TABLE', add: [1, 2], rem: [] }], view: 0, nf: 3, nid: 4, msg: 'Version 0 : deux fichiers Parquet, un commit dans le journal.'
      };
      const last = () => st.log.length - 1;
      const at = v => st.ent.filter(e => e.add <= v && (e.rem === null || e.rem > v));
      const R = e => st.phys[e.n].rows;
      const commit = (op, adds, rems, readd) => {
        const v = st.log.length;
        rems.forEach(e => e.rem = v);
        const ns = adds.map(rows => { const n = st.nf++; st.phys[n] = { rows, gone: false }; st.ent.push({ n, add: v, rem: null }); return n; });
        (readd || []).forEach(n => { st.ent.push({ n, add: v, rem: null }); ns.push(n); });
        st.log.push({ v, op, add: ns, rem: rems.map(e => e.n) }); st.view = v;
      };
      const OPS = {
        insert() { const p = NEW[(st.nid - 4) % NEW.length]; commit('INSERT', [[{ id: st.nid++, nom: p[0], pays: p[1] }]], []); st.msg = 'INSERT : un nouveau fichier, rien n\'est réécrit.'; },
        update() { const f = at(last()).find(x => R(x).length); if (!f) return; const rows = R(f).map((r, i) => i ? r : { ...r, pays: r.pays === 'BE' ? 'FR' : 'BE' }); commit('UPDATE', [rows], [f]); st.msg = 'UPDATE : Parquet est immuable. Le fichier est réécrit en entier, l\'ancien est retiré du journal mais reste sur le disque.'; },
        del() { const fs = at(last()).filter(x => R(x).length), f = fs[fs.length - 1]; if (!f) return; const rows = R(f).slice(0, -1); commit('DELETE', rows.length ? [rows] : [], [f]); st.msg = 'DELETE : même mécanique, le fichier touché est remplacé.'; },
        merge() { const f = at(last()).find(x => R(x).length); if (!f) return; const p = NEW[(st.nid - 4) % NEW.length]; const rows = R(f).map((r, i) => i ? r : { ...r, nom: r.nom.toUpperCase() }); commit('MERGE', [rows, [{ id: st.nid++, nom: p[0], pays: p[1] }]], [f]); st.msg = 'MERGE : mise à jour et insertion dans un seul commit atomique.'; },
        optimize() { const fs = at(last()); if (fs.length < 2) { st.msg = 'Un seul fichier actif : rien à compacter.'; return; } commit('OPTIMIZE', [fs.flatMap(R)], fs); st.msg = 'OPTIMIZE : les petits fichiers sont compactés en un seul. Les données ne changent pas.'; },
        vacuum() { const now = at(last()).map(e => e.n), dead = Object.keys(st.phys).filter(n => !st.phys[n].gone && !now.includes(+n)); dead.forEach(n => st.phys[n].gone = true); st.msg = dead.length ? 'VACUUM : ' + dead.length + ' fichier(s) supprimé(s) du disque. On simule ici une rétention dépassée (7 jours par défaut).' : 'Rien à nettoyer : tous les fichiers sont utilisés par la version actuelle.'; },
        restore() { const target = at(st.view).map(e => e.n), now = at(last()), from = st.view; commit('RESTORE → v' + from, [], now.filter(e => !target.includes(e.n)), target.filter(n => !now.some(e => e.n === n))); st.msg = 'RESTORE : un nouveau commit qui réactive les fichiers de la version ' + from + '. L\'historique n\'est pas effacé.'; }
      };
      const draw = () => {
        const L = last(), cur = at(st.view).map(e => e.n), readable = cur.every(n => !st.phys[n].gone), rows = cur.flatMap(n => st.phys[n].rows).sort((a, b) => a.id - b.id);
        const files = Object.keys(st.phys).map(n => ({ n: +n, rows: st.phys[n].rows, gone: st.phys[n].gone, live: cur.includes(+n) }));
        if (!readable) { win(); }
        root.innerHTML = `
          <div class="sim-actions">${[['insert', 'INSERT'], ['update', 'UPDATE'], ['del', 'DELETE'], ['merge', 'MERGE'], ['optimize', 'OPTIMIZE'], ['vacuum', 'VACUUM']].map(o => `<button data-op="${o[0]}" class="${o[0] === 'vacuum' ? 'b-warn' : ''}">${o[1]}</button>`).join('')}</div>
          <div class="delta">
            <div class="col"><span class="zlabel">_delta_log</span>${st.log.slice().reverse().map(c => `<button class="commit${c.v === st.view ? ' sel' : ''}" data-v="${c.v}"><b>${String(c.v).padStart(3, '0')}.json</b> ${esc(c.op)}<small>${c.add.map(n => '+f' + n).concat(c.rem.map(n => '−f' + n)).join(' ') || '—'}</small></button>`).join('')}</div>
            <div class="col"><span class="zlabel">Fichiers Parquet sur le disque</span><div class="files">${files.map(f => `<span class="chip ${f.gone ? 'gone' : f.live ? 'live' : 'stale'}">f${f.n}.parquet<small>${f.gone ? 'supprimé' : f.live ? f.rows.length + ' ligne' + (f.rows.length > 1 ? 's' : '') : 'hors version'}</small></span>`).join('')}</div>
              <div class="legend"><span><i class="lg-live"></i>lu par cette version</span><span><i class="lg-stale"></i>sur le disque, ignoré</span><span><i class="lg-gone"></i>supprimé</span></div></div>
            <div class="col"><span class="zlabel">SELECT * … VERSION AS OF ${st.view}</span>
              ${readable ? `<table class="t"><tr><th>id</th><th>nom</th><th>pays</th></tr>${rows.map(r => `<tr><td>${r.id}</td><td>${esc(r.nom)}</td><td>${r.pays}</td></tr>`).join('') || '<tr><td colspan="3" class="muted">table vide</td></tr>'}</table>`
                : '<div class="result ko"><b>Version illisible</b><br>Ses fichiers ont été supprimés par VACUUM. Le time travel n\'est pas une sauvegarde.</div>'}</div>
          </div>
          <div class="sim-actions"><label for="tt">Time travel : version <b>${st.view}</b>${st.view === L ? ' (actuelle)' : ''}</label><input id="tt" type="range" min="0" max="${L}" value="${st.view}"${L ? '' : ' disabled'}>
            <button data-op="restore"${st.view === L || !readable ? ' disabled' : ''}>RESTORE vers la version ${st.view}</button></div>
          <div class="sim-note">${st.msg}</div>`;
      };
      root.onclick = e => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.op) OPS[b.dataset.op](); if (b.dataset.v != null) st.view = +b.dataset.v; draw(); };
      root.oninput = e => { if (e.target.id === 'tt') { st.view = +e.target.value; draw(); const t = root.querySelector('#tt'); if (t) t.focus(); } };
      draw();
    }
  });

  /* ---------- 7. Job et Repair run ---------- */
  SIMS.push({
    id: 'job', mod: 'm7', title: 'Un job tombe en panne à 3 h du matin',
    tag: 'Lance le job, casse une tâche, puis compare les deux façons de reprendre.',
    mission: 'Termine un job en échec avec Repair run.',
    mount(root, win) {
      const T = { ingest: ['Ingestion', 12, []], silver: ['Silver', 18, ['ingest']], gv: ['Gold ventes', 6, ['silver']], gc: ['Gold clients', 6, ['silver']], dash: ['Dashboard', 2, ['gv', 'gc']] };
      const LEVELS = [['ingest'], ['silver'], ['gv', 'gc'], ['dash']];
      const st = { s: {}, bug: false, running: false, min: 0, runs: 0, msg: 'Cinq tâches, quatre niveaux de dépendance.', repaired: false };
      Object.keys(T).forEach(k => st.s[k] = 'idle');
      const failed = () => Object.values(st.s).includes('fail');
      const exec = (only, repair) => {
        st.running = true; st.msg = repair ? 'Repair run : seules les tâches en échec ou ignorées repartent.' : 'Exécution complète…';
        only.forEach(k => st.s[k] = 'idle');
        let delay = 0;
        LEVELS.forEach(lv => {
          const ks = lv.filter(k => only.includes(k)); if (!ks.length) return;
          setTimeout(() => { if (!alive(root)) return; ks.forEach(k => { st.s[k] = T[k][2].some(d => st.s[d] !== 'ok') ? 'skip' : 'run'; }); draw(); }, delay);
          delay += 800;
          setTimeout(() => { if (!alive(root)) return; ks.forEach(k => { if (st.s[k] !== 'run') return; st.min += T[k][1]; st.runs++; st.s[k] = k === 'gc' && st.bug ? 'fail' : 'ok'; }); draw(); }, delay);
        });
        setTimeout(() => {
          if (!alive(root)) return; st.running = false;
          if (failed()) st.msg = 'Gold clients a échoué. Dashboard n\'a pas été lancé : une tâche ne démarre pas si une dépendance a échoué. Corrige, puis choisis comment reprendre.';
          else { st.msg = repair ? 'Réparé : les tâches déjà réussies n\'ont pas été rejouées.' : 'Job terminé avec succès.'; if (repair) win(); }
          draw();
        }, delay + 50);
      };
      const LBL = { idle: 'en attente', run: 'en cours', ok: 'réussie', fail: 'échec', skip: 'ignorée' };
      const draw = () => {
        root.innerHTML = `
          <div class="dag">${LEVELS.map((lv, i) => `${i ? '<span class="arrow">→</span>' : ''}<div class="dag-col">${lv.map(k => `<div class="task t-${st.s[k]}"><b>${T[k][0]}</b><small>${T[k][1]} min · ${LBL[st.s[k]]}</small></div>`).join('')}</div>`).join('')}</div>
          <div class="sim-actions">
            <button class="b-primary" data-a="run"${st.running ? ' disabled' : ''}>${failed() ? 'Relancer tout le job' : 'Lancer le job'}</button>
            <button data-a="repair"${st.running || !failed() || st.bug ? ' disabled' : ''}>Repair run</button>
            <label class="chk"><input type="checkbox" id="bug" ${st.bug ? 'checked' : ''}${st.running ? ' disabled' : ''}> Bug dans Gold clients</label>
          </div>
          <div class="meter"><span>Tâches exécutées : <b>${st.runs}</b></span><span>Minutes de calcul facturées : <b>${st.min}</b></span></div>
          <div class="sim-note">${st.msg}</div>`;
      };
      root.onchange = e => { if (e.target.id === 'bug') { st.bug = e.target.checked; draw(); } };
      root.onclick = e => {
        const b = e.target.closest('button'); if (!b) return;
        if (b.dataset.a === 'run') exec(Object.keys(T), false);
        if (b.dataset.a === 'repair') exec(Object.keys(T).filter(k => st.s[k] === 'fail' || st.s[k] === 'skip'), true);
        draw();
      };
      draw();
    }
  });

  /* ---------- 8. Import ou DirectQuery ---------- */
  SIMS.push({
    id: 'bi', mod: 'm8', title: 'Import ou DirectQuery',
    tag: 'Deux rapports Power BI sur la même table Gold. Observe ce que chacun coûte et montre.',
    mission: 'Laisse le rapport Import prendre du retard, puis rafraîchis-le.',
    mount(root, win) {
      const st = { src: 12400, imp: 12400, qImp: 0, qDq: 0, clicks: 0, stale: false };
      const draw = () => {
        const late = st.src - st.imp;
        root.innerHTML = `
          <div class="sim-actions"><button data-a="sale">Une vente arrive dans Gold (+350 €)</button><button data-a="click">Un utilisateur clique sur un filtre</button><button class="b-primary" data-a="refresh">Rafraîchir le dataset Import</button></div>
          <div class="sim-cols">
            <div class="report"><span class="zlabel">Rapport en mode Import</span><div class="big">${st.imp.toLocaleString('fr-FR')} €</div>
              <span class="badge ${late ? 'ko' : 'ok'}">${late ? 'En retard de ' + late.toLocaleString('fr-FR') + ' €' : 'À jour'}</span>
              <p class="muted">Requêtes envoyées au SQL warehouse : <b>${st.qImp}</b><br>Les clics lisent la copie locale : réponse instantanée.</p></div>
            <div class="report"><span class="zlabel">Rapport en DirectQuery</span><div class="big">${st.src.toLocaleString('fr-FR')} €</div>
              <span class="badge ok">À jour</span>
              <p class="muted">Requêtes envoyées au SQL warehouse : <b>${st.qDq}</b><br>Chaque clic interroge Databricks : le warehouse doit rester allumé.</p></div>
          </div>
          <div class="sim-note">${st.clicks} clic(s) utilisateur. Import paie au rafraîchissement, DirectQuery paie à chaque interaction.</div>`;
      };
      root.onclick = e => {
        const b = e.target.closest('button'); if (!b) return; const a = b.dataset.a;
        if (a === 'sale') { st.src += 350; st.stale = true; }
        if (a === 'click') { st.clicks++; st.qDq++; }
        if (a === 'refresh') { st.qImp++; if (st.stale && st.imp !== st.src) win(); st.imp = st.src; st.stale = false; }
        draw();
      };
      draw();
    }
  });

  /* ---------- 9. Auto Loader et checkpoint ---------- */
  SIMS.push({
    id: 'autoloader', mod: 'm9', title: 'Auto Loader et son checkpoint',
    tag: 'Dépose des fichiers, lance le flux, relance-le. Puis supprime le checkpoint.',
    mission: 'Lance le flux deux fois de suite : la seconde ne doit rien réingérer.',
    mount(root, win) {
      const st = { land: [], ck: [], rows: 0, n: 1, msg: 'La zone de dépôt est vide.', hadRun: false };
      const draw = () => {
        const dup = st.rows > st.land.length * 100;
        root.innerHTML = `
          <div class="sim-actions"><button data-a="drop">Déposer 3 fichiers</button><button class="b-primary" data-a="run">Lancer le flux (availableNow)</button><button class="b-warn" data-a="rm">Supprimer le checkpoint</button></div>
          <div class="sim-cols three">
            <div><span class="zlabel">Zone de dépôt (volume)</span><div class="files">${st.land.map(f => `<span class="chip ${st.ck.includes(f) ? 'stale' : 'live'}">${f}.json<small>100 lignes</small></span>`).join('') || '<span class="muted">aucun fichier</span>'}</div></div>
            <div><span class="zlabel">Checkpoint</span><div class="files">${st.ck.map(f => `<span class="chip stale">${f} ✓</span>`).join('') || '<span class="muted">vide : le flux ne sait rien</span>'}</div></div>
            <div><span class="zlabel">Table bronze</span><div class="big">${st.rows.toLocaleString('fr-FR')}<small> lignes</small></div>${dup ? '<span class="badge ko">Doublons : plus de lignes que la source</span>' : '<span class="badge ok">Cohérent avec la source</span>'}</div>
          </div>
          <div class="sim-note">${st.msg}</div>`;
      };
      root.onclick = e => {
        const b = e.target.closest('button'); if (!b) return; const a = b.dataset.a;
        if (a === 'drop') { for (let i = 0; i < 3; i++) st.land.push('courses_' + String(st.n++).padStart(3, '0')); st.msg = 'Trois nouveaux fichiers attendent.'; }
        if (a === 'run') {
          const fresh = st.land.filter(f => !st.ck.includes(f)); st.rows += fresh.length * 100; st.ck = st.ck.concat(fresh);
          st.msg = fresh.length ? fresh.length + ' nouveau(x) fichier(s) ingéré(s), ' + fresh.length * 100 + ' lignes ajoutées. Le checkpoint les mémorise.' : 'Rien de nouveau : le checkpoint sait que tout a déjà été traité. Zéro ligne ajoutée.';
          if (!fresh.length && st.hadRun) win(); if (fresh.length) st.hadRun = true;
        }
        if (a === 'rm') { st.ck = []; st.msg = 'Checkpoint supprimé. Le flux a perdu la mémoire : relance-le pour voir le résultat.'; }
        draw();
      };
      draw();
    }
  });

  /* ---------- 10. Data skipping ---------- */
  SIMS.push({
    id: 'skipping', mod: 'm10', title: 'Data skipping et liquid clustering',
    tag: 'Delta connaît le min et le max de chaque fichier. Déplace le filtre.',
    mission: 'Organise la table pour lire 2 fichiers au plus.',
    mount(root, win) {
      const MESSY = [[1, 28], [2, 30], [1, 25], [3, 29], [5, 30], [1, 27], [4, 30], [2, 26], [6, 30], [1, 29], [3, 24], [2, 30]];
      const TIDY = MESSY.map((_, k) => [Math.floor(k * 2.5) + 1, Math.floor((k + 1) * 2.5)]);
      const st = { day: 15, tidy: false };
      const draw = () => {
        const F = st.tidy ? TIDY : MESSY, read = F.filter(r => st.day >= r[0] && st.day <= r[1]).length;
        if (st.tidy && read <= 2) win();
        root.innerHTML = `
          <div class="sim-actions"><div class="seg"><button data-t="0" class="${st.tidy ? '' : 'on'}">Table non organisée</button><button data-t="1" class="${st.tidy ? 'on' : ''}">CLUSTER BY (jour)</button></div>
            <label for="dj">WHERE jour = <b>${st.day}</b></label><input id="dj" type="range" min="1" max="30" value="${st.day}"></div>
          <div class="skip">
            ${F.map((r, i) => { const hit = st.day >= r[0] && st.day <= r[1]; return `<div class="row"><span class="fname">f${i + 1}</span><div class="track"><b class="cur" style="left:${(st.day - 0.5) / 30 * 100}%"></b><i class="${hit ? 'hit' : 'miss'}" style="left:${(r[0] - 1) / 30 * 100}%;width:${(r[1] - r[0] + 1) / 30 * 100}%"></i></div><span class="fstate ${hit ? 'hit' : ''}">${hit ? 'lu' : 'ignoré'}</span></div>`; }).join('')}
            <div class="row axis"><span class="fname"></span><div class="track"><span>jour 1</span><span>jour 15</span><span>jour 30</span></div><span class="fstate"></span></div></div>
          <div class="meter"><span>Fichiers lus : <b>${read} / 12</b></span><span>Fichiers ignorés sans être ouverts : <b>${12 - read}</b></span></div>
          <div class="sim-note">${st.tidy ? 'Chaque fichier couvre une plage étroite : le filtre en écarte presque tous sans les ouvrir.' : 'Chaque fichier contient un peu de tous les jours : les plages min/max se recouvrent, les statistiques ne servent à rien.'}</div>`;
      };
      root.onclick = e => { const b = e.target.closest('button[data-t]'); if (b) { st.tidy = b.dataset.t === '1'; draw(); } };
      root.oninput = e => { if (e.target.id === 'dj') { st.day = +e.target.value; draw(); const t = root.querySelector('#dj'); if (t) t.focus(); } };
      draw();
    }
  });

  /* ---------- 11. CI/CD ---------- */
  SIMS.push({
    id: 'cicd', mod: 'm11', title: 'Un changement part en production',
    tag: 'Pousse un changement par la chaîne CI/CD, ou à la main dans l\'interface.',
    mission: 'Laisse la chaîne arrêter un bug avant la production.',
    mount(root, win) {
      const STEPS = [['pr', 'Pull request'], ['test', 'Tests unitaires'], ['val', 'bundle validate'], ['dev', 'deploy -t dev'], ['prod', 'deploy -t prod']];
      const st = { bug: false, yaml: false, manual: false, s: {}, running: false, msg: 'Choisis un scénario, puis pousse le changement.' };
      const draw = () => {
        root.innerHTML = `
          <div class="sim-actions"><label class="chk"><input type="checkbox" id="c-bug"${st.bug ? ' checked' : ''}> Bug dans une transformation</label>
            <label class="chk"><input type="checkbox" id="c-yaml"${st.yaml ? ' checked' : ''}> Erreur dans databricks.yml</label>
            <label class="chk"><input type="checkbox" id="c-manual"${st.manual ? ' checked' : ''}> Modifier le job à la main en production</label></div>
          <div class="dag">${STEPS.map((s, i) => `${i ? '<span class="arrow">→</span>' : ''}<div class="dag-col"><div class="task t-${st.s[s[0]] || 'idle'}"><b>${s[1]}</b><small>${{ ok: 'passé', fail: 'bloqué', skip: 'non exécuté', run: 'en cours', bad: 'incident' }[st.s[s[0]]] || 'en attente'}</small></div></div>`).join('')}</div>
          <div class="sim-actions"><button class="b-primary" data-go="1"${st.running ? ' disabled' : ''}>Pousser le changement</button></div>
          <div class="sim-note">${st.msg}</div>`;
      };
      root.onchange = e => { const m = { 'c-bug': 'bug', 'c-yaml': 'yaml', 'c-manual': 'manual' }[e.target.id]; if (m) { st[m] = e.target.checked; draw(); } };
      root.onclick = e => {
        if (!e.target.closest('button[data-go]')) return;
        st.s = {}; st.running = true;
        if (st.manual) {
          STEPS.slice(0, 4).forEach(s => st.s[s[0]] = 'skip'); st.s.prod = st.bug || st.yaml ? 'bad' : 'ok'; st.running = false;
          st.msg = st.bug || st.yaml ? 'Incident en production. Personne n\'a relu le changement, aucun test n\'a tourné, et rien ne dit ce qui a été modifié.' : 'Ça passe cette fois. Mais le changement n\'est ni relu, ni testé, ni tracé, et le prochain déploiement par bundle l\'écrasera.';
          return draw();
        }
        const stopAt = st.bug ? 'test' : st.yaml ? 'val' : null;
        let stopped = false;
        STEPS.forEach((s, i) => setTimeout(() => {
          if (!alive(root)) return;
          if (stopped) st.s[s[0]] = 'skip'; else if (s[0] === stopAt) { st.s[s[0]] = 'fail'; stopped = true; } else st.s[s[0]] = 'ok';
          if (i === STEPS.length - 1) {
            st.running = false;
            st.msg = stopAt === 'test' ? 'Les tests ont arrêté le bug. La production n\'a rien vu.' : stopAt === 'val' ? 'bundle validate a refusé la configuration avant tout déploiement.' : 'Changement relu, testé, déployé en dev puis en prod, sous l\'identité d\'un service principal.';
            if (stopAt === 'test') win();
          }
          draw();
        }, 600 * (i + 1)));
        draw();
      };
      draw();
    }
  });

  window.SIMS = SIMS;
})();
