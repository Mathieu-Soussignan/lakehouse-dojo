// Labo SQL & PySpark : un vrai moteur SQL (DuckDB-WASM) + compilateur DataFrame PySpark dans le navigateur, sur les données de la Banque Lanterne.
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

  /* Traduction transparente des idiomes Databricks SQL (EXCEPT, LEFT ANTI JOIN, MERGE INTO) vers DuckDB */
  function transpileDatabricksSql(stmt) {
    let s = stmt.replace(/\bSELECT\s+\*\s+EXCEPT\s*\(/gi, 'SELECT * EXCLUDE (')
      .replace(/\bLEFT\s+ANTI\s+JOIN\b/gi, 'ANTI JOIN')
      .replace(/\bLEFT\s+SEMI\s+JOIN\b/gi, 'SEMI JOIN');
    const m = s.match(/^([\s\S]*?)\bMERGE\s+INTO\s+([A-Za-z0-9_.]+)(?:\s+(?:AS\s+)?([A-Za-z0-9_]+))?\s+USING\s+([A-Za-z0-9_.]+|\([\s\S]+?\))(?:\s+(?:AS\s+)?([A-Za-z0-9_]+))?\s+ON\s+([\s\S]+?)\s+WHEN\s+MATCHED(?:\s+AND\s+([\s\S]+?))?\s+THEN\s+UPDATE\s+SET\s+([\s\S]+?)\s+WHEN\s+NOT\s+MATCHED(?:\s+AND\s+([\s\S]+?))?\s+THEN\s+INSERT\s+\*\s*$/i);
    if (!m) return [s];
    const cte = m[1].trim(), target = m[2], tAlias = m[3] || target, src = m[4], sAlias = m[5] || 'a';
    const onRaw = m[6].trim(), mCondRaw = (m[7] || '').trim(), setRaw = m[8].trim(), iCondRaw = (m[9] || '').trim();
    const repT = x => x.replace(new RegExp('\\b' + tAlias + '\\.', 'g'), target + '.');
    const setClause = setRaw.replace(new RegExp('^' + tAlias + '\\.', 'i'), '');
    const upd = (cte ? cte + ' ' : '') + 'UPDATE ' + target + ' SET ' + setClause + ' FROM ' + src + ' AS ' + sAlias +
      ' WHERE (' + repT(onRaw) + ')' + (mCondRaw ? ' AND (' + repT(mCondRaw) + ')' : '');
    const onSub = onRaw.replace(new RegExp('\\b' + tAlias + '\\.', 'g'), '_s.');
    const ins = (cte ? cte + ' ' : '') + 'INSERT INTO ' + target + ' SELECT ' + sAlias + '.* FROM ' + src + ' AS ' + sAlias +
      ' WHERE ' + (iCondRaw ? '(' + iCondRaw + ') AND ' : '') + 'NOT EXISTS (SELECT 1 FROM ' + target + ' AS _s WHERE ' + onSub + ')';
    return [upd, ins];
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
    const rawStmts = split(sql); if (!rawStmts.length) throw new Error('Le script est vide.');
    const stmts = rawStmts.flatMap(transpileDatabricksSql);
    let last = null, affected = 0, ms = 0;
    for (let i = 0; i < stmts.length; i++) {
      try { const r = await query(stmts[i]); ms += r.ms; if (r.cols.length === 1 && r.cols[0] === 'Count' && /^\s*(insert|update|delete|with\b[\s\S]*?\b(?:insert|update|delete))/i.test(stmts[i])) affected += Number(r.rows[0][0]); else if (r.cols.length) last = r; }
      catch (e) { const err = new Error(String(e.message || e)); err.stmt = i + 1; err.of = stmts.length; throw err; }
    }
    return { last, affected, ms, count: stmts.length };
  }
  const tableExists = async n => (await query('SELECT count(*) FROM information_schema.tables WHERE table_schema = \'main\' AND table_name = \'' + n + '\'')).rows[0][0] > 0;

  /* Restauration automatique des tables déjà validées dans une session précédente */
  async function restoreProgressTables(LS) {
    if (!LS || !LS.done) return false;
    let restored = false;
    if (LS.done.m2 != null && !(await tableExists('silver_clients'))) {
      await E.conn.query('CREATE OR REPLACE TABLE silver_clients AS SELECT * FROM ref.silver_clients');
      restored = true;
    }
    if (LS.done.m3 != null && !(await tableExists('silver_transactions'))) {
      await E.conn.query('CREATE OR REPLACE TABLE silver_transactions AS SELECT * FROM ref.silver_transactions');
      await E.conn.query('CREATE OR REPLACE TABLE rejets AS SELECT * FROM ref.rejets');
      restored = true;
    }
    if (LS.done.m4 != null && !(await tableExists('gold_flux'))) {
      await E.conn.query('CREATE OR REPLACE TABLE gold_flux AS SELECT * FROM ref.gold_flux');
      restored = true;
    }
    return restored;
  }

  /* ---------- Moteur PySpark DataFrame (AST Python → Plan Catalyst + SQL DuckDB) ---------- */
  const qStr = v => v === null || v === undefined ? 'NULL' : typeof v === 'boolean' ? (v ? 'TRUE' : 'FALSE') : typeof v === 'number' ? String(v) : "'" + String(v).replace(/'/g, "''") + "'";
  class Col {
    constructor(sql, aliasName) { this.sql = sql; this.aliasName = aliasName || null; }
    toSql() { return this.sql; }
    toSelect() { return this.aliasName ? this.sql + ' AS ' + this.aliasName : this.sql; }
    alias(n) { return new Col(this.sql, n); }
    isNull() { return new Col('(' + this.sql + ' IS NULL)'); }
    isNotNull() { return new Col('(' + this.sql + ' IS NOT NULL)'); }
    desc() { return new Col(this.sql + ' DESC'); }
    asc() { return new Col(this.sql + ' ASC'); }
    cast(t) { return new Col('CAST(' + this.sql + ' AS ' + String(t).toUpperCase() + ')'); }
    isin(...vals) { const flat = vals.flat(); return new Col('(' + this.sql + ' IN (' + flat.map(v => v instanceof Col ? v.toSql() : qStr(v)).join(', ') + '))'); }
    when(cond, val) {
      const cSql = cond instanceof Col ? cond.toSql() : String(cond);
      const vSql = val instanceof Col ? val.toSql() : qStr(val);
      const cases = (this._cases || []).concat([[cSql, vSql]]);
      const col = new Col('CASE ' + cases.map(([c, v]) => 'WHEN ' + c + ' THEN ' + v).join(' ') + ' END');
      col._cases = cases;
      return col;
    }
    otherwise(val) {
      const vSql = val instanceof Col ? val.toSql() : qStr(val);
      const cases = this._cases || [];
      return new Col('CASE ' + cases.map(([c, v]) => 'WHEN ' + c + ' THEN ' + v).join(' ') + ' ELSE ' + vSql + ' END');
    }
    over(w) {
      const parts = w && w._part && w._part.length ? 'PARTITION BY ' + w._part.join(', ') : '';
      const ords = w && w._ord && w._ord.length ? 'ORDER BY ' + w._ord.join(', ') : '';
      return new Col(this.sql + ' OVER (' + [parts, ords].filter(Boolean).join(' ') + ')');
    }
  }
  const toColSql = x => x instanceof Col ? x.toSql() : typeof x === 'string' ? x : qStr(x);
  const toSelSql = x => x instanceof Col ? x.toSelect() : String(x);
  const normFilterSql = s => String(s).replace(/==/g, '=').replace(/!=/g, '<>').replace(/\b([A-Za-z_][A-Za-z0-9_]*)\./g, '');

  const F_API = {
    col: n => new Col(String(n).replace(/^[A-Za-z_][A-Za-z0-9_]*\./, '')),
    lit: v => new Col(qStr(v)),
    upper: x => new Col('upper(' + toColSql(x) + ')'),
    lower: x => new Col('lower(' + toColSql(x) + ')'),
    trim: x => new Col('trim(' + toColSql(x) + ')'),
    abs: x => new Col('abs(' + toColSql(x) + ')'),
    round: (x, d = 0) => new Col('round(' + toColSql(x) + ', ' + Number(d) + ')'),
    trunc: (x, fmt) => new Col("date_trunc('" + String(fmt).toLowerCase() + "', " + toColSql(x) + ')::DATE'),
    date_trunc: (fmt, x) => new Col("date_trunc('" + String(fmt).toLowerCase() + "', " + toColSql(x) + ')::DATE'),
    to_date: x => new Col('CAST(' + toColSql(x) + ' AS DATE)'),
    count: x => new Col(x === '*' ? 'count(*)' : 'count(' + toColSql(x) + ')'),
    count_if: x => new Col('count_if(' + toColSql(x) + ')'),
    sum: x => new Col('sum(' + toColSql(x) + ')'),
    avg: x => new Col('avg(' + toColSql(x) + ')'),
    min: x => new Col('min(' + toColSql(x) + ')'),
    max: x => new Col('max(' + toColSql(x) + ')'),
    desc: x => new Col(toColSql(x) + ' DESC'),
    asc: x => new Col(toColSql(x) + ' ASC'),
    row_number: () => new Col('row_number()'),
    rank: () => new Col('rank()'),
    dense_rank: () => new Col('dense_rank()'),
    coalesce: (...xs) => new Col('coalesce(' + xs.map(toColSql).join(', ') + ')'),
    when: (cond, val) => (new Col('')).when(cond, val),
    broadcast: df => { if (df) df._broadcast = true; return df; }
  };
  const WINDOW_API = {
    partitionBy: (...cols) => ({
      _part: cols.flat().map(toColSql), _ord: [],
      orderBy(...ords) { return { _part: this._part, _ord: ords.flat().map(toColSql) }; }
    }),
    orderBy: (...ords) => ({
      _part: [], _ord: ords.flat().map(toColSql),
      partitionBy(...cols) { return { _part: cols.flat().map(toColSql), _ord: this._ord }; }
    })
  };

  function tokenizePy(src) {
    const s = src.replace(/\\\r?\n/g, ' ');
    const tokens = [];
    let i = 0, depth = 0;
    while (i < s.length) {
      const c = s[i];
      if (c === ' ' || c === '\t' || c === '\r') { i++; continue; }
      if (c === '#') { while (i < s.length && s[i] !== '\n') i++; continue; }
      if (c === '\n') { if (depth === 0) tokens.push({ t: 'NL' }); i++; continue; }
      if (c === '"' || c === "'") {
        const q3 = s.slice(i, i + 3) === c + c + c ? c + c + c : c;
        i += q3.length;
        let str = '';
        while (i < s.length && s.slice(i, i + q3.length) !== q3) {
          if (s[i] === '\\' && i + 1 < s.length) { i++; str += s[i++]; }
          else str += s[i++];
        }
        i += q3.length;
        tokens.push({ t: 'STR', v: str });
        continue;
      }
      if (/[0-9]/.test(c)) {
        let num = '';
        while (i < s.length && /[0-9.]/.test(s[i])) num += s[i++];
        tokens.push({ t: 'NUM', v: Number(num) });
        continue;
      }
      if (/[A-Za-z_]/.test(c)) {
        let id = '';
        while (i < s.length && /[A-Za-z0-9_]/.test(s[i])) id += s[i++];
        tokens.push({ t: 'ID', v: id });
        continue;
      }
      const two = s.slice(i, i + 2);
      if (['==', '!=', '<=', '>=', '<>'].includes(two)) { tokens.push({ t: 'OP', v: two }); i += 2; continue; }
      if ('()[]{}'.includes(c)) {
        if ('([{'.includes(c)) depth++;
        else depth = Math.max(0, depth - 1);
        tokens.push({ t: c, v: c }); i++; continue;
      }
      if (',.:+-*/&|~<>='.includes(c)) { tokens.push({ t: 'OP', v: c }); i++; continue; }
      throw new Error('Caractère inattendu en PySpark : ' + c);
    }
    return tokens;
  }

  function parsePy(tokens) {
    let p = 0;
    const pk = () => tokens[p], nx = () => tokens[p++];
    const skipNL = () => { while (pk() && (pk().t === 'NL' || (pk().t === 'OP' && pk().v === ';'))) nx(); };
    function parseStmt() {
      skipNL();
      const t = pk(); if (!t) return null;
      if (t.t === 'ID' && (t.v === 'from' || t.v === 'import')) {
        while (pk() && pk().t !== 'NL') nx();
        return { k: 'noop' };
      }
      if (t.t === 'ID' && tokens[p + 1] && tokens[p + 1].t === 'OP' && tokens[p + 1].v === '=') {
        const name = nx().v; nx();
        return { k: 'assign', name, expr: parseExpr() };
      }
      return { k: 'expr', expr: parseExpr() };
    }
    function parseExpr() { return parseOr(); }
    function parseOr() {
      let l = parseAnd();
      while (pk() && ((pk().t === 'OP' && pk().v === '|') || (pk().t === 'ID' && pk().v === 'or'))) { nx(); l = { k: 'bin', op: '|', l, r: parseAnd() }; }
      return l;
    }
    function parseAnd() {
      let l = parseCmp();
      while (pk() && ((pk().t === 'OP' && pk().v === '&') || (pk().t === 'ID' && pk().v === 'and'))) { nx(); l = { k: 'bin', op: '&', l, r: parseCmp() }; }
      return l;
    }
    function parseCmp() {
      let l = parseAdd();
      while (pk() && pk().t === 'OP' && ['==', '!=', '<>', '<', '<=', '>', '>='].includes(pk().v)) { const op = nx().v; l = { k: 'bin', op, l, r: parseAdd() }; }
      return l;
    }
    function parseAdd() {
      let l = parseMul();
      while (pk() && pk().t === 'OP' && (pk().v === '+' || pk().v === '-')) { const op = nx().v; l = { k: 'bin', op, l, r: parseMul() }; }
      return l;
    }
    function parseMul() {
      let l = parseUnary();
      while (pk() && pk().t === 'OP' && (pk().v === '*' || pk().v === '/')) { const op = nx().v; l = { k: 'bin', op, l, r: parseUnary() }; }
      return l;
    }
    function parseUnary() {
      if (pk() && pk().t === 'OP' && (pk().v === '-' || pk().v === '~' || pk().v === '*')) { const op = nx().v; return { k: 'un', op, e: parseUnary() }; }
      return parsePost();
    }
    function parsePost() {
      let e = parsePrim();
      while (pk()) {
        if (pk().t === 'OP' && pk().v === '.') {
          nx(); const prop = nx();
          if (!prop || prop.t !== 'ID') throw new Error('Nom de méthode attendu après "."');
          e = { k: 'prop', obj: e, prop: prop.v };
        } else if (pk().t === '(') {
          nx(); const args = [], kwargs = {};
          while (pk() && pk().t !== ')') {
            if (pk().t === 'ID' && tokens[p + 1] && tokens[p + 1].t === 'OP' && tokens[p + 1].v === '=') {
              const k = nx().v; nx(); kwargs[k] = parseExpr();
            } else args.push(parseExpr());
            if (pk() && pk().t === 'OP' && pk().v === ',') nx();
          }
          if (pk() && pk().t === ')') nx();
          e = { k: 'call', fn: e, args, kwargs };
        } else if (pk().t === '[') {
          nx(); const idx = parseExpr();
          if (pk() && pk().t === ']') nx();
          e = { k: 'idx', obj: e, idx };
        } else break;
      }
      return e;
    }
    function parsePrim() {
      const t = pk();
      if (!t) throw new Error('Fin d\'expression inattendue');
      if (t.t === 'NUM') { nx(); return { k: 'lit', v: t.v }; }
      if (t.t === 'STR') { nx(); return { k: 'lit', v: t.v }; }
      if (t.t === 'ID') {
        nx();
        if (t.v === 'True') return { k: 'lit', v: true };
        if (t.v === 'False') return { k: 'lit', v: false };
        if (t.v === 'None') return { k: 'lit', v: null };
        return { k: 'id', name: t.v };
      }
      if (t.t === '(') {
        nx(); const items = [];
        let isTuple = false;
        while (pk() && pk().t !== ')') {
          items.push(parseExpr());
          if (pk() && pk().t === 'OP' && pk().v === ',') { isTuple = true; nx(); }
        }
        if (pk() && pk().t === ')') nx();
        if (items.length === 1 && !isTuple) return items[0];
        return { k: 'list', items };
      }
      if (t.t === '[') {
        nx(); const items = [];
        while (pk() && pk().t !== ']') {
          items.push(parseExpr());
          if (pk() && pk().t === 'OP' && pk().v === ',') nx();
        }
        if (pk() && pk().t === ']') nx();
        return { k: 'list', items };
      }
      if (t.t === '{') {
        nx(); const entries = [];
        while (pk() && pk().t !== '}') {
          const k = parseExpr();
          if (pk() && pk().t === 'OP' && pk().v === ':') nx();
          const v = parseExpr();
          entries.push([k, v]);
          if (pk() && pk().t === 'OP' && pk().v === ',') nx();
        }
        if (pk() && pk().t === '}') nx();
        return { k: 'dict', entries };
      }
      throw new Error('Jeton inattendu en PySpark : ' + (t.v || t.t));
    }
    const stmts = [];
    while (pk()) { const s = parseStmt(); if (s) stmts.push(s); skipNL(); }
    return stmts;
  }

  async function runPySpark(src) {
    const t0 = performance.now();
    let lastRes = null, lastPlan = null, affected = 0;

    class DF {
      constructor(sql, plan) { this.sql = sql; this.plan = plan || []; }
      async getCols() {
        const r = await query('SELECT * FROM (' + this.sql + ') LIMIT 0');
        return r.cols;
      }
      explainText() {
        const lines = ['== Physical Plan (AdaptiveSparkPlan / Catalyst) =='];
        this.plan.slice().reverse().forEach((step, i) => {
          lines.push((i === 0 ? '+- ' : '   '.repeat(i) + '+- ') + step);
        });
        return lines.join('\n');
      }
      alias(a) { const d = new DF(this.sql, this.plan.slice()); d._alias = a; return d; }
      filter(cond) {
        const c = cond instanceof Col ? cond.toSql() : normFilterSql(cond);
        return new DF('SELECT * FROM (' + this.sql + ') WHERE ' + c, this.plan.concat(['Filter (' + c + ')']));
      }
      where(cond) { return this.filter(cond); }
      select(...cols) {
        const flat = cols.flat();
        const s = flat.map(c => c instanceof Col ? c.toSelect() : String(c).replace(/^[A-Za-z_][A-Za-z0-9_]*\./, '')).join(', ');
        return new DF('SELECT ' + s + ' FROM (' + this.sql + ')', this.plan.concat(['Project [' + s + ']']));
      }
      async withColumn(name, expr) {
        const existing = await this.getCols();
        const eSql = expr instanceof Col ? expr.toSql() : qStr(expr);
        const sql = existing.includes(name)
          ? 'SELECT * REPLACE (' + eSql + ' AS ' + name + ') FROM (' + this.sql + ')'
          : 'SELECT *, ' + eSql + ' AS ' + name + ' FROM (' + this.sql + ')';
        return new DF(sql, this.plan.concat(['Project [withColumn ' + name + ' = ' + eSql + ']']));
      }
      drop(...cols) {
        const flat = cols.flat().map(c => c instanceof Col ? c.toSql() : String(c));
        return new DF('SELECT * EXCLUDE (' + flat.join(', ') + ') FROM (' + this.sql + ')', this.plan.concat(['Project [drop ' + flat.join(', ') + ']']));
      }
      dropDuplicates(subset) {
        if (subset && subset.length) {
          const ks = subset.flat().join(', ');
          return new DF('SELECT * FROM (' + this.sql + ') QUALIFY row_number() OVER (PARTITION BY ' + ks + ') = 1', this.plan.concat(['Exchange hashpartitioning(' + ks + ')', 'Deduplicate [' + ks + ']']));
        }
        return new DF('SELECT DISTINCT * FROM (' + this.sql + ')', this.plan.concat(['Exchange hashpartitioning(*)', 'HashAggregate (distinct)']));
      }
      distinct() { return this.dropDuplicates(); }
      join(other, on, how = 'inner') {
        const h = String(how).toLowerCase();
        const joinKw = h === 'left' || h === 'left_outer' || h === 'leftouter' ? 'LEFT JOIN'
          : h === 'left_anti' || h === 'anti' || h === 'leftanti' ? 'ANTI JOIN'
          : h === 'left_semi' || h === 'semi' || h === 'leftsemi' ? 'SEMI JOIN'
          : h === 'right' || h === 'right_outer' ? 'RIGHT JOIN'
          : h === 'full' || h === 'outer' || h === 'full_outer' ? 'FULL JOIN' : 'INNER JOIN';
        let onClause = '';
        if (typeof on === 'string') onClause = 'USING (' + on + ')';
        else if (Array.isArray(on)) onClause = 'USING (' + on.join(', ') + ')';
        else if (on instanceof Col) onClause = 'ON ' + on.toSql();
        const opName = (other._broadcast || joinKw === 'ANTI JOIN') ? 'BroadcastHashJoin' : 'SortMergeJoin';
        return new DF('SELECT * FROM (' + this.sql + ') _l ' + joinKw + ' (' + other.sql + ') _r ' + onClause,
          this.plan.concat([opName + ' [' + (Array.isArray(on) ? on.join(', ') : on) + '] (' + joinKw + ')']));
      }
      groupBy(...cols) {
        const flat = cols.flat().map(toColSql);
        const self = this;
        return {
          agg(...exprs) {
            const ef = exprs.flat().map(toSelSql);
            const all = flat.concat(ef);
            return new DF('SELECT ' + all.join(', ') + ' FROM (' + self.sql + ') GROUP BY ' + flat.map((_, i) => i + 1).join(', '),
              self.plan.concat(['Exchange hashpartitioning(' + flat.join(', ') + ')', 'HashAggregate(keys=[' + flat.join(', ') + '], functions=[' + ef.join(', ') + '])']));
          },
          count() { return this.agg(F_API.count('*').alias('count')); }
        };
      }
      agg(...exprs) {
        const ef = exprs.flat().map(toSelSql);
        return new DF('SELECT ' + ef.join(', ') + ' FROM (' + this.sql + ')', this.plan.concat(['HashAggregate(keys=[], functions=[' + ef.join(', ') + '])']));
      }
      orderBy(...cols) {
        const s = cols.flat().map(toColSql).join(', ');
        return new DF('SELECT * FROM (' + this.sql + ') ORDER BY ' + s, this.plan.concat(['Exchange rangepartitioning(' + s + ')', 'Sort [' + s + ']']));
      }
      sort(...cols) { return this.orderBy(...cols); }
      limit(n) { return new DF('SELECT * FROM (' + this.sql + ') LIMIT ' + Number(n), this.plan.concat(['GlobalLimit ' + Number(n)])); }
      union(other) { return new DF('SELECT * FROM (' + this.sql + ') UNION ALL SELECT * FROM (' + other.sql + ')', this.plan.concat(['Union'])); }
      unionByName(other) { return new DF('SELECT * FROM (' + this.sql + ') UNION ALL BY NAME SELECT * FROM (' + other.sql + ')', this.plan.concat(['UnionByName'])); }
      async count() {
        const r = await query('SELECT count(*) AS count FROM (' + this.sql + ')');
        const val = Number(r.rows[0][0]);
        lastRes = { cols: ['count'], types: ['Int64'], rows: [[val]], ms: r.ms };
        lastPlan = { plan: this.explainText(), sql: 'SELECT count(*) FROM (' + this.sql + ')' };
        return val;
      }
      async first() {
        const r = await query('SELECT * FROM (' + this.sql + ') LIMIT 1');
        return r.rows[0] || [];
      }
      head() { return this.first(); }
      async collect() { return (await query('SELECT * FROM (' + this.sql + ')')).rows; }
      async show(n = 20) {
        lastRes = await query('SELECT * FROM (' + this.sql + ') LIMIT ' + Number(n));
        lastPlan = { plan: this.explainText(), sql: this.sql };
        return lastRes;
      }
      explain() {
        lastPlan = { plan: this.explainText(), sql: this.sql };
        return lastPlan.plan;
      }
      get write() {
        const self = this;
        return {
          mode() { return this; },
          option() { return this; },
          async saveAsTable(name) {
            await E.conn.query('CREATE OR REPLACE TABLE ' + name + ' AS ' + self.sql);
            lastRes = await query('SELECT * FROM ' + name);
            affected = lastRes.rows.length;
            lastPlan = { plan: self.explainText() + '\n+- Execute CreateDataSourceTableAsSelectCommand `' + name + '`', sql: 'CREATE OR REPLACE TABLE ' + name + ' AS\n' + self.sql };
            return null;
          }
        };
      }
    }

    class DeltaTableObj {
      constructor(name) { this.name = name; this.tAlias = name; }
      alias(a) { this.tAlias = a; return this; }
      merge(srcDf, cond) { this.srcDf = srcDf; this.sAlias = srcDf._alias || 'a'; this.onCond = cond instanceof Col ? cond.toSql() : String(cond); return this; }
      whenMatchedUpdate(args, kwargs) {
        const cond = (kwargs && kwargs.condition) || (args && args[0]) || '';
        const setObj = (kwargs && kwargs.set) || (args && args[1]) || {};
        this.mCond = cond;
        this.setSql = Object.entries(setObj).map(([k, v]) => k.replace(new RegExp('^' + this.tAlias + '\\.'), '') + ' = ' + (v instanceof Col ? v.toSql() : String(v))).join(', ');
        return this;
      }
      whenNotMatchedInsertAll(args, kwargs) {
        this.iCond = (kwargs && kwargs.condition) || (args && args[0]) || '';
        this.insertAll = true;
        return this;
      }
      async execute() {
        const repT = x => String(x).replace(new RegExp('\\b' + this.tAlias + '\\.', 'g'), this.name + '.');
        const updSql = 'UPDATE ' + this.name + ' SET ' + repT(this.setSql) + ' FROM (' + this.srcDf.sql + ') AS ' + this.sAlias +
          ' WHERE (' + repT(this.onCond) + ')' + (this.mCond ? ' AND (' + repT(this.mCond) + ')' : '');
        const onSub = String(this.onCond).replace(new RegExp('\\b' + this.tAlias + '\\.', 'g'), '_s.');
        const insSql = 'INSERT INTO ' + this.name + ' SELECT ' + this.sAlias + '.* FROM (' + this.srcDf.sql + ') AS ' + this.sAlias +
          ' WHERE ' + (this.iCond ? '(' + this.iCond + ') AND ' : '') + 'NOT EXISTS (SELECT 1 FROM ' + this.name + ' AS _s WHERE ' + onSub + ')';
        await E.conn.query(updSql);
        await E.conn.query(insSql);
        lastRes = await query('SELECT * FROM ' + this.name);
        lastPlan = { plan: '== Physical Plan (Delta Merge) ==\n+- MergeIntoCommand (target=' + this.name + ')\n   +- ' + this.srcDf.plan.join('\n      +- '), sql: updSql + ';\n' + insSql + ';' };
        return null;
      }
    }

    const spark = {
      table: n => new DF('SELECT * FROM ' + n, ['FileScan parquet main.' + n]),
      get read() { return { table: n => spark.table(n) }; },
      sql: q => new DF(transpileDatabricksSql(q)[0], ['SparkSQL [' + q.slice(0, 48) + '…]']),
      createDataFrame: (rows, cols) => {
        const vals = rows.map(r => '(' + r.map(qStr).join(', ') + ')').join(', ');
        return new DF('SELECT * FROM (VALUES ' + vals + ') AS _t(' + cols.join(', ') + ')', ['LocalTableScan [' + cols.join(', ') + ']']);
      }
    };

    const env = {
      spark, F: F_API, functions: F_API, Window: WINDOW_API,
      DeltaTable: { forName: (_, name) => new DeltaTableObj(name) },
      display: async df => {
        if (df instanceof DF) {
          lastRes = await query(df.sql);
          lastPlan = { plan: df.explainText(), sql: df.sql };
        }
        return lastRes;
      },
      print: () => null
    };

    async function evalNode(n) {
      if (!n) return null;
      if (n.k === 'lit') return n.v;
      if (n.k === 'id') {
        if (n.name in env) return env[n.name];
        throw new Error("Variable PySpark '" + n.name + "' non définie.");
      }
      if (n.k === 'list') {
        const out = [];
        for (const it of n.items) {
          if (it.k === 'un' && it.op === '*') { const v = await evalNode(it.e); out.push(...v); }
          else out.push(await evalNode(it));
        }
        return out;
      }
      if (n.k === 'dict') {
        const obj = {};
        for (const [kNode, vNode] of n.entries) obj[await evalNode(kNode)] = await evalNode(vNode);
        return obj;
      }
      if (n.k === 'un') {
        const v = await evalNode(n.e);
        if (n.op === '-') return v instanceof Col ? new Col('(-' + v.toSql() + ')') : -v;
        if (n.op === '~') return v instanceof Col ? new Col('(NOT ' + v.toSql() + ')') : !v;
        return v;
      }
      if (n.k === 'bin') {
        const l = await evalNode(n.l), r = await evalNode(n.r);
        if (l instanceof Col || r instanceof Col) {
          const opMap = { '==': '=', '!=': '<>', '&': 'AND', '|': 'OR' };
          const sqlOp = opMap[n.op] || n.op;
          const lSql = l instanceof Col ? l.toSql() : qStr(l);
          const rSql = r instanceof Col ? r.toSql() : qStr(r);
          return new Col('(' + lSql + ' ' + sqlOp + ' ' + rSql + ')');
        }
        if (n.op === '+') return l + r;
        if (n.op === '-') return l - r;
        if (n.op === '*') return l * r;
        if (n.op === '/') return l / r;
        if (n.op === '==') return l === r;
        if (n.op === '!=') return l !== r;
        if (n.op === '<') return l < r;
        if (n.op === '<=') return l <= r;
        if (n.op === '>') return l > r;
        if (n.op === '>=') return l >= r;
        return null;
      }
      if (n.k === 'idx') {
        const obj = await evalNode(n.obj), idx = await evalNode(n.idx);
        if (obj instanceof DF && typeof idx === 'string') return F_API.col(idx);
        return obj ? obj[idx] : undefined;
      }
      if (n.k === 'prop') {
        const obj = await evalNode(n.obj);
        if (obj instanceof DF && n.prop === 'columns') return await obj.getCols();
        return obj[n.prop];
      }
      if (n.k === 'call') {
        const args = [];
        for (const a of n.args) {
          if (a.k === 'un' && a.op === '*') { const v = await evalNode(a.e); args.push(...v); }
          else args.push(await evalNode(a));
        }
        const kwargs = {};
        for (const [k, vNode] of Object.entries(n.kwargs || {})) kwargs[k] = await evalNode(vNode);
        if (n.fn.k === 'prop') {
          const obj = await evalNode(n.fn.obj), mName = n.fn.prop;
          if (!obj || typeof obj[mName] !== 'function') throw new Error("Méthode PySpark inconnue : ." + mName + "()");
          if (obj instanceof DeltaTableObj && (mName === 'whenMatchedUpdate' || mName === 'whenNotMatchedInsertAll')) {
            return await obj[mName](args, kwargs);
          }
          return await obj[mName](...args);
        }
        const fn = await evalNode(n.fn);
        if (typeof fn !== 'function') throw new Error('Appel invalide en PySpark');
        return await fn(...args);
      }
      return null;
    }

    const stmts = parsePy(tokenizePy(src));
    if (!stmts.length) throw new Error('Le script PySpark est vide.');
    let lastVal = null, lastVar = null;
    for (const st of stmts) {
      if (st.k === 'noop') continue;
      if (st.k === 'assign') { lastVal = await evalNode(st.expr); env[st.name] = lastVal; lastVar = st.name; }
      else if (st.k === 'expr') { lastVal = await evalNode(st.expr); }
    }
    if (lastVal instanceof DF && !lastRes) {
      lastRes = await query(lastVal.sql);
      lastPlan = { plan: lastVal.explainText(), sql: lastVal.sql };
    } else if (typeof lastVal === 'number' && !lastRes) {
      lastRes = { cols: [lastVar || 'valeur'], types: ['Int64'], rows: [[lastVal]], ms: 1 };
    }
    return { last: lastRes, affected, ms: Math.round(performance.now() - t0), plan: lastPlan };
  }

  /* ---------- comparaison avec diff visuel ---------- */
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
    if (m.idempotent) return checkIdempotent(m, c);
    if (m.table || m.tables) {
      for (const t of (m.tables || [m.table])) {
        if (!(await tableExists(t.name))) return { ok: false, msg: 'La table <code>' + t.name + '</code> n\'existe pas. Crée-la avec <code>CREATE OR REPLACE TABLE ' + t.name + ' AS …</code> (ou <code>.write.saveAsTable("' + t.name + '")</code> en PySpark).' };
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
    const user = c.last; if (!user) return { ok: false, msg: 'Ton script ne renvoie aucun résultat : termine par un <code>SELECT</code> (ou <code>display(df)</code> / <code>.count()</code> en PySpark).' };
    const ref = m.expect.rows ? { cols: ['v'], types: ['Int64'], rows: m.expect.rows } : await query(m.expect.sql);
    const r = compare(user, ref, m.expect);
    if (r.ok) return r;
    for (const v of (m.variants || [])) { const vr = await query(v.sql); if (vr.cols.length === ref.cols.length && compare(user, vr, m.expect).ok) return { ok: false, msg: v.msg }; }
    return r;
  }
  async function checkIdempotent(m, c) {
    const id = m.idempotent, exec = s => c.lang === 'py' ? runPySpark(s) : runScript(s);
    if (!(await tableExists(id.name))) await E.conn.query('CREATE OR REPLACE TABLE ' + id.name + ' AS SELECT * FROM ' + id.reset);
    else await E.conn.query('CREATE OR REPLACE TABLE ' + id.name + ' AS SELECT * FROM ' + id.reset);
    const ref = await query('SELECT * FROM ' + id.ref);
    await exec(c.editor);
    let r = compare(await query('SELECT * FROM ' + id.name), ref);
    if (!r.ok) return { ok: false, msg: 'Après <strong>un</strong> passage de ton script, <code>' + id.name + '</code> n\'est pas dans l\'état attendu (' + r.msg + ')' };
    const before = (await query('SELECT count(*), count_if(statut = \'ANNULEE\') FROM ' + id.name)).rows[0];
    await exec(c.editor);
    const after = (await query('SELECT count(*), count_if(statut = \'ANNULEE\') FROM ' + id.name)).rows[0];
    if (before.join() !== after.join()) return { ok: false, msg: 'Ton script <strong>n\'est pas idempotent</strong> : après le premier passage la table compte ' + before[0] + ' lignes dont ' + before[1] + ' annulées ; après le second, ' + after[0] + ' dont ' + after[1] + '. Rejouer un job ne doit jamais dupliquer ni défaire.' };
    return { ok: true, extra: 'Deux passages, mêmes compteurs : <strong>' + after[0] + ' lignes, ' + after[1] + ' annulées</strong>.' };
  }

  /* ---------- coloration syntaxique SQL & PySpark ---------- */
  const KW_SQL = new Set('SELECT FROM WHERE GROUP BY ORDER LIMIT JOIN LEFT RIGHT INNER OUTER FULL CROSS ON USING AS WITH UNION ALL DISTINCT CASE WHEN THEN ELSE END AND OR NOT NULL IS IN EXISTS CREATE OR REPLACE TABLE VIEW INSERT INTO UPDATE SET DELETE VALUES ANTI SEMI QUALIFY OVER PARTITION EXCLUDE EXCEPT MERGE MATCHED HAVING DESC ASC BETWEEN LIKE DATE TIMESTAMP TRUE FALSE DROP ALTER SCHEMA IF'.split(' '));
  const KW_PY = new Set('from import as def return if else elif for in and or not True False None spark display F Window DeltaTable table select filter where withColumn drop dropDuplicates distinct join groupBy agg orderBy sort limit union unionByName alias write mode saveAsTable count first collect show explain when otherwise isNull isNotNull over partitionBy merge whenMatchedUpdate whenNotMatchedInsertAll execute'.split(' '));
  const RE_SQL = /(--[^\n]*)|('(?:[^']|'')*')|\b(\d+(?:\.\d+)?)\b|\b([A-Za-z_][A-Za-z0-9_]*)\b/g;
  const RE_PY = /(#[^\n]*)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|\b(\d+(?:\.\d+)?)\b|\b([A-Za-z_][A-Za-z0-9_]*)\b/g;
  function hl(s, lang) {
    let out = '', last = 0;
    const re = lang === 'py' ? RE_PY : RE_SQL;
    s.replace(re, (m, c, str, num, id, off) => {
      out += esc(s.slice(last, off)); last = off + m.length;
      if (c) out += '<i class="c">' + esc(m) + '</i>';
      else if (str) out += '<i class="s">' + esc(m) + '</i>';
      else if (num) out += '<i class="n">' + m + '</i>';
      else if (lang === 'py' ? KW_PY.has(m) : KW_SQL.has(m.toUpperCase())) out += '<i class="k">' + m + '</i>';
      else if (s[last] === '(') out += '<i class="f">' + m + '</i>';
      else out += m;
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
    const S = ctx.S; S.lab = S.lab || { done: {}, pyDone: {}, hints: {}, drafts: {}, pyDrafts: {}, follow: {}, lang: 'sql' };
    const LS = S.lab; LS.pyDone = LS.pyDone || {}; LS.pyDrafts = LS.pyDrafts || {};
    let lang = LS.lang || 'sql';
    const MS = L.MISSIONS;
    const cur = MS.find(m => m.id === missionId) || MS.find(m => !LS.done[m.id]) || MS[0];
    const total = MS.reduce((s, m) => s + m.xp, 0) + MS.reduce((s, m) => s + (m.followup ? m.followup.xp : 0), 0), earned = Object.values(LS.done).reduce((s, v) => s + v, 0);
    root.innerHTML =
      '<div class="head"><p class="crumb"><a href="#accueil">Accueil</a> / Labo SQL & PySpark</p><h1>Labo SQL & PySpark : la Banque Lanterne</h1>' +
      '<p class="muted">Un vrai moteur DuckDB + un compilateur DataFrame PySpark tournent dans ton navigateur sur la Banque Lanterne. Résous chaque mission en <b>SQL</b>, en <b>PySpark</b> (avec visualisation du <code>Physical Plan</code> Catalyst !) ou dans les deux langages. <span class="pill">' + earned + ' / ' + total + ' XP</span></p></div>' +
      '<div class="lab">' +
        '<aside class="lab-side panel"><h3>Missions</h3><ol class="mlist">' + MS.map((m, i) => '<li><a href="#labo-' + m.id + '" class="' + (m.id === cur.id ? 'on' : '') + (LS.done[m.id] != null ? ' done' : '') + '"><span class="mn">' + (LS.done[m.id] != null ? '✓' : i) + '</span><span>' + esc(m.title) + (LS.pyDone[m.id] ? ' <small class="pill ok" style="padding:0 5px;font-size:.65rem">PySpark ✓</small>' : '') + '</span><small>' + m.xp + ' XP</small></a></li>').join('') + '</ol>' +
        '<h3>Tables</h3><div id="schema" class="schema"><p class="fine">Le moteur démarre…</p></div>' +
        '<details class="dialect"><summary>Ce moteur et Databricks</summary><table class="plain"><tr><th>Ici (DuckDB)</th><th>Databricks</th></tr>' + L.DIALECT.map(d => '<tr><td><code>' + esc(d[0]) + '</code></td><td><code>' + esc(d[1]) + '</code><br><span class="fine">' + esc(d[2]) + '</span></td></tr>').join('') + '</table></details>' +
        '<button id="lab-reset" class="small">Réinitialiser le labo</button></aside>' +
        '<div class="lab-main">' +
          '<section class="panel" id="brief"><div class="hstack between"><span class="eyebrow">Mission ' + MS.indexOf(cur) + '</span><span class="pill">' + cur.xp + ' XP</span></div><h2>' + esc(cur.title) + '</h2><p class="brief">' + cur.brief + '</p>' +
          (cur.rules ? '<table class="plain rules">' + cur.rules.map(r => '<tr><td><code>' + r[0] + '</code></td><td>' + r[1] + '</td></tr>').join('') + '</table>' : '') + '<div id="needs"></div></section>' +
          '<section class="panel">' +
          '<div class="hstack between"><div class="seg"><button data-lang="sql" class="' + (lang === 'sql' ? 'on' : '') + '">Mode SQL (DuckDB / Databricks SQL)</button><button data-lang="py" class="' + (lang === 'py' ? 'on' : '') + '">🐍 Mode PySpark (DataFrame API + explain)</button></div>' +
          '<span class="fine" id="lang-tag">' + (lang === 'py' ? 'Évaluation paresseuse → compilé et exécuté sur DuckDB' : 'Syntaxe SQL standard + extensions Databricks (EXCEPT, QUALIFY, MERGE)') + '</span></div>' +
          '<div class="editor"><pre class="hl" id="hl" aria-hidden="true"></pre><textarea id="sql" spellcheck="false" aria-label="Éditeur de code" autocapitalize="off"></textarea></div>' +
          '<div class="hstack"><button id="run" class="b-primary" disabled>▶ Exécuter <kbd>Ctrl</kbd>+<kbd>↵</kbd></button><button id="validate" disabled>✔ Valider la mission</button><button id="hint">💡 Indice <span id="hint-n"></span></button><button id="starter" class="small">Remettre le point de départ</button></div><div id="hint-box"></div></section>' +
          '<section class="panel" id="result"><div id="boot" class="boot"><span class="spin"></span><span id="boot-msg">Démarrage du moteur…</span></div></section>' +
          '<section class="panel" id="verdict" hidden></section>' +
        '</div></div>';

    const ta = $(root, '#sql'), pre = $(root, '#hl'), res = $(root, '#result'), ver = $(root, '#verdict');
    const getStarter = () => lang === 'py' ? (cur.pyStarter || cur.py) : cur.starter;
    const getDraft = () => lang === 'py' ? (LS.pyDrafts[cur.id] != null ? LS.pyDrafts[cur.id] : getStarter()) : (LS.drafts[cur.id] != null ? LS.drafts[cur.id] : getStarter());
    ta.value = getDraft();
    const paint = () => { pre.innerHTML = hl(ta.value, lang); pre.scrollTop = ta.scrollTop; pre.scrollLeft = ta.scrollLeft; };
    ta.addEventListener('input', () => {
      paint();
      if (lang === 'py') LS.pyDrafts[cur.id] = ta.value; else LS.drafts[cur.id] = ta.value;
      ctx.save();
    });
    ta.addEventListener('scroll', () => { pre.scrollTop = ta.scrollTop; pre.scrollLeft = ta.scrollLeft; });
    ta.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); run(); }
      else if (e.key === 'Tab') { e.preventDefault(); const s = ta.selectionStart; ta.setRangeText('  ', s, ta.selectionEnd, 'end'); ta.dispatchEvent(new Event('input')); }
    });
    paint();

    root.querySelectorAll('[data-lang]').forEach(b => b.onclick = () => {
      lang = b.dataset.lang; LS.lang = lang; ctx.save();
      root.querySelectorAll('[data-lang]').forEach(x => x.classList.toggle('on', x.dataset.lang === lang));
      $(root, '#lang-tag').textContent = lang === 'py' ? 'Évaluation paresseuse → compilé et exécuté sur DuckDB' : 'Syntaxe SQL standard + extensions Databricks (EXCEPT, QUALIFY, MERGE)';
      ta.value = getDraft(); paint(); showHints();
    });

    const hintN = () => LS.hints[cur.id] || 0;
    const showHints = () => {
      const n = hintN(); $(root, '#hint-n').textContent = n ? '(' + n + '/3)' : '';
      $(root, '#hint-box').innerHTML = cur.hints.slice(0, n).map((h, i) => {
        const solText = (i === 2 && lang === 'py') ? cur.py : h;
        return '<div class="hint"><b>Indice ' + (i + 1) + (i === 2 ? ' · solution (' + (lang === 'py' ? 'PySpark' : 'SQL') + ')' : '') + '</b>' + (i === 2 ? '<pre>' + esc(solText) + '</pre>' : '<p>' + h + '</p>') + '</div>';
      }).join('') + (n ? '<p class="fine">Récompense actuelle : ' + Math.round(cur.xp * (1 - PENALTY[n])) + ' XP.</p>' : '');
    };
    showHints();
    $(root, '#hint').onclick = () => { if (hintN() < 3) { LS.hints[cur.id] = hintN() + 1; ctx.save(); showHints(); } };
    $(root, '#starter').onclick = () => { ta.value = getStarter(); ta.dispatchEvent(new Event('input')); };

    async function schema() {
      const box = $(root, '#schema'); if (!box) return;
      const r = await query('SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_schema = \'main\' ORDER BY table_name, ordinal_position');
      const by = {}; r.rows.forEach(([t, c, d]) => (by[t] = by[t] || []).push([c, d]));
      const counts = {}; for (const t of Object.keys(by)) counts[t] = (await query('SELECT count(*) FROM ' + t)).rows[0][0];
      box.innerHTML = Object.keys(by).map(t => '<details><summary><b>' + t + '</b> <span class="fine">' + counts[t].toLocaleString('fr-FR') + '</span></summary><ul>' + by[t].map(c => '<li><button class="col" data-ins="' + c[0] + '">' + c[0] + '</button> <span class="fine">' + c[1].toLowerCase() + '</span></li>').join('') + '</ul><button class="small" data-ins="SELECT * FROM ' + t + ' LIMIT 10;">Aperçu</button></details>').join('');
    }
    root.addEventListener('click', e => {
      const b = e.target.closest('[data-ins]'); if (!b) return;
      const t = b.dataset.ins;
      if (/^SELECT /.test(t)) {
        if (lang === 'py') {
          const tbl = t.match(/FROM\s+([A-Za-z0-9_]+)/)[1];
          ta.value = 'display(spark.table("' + tbl + '").limit(10))';
        } else ta.value = t;
        ta.dispatchEvent(new Event('input')); run();
      } else { ta.setRangeText(t, ta.selectionStart, ta.selectionEnd, 'end'); ta.dispatchEvent(new Event('input')); ta.focus(); }
    });

    async function needs() {
      const box = $(root, '#needs'); if (!box || !cur.needs) return;
      const miss = []; for (const n of cur.needs) if (!(await tableExists(n))) miss.push(n);
      box.innerHTML = miss.length ? '<div class="note warn">Cette mission part de <code>' + miss.join('</code>, <code>') + '</code>, que tu n\'as pas encore construite. <button id="provision" class="small">Charger la version de référence (sans XP)</button></div>' : '';
      const p = $(root, '#provision'); if (p) p.onclick = async () => { for (const n of miss) await E.conn.query('CREATE OR REPLACE TABLE ' + n + ' AS SELECT * FROM ref.' + n); await schema(); await needs(); };
    }
    const err = e => '<div class="note bad"><b>Erreur' + (e.stmt && e.of > 1 ? ' (instruction ' + e.stmt + ' sur ' + e.of + ')' : '') + '</b><pre class="errtxt">' + esc(String(e.message).replace(/^(Catalog|Binder|Parser|Conversion|Invalid Input|Constraint) Error: /, '$1 : ').slice(0, 600)) + '</pre></div>';
    let tab = 'table', lastRes = null;
    const showResult = (r, info, planInfo) => {
      lastRes = r;
      const ch = r && chart(r);
      const planHtml = planInfo ? '<details style="margin-top:8px" open><summary>🔍 Plan d\'exécution Spark (<code>df.explain()</code>) & SQL compilé</summary><pre class="mini" style="margin-top:6px">' + esc(planInfo.plan) + '\n\n-- SQL compilé exécuté sur DuckDB :\n' + esc(planInfo.sql) + '</pre></details>' : '';
      res.innerHTML = '<div class="hstack between"><b>Résultat' + (lang === 'py' ? ' DataFrame PySpark' : '') + '</b><span class="fine">' + (r ? r.rows.length.toLocaleString('fr-FR') + ' ligne(s) · ' : '') + info + '</span>' +
        '<div class="hstack">' + (r && r.rows.length ? '<button class="small" id="dl-csv">⬇ CSV</button>' : '') +
        (ch ? '<span class="seg"><button data-tab="table" class="' + (tab === 'table' ? 'on' : '') + '">Tableau</button><button data-tab="chart" class="' + (tab === 'chart' ? 'on' : '') + '">Graphique</button></span>' : '') + '</div></div>' +
        (r ? (tab === 'chart' && ch ? ch : grid(r)) : '<p class="muted">Aucune ligne à afficher.</p>') + planHtml;
      res.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { tab = b.dataset.tab; showResult(r, info, planInfo); });
      const dl = $(res, '#dl-csv');
      if (dl) dl.onclick = () => {
        const csv = [r.cols.join(',')].concat(r.rows.map(row => row.map(v => v === null ? '' : typeof v === 'string' && /[,;"\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v).join(','))).join('\n');
        const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = 'resultat-' + cur.id + '.csv';
        document.body.appendChild(a); a.click(); a.remove();
      };
    };
    async function run() {
      if (E.state !== 'ready') return null;
      const text = ta.value.slice(ta.selectionStart, ta.selectionEnd).trim() ? ta.value.slice(ta.selectionStart, ta.selectionEnd) : ta.value;
      try {
        const r = lang === 'py' ? await runPySpark(text) : await runScript(text);
        showResult(r.last, (r.affected ? r.affected + ' ligne(s) écrite(s) · ' : '') + r.ms + ' ms', r.plan);
        await schema(); await needs();
        return r;
      } catch (e) { res.innerHTML = err(e); return null; }
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
        if (!m.idempotent) { r = await run(); if (!r) { ver.hidden = true; btn.disabled = false; return; } }
        const out = await checkMission(m, { last: r && r.last, editor: ta.value, lang });
        if (!out.ok) {
          let up = '';
          for (const nd of (m.needs || [])) { try { if (!compare(await query('SELECT * FROM ' + nd), await query('SELECT * FROM ref.' + nd), { tol: 0.011 }).ok) up += '<p>⚠ Ta table <code>' + nd + '</code> ne correspond pas à la référence : l\'erreur vient peut-être d\'une mission précédente.</p>'; } catch (e) { } }
          ver.innerHTML = '<div class="note bad"><b>Pas encore.</b><p>' + out.msg + '</p>' + up + '</div>';
        }
        else {
          const gain = Math.round(m.xp * (1 - PENALTY[n])), first = LS.done[m.id] == null;
          if (lang === 'py') LS.pyDone[m.id] = true;
          if (first) { LS.done[m.id] = gain; ctx.save(); ctx.confetti(); ctx.reward(); } else { ctx.save(); }
          ver.innerHTML = '<div class="note ok"><b>Mission réussie en ' + (lang === 'py' ? 'PySpark 🐍' : 'SQL') + (first ? ' · +' + gain + ' XP' : ' (déjà validée)') + '</b>' + (out.extra ? '<p>' + out.extra + '</p>' : '') + (m.after ? '<p>' + m.after + '</p>' : '') + '</div>' +
            (m.followup ? '<div class="follow" id="follow"></div>' : '') + '<div id="flow"></div>' +
            '<details open><summary>' + (lang === 'py' ? 'Voir aussi la solution SQL' : 'Équivalent PySpark (exécutable en basculant en Mode PySpark !)') + '</summary><pre>' + esc(lang === 'py' ? m.hints[2] : m.py) + '</pre></details>' +
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

    // démarrage du moteur + restauration automatique des tables des missions déjà validées
    boot(m => { const el = $(root, '#boot-msg'); if (el) el.textContent = m; }).then(async () => {
      if (!root.isConnected) return;
      const restored = await restoreProgressTables(LS);
      res.innerHTML = '<p class="muted">Le moteur est prêt' + (restored ? ' (tes tables des missions précédentes ont été restaurées automatiquement ✓)' : '') + '. Écris ta requête en SQL ou en PySpark puis <kbd>Ctrl</kbd>+<kbd>↵</kbd>.</p>';
      $(root, '#run').disabled = false; $(root, '#validate').disabled = false;
      await schema(); await needs();
    }).catch(e => { if (root.isConnected) res.innerHTML = '<div class="note bad"><b>Le moteur SQL n\'a pas pu démarrer.</b><p>Il se télécharge depuis un CDN public (connexion internet requise, environ 7 Mo). Vérifie ta connexion ou un éventuel proxy d\'entreprise, puis recharge la page.</p><pre class="errtxt">' + esc(E.error) + '</pre></div>'; });
  }

  window.SQLLab = { mount, _e: E, _query: query, _runPySpark: runPySpark, _transpileSql: transpileDatabricksSql };
})();
