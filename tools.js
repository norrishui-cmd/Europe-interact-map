/* Chronica Maps — interactive tools: daily puzzle, compare two years, your town's history.
   Each tool page sets <main data-tool="daily|compare|town"> and loads d3 + this file. */
(function () {
  const V = '?v=' + (window.APP_V || '');
  const REGIONS = {
    europe: { name: 'Europe', box: [-24, 34, 58, 71.5] },
    asia: { name: 'Asia', box: [34, -8, 148, 56] },
    africa: { name: 'Africa', box: [-19, -35, 52, 37.5] },
    americas: { name: 'The Americas', box: [-126, -56, -34, 62] },
    oceania: { name: 'Oceania', box: [110, -48, 182, 0] },
    world: { name: 'The world', box: [-168.9, -57, 190.9, 84] },
  };
  const W = 1200, H = 800;
  function millerRaw(l, p) { return [l, 1.25 * Math.log(Math.tan(Math.PI / 4 + 0.4 * p))]; }
  millerRaw.invert = (x, y) => [x, 2.5 * Math.atan(Math.exp(0.8 * y)) - 0.625 * Math.PI];
  const boxPts = b => { const [x0, y0, x1, y1] = b, pts = []; for (let x = x0; x <= x1; x++) pts.push([x, y0], [x, y1]); for (let y = y0; y <= y1; y++) pts.push([x0, y], [x1, y]); return { type: 'MultiPoint', coordinates: pts }; };
  const proj = r => d3.geoProjection(millerRaw).rotate([-11, 0]).precision(0.3).fitExtent([[10, 10], [W - 10, H - 10]], boxPts(REGIONS[r].box));
  const fy = y => (y < 0 ? `${-y} BC` : y < 1000 ? `AD ${y}` : `${y}`);
  const yearSlug = y => (y < 0 ? `${-y}-bc` : `${y}`);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const store = { get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
  function regionOf(ll) {
    const C = { europe: [17, 53], asia: [95, 32], africa: [18, 3], americas: [-80, 15], oceania: [155, -22] };
    let best = 'world', bd = 1e9;
    for (const k in C) { const [x0, y0, x1, y1] = REGIONS[k].box; let lon = ll[0]; if (lon < x0) lon += 360; if (lon >= x0 - 4 && lon <= x1 + 4 && ll[1] >= y0 - 4 && ll[1] <= y1 + 4) { const d = d3.geoDistance(ll, C[k]); if (d < bd) { bd = d; best = k; } } }
    return best;
  }

  let META, PHYS;
  const SNAP = {};
  const loadMeta = () => Promise.all([d3.json('/data/tools-meta.json' + V), d3.json('/physical.json' + V)]).then(([m, p]) => { META = m; PHYS = p; });
  const loadSnap = s => SNAP[s] || (SNAP[s] = d3.json(`/atlas/${s}.json` + V));
  const nm = n => (META.names[n] ? META.names[n][0] : n);
  const col = n => (META.names[n] ? META.names[n][1] : '#c9b48a');
  const tribal = n => !!(META.names[n] && META.names[n][2]);
  const stLink = n => { const m = META.names[n]; const sw = `<span class="sw" style="background:${col(n)}"></span>`; return m && m[3] ? `${sw}<a href="/en/state/${m[3]}">${esc(nm(n))}</a>` : `${sw}${esc(nm(n) || 'Unclaimed / no data')}`; };
  const named = fc => fc.features.filter(f => f.properties.n && f.properties.n.trim());

  // draw one border map into an <svg viewBox="0 0 1200 800">
  function drawMap(svgEl, fc, region, opt = {}) {
    const p = proj(region), path = d3.geoPath(p), svg = d3.select(svgEl).attr('viewBox', `0 0 ${W} ${H}`);
    svg.selectAll('*').remove();
    svg.append('rect').attr('width', W).attr('height', H).attr('fill', '#c9d3c8');
    svg.append('path').datum(PHYS.land).attr('d', path).attr('fill', '#eadfc4');
    const fs = named(fc);
    svg.append('g').selectAll('path').data(fs).join('path').attr('d', path)
      .attr('fill', d => (opt.highlight && d.properties.n === opt.highlight ? '#a8322a' : col(d.properties.n)))
      .attr('fill-opacity', d => (tribal(d.properties.n) ? 0.3 : 0.62)).attr('stroke', '#5a4630').attr('stroke-opacity', 0.55).attr('stroke-width', 0.7);
    svg.append('g').attr('fill', 'none').attr('stroke', '#7d9cab').attr('stroke-width', 0.8).selectAll('path').data(PHYS.rivers.features).join('path').attr('d', path);
    svg.append('path').datum(PHYS.land).attr('d', path).attr('fill', 'none').attr('stroke', '#7d6a4c').attr('stroke-width', 0.8).attr('stroke-opacity', 0.7);
    if (opt.labels) {
      const placed = [], g = svg.append('g').attr('font-family', 'Georgia,serif').attr('font-weight', 700).attr('fill', '#3a2a1a').attr('text-anchor', 'middle').attr('paint-order', 'stroke').attr('stroke', '#efe4cb').attr('stroke-width', 3);
      for (const f of fs) {
        const n = f.properties.n;
        if (tribal(n) || (opt.labels !== true && !opt.labels.includes(n))) continue;
        let geo = f.geometry, best = geo;
        if (geo.type === 'MultiPolygon') { let ba = -1; for (const c of geo.coordinates) { const pg = { type: 'Polygon', coordinates: c }; const a = d3.geoArea(pg); if (a > ba) { ba = a; best = pg; } } }
        const c = path.centroid(best); if (!isFinite(c[0]) || c[0] < 30 || c[0] > W - 30 || c[1] < 20 || c[1] > H - 20) continue;
        const fz = Math.max(13, Math.min(26, 6 + Math.sqrt(path.area(best)) * 0.05)), w = nm(n).length * fz * 0.56 + 6;
        const bx = [c[0] - w / 2, c[1] - fz, c[0] + w / 2, c[1] + 4];
        if (placed.some(q => !(bx[2] < q[0] || bx[0] > q[2] || bx[3] < q[1] || bx[1] > q[3]))) continue;
        placed.push(bx); g.append('text').attr('x', c[0]).attr('y', c[1]).attr('font-size', fz).text(nm(n));
        if (opt.labels === true && placed.length >= (opt.max || 16)) break;
      }
    }
    if (opt.pin) { const q = p(opt.pin); svg.append('circle').attr('cx', q[0]).attr('cy', q[1]).attr('r', 9).attr('fill', '#a8322a').attr('stroke', '#fff').attr('stroke-width', 3); }
    return p;
  }
  // states whose main body lies in the region, sorted by area
  function regionStates(fc, region) {
    return named(fc).filter(f => !tribal(f.properties.n)).map(f => ({ n: f.properties.n, a: d3.geoArea(f) * 6371 * 6371, c: d3.geoCentroid(f) }))
      .filter(x => region === 'world' || regionOf(x.c) === region).reduce((m, x) => { const o = m.find(y => y.n === x.n); if (o) o.a += x.a; else m.push(x); return m; }, []).sort((a, b) => b.a - a.a);
  }
  const fmtKm2 = a => (a >= 1e6 ? `${(a / 1e6).toFixed(2)} million km²` : `${(Math.round(a / 1e4) * 1e4).toLocaleString('en-US')} km²`);
  const yearPage = (s, r) => (r === 'europe' ? `/en/year/${yearSlug(s)}` : `/en/world/${yearSlug(s)}`);
  const eraOf = (s, r) => { const L = META.eras[r] || META.eras.europe; const e = L.find(e => s >= e[0] && s < e[1]) || L[L.length - 1]; return e[2]; };

  // ===================== DAILY =====================
  function daily(root) {
    const EPOCH = Date.UTC(2026, 10, 9), DAY = 864e5;
    const today = Math.floor((Date.now() - EPOCH) / DAY) + 1;
    const want = +(location.hash.match(/^#(\d+)$/) || [])[1];
    const num = want >= 1 && want <= today ? want : today;
    const S = META.snaps;
    const pool = [];
    S.forEach(s => {
      pool.push([s, 'europe'], [s, 'world']);
      if (s >= -323) pool.push([s, 'asia']);
      if (s >= 1914) pool.push([s, 'africa']);
      if (s >= 1600) pool.push([s, 'americas']);
    });
    let seed = 20261109; const rnd = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    const [ans, region] = pool[(num - 1) % pool.length], ai = S.indexOf(ans), MAX = 5;
    const key = 'cm_daily_' + num, st = store.get(key, { g: [] }), stats = store.get('cm_daily_stats', { played: 0, won: 0, streak: 0, best: 0, last: 0 });
    root.innerHTML = `<div class="tool-head"><b>Puzzle #${num}</b> · ${REGIONS[region].name} ${num < today ? `· <a href="/daily">today's puzzle</a>` : ''}</div>
<div class="mapbox"><svg id="dmap"></svg></div>
<div id="hints" class="hints"></div>
<div class="guessrow"><label for="dsel">Which border map is this?</label> <select id="dsel">${S.map(s => `<option value="${s}">${fy(s)}</option>`).join('')}</select> <button id="dgo" class="btn">Guess</button></div>
<div id="dlog" class="dlog"></div><div id="dres"></div>`;
    const sel = root.querySelector('#dsel'); sel.value = S[Math.floor(S.length / 2)];
    loadSnap(ans).then(fc => {
      const states = regionStates(fc, region), top = states.map(x => x.n);
      const render = () => {
        const done = st.g.includes(ans) || st.g.length >= MAX, won = st.g.includes(ans), wrong = st.g.filter(g => g !== ans).length;
        const lab = done ? true : wrong >= 3 ? top.slice(0, 5) : wrong >= 1 ? top.slice(0, 1) : [];
        drawMap(root.querySelector('#dmap'), fc, region, { labels: lab, max: 16 });
        const hints = [];
        if (wrong >= 1 && top[0]) hints.push(`The largest state on this map is <b>${esc(nm(top[0]))}</b>.`);
        if (wrong >= 2) hints.push(`Era: <b>${esc(eraOf(ans, region))}</b>.`);
        if (wrong >= 3) hints.push('Four more states are now labelled.');
        if (wrong >= 4) { const lo = S[Math.max(0, ai - 2)], hi = S[Math.min(S.length - 1, ai + 2)]; hints.push(`The map is between <b>${fy(lo)}</b> and <b>${fy(hi)}</b>.`); }
        root.querySelector('#hints').innerHTML = done ? '' : hints.map(h => `<p>💡 ${h}</p>`).join('');
        root.querySelector('#dlog').innerHTML = st.g.map(g => { const d = S.indexOf(g) - ai; return `<div class="dl">${mark(d)} ${fy(g)} ${d === 0 ? '— correct!' : d < 0 ? '— later ⬆️' : '— earlier ⬇️'}</div>`; }).join('');
        root.querySelector('.guessrow').style.display = done ? 'none' : '';
        if (done) {
          const share = `Chronica Daily #${num} · ${REGIONS[region].name}\n${st.g.map(g => mark(S.indexOf(g) - ai) + (S.indexOf(g) - ai < 0 ? '⬆️' : S.indexOf(g) - ai > 0 ? '⬇️' : '')).join(' ')}\n${won ? st.g.length : 'X'}/${MAX} · chronicamaps.com/daily`;
          root.querySelector('#dres').innerHTML = `<div class="result"><p class="big">${won ? '🎉 Solved!' : 'Not this time.'} The map shows <b>${REGIONS[region].name} in ${fy(ans)}</b>.</p>
<p>Streak: <b>${stats.streak}</b> · Best: ${stats.best} · Played: ${stats.played} · Won: ${stats.won}</p>
<pre class="share">${esc(share)}</pre><p><button class="btn" id="dshare">Copy result</button> <a class="btn ghost" href="${yearPage(ans, region)}">Read about this map →</a></p>
<p class="muted">A new puzzle every day at 00:00 UTC.${num > 1 ? ` Missed one? <a href="/daily#${num - 1}">Play #${num - 1}</a>.` : ''}</p></div>`;
          root.querySelector('#dshare').onclick = e => { const done = () => { e.target.textContent = 'Copied ✓'; }; (navigator.clipboard ? navigator.clipboard.writeText(share).then(done, () => {}) : 0); if (navigator.share && /Mobi/.test(navigator.userAgent)) navigator.share({ text: share }).catch(() => {}); };
        }
      };
      const mark = d => (d === 0 ? '🟩' : Math.abs(d) <= 2 ? '🟨' : '⬜');
      root.querySelector('#dgo').onclick = () => {
        const g = +sel.value; if (st.g.includes(g)) return;
        st.g.push(g); store.set(key, st);
        if (st.g.includes(ans) || st.g.length >= MAX) {
          if (num === today && stats.last !== num) { const won = st.g.includes(ans); stats.played++; if (won) { stats.won++; stats.streak = stats.last === num - 1 ? stats.streak + 1 : 1; stats.best = Math.max(stats.best, stats.streak); } else stats.streak = 0; stats.last = num; store.set('cm_daily_stats', stats); }
        }
        render();
      };
      render();
    });
  }

  // ===================== COMPARE =====================
  function compare(root) {
    const S = META.snaps, PRE = META.presets;
    const parse = () => { const m = location.hash.match(/^#([a-z]+)-(-?\d+)-(-?\d+)/); return m && REGIONS[m[1]] && S.includes(+m[2]) && S.includes(+m[3]) ? [m[1], +m[2], +m[3]] : ['europe', 1914, 1920]; };
    let [region, a, b] = parse();
    const opts = v => S.map(s => `<option value="${s}"${s === v ? ' selected' : ''}>${fy(s)}</option>`).join('');
    root.innerHTML = `<div class="presets">${PRE.map((p, i) => `<button class="chip" data-i="${i}">${esc(p[0])}</button>`).join('')}</div>
<div class="ctrls"><label>Region <select id="creg">${Object.keys(REGIONS).map(k => `<option value="${k}">${REGIONS[k].name}</option>`).join('')}</select></label>
<label>Before <select id="ca"></select></label><label>After <select id="cb"></select></label></div>
<div class="swipe" id="swipe"><svg id="cmA"></svg><div class="ctop" id="ctop"><svg id="cmB"></svg></div><div class="handle" id="chandle"><span>⇆</span></div><div class="tag l" id="tagA"></div><div class="tag r" id="tagB"></div></div>
<p class="muted">Drag the handle to wipe between the two maps.</p><div id="cout"></div>`;
    const $ = s => root.querySelector(s);
    const sync = () => { $('#creg').value = region; $('#ca').innerHTML = opts(a); $('#cb').innerHTML = opts(b); };
    let pos = 50;
    const setPos = x => { pos = Math.max(0, Math.min(100, x)); $('#ctop').style.clipPath = `inset(0 0 0 ${pos}%)`; $('#chandle').style.left = pos + '%'; };
    const sw = $('#swipe'); let drag = false;
    const mv = e => { if (!drag) return; const r = sw.getBoundingClientRect(), x = (e.touches ? e.touches[0].clientX : e.clientX) - r.left; setPos((x / r.width) * 100); e.preventDefault(); };
    sw.addEventListener('pointerdown', e => { drag = true; mv(e); sw.setPointerCapture && sw.setPointerCapture(e.pointerId); });
    sw.addEventListener('pointermove', mv); sw.addEventListener('pointerup', () => { drag = false; });
    const go = () => {
      if (a > b) [a, b] = [b, a];
      sync(); history.replaceState(null, '', `#${region}-${a}-${b}`);
      $('#tagA').textContent = fy(a); $('#tagB').textContent = fy(b);
      Promise.all([loadSnap(a), loadSnap(b)]).then(([fa, fb]) => {
        drawMap($('#cmA'), fa, region, { labels: true, max: 14 }); drawMap($('#cmB'), fb, region, { labels: true, max: 14 }); setPos(pos);
        const A = regionStates(fa, region), B = regionStates(fb, region), am = new Map(A.map(x => [x.n, x.a])), bm = new Map(B.map(x => [x.n, x.a])), big = 20000;
        const app = B.filter(x => !am.has(x.n) && x.a > big), van = A.filter(x => !bm.has(x.n) && x.a > big);
        const del = B.filter(x => am.has(x.n)).map(x => ({ n: x.n, d: x.a - am.get(x.n), r: x.a / am.get(x.n) - 1 })).filter(x => Math.abs(x.d) > 15000 && Math.abs(x.r) > 0.08).sort((x, y) => Math.abs(y.d) - Math.abs(x.d));
        const sk = d => `${d >= 0 ? '+' : '−'}${fmtKm2(Math.abs(d))}`;
        const list = (t, arr, f) => (arr.length ? `<h3>${t} <small>(${arr.length})</small></h3><ul class="links cols">${arr.slice(0, 16).map(x => `<li>${stLink(x.n)} · ${f(x)}</li>`).join('')}</ul>` : '');
        const preset = PRE.find(p => p[1] === region && p[2] === a && p[3] === b);
        $('#cout').innerHTML = `${preset ? `<p class="lead2">${esc(preset[4])}</p>` : ''}<h2>${REGIONS[region].name}: ${fy(a)} → ${fy(b)}</h2>
<p>${app.length} states appear, ${van.length} disappear and ${del.length} change size noticeably between these two border maps.</p>
${list('Appear', app, x => fmtKm2(x.a))}${list('Disappear', van, x => fmtKm2(x.a))}${list('Grow', del.filter(x => x.d > 0), x => sk(x.d))}${list('Shrink', del.filter(x => x.d < 0), x => sk(x.d))}
<p><a href="${yearPage(a, region)}">About the ${fy(a)} map</a> · <a href="${yearPage(b, region)}">About the ${fy(b)} map</a> · <a href="/#y${a < 0 ? 'BC' + -a : a}${region === 'europe' ? '' : '-r-' + region}-l-en">Open in the interactive map</a></p>`;
      });
    };
    root.querySelectorAll('.chip').forEach(c => (c.onclick = () => { const p = PRE[+c.dataset.i]; [region, a, b] = [p[1], p[2], p[3]]; go(); }));
    $('#creg').onchange = e => { region = e.target.value; go(); };
    $('#ca').onchange = e => { a = +e.target.value; go(); };
    $('#cb').onchange = e => { b = +e.target.value; go(); };
    go();
  }

  // ===================== TOWN =====================
  function town(root) {
    root.innerHTML = `<div class="search"><input id="tq" type="search" placeholder="Type a town or city, e.g. Lyon, Kyoto, Lima…" autocomplete="off" aria-label="Search for a town"><div id="tres" class="tres"></div></div><div id="tout"><p class="muted">Loading 7,000 towns…</p></div>`;
    const $ = s => root.querySelector(s);
    d3.json('/towns.json' + V).then(D => {
      const S = D.snaps, T = D.t, fold = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
      T.forEach(t => (t.k = fold(t[1] + ' ' + t[0])));
      $('#tout').innerHTML = `<p class="muted">Start typing to search ${T.length.toLocaleString('en-US')} towns and cities.</p>`;
      const show = t => {
        const h = t[7], rows = [];
        for (let i = 0; i < h.length; i += 2) rows.push({ n: h[i] >= 0 ? D.names[h[i]] : null, from: S[h[i + 1]], to: h[i + 2] !== undefined ? S[h[i + 3]] - 1 : 2026 });
        const ruled = rows.filter(r => r.n && !tribal(r.n)), uniq = [...new Set(ruled.map(r => nm(r.n)))];
        const ll = [t[4], t[5]], reg = regionOf(ll);
        history.replaceState(null, '', '#' + t[8]);
        const longest = ruled.slice().sort((a, b) => (b.to - b.from) - (a.to - a.from))[0];
        $('#tout').innerHTML = `<h2>${esc(t[0])}${t[3] && t[3] !== t[0] ? `, ${esc(t[3])}` : ''}${t[2] ? ` <small>${esc(t[2])}</small>` : ''}</h2>
<p class="lead2">On Chronica Maps' ${S.length} border maps, ${esc(t[0])} lies within ${uniq.length} different state${uniq.length === 1 ? '' : 's'}${longest ? `; the longest stretch is under ${esc(nm(longest.n))} (${fy(longest.from)}–${longest.to >= 2026 ? 'today' : fy(longest.to)})` : ''}.</p>
<div class="tbar">${rows.map(r => `<span title="${esc((r.n ? nm(r.n) : 'No state recorded') + ' · ' + fy(r.from))}" style="flex:${Math.max(1, r.to - r.from)};background:${r.n ? col(r.n) : '#e8dfcc'}"></span>`).join('')}</div>
<div class="tw"><table><thead><tr><th>Period (by border map)</th><th>Ruled by</th></tr></thead><tbody>${rows.map(r => `<tr><td>${fy(r.from)} – ${r.to >= 2026 ? 'today' : fy(r.to)}</td><td>${r.n ? stLink(r.n) : '<span class="muted">No state recorded</span>'}</td></tr>`).join('')}</tbody></table></div>
<div class="mapbox"><svg id="tmap"></svg></div>
<p>${META.towns[t[8]] ? `<a href="/en/town/${t[8]}">Full page for ${esc(t[0])}</a> · ` : ''}<a href="/#y${t[7].length ? '1500' : '1500'}${reg === 'europe' ? '' : '-r-' + reg}-l-en">Explore the interactive map</a></p>
<p class="muted">Based on the approximate historical borders in the map data; small towns near frontiers may be assigned to a neighbouring state.</p>`;
        const last = S[S.length - 1]; loadSnap(last).then(fc => drawMap($('#tmap'), fc, reg, { labels: true, max: 12, pin: ll }));
      };
      const q = $('#tq'), res = $('#tres');
      q.addEventListener('input', () => {
        const v = fold(q.value.trim()); if (v.length < 2) { res.innerHTML = ''; return; }
        const hits = T.filter(t => t.k.includes(v)).sort((a, b) => (fold(a[1]).startsWith(v) ? 0 : 1) - (fold(b[1]).startsWith(v) ? 0 : 1) || b[6] - a[6]).slice(0, 10);
        res.innerHTML = hits.map((t, i) => `<button data-i="${T.indexOf(t)}">${esc(t[0])} <small>${esc([t[3], t[2]].filter(Boolean).join(', '))}</small></button>`).join('');
        res.querySelectorAll('button').forEach(b => (b.onclick = () => { res.innerHTML = ''; q.value = T[+b.dataset.i][0]; show(T[+b.dataset.i]); }));
      });
      const h = decodeURIComponent(location.hash.slice(1)); const t0 = h && T.find(t => t[8] === h);
      if (t0) { q.value = t0[0]; show(t0); }
    });
  }


  // ===================== TRUE SIZE =====================
  function size(root) {
    const S = META.snaps, PRE = META.sizePresets;
    root.innerHTML = `<div class="presets">${PRE.map((p, i) => `<button class="chip" data-i="${i}">${esc(p[0])}</button>`).join('')}</div>
<div class="ctrls"><label>Year <select id="sy">${S.map(s => `<option value="${s}">${fy(s)}</option>`).join('')}</select></label><label>State <select id="sn"></select></label> <button class="btn ghost" id="sreset">Back to original place</button></div>
<div class="mapbox sizebox"><svg id="smap"></svg></div>
<p class="muted">Drag the red shape. It is rotated on the globe as it moves, so it keeps its true size; the map projection stretches everything near the poles, just like the countries underneath.</p><div id="sout"></div>`;
    const $ = s => root.querySelector(s), svgEl = $('#smap');
    let snap, name, G, c0, tgt, p, path, modern, mAreas;
    const R2 = 6371 * 6371;
    const rotated = () => { const r1 = d3.geoRotation([-c0[0], -c0[1]]), r2 = d3.geoRotation([-tgt[0], -tgt[1]]).invert, f = q => r2(r1(q)); const m = c => (typeof c[0] === 'number' ? f(c) : c.map(m)); return { type: G.type, coordinates: m(G.coordinates) }; };
    const base = () => {
      p = proj('world'); path = d3.geoPath(p);
      drawMap(svgEl, modern, 'world', { labels: true, max: 30 });
      const svg = d3.select(svgEl); svg.selectAll('g:nth-of-type(1) path').attr('fill-opacity', 0.28);
      svg.append('path').attr('id', 'sghost').attr('fill', 'none').attr('stroke', '#a8322a').attr('stroke-dasharray', '5 4').attr('stroke-width', 1.4);
      svg.append('path').attr('id', 'sshape').attr('fill', '#a8322a').attr('fill-opacity', 0.55).attr('stroke', '#7d1f19').attr('stroke-width', 1.6).style('cursor', 'grab');
    };
    const draw = () => { d3.select('#sghost').attr('d', path(G)); d3.select('#sshape').attr('d', path(rotated())); };
    const info = () => {
      const a = d3.geoArea(G) * R2, cmp = mAreas.map(([n, b]) => [n, a / b]).sort((x, y) => Math.abs(Math.log(x[1])) - Math.abs(Math.log(y[1])));
      const pick = [...new Map([...cmp.slice(0, 3), ...cmp.filter(x => /United States|China/.test(x[0]))].map(x => [x[0], x])).values()].slice(0, 4);
      $('#sout').innerHTML = `<h2>${esc(nm(name))} in ${fy(snap)}</h2><p class="lead2">About <b>${fmtKm2(a)}</b>${pick.length ? ' — ' + pick.map(([n, r]) => `${r >= 1 ? r.toFixed(1) + '×' : Math.round(r * 100) + '% of'} ${esc(n)}`).join(', ') : ''}.</p>
<p>${META.names[name] && META.names[name][3] ? `<a href="/en/state/${META.names[name][3]}">${esc(nm(name))}: borders over time</a> · ` : ''}<a href="${yearPage(snap, regionOf(c0))}">${fy(snap)} map</a> · <a href="/size#${snap}-${encodeURIComponent(name)}">Link to this comparison</a></p>`;
    };
    const fillStates = fc => { const L = regionStates(fc, 'world').filter(x => x.a > 150000).slice(0, 80); $('#sn').innerHTML = L.map(x => `<option value="${esc(x.n)}">${esc(nm(x.n))} · ${fmtKm2(x.a)}</option>`).join(''); return L; };
    const choose = (s, n) => loadSnap(s).then(fc => {
      snap = s; $('#sy').value = s; const L = fillStates(fc); name = n && L.some(x => x.n === n) ? n : L[0].n; $('#sn').value = name;
      const fs = fc.features.filter(f => f.properties.n === name); G = fs.length === 1 ? fs[0].geometry : { type: 'MultiPolygon', coordinates: fs.flatMap(f => (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates)) };
      let best = G; if (G.type === 'MultiPolygon') { let ba = -1; for (const c of G.coordinates) { const pg = { type: 'Polygon', coordinates: c }; const a = d3.geoArea(pg); if (a > ba) { ba = a; best = pg; } } }
      c0 = d3.geoCentroid(best); tgt = c0.slice(); draw(); info(); history.replaceState(null, '', `#${s}-${encodeURIComponent(name)}`);
    });
    const toGeo = e => { const r = svgEl.getBoundingClientRect(); return p.invert([((e.clientX - r.left) / r.width) * 1200, ((e.clientY - r.top) / r.height) * 800]); };
    let drag = null;
    svgEl.addEventListener('pointerdown', e => { if (e.target.id !== 'sshape') return; drag = { g: toGeo(e), t: tgt.slice() }; svgEl.setPointerCapture(e.pointerId); e.target.style.cursor = 'grabbing'; e.preventDefault(); });
    svgEl.addEventListener('pointermove', e => { if (!drag) return; const g = toGeo(e); if (!g) return; tgt = [drag.t[0] + (g[0] - drag.g[0]), Math.max(-80, Math.min(80, drag.t[1] + (g[1] - drag.g[1])))]; draw(); });
    svgEl.addEventListener('pointerup', () => { drag = null; d3.select('#sshape').style('cursor', 'grab'); });
    $('#sreset').onclick = () => { tgt = c0.slice(); draw(); };
    $('#sy').onchange = e => choose(+e.target.value);
    $('#sn').onchange = e => choose(snap, e.target.value);
    root.querySelectorAll('.chip').forEach(c => (c.onclick = () => { const q = PRE[+c.dataset.i]; choose(q[1], q[2]); }));
    loadSnap(2010).then(fc => {
      modern = fc;
      const want = [['United States', /^United States/], ['Russia', /^Russia/], ['China', /^China$|People's Republic of China/], ['Brazil', /^Brazil/], ['Australia', /^Australia$/], ['India', /^India$/], ['Canada', /^Canada$/], ['France', /^France$/], ['Mexico', /^Mexico$/], ['Egypt', /^Egypt$/]];
      mAreas = want.map(([lab, re]) => [lab, fc.features.filter(f => re.test(f.properties.n || '')).reduce((s, f) => s + d3.geoArea(f) * R2, 0)]).filter(x => x[1] > 0);
      base();
      const m = location.hash.match(/^#(-?\d+)-(.+)$/); if (m && S.includes(+m[1])) choose(+m[1], decodeURIComponent(m[2])); else choose(PRE[0][1], PRE[0][2]);
    });
  }

  // ===================== ANIMATE =====================
  function animate(root) {
    const S = META.snaps;
    const opt = (v, list, f = x => x) => list.map(x => `<option value="${x}"${x === v ? ' selected' : ''}>${f(x)}</option>`).join('');
    root.innerHTML = `<div class="ctrls"><label>Region <select id="ar">${Object.keys(REGIONS).map(k => `<option value="${k}">${REGIONS[k].name}</option>`).join('')}</select></label>
<label>From <select id="af">${opt(-500, S, fy)}</select></label><label>To <select id="at">${opt(S[S.length - 1], S, fy)}</select></label>
<label>Seconds per map <select id="as">${opt('0.8', ['0.4', '0.8', '1.2', '2'])}</select></label>
<label>Shape <select id="aa"><option value="land">Landscape 3:2</option><option value="square">Square 1:1</option><option value="vertical">Vertical 9:16 (Shorts, TikTok)</option></select></label>
<label>Format <select id="ak"><option value="video">Video</option><option value="gif">GIF</option></select></label></div>
<p><button class="btn" id="ago">Create animation</button> <span id="amsg" class="muted"></span></p>
<div class="animbox"><canvas id="acv"></canvas></div><div id="aout"></div>`;
    const $ = s => root.querySelector(s), cv = $('#acv'), ctx = cv.getContext('2d');
    const DIM = { land: [1200, 800, 0, 800], square: [1080, 1080, 120, 800], vertical: [1080, 1920, 300, 1260] };
    function frame(fc, s, region, shape, title) {
      const [w, h, top, mh] = DIM[shape];
      cv.width = w; cv.height = h;
      ctx.fillStyle = '#f3ead6'; ctx.fillRect(0, 0, w, h);
      const pr = d3.geoProjection(millerRaw).rotate([-11, 0]).fitExtent([[0, top], [w, top + mh]], boxPts(REGIONS[region].box)), pa = d3.geoPath(pr, ctx);
      ctx.save(); ctx.beginPath(); ctx.rect(0, top, w, mh); ctx.clip();
      ctx.fillStyle = '#c9d3c8'; ctx.fillRect(0, top, w, mh);
      ctx.beginPath(); pa(PHYS.land); ctx.fillStyle = '#eadfc4'; ctx.fill();
      for (const f of named(fc)) { ctx.beginPath(); pa(f); ctx.globalAlpha = tribal(f.properties.n) ? 0.3 : 0.62; ctx.fillStyle = col(f.properties.n); ctx.fill(); ctx.globalAlpha = 0.5; ctx.strokeStyle = '#5a4630'; ctx.lineWidth = 0.8; ctx.stroke(); ctx.globalAlpha = 1; }
      ctx.beginPath(); pa(PHYS.land); ctx.strokeStyle = 'rgba(125,106,76,.7)'; ctx.lineWidth = 0.9; ctx.stroke();
      const placed = []; ctx.textAlign = 'center'; ctx.lineJoin = 'round';
      for (const x of regionStates(fc, region).slice(0, 40)) {
        if (placed.length >= 12) break;
        const f = fc.features.find(g => g.properties.n === x.n); let geo = f.geometry, best = geo;
        if (geo.type === 'MultiPolygon') { let ba = -1; for (const c of geo.coordinates) { const pg = { type: 'Polygon', coordinates: c }; const a = d3.geoArea(pg); if (a > ba) { ba = a; best = pg; } } }
        const c = d3.geoPath(pr).centroid(best); if (!isFinite(c[0]) || c[0] < 40 || c[0] > w - 40 || c[1] < top + 20 || c[1] > top + mh - 20) continue;
        const fz = Math.max(15, Math.min(30, 8 + Math.sqrt(d3.geoPath(pr).area(best)) * 0.05)) * (shape === 'land' ? 1 : 1.35); ctx.font = `700 ${fz}px Georgia, serif`;
        const tw = ctx.measureText(nm(x.n)).width + 8, bx = [c[0] - tw / 2, c[1] - fz, c[0] + tw / 2, c[1] + 4];
        if (placed.some(q => !(bx[2] < q[0] || bx[0] > q[2] || bx[3] < q[1] || bx[1] > q[3]))) continue; placed.push(bx);
        ctx.strokeStyle = '#efe4cb'; ctx.lineWidth = 4; ctx.strokeText(nm(x.n), c[0], c[1]); ctx.fillStyle = '#3a2a1a'; ctx.fillText(nm(x.n), c[0], c[1]);
      }
      ctx.restore();
      ctx.textAlign = 'left'; ctx.fillStyle = '#2b2118';
      if (shape === 'land') {
        ctx.fillStyle = 'rgba(43,33,24,.88)'; ctx.fillRect(0, h - 74, w, 74);
        ctx.fillStyle = '#f6e9cf'; ctx.font = '700 46px Georgia, serif'; ctx.fillText(fy(s), 28, h - 22);
        ctx.font = '24px Georgia, serif'; ctx.fillStyle = '#e3c9a0'; ctx.fillText(title, 260, h - 28);
        ctx.textAlign = 'right'; ctx.fillText('chronicamaps.com', w - 24, h - 28);
      } else {
        ctx.font = `700 ${shape === 'vertical' ? 62 : 46}px Georgia, serif`; ctx.textAlign = 'center'; ctx.fillText(title, w / 2, top / 2 + 18);
        ctx.font = `700 ${shape === 'vertical' ? 150 : 84}px Georgia, serif`; ctx.fillStyle = '#a8322a'; ctx.fillText(fy(s), w / 2, top + mh + (shape === 'vertical' ? 190 : 100));
        ctx.font = '34px Georgia, serif'; ctx.fillStyle = '#5b4a36'; ctx.fillText('chronicamaps.com', w / 2, h - (shape === 'vertical' ? 70 : 22));
      }
    }
    $('#ago').onclick = async () => {
      const region = $('#ar').value, shape = $('#aa').value, kind = $('#ak').value, sec = +$('#as').value;
      let a = +$('#af').value, b = +$('#at').value; if (a > b) [a, b] = [b, a];
      const list = S.filter(s => s >= a && s <= b); if (list.length < 2) { $('#amsg').textContent = 'Pick at least two maps.'; return; }
      const title = `${REGIONS[region].name}, ${fy(a)} – ${fy(b)}`, btn = $('#ago'); btn.disabled = true; $('#aout').innerHTML = '';
      const msg = t => ($('#amsg').textContent = t);
      msg('Loading maps…'); const fcs = []; for (const s of list) fcs.push(await loadSnap(s));
      const frames = [];
      for (let i = 0; i < list.length; i++) { msg(`Drawing ${i + 1} / ${list.length}…`); frame(fcs[i], list[i], region, shape, title); frames.push(await createImageBitmap(cv)); await new Promise(r => setTimeout(r, 0)); }
      const fname = `chronicamaps-${region}-${yearSlug(a)}-${yearSlug(b)}`;
      try {
        if (kind === 'gif') {
          const { GIFEncoder, quantize, applyPalette } = await import('/vendor/gifenc.esm.js');
          const sc = shape === 'vertical' ? 0.5 : 0.6, gw = Math.round(cv.width * sc), gh = Math.round(cv.height * sc), oc = document.createElement('canvas'); oc.width = gw; oc.height = gh; const ox = oc.getContext('2d');
          const gif = GIFEncoder();
          for (let i = 0; i < frames.length; i++) { msg(`Encoding GIF ${i + 1} / ${frames.length}…`); ox.drawImage(frames[i], 0, 0, gw, gh); const data = ox.getImageData(0, 0, gw, gh).data, pal = quantize(data, 256), idx = applyPalette(data, pal); gif.writeFrame(idx, gw, gh, { palette: pal, delay: Math.round(sec * 1000) * (i === frames.length - 1 ? 3 : 1) }); await new Promise(r => setTimeout(r, 0)); }
          gif.finish(); done(new Blob([gif.bytes()], { type: 'image/gif' }), fname + '.gif');
        } else {
          const types = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'], type = types.find(t => window.MediaRecorder && MediaRecorder.isTypeSupported(t));
          if (!type) { msg('Video recording is not supported in this browser; choose GIF.'); btn.disabled = false; return; }
          const stream = cv.captureStream(30), rec = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 6e6 }), chunks = [];
          rec.ondataavailable = e => e.data.size && chunks.push(e.data);
          const stopped = new Promise(r => (rec.onstop = r)); rec.start();
          for (let i = 0; i < frames.length; i++) {
            msg(`Recording ${i + 1} / ${frames.length}…`); const hold = sec * 1000 * (i === frames.length - 1 ? 2.5 : 1), t0 = performance.now();
            while (performance.now() - t0 < hold) { ctx.drawImage(frames[i], 0, 0); await new Promise(r => setTimeout(r, 1000 / 30)); }
          }
          rec.stop(); await stopped; done(new Blob(chunks, { type: type.split(';')[0] }), fname + (type.includes('mp4') ? '.mp4' : '.webm'));
        }
      } catch (e) { msg('Something went wrong: ' + e.message); }
      btn.disabled = false;
      function done(blob, fn) { const u = URL.createObjectURL(blob); msg(`Done — ${(blob.size / 1048576).toFixed(1)} MB.`); $('#aout').innerHTML = `<p><a class="btn" href="${u}" download="${fn}">Download ${esc(fn)}</a></p><p class="muted">Free to post anywhere; please keep the chronicamaps.com credit visible.</p>`; }
    };
    loadSnap(-500).then(fc => frame(fc, -500, 'europe', 'land', 'Europe, 500 BC – 2010'));
    $('#ar').onchange = () => loadSnap(+$('#af').value).then(fc => frame(fc, +$('#af').value, $('#ar').value, $('#aa').value, `${REGIONS[$('#ar').value].name}`));
    $('#aa').onchange = $('#ar').onchange; $('#af').onchange = $('#ar').onchange;
  }

  const root = document.querySelector('[data-tool]');
  if (root) loadMeta().then(() => ({ daily, compare, town, size, animate })[root.dataset.tool](root.querySelector('.tool')));
})();
