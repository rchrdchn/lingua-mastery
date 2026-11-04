/* Site search (Tiny Labs shared pattern): a command palette (Cmd/Ctrl+K or "/") and a /search/?q= page. No library.
   Config: <script type="application/json" id="ss-cfg">{idx, page, stop, t:{...}}</script>. Triggers: any [data-ss-open] (an <a href="/search/">
   so it works without JS). The index (built at build time) is fetched once, on first open or when a trigger is hovered or focused.
   Index: {g:[groupKey...], w:[group weight...], i:[[groupIndex, title, sub, url, keywords, boost?, aliases?]], s:[suggested item indexes]}.
   Aliases (nicknames like "psg" or "man utd") score like title words; keywords score a bit lower.
   Matching: every query word must match a title or keyword word (exact, prefix, inside, or 1-2 typos); Chinese runs match as substrings.
   If nothing matches every word, the best partial matches show under "Closest matches". */
(() => {
  if (window.SiteSearch) return;
  const cfgEl = document.getElementById('ss-cfg'); if (!cfgEl) return;
  const C = JSON.parse(cfgEl.textContent), T = C.t || {};
  const STOP = new Set(C.stop || ['the', 'a', 'an', 'of', 'and', 'to', 'in', 'on', 'for', 'with', 'at']);
  const CJK = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/;
  const norm = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/['’]/g, '');
  const split = s => norm(s).match(/[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]+|(?:(?![\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff])[\p{L}\p{N}])+/gu) || [];
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  // Damerau-Levenshtein (optimal string alignment), stops early past max.
  const dl = (a, b, max) => {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    let p2 = null, p = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const c = [i]; let lo = i;
      for (let j = 1; j <= b.length; j++) {
        let v = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        if (p2 && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, p2[j - 2] + 1);
        c[j] = v; if (v < lo) lo = v;
      }
      if (lo > max) return max + 1;
      p2 = p; p = c;
    }
    return p[b.length];
  };
  // How well query word t matches index word w: 1 exact, .85 prefix, .55 inside, .7/.5 typo, 0 none.
  const wscore = (t, w, fz = true) => {
    if (t === w) return 1;
    if (t.length <= 1) return 0;
    if (w.startsWith(t)) return t.length <= 2 ? .6 : .85;
    if (t.length <= 2) return 0;
    if (t.length >= 4 && w.includes(t)) return .55;
    if (fz && t.length >= 4) {
      const max = t.length >= 7 ? 2 : 1, d = dl(t, w, max);
      if (d <= max) return d === 1 ? .7 : .5;
      if (w.length > t.length && dl(t, w.slice(0, t.length), 1) <= 1) return .5;
    }
    return 0;
  };
  const best = (t, ws, fz) => { let b = 0; for (const w of ws) { const s = wscore(t, w, fz); if (s > b) { b = s; if (b === 1) break; } } return b; };
  const bigrams = s => { const o = []; for (let i = 0; i < s.length - 1; i++) o.push(s.slice(i, i + 2)); return o; };
  const cjkScore = (t, item, fz) => {
    if (item.rt.includes(t)) return 1;
    if (item.rk.includes(t)) return .7;
    if (fz && t.length >= 3) { const bg = bigrams(t), hit = bg.filter(b => item.rt.includes(b) || item.rk.includes(b)).length; if (hit / bg.length >= .6) return .45; }
    return 0;
  };

  let IDX = null, loading = null;
  const load = () => loading || (loading = fetch(C.idx).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }).then(j => {
    const gw = j.w || [];
    const items = j.i.map(([g, t, s, u, k, b, a], n) => ({ n, g: j.g[g], gi: g, t, s: s || '', u, b: (b || 0) + (gw[g] || 0) * 20,
      tw: [...new Set(split(`${t} ${a || ''}`))], kw: [...new Set(split(`${s || ''} ${k || ''}`))], rt: norm(t), rk: norm(`${s || ''} ${k || ''}`), nt: norm(t) }));
    IDX = { items, groups: j.g, sugg: (j.s || []).map(n => items[n]).filter(Boolean) };
    return IDX;
  }).catch(e => { loading = null; throw e; }));

  function query(q) {
    const nq = norm(q).trim(); if (!nq || !IDX) return { list: [], loose: false, toks: [] };
    let toks = split(nq); const kept = toks.filter(t => !STOP.has(t)); if (kept.length) toks = kept;
    toks = [...new Set(toks)];
    // Pass 1: exact, prefix and inside matches only. Typos count only when pass 1 finds nothing, so "pear" doesn't drag in "tears".
    const scoreIt = (it, need, fz) => {
      let tot = 0, hit = 0;
      for (const t of toks) {
        const s = CJK.test(t) ? cjkScore(t, it, fz) : Math.max(best(t, it.tw, fz), best(t, it.kw, fz) * .6);
        if (s > 0) { hit++; tot += s; }
      }
      if (hit < need) return 0;
      let sc = tot / toks.length;
      if (it.nt === nq) sc += 1; else if (it.nt.startsWith(nq)) sc += .5; else if (nq.length > 2 && it.nt.includes(nq)) sc += .25;
      return sc + it.b * .05;
    };
    const pass = (need, fz) => IDX.items.map(it => [it, scoreIt(it, need, fz)]).filter(x => x[1] > 0);
    let list = pass(toks.length, false), loose = false;
    if (!list.length) list = pass(toks.length, true);
    if (!list.length && toks.length > 1) { loose = true; list = pass(Math.ceil(toks.length / 2), true); }
    list.sort((a, b) => b[1] - a[1] || a[0].gi - b[0].gi || a[0].n - b[0].n);
    return { list: list.map(x => x[0]), loose, toks };
  }

  // Bold the title words a query word matched.
  function hl(title, toks) {
    let h = title.split(/([\p{L}\p{N}]+)/u).map((w, i) => i % 2 && toks.some(t => !CJK.test(t) && wscore(t, norm(w)) >= .5) ? `<mark>${esc(w)}</mark>` : esc(w)).join('');
    for (const t of toks) if (CJK.test(t) && title.includes(t)) h = h.split(t).join(`<mark>${t}</mark>`);
    return h.replace(/<\/mark>(\s*)<mark>/g, '$1');
  }
  const pageUrl = q => (C.page || '/search/') + (q ? '?q=' + encodeURIComponent(q) : '');
  const gLabel = g => (T.groups && T.groups[g]) || g;

  // Render grouped results into a listbox. limit: per-group cap (0 = all).
  let uid = 0;
  function render(box, res, q, limit) {
    const by = new Map();
    for (const it of res.list) { if (!by.has(it.g)) by.set(it.g, []); by.get(it.g).push(it); }
    const order = [...by.keys()];
    const cap = limit && order.length === 1 ? limit * 2 : limit;
    let html = res.loose ? `<p class="ss-note">${esc(T.closest || 'Closest matches')}</p>` : '';
    for (const g of order) {
      const xs = cap ? by.get(g).slice(0, cap) : by.get(g), id = `ss-g${++uid}`;
      html += `<div class="ss-grp" role="group" aria-labelledby="${id}"><p class="ss-gh" id="${id}">${esc(gLabel(g))}${by.get(g).length > xs.length ? ` <span>${by.get(g).length}</span>` : ''}</p>${xs.map(it => `<a class="ss-o ss-${esc(it.g)}" role="option" id="ss-o${++uid}" href="${esc(it.u)}" aria-selected="false"><span class="ss-t">${hl(it.t, res.toks)}</span>${it.s ? `<span class="ss-s">${esc(it.s)}</span>` : ''}</a>`).join('')}</div>`;
    }
    box.innerHTML = html;
    return res.list.length;
  }
  function renderSugg(box) {
    if (!IDX || !IDX.sugg.length) { box.innerHTML = `<p class="ss-note">${esc(T.hint || '')}</p>`; return; }
    const id = `ss-g${++uid}`;
    box.innerHTML = `<div class="ss-grp" role="group" aria-labelledby="${id}"><p class="ss-gh" id="${id}">${esc(T.popular || 'Popular')}</p>${IDX.sugg.map(it => `<a class="ss-o ss-${esc(it.g)}" role="option" id="ss-o${++uid}" href="${esc(it.u)}" aria-selected="false"><span class="ss-t">${esc(it.t)}</span>${it.s ? `<span class="ss-s">${esc(it.s)}</span>` : ''}</a>`).join('')}</div>`;
  }

  // Arrow keys move through options; Enter opens the active one.
  function keys(input, box, onEnterNone) {
    let act = -1;
    const opts = () => [...box.querySelectorAll('[role=option]')];
    const set = i => { const o = opts(); o.forEach((x, j) => x.setAttribute('aria-selected', j === i ? 'true' : 'false')); act = i;
      if (o[i]) { input.setAttribute('aria-activedescendant', o[i].id); o[i].scrollIntoView({ block: 'nearest' }); } else input.removeAttribute('aria-activedescendant'); };
    input.addEventListener('keydown', e => {
      const o = opts();
      if (e.key === 'ArrowDown' || (e.key === 'n' && e.ctrlKey)) { e.preventDefault(); if (o.length) set((act + 1) % o.length); }
      else if (e.key === 'ArrowUp' || (e.key === 'p' && e.ctrlKey)) { e.preventDefault(); if (o.length) set(act <= 0 ? o.length - 1 : act - 1); }
      else if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); if (o[act]) o[act].click(); else if (o[0] && input.value.trim()) o[0].click(); else onEnterNone && onEnterNone(); }
    });
    box.addEventListener('mousemove', e => { const a = e.target.closest('[role=option]'); if (a) { const i = opts().indexOf(a); if (i !== act) set(i); } });
    return { reset: () => set(input.value.trim() && opts().length ? 0 : -1) };
  }

  // ---------- palette ----------
  let dlg, inp, list, foot, nav;
  const mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  function build() {
    dlg = document.createElement('dialog'); dlg.className = 'ss'; dlg.setAttribute('aria-label', T.aria || 'Search');
    dlg.innerHTML = `<div class="ss-box"><form class="ss-bar" role="search" action="${esc(C.page || '/search/')}" method="get"><svg class="ss-i" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>
<input class="ss-in" name="q" type="search" role="combobox" aria-expanded="true" aria-controls="ss-list" aria-autocomplete="list" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search" placeholder="${esc(T.ph || 'Search')}" aria-label="${esc(T.aria || 'Search')}">
<button type="button" class="ss-x" data-ss-close>${esc(T.close || 'Close')}</button></form>
<div class="ss-list" id="ss-list" role="listbox" aria-label="${esc(T.results || 'Results')}"></div>
<div class="ss-foot"><span class="ss-keys"><kbd>↑</kbd><kbd>↓</kbd> ${esc(T.move || 'move')} <kbd>↵</kbd> ${esc(T.open || 'open')} <kbd>esc</kbd> ${esc(T.close || 'close').toLowerCase()}</span><a class="ss-all" href="${esc(pageUrl(''))}">${esc(T.all || 'See all results')}</a></div>
<p class="ss-live" aria-live="polite"></p></div>`;
    document.body.append(dlg);
    inp = dlg.querySelector('.ss-in'); list = dlg.querySelector('.ss-list'); foot = dlg.querySelector('.ss-all');
    nav = keys(inp, list, () => { location.href = pageUrl(inp.value.trim()); });
    let tm;
    inp.addEventListener('input', () => { clearTimeout(tm); tm = setTimeout(run, 40); });
    dlg.addEventListener('click', e => { if (e.target === dlg || e.target.closest('[data-ss-close]')) close(); else if (e.target.closest('a[href]') && !e.metaKey && !e.ctrlKey && !e.shiftKey) close(); });
    dlg.addEventListener('close', () => document.documentElement.classList.remove('ss-lock'));
    dlg.querySelector('form').addEventListener('submit', e => e.preventDefault());
  }
  function run() {
    const q = inp.value.trim(), live = dlg.querySelector('.ss-live');
    foot.href = pageUrl(q);
    if (!IDX) { list.innerHTML = `<p class="ss-note">${esc(T.loading || 'Loading…')}</p>`; return; }
    if (!q) { renderSugg(list); live.textContent = ''; nav.reset(); return; }
    const n = render(list, query(q), q, 5);
    if (!n) list.innerHTML = `<p class="ss-note">${esc((T.none || 'No results for “{q}”').replace('{q}', q))}</p>`;
    live.textContent = n ? (T.count || '{n} results').replace('{n}', n) : '';
    nav.reset();
  }
  function open(q) {
    if (!dlg) build();
    if (dlg.open) { inp.focus(); return; }
    if (typeof q === 'string') inp.value = q;
    document.documentElement.classList.add('ss-lock');
    dlg.showModal(); inp.focus(); inp.select(); run();
    load().then(run, () => { list.innerHTML = `<p class="ss-note">${esc(T.error || 'Search is unavailable right now.')} <a href="${esc(pageUrl(inp.value.trim()))}">${esc(T.all || 'See all results')}</a></p>`; });
  }
  function close() { if (dlg && dlg.open) dlg.close(); }

  document.addEventListener('click', e => { const a = e.target.closest('[data-ss-open]'); if (!a || e.metaKey || e.ctrlKey || e.shiftKey) return; if (document.querySelector('[data-ss-page]')) { e.preventDefault(); const i = document.querySelector('[data-ss-page] input'); i && i.focus(); return; } e.preventDefault(); open(); });
  const warm = e => { if (e.target.closest && e.target.closest('[data-ss-open]')) load().catch(() => {}); };
  document.addEventListener('pointerover', warm, { passive: true }); document.addEventListener('focusin', warm);
  document.addEventListener('keydown', e => {
    if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey) && !e.altKey) { e.preventDefault(); if (dlg && dlg.open) close(); else open(); return; }
    if (e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey) {
      const t = e.target, tag = t && t.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable) || document.querySelector('dialog[open]')) return;
      e.preventDefault(); const pi = document.querySelector('[data-ss-page] input'); if (pi) pi.focus(); else open();
    }
  });
  document.querySelectorAll('[data-ss-kbd]').forEach(k => { k.textContent = mac ? '⌘K' : 'Ctrl K'; });

  // ---------- /search/ page ----------
  const pg = document.querySelector('[data-ss-page]');
  if (pg) {
    const pi = pg.querySelector('input'), out = pg.querySelector('[data-ss-results]'), stat = pg.querySelector('[data-ss-static]'), live = pg.querySelector('[data-ss-live]');
    pi.setAttribute('role', 'combobox'); pi.setAttribute('aria-controls', out.id); pi.setAttribute('aria-autocomplete', 'list'); pi.setAttribute('aria-expanded', 'true');
    const pnav = keys(pi, out, () => {});
    pg.querySelector('form').addEventListener('submit', e => { e.preventDefault(); go(); });
    const go = () => {
      const q = pi.value.trim();
      history.replaceState(null, '', pageUrl(q));
      if (stat) stat.hidden = !!q;
      if (!q) { out.innerHTML = ''; if (live) live.textContent = ''; return; }
      if (!IDX) { out.innerHTML = `<p class="ss-note">${esc(T.loading || 'Loading…')}</p>`; return; }
      const n = render(out, query(q), q, 0);
      if (!n) out.innerHTML = `<p class="ss-note">${esc((T.none || 'No results for “{q}”').replace('{q}', q))}</p>`;
      if (live) live.textContent = n ? (T.count || '{n} results').replace('{n}', n) : (T.none || '').replace('{q}', q);
      pnav.reset();
    };
    let tm; pi.addEventListener('input', () => { clearTimeout(tm); tm = setTimeout(go, 60); });
    pi.value = new URLSearchParams(location.search).get('q') || '';
    go(); load().then(go, () => { out.innerHTML = `<p class="ss-note">${esc(T.error || 'Search is unavailable right now.')}</p>`; if (stat) stat.hidden = false; });
    if (!pi.value) pi.focus();
  }
  window.SiteSearch = { open, close, query: q => load().then(() => query(q).list) };
})();
