// Chronica Maps · static SEO page builder
// Runs on Vercel at deploy time: `node build.mjs` → ./dist
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { geoProjection, geoPath, geoContains, geoArea, geoDistance, geoBounds, geoCentroid } from 'd3-geo';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'dist');
const SITE = 'https://chronicamaps.com';
const TODAY = new Date().toISOString().slice(0, 10);
const R_KM = 6371;

// ---------- load content (same files the app uses) ----------
const ctx = { window: {} };
vm.createContext(ctx);
for (const f of ['i18n.js', 'polities.js', 'polities_world.js', 'content.js', 'content_more.js', 'content_world.js', 'content_world2.js', 'content_en.js', 'content_more_en.js', 'content_world_en.js', 'content_world2_en.js', 'landmarks.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
}
const W = ctx.window, E = W.CONTENT_EN;
const ATLAS = JSON.parse(fs.readFileSync(path.join(ROOT, 'atlas.json'), 'utf8'));
const PHYS = JSON.parse(fs.readFileSync(path.join(ROOT, 'physical.json'), 'utf8'));
const SNAPS = ATLAS.snaps;
const feats = s => ATLAS.data[String(s)].features;
// bounding boxes for fast point-in-polygon
for (const s of SNAPS) for (const f of feats(s)) { const b = geoBounds(f); f._b = b; }
const inB = (b, ll) => { if (ll[1] < b[0][1] - 0.5 || ll[1] > b[1][1] + 0.5) return false; const x0 = b[0][0], x1 = b[1][0]; if (x0 <= x1) return ll[0] >= x0 - 0.5 && ll[0] <= x1 + 0.5; return ll[0] >= x0 - 0.5 || ll[0] <= x1 + 0.5; };

// ---------- helpers ----------
const fmtLL = (c, d = 2) => `${Math.abs(c[1]).toFixed(d)}° ${c[1] < 0 ? 'S' : 'N'}, ${Math.abs(c[0]).toFixed(d)}° ${c[0] < 0 ? 'W' : 'E'}`;
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fy = y => (y < 0 ? `${-y} BC` : y < 1000 ? `AD ${y}` : `${y}`);
const fyShort = y => (y < 0 ? `${-y} BC` : `${y}`);
const slug = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const yearSlug = y => (y < 0 ? `${-y}-bc` : `${y}`);
const hashYear = y => (y < 0 ? `yBC${-y}` : `y${y}`);
const strip = s => s.replace(/[\u3000-\u303f\u4e00-\u9fff\uff00-\uffef“”]+/g, ' ').replace(/\s+/g, ' ').replace(/\s*\/\s*$/, '').trim();
const cut = (s, n = 155) => (s.length <= n ? s : s.slice(0, s.lastIndexOf(' ', n - 1)) + '…');
const fmtKm2 = a => (a >= 1e6 ? `${(a / 1e6).toFixed(2)} million km²` : `${(Math.round(a / 1e4) * 1e4).toLocaleString('en-US')} km²`);
const snapFor = y => { let s = SNAPS[0]; for (const v of SNAPS) if (v <= y) s = v; return s; };
const snapEnd = s => { const i = SNAPS.indexOf(s); return i < SNAPS.length - 1 ? SNAPS[i + 1] - 1 : 2026; };

const FIX = { 'Burgandy': 'Burgundy', 'Castille': 'Castile', 'Castilla': 'Castile', 'Irlanda': 'Irish kingdoms', 'Britany': 'Brittany', 'Cyraneica (UK Lybia)': 'Cyrenaica (UK)', 'Tripolitana (UK Lybia)': 'Tripolitania (UK)', 'Fezzan (Frech Lybia)': 'Fezzan (France)', 'Turcik tribes': 'Turkic tribes', 'Kyivan Rus': "Kievan Rus'", 'Kievan Rus': "Kievan Rus'", 'Mascat': 'Muscat', 'Watassid Morocco': 'Wattasid Morocco', 'Mamluke Sultanate': 'Mamluk Sultanate', 'Byelarus': 'Belarus', 'Peshemegs': 'Pechenegs', 'Quazaq Khanate': 'Kazakh Khanate', 'Kwarezm': 'Khwarezm', 'Imperial Hungary': 'Royal Hungary', 'Turingians': 'Thuringians', 'Boihaenum': 'Bohemia (Marcomanni)', 'Dumonii': 'Dumnonia', 'Saami': 'Sámi', 'Sami': 'Sámi', 'Samis': 'Sámi', 'Etrurians': 'Etruscans', 'Sabini': 'Sabines', 'Sarmates': 'Sarmatians', 'Alamans': 'Alemanni' };
const polName = n => FIX[n.trim()] || n.trim();
const lineage = n => W.LINEAGES.find(L => L[3].test(n));
const isTribal = n => W.TRIBAL.test(n) || (W.TRIBAL_SET && W.TRIBAL_SET.has(n)) || /^(minor states|\?|Rome \()/.test(n.trim());
const FALL = W.FALLBACK_COLORS;
const hash = s => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); };
const colorOf = n => { const L = lineage(n); if (L) return L[2]; if (W.TRIBAL.test(n) || (W.TRIBAL_SET && W.TRIBAL_SET.has(n))) return '#d6c6a0'; return FALL[hash(n) % FALL.length]; };
const LINEAGE_EN = Object.fromEntries(Object.entries(W.LINEAGE_NAMES).map(([k, v]) => [k, v[0]]));

function polityAt0(ll, s) { for (const f of feats(s)) { const n = f.properties.n; if (n && n.trim() && inB(f._b, ll) && geoContains(f, ll)) return n; } return null; }
function polityAt(ll, s) {
  let n = polityAt0(ll, s); if (n) return n;
  for (const r of [0.1, 0.2, 0.35]) for (let a = 0; a < 8; a++) {
    n = polityAt0([ll[0] + r * Math.cos(a * Math.PI / 4) / Math.cos(ll[1] * Math.PI / 180), ll[1] + r * Math.sin(a * Math.PI / 4)], s);
    if (n) return n;
  }
  return null;
}
function ruledBy(ll) {
  const rows = [];
  SNAPS.forEach((s, i) => {
    const n = polityAt(ll, s) || ''; const to = i < SNAPS.length - 1 ? SNAPS[i + 1] - 1 : 2026;
    const last = rows.at(-1);
    if (last && last.n === n) last.to = to; else rows.push({ n, from: s, to });
  });
  return rows;
}
const REALM_REG = { persia: ['europe', 'asia'], mac: ['europe', 'asia'], rome: ['europe', 'africa', 'world'], byz: ['europe', 'world'], ottoman: ['europe', 'asia', 'africa', 'world'], rus: ['europe', 'asia'], eng: ['europe', 'oceania', 'world'], spain: ['europe', 'americas'], france: ['europe', 'africa'] };
const realmIn = (R, r) => (R.reg || REALM_REG[R.k] || ['europe']).includes(r);
const rulersAt = (y, r = 'europe') => W.RULERS.filter(R => realmIn(R, r)).map(R => { const i = R.list.findIndex(r => r[0] <= y && y <= r[1]); return i < 0 ? null : { realm: E.rulersT[R.k], name: E.rulers[R.k][i], from: R.list[i][0], to: R.list[i][1] }; }).filter(Boolean);

// ---------- English data ----------
const CITIES = W.CITIES.map(c => {
  const e = E.cities[c.id];
  return { id: c.id, name: e.n, c: c.c, bio: e.bio,
    names: c.names.map((n, i) => ({ from: n[0], name: (e.names && e.names[i]) || strip(n[1]) || e.n, note: e.notes[i] || '' })),
    ev: c.ev.map((x, i) => ({ y: x[0], t: e.ev[i] || '' })).sort((a, b) => a.y - b.y) };
});
const THE = new Set(['Catalaunian Plains', 'Teutoburg Forest', 'Kalka River', 'White Mountain', 'Somme', 'Milvian Bridge']);
const SITE_TITLE = { peipus: 'Battle on the Ice (Lake Peipus)', normandy: 'Normandy Landings', gallipoli: 'Gallipoli Campaign', ankara1402: 'Battle of Ankara', tannenberg1914: 'Battle of Tannenberg', tours: 'Battle of Tours–Poitiers', kosovo: 'Battle of Kosovo' };
const SITES = W.SITES.map(s => ({ id: s.id, en: s.en, c: s.c, y: s.y, k: s.k, d: E.sites[s.id],
  title: SITE_TITLE[s.id] || (s.k === 'battle' ? (s.en.startsWith('Battle') ? s.en : `Battle of ${THE.has(s.en) ? 'the ' : ''}${s.en}`) : s.en) }));
const EVENTS = W.EVENTS.map((e, i) => ({ y: e[0], t: E.events[i], place: e[2], ll: e[2] ? (W.CITIES.find(c => c.id === e[2]) || W.SITES.find(s => s.id === e[2])).c : e[3] }));
const ERAS = W.ERAS.map((e, i) => ({ from: e[0], to: e[1], name: E.eras[i][0], desc: E.eras[i][1], slug: slug(E.eras[i][0]), region: 'europe' }));
const RERAS = Object.entries(W.REGION_ERAS || {}).flatMap(([r, list]) => list.map((e, i) => ({ from: e[0], to: e[1], name: E.regionEras[r][i][0], desc: E.regionEras[r][i][1], slug: slug(E.regionEras[r][i][0]), region: r })));
for (const e of RERAS) if (ERAS.some(o => o.slug === e.slug) || RERAS.filter(o => o.slug === e.slug).length > 1) e.slug += '-' + e.region;
const ALL_ERAS = [...ERAS, ...RERAS];
const JOURNEYS = W.JOURNEYS.map(j => { const e = E.journeys[j.id];
  return { id: j.id, title: e.t, who: strip(j.who.replace(/“[^”]*”/g, '')).replace(/^[\s·]+/, ''), span: j.span.replace(/前 (\d+)/g, (m, y) => `${y} BC`),
    stops: j.stops.map((s, i) => ({ y: s[0], c: s[2], place: e.stops[i][0], t: e.stops[i][1] })) }; });

// ---------- projection & static maps ----------
// same regions as the app
const REGIONS = {
  europe: { c: [17, 53], clip: 1, box: [-24, 34, 58, 71.5], name: 'Europe' },
  asia: { c: [95, 32], clip: 1, box: [34, -8, 148, 56], name: 'Asia' },
  africa: { c: [18, 3], clip: 1, box: [-19, -35, 52, 37.5], name: 'Africa' },
  americas: { c: [-80, 15], clip: 1, box: [-126, -56, -34, 62], name: 'the Americas' },
  oceania: { c: [155, -22], clip: 1, box: [110, -48, 182, 0], name: 'Oceania' },
  world: { c: [11, 0], clip: 0, box: [-168.9, -57, 190.9, 84], name: 'the world' },
};
const boxPts = b => { const [x0, y0, x1, y1] = b, pts = []; for (let x = x0; x <= x1; x++) pts.push([x, y0], [x, y1]); for (let y = y0; y <= y1; y++) pts.push([x0, y], [x1, y]); return { type: 'MultiPoint', coordinates: pts }; };
function millerRaw(l, p) { return [l, 1.25 * Math.log(Math.tan(Math.PI / 4 + 0.4 * p))]; }
millerRaw.invert = (x, y) => [x, 2.5 * Math.atan(Math.exp(0.8 * y)) - 0.625 * Math.PI];
const PROJS = {}, PATHS = {};
for (const [k, R] of Object.entries(REGIONS)) {
  // flat Miller cylindrical projection, same as the app
  const p = geoProjection(millerRaw).rotate([-11, 0]);
  p.fitExtent([[10, 10], [1190, 790]], boxPts(R.box));
  p.clipExtent([[0, 0], [1200, 800]]);
  PROJS[k] = p; PATHS[k] = geoPath(p).digits(1);
}
const PROJ = PROJS.europe, P = PATHS.europe, path0 = () => P;
function regionOf(ll) { let best = 'world', bd = 1e9; for (const [k, R] of Object.entries(REGIONS)) { if (!R.clip) continue; const [x0, y0, x1, y1] = R.box; let lon = ll[0]; if (lon < x0) lon += 360; const inBox = lon >= x0 - 4 && lon <= x1 + 4 && ll[1] >= y0 - 4 && ll[1] <= y1 + 4; const d = geoDistance(ll, R.c); if (inBox && d < bd) { bd = d; best = k; } } return best; }
const regionOfAll = lls => { const rs = new Set(lls.map(regionOf)); return rs.size === 1 ? [...rs][0] : 'world'; };
const pt = (ll, r = 'europe') => { const p = PROJS[r](ll); return { x: +(p[0] / 12).toFixed(2), y: +(p[1] / 8).toFixed(2) }; }; // % of 1200×800
const mapUrl = (s, r = 'europe') => (r === 'europe' ? `/maps/${yearSlug(s)}.svg` : `/maps/${r}/${yearSlug(s)}.svg`);
const NEED = new Set();

// states: named, non-tribal, ≥3 maps, large enough
const stInfo = {};
for (const s of SNAPS) for (const f of feats(s)) {
  const n = f.properties.n; if (!n || !n.trim() || isTribal(n)) continue;
  const area = geoArea(f) * R_KM * R_KM;
  (stInfo[n] ||= { n, maps: [] }).maps.push({ s, area, f });
}
const STATES = Object.values(stInfo).filter(st => {
  const peak = st.maps.reduce((a, b) => (b.area > a.area ? b : a));
  if (st.maps.length < 3 && peak.area < 1e6) return false;
  st.peak = peak;
  let g = peak.f.geometry, best = g;
  if (g.type === 'MultiPolygon') { let ba = -1; for (const c of g.coordinates) { const pg = { type: 'Polygon', coordinates: c }; const a = geoArea(pg); if (a > ba) { ba = a; best = pg; } } }
  st.ll = geoCentroid(best); st.region = regionOf(st.ll);
  if (/^(Antarctica|Greenland)$/.test(st.n)) return false;
  return peak.area > (st.region === 'europe' ? 60000 : 250000);
}).map(st => ({ ...st, name: polName(st.n), slug: slug(polName(st.n)) }));
// de-duplicate slugs (e.g. Castile / Castille → keep larger)
const bySlug = {};
for (const st of STATES) if (!bySlug[st.slug] || st.peak.area > bySlug[st.slug].peak.area) bySlug[st.slug] = st;
const STATE_LIST = Object.values(bySlug).sort((a, b) => a.name.localeCompare(b.name));
const stateUrl = n => { const s = bySlug[slug(polName(n))]; return s && s.n === n ? `/en/state/${s.slug}` : (s ? `/en/state/${s.slug}` : null); };

// thin a projected path string: drop vertices closer than tol px, and tiny rings
function thin(d, tol) {
  if (!d) return d;
  return d.split(/(?=M)/).map(sp => {
    const closed = /Z\s*$/.test(sp); const nums = sp.replace(/[MLZ]/g, ' ').trim().split(/[\s,]+/).map(Number);
    const pts = []; for (let i = 0; i + 1 < nums.length; i += 2) pts.push([nums[i], nums[i + 1]]);
    if (!pts.length) return '';
    const out = [pts[0]]; for (let i = 1; i < pts.length; i++) { const l = out[out.length - 1], p = pts[i]; if (Math.abs(p[0] - l[0]) + Math.abs(p[1] - l[1]) >= tol || i === pts.length - 1) out.push(p); }
    if (closed) { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const [x, y] of out) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } if (out.length < 4 || (x1 - x0) * (y1 - y0) < tol * tol * 2) return ''; }
    return 'M' + out.map(p => `${Math.round(p[0])},${Math.round(p[1])}`).join('L') + (closed ? 'Z' : '');
  }).join('');
}
function mapSVG(s, r = 'europe') {
  const P0 = PATHS[r], TOL = r === 'world' ? 2 : 1.2;
  const P = Object.assign(g => thin(P0(g), TOL), { centroid: g => P0.centroid(g), area: g => P0.area(g) });
  const fs_ = feats(s).filter(f => f.properties.n && f.properties.n.trim() && P(f));
  const land = `<path d="${P(PHYS.land)}" fill="#eadfc4"/>`;
  const pols = fs_.map(f => { const n = f.properties.n; return `<path d="${P(f)}" fill="${colorOf(n)}" fill-opacity="${isTribal(n) ? 0.3 : 0.6}" stroke="#5a4630" stroke-opacity=".55" stroke-width=".7"/>`; }).join('');
  const riv = PHYS.rivers.features.map(f => P(f)).filter(Boolean).map(d => `<path d="${d}"/>`).join('');
  const lakes = PHYS.lakes.features.map(f => P(f)).filter(Boolean).map(d => `<path d="${d}"/>`).join('');
  const sphere = '';
  const labs = fs_.filter(f => !isTribal(f.properties.n)).slice(0, r === 'world' ? 18 : 14).map(f => {
    let g = f.geometry, best = g;
    if (g.type === 'MultiPolygon') { let ba = -1; for (const c of g.coordinates) { const pg = { type: 'Polygon', coordinates: c }; const a = geoArea(pg); if (a > ba) { ba = a; best = pg; } } }
    const c = P.centroid(best); if (!isFinite(c[0]) || c[0] < 30 || c[0] > 1170 || c[1] < 20 || c[1] > 780) return '';
    const fs2 = r === 'europe' ? Math.max(11, Math.min(24, 6 + Math.sqrt(f.properties.a) * 0.9)) : Math.max(10, Math.min(20, 5 + Math.sqrt(P.area(best)) * 0.04));
    return `<text x="${c[0].toFixed(0)}" y="${c[1].toFixed(0)}" font-size="${fs2.toFixed(0)}">${esc(polName(f.properties.n))}</text>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800"><rect width="1200" height="800" fill="#c9d3c8"/>${land}${pols}<g fill="#b8c9c4" stroke="#7d9cab" stroke-width=".5">${lakes}</g><g fill="none" stroke="#7d9cab" stroke-width=".8">${riv}</g><path d="${P(PHYS.land)}" fill="none" stroke="#7d6a4c" stroke-width=".8" stroke-opacity=".7"/>${sphere}<g font-family="Georgia,serif" font-weight="700" fill="#3a2a1a" text-anchor="middle" paint-order="stroke" stroke="#efe4cb" stroke-width="3" stroke-linejoin="round">${labs}</g></svg>`;
}

// ---------- page template ----------
const NAV = [['Europe by year', '/en/years'], ['World maps', '/en/world'], ['Cities', '/en/cities'], ['Landmarks', '/en/landmarks'], ['Battles & sites', '/en/battles'], ['States', '/en/states'], ['Journeys', '/en/journeys'], ['Eras', '/en/eras']];
function page({ url, title, desc, h1, crumbs, body, ld = [], ogImage }) {
  const bc = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c[0], item: SITE + c[1] })) };
  const lds = [bc, ...ld].map(o => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`).join('\n');
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${SITE}${url}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Chronica Maps">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${SITE}${url}">
${ogImage ? `<meta property="og:image" content="${SITE}${ogImage}">` : ''}
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/assets/page.css">
${lds}
</head>
<body>
<header class="top"><a class="brand" href="/"><span class="seal">C</span>Chronica Maps</a><nav>${NAV.map(([t, u]) => `<a href="${u}">${t}</a>`).join('')}<a class="cta" href="/">Interactive map →</a></nav></header>
<main>
<nav class="crumbs" aria-label="Breadcrumb">${crumbs.map((c, i) => (i < crumbs.length - 1 ? `<a href="${c[1]}">${esc(c[0])}</a>` : `<span>${esc(c[0])}</span>`)).join(' › ')}</nav>
<h1>${h1}</h1>
${body}
</main>
<footer><p>Historical borders are schematic approximations, not surveyed boundaries. Border data: <a href="https://github.com/aourednik/historical-basemaps">historical-basemaps</a> (GPL-3.0); land and rivers: Natural Earth. Inspired by <a href="https://github.com/DeanChensj/jiangshan-map">Jiangshan Atlas</a>.</p><p><a href="/">Interactive map</a> · ${NAV.map(([t, u]) => `<a href="${u}">${t}</a>`).join(' · ')}</p></footer>
</body>
</html>`;
}
const mapBlock = (s, alt, overlay = '', r = 'europe') => { NEED.add(`${r}|${s}`); return `<figure class="map"><div class="mapwrap"><img src="${mapUrl(s, r)}" width="1200" height="800" alt="${esc(alt)}" loading="eager" decoding="async">${overlay}</div><figcaption>Border map for ${fy(s)}. ${r === 'europe' ? `<a href="/en/year/${yearSlug(s)}">See Europe in ${fy(s)}</a>` : `<a href="/en/world/${yearSlug(s)}">See the world in ${fy(s)}</a>`}.</figcaption></figure>`; };
const pin = (ll, label, r = 'europe') => { const p = pt(ll, r); return `<span class="pin" style="left:${p.x}%;top:${p.y}%"><span>${esc(label)}</span></span>`; };
const openBtn = (h, label) => `<p><a class="btn" href="/#${h}-l-en">${esc(label)}</a></p>`;
const table = (head, rows) => `<div class="tw"><table>${head.some(h => h) ? `<thead><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr></thead>` : ''}<tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
const stLink = n => { if (!n) return '<span class="muted">Unclaimed / no data</span>'; const u = stateUrl(n); const sw = `<span class="sw" style="background:${colorOf(n)}"></span>`; return u ? `${sw}<a href="${u}">${esc(polName(n))}</a>` : `${sw}${esc(polName(n))}`; };
const placeLink = id => { const c = CITIES.find(x => x.id === id); if (c) return `<a href="/en/city/${c.id}">${esc(c.name)}</a>`; const s = SITES.find(x => x.id === id); return s ? `<a href="/en/battle/${s.id}">${esc(s.title)}</a>` : ''; };
const nearCities = (ll, n = 3, max = 600) => CITIES.map(c => ({ c, d: geoDistance(c.c, ll) * R_KM })).filter(x => x.d > 1 && x.d < max).sort((a, b) => a.d - b.d).slice(0, n);
const nearSites = (ll, max = 150, skip) => SITES.filter(s => s.id !== skip && geoDistance(s.c, ll) * R_KM < max).sort((a, b) => a.y - b.y);
const eventsIn = (a, b) => EVENTS.filter(e => e.y >= a && e.y <= b).sort((x, y) => x.y - y.y);
const pages = [];
const add = (url, html) => pages.push({ url, html });

// ---------- landmarks ----------
const LMS = (W.LANDMARKS || []).map(m => ({ ...m, name: m.n.en }));
const ctySlug = c => slug(c);
const STATUS = { standing: 'Standing', ruins: 'Ruins', lost: 'Lost', rebuilt: 'Rebuilt' };
const THEN = { standing: 'Historical view', ruins: 'As it was', lost: 'As it was', rebuilt: 'Before' };
const NOW = { standing: 'Today', ruins: 'The ruins today', lost: 'The site today', rebuilt: 'Today' };
const imgH = i => (i.w && i.h ? Math.round(500 * i.h / i.w) : 333);
const credit = i => `${esc(i.artist || 'Unknown author')}${i.license ? `, ${i.licUrl ? `<a href="${esc(i.licUrl)}" rel="license nofollow">${esc(i.license)}</a>` : esc(i.license)}` : ''}, via <a href="${esc(i.page)}" rel="nofollow">Wikimedia Commons</a>`;
const fig = (i, label, alt) => i ? `<figure class="lmfig"><div class="lmlabel">${esc(label)}</div><img src="${esc(i.t960 || i.t500)}" srcset="${esc(i.t500)} 500w, ${esc(i.t960 || i.t500)} 960w" sizes="(max-width: 640px) 100vw, 440px" width="500" height="${imgH(i)}" alt="${esc(alt)}" loading="lazy" decoding="async"><figcaption>${i.cap ? esc(i.cap) + '. ' : ''}${credit(i)}</figcaption></figure>` : '';
const lmNear = (ll, km, skip) => LMS.filter(o => o.id !== skip && geoDistance(o.c, ll) * R_KM < km).sort((a, b) => geoDistance(a.c, ll) - geoDistance(b.c, ll));
const lmCard = o => `<li class="lmcard"><a href="/en/landmark/${o.id}">${o.img.now ? `<img src="${esc(o.img.now.t500)}" alt="${esc(o.name)} today" loading="lazy" width="500" height="${imgH(o.img.now)}">` : ''}<span class="t">${esc(o.name)}</span></a><span class="m">${esc(STATUS[o.st])} · ${fy(o.y)}</span></li>`;
// ---------- year pages ----------
for (const s of SNAPS) {
  const end = snapEnd(s), era = ERAS.find(e => s >= e.from && s < e.to) || ERAS.at(-1);
  const named = feats(s).filter(f => f.properties.n && f.properties.n.trim() && !isTribal(f.properties.n) && P.centroid(f) && isFinite(P.centroid(f)[0]) && P.area(f) > 30)
    .map(f => ({ n: f.properties.n, area: geoArea(f) * R_KM * R_KM })).sort((a, b) => b.area - a.area);
  const top3 = named.slice(0, 3).map(x => polName(x.n));
  const rul = rulersAt(s), evs = eventsIn(s, end).filter(e => !e.ll || regionOf(e.ll) === 'europe'), sites = SITES.filter(x => x.y >= s && x.y <= end && regionOf(x.c) === 'europe').sort((a, b) => a.y - b.y);
  const i = SNAPS.indexOf(s), prev = SNAPS[i - 1], next = SNAPS[i + 1];
  const lead = `This border map shows Europe and the Mediterranean in ${fy(s)} (era: ${era.name}). The largest states on the map were ${top3.slice(0, -1).join(', ')} and ${top3.at(-1)}. The map stays in use until the next border change recorded in ${next ? fy(next) : 'the present'}.`;
  const body = `<p class="lead">${esc(lead)}</p>
${mapBlock(s, `Map of Europe in ${fy(s)} showing state borders`)}
${openBtn(hashYear(s), `Open Europe in ${fy(s)} in the interactive map`)}
<h2>States on the map in ${fy(s)}</h2>
<p class="muted">Areas are approximate and cover each state's whole territory, including land outside the map frame.</p>
${table(['State', 'Approx. area'], named.slice(0, 25).map(x => [stLink(x.n), fmtKm2(x.area)]))}
${rul.length ? `<h2>Rulers in ${fy(s)}</h2>${table(['Realm', 'Ruler', 'Reign'], rul.map(r => [esc(r.realm), esc(r.name), `${fyShort(r.from)}–${fyShort(r.to)}`]))}` : ''}
${evs.length ? `<h2>Key events, ${fy(s)} to ${fy(end)}</h2>${table(['Year', 'Event', 'Where'], evs.map(e => [fy(e.y), esc(e.t), e.place ? placeLink(e.place) : '']))}` : ''}
${sites.length ? `<h2>Battles and sites in this period</h2><ul class="links">${sites.map(x => `<li><a href="/en/battle/${x.id}">${esc(x.title)}</a> · ${fy(x.y)}</li>`).join('')}</ul>` : ''}
<p class="pn">${prev !== undefined ? `<a href="/en/year/${yearSlug(prev)}">← Europe in ${fy(prev)}</a>` : '<span></span>'}${next !== undefined ? `<a href="/en/year/${yearSlug(next)}">Europe in ${fy(next)} →</a>` : ''}</p>
<p>Part of the era: <a href="/en/era/${era.slug}">${esc(era.name)}</a>. See also <a href="/en/world/${yearSlug(s)}">the world in ${fy(s)}</a>.</p>`;
  add(`/en/year/${yearSlug(s)}`, page({ url: `/en/year/${yearSlug(s)}`, title: `Map of Europe in ${fy(s)}: Borders, Rulers & Events | Chronica Maps`,
    desc: cut(`Map of Europe in ${fy(s)}: state borders, the largest empires (${top3.join(', ')}), rulers in power and key events up to ${fy(end)}.`),
    h1: `Map of Europe in ${fy(s)}`, crumbs: [['Home', '/'], ['Years', '/en/years'], [fy(s), `/en/year/${yearSlug(s)}`]], body,
    ld: [{ '@context': 'https://schema.org', '@type': 'Article', headline: `Map of Europe in ${fy(s)}`, inLanguage: 'en', image: `${SITE}/maps/${yearSlug(s)}.svg`, dateModified: TODAY }] }));
}

// ---------- world year pages ----------
for (const s of SNAPS) {
  const end = snapEnd(s), i = SNAPS.indexOf(s), prev = SNAPS[i - 1], next = SNAPS[i + 1];
  const named = feats(s).filter(f => f.properties.n && f.properties.n.trim() && !isTribal(f.properties.n) && f.properties.n !== 'Antarctica')
    .map(f => ({ n: f.properties.n, area: geoArea(f) * R_KM * R_KM, r: null, f })).sort((a, b) => b.area - a.area);
  const top = named.slice(0, 5).map(x => polName(x.n));
  const evs = eventsIn(s, end), sites = SITES.filter(x => x.y >= s && x.y <= end).sort((a, b) => a.y - b.y), wr = ['china', 'rome', 'byz', 'caliph', 'mongol', 'ottoman', 'eng', 'usa', 'india', 'japan'].map(k => W.RULERS.find(R => R.k === k)).filter(Boolean).map(R => { const i = R.list.findIndex(r => r[0] <= s && s <= r[1]); return i < 0 ? null : { realm: E.rulersT[R.k], name: E.rulers[R.k][i], from: R.list[i][0], to: R.list[i][1] }; }).filter(Boolean);
  const lead = `This world map shows state borders in ${fy(s)}. The largest states and empires were ${top.slice(0, -1).join(', ')} and ${top.at(-1)}. The map stays in use until the next recorded border change in ${next ? fy(next) : 'the present'}.`;
  const regionLinks = ['europe', 'asia', 'africa', 'americas', 'oceania'].map(r => `<li><a href="${mapUrl(s, r)}">${REGIONS[r].name} in ${fy(s)} (map image)</a> · <a href="/#${hashYear(s)}${r === 'europe' ? '' : `-r-${r}`}-l-en">open in the interactive map</a></li>`).join('');
  ['asia', 'africa', 'americas', 'oceania'].forEach(r => NEED.add(`${r}|${s}`));
  const body = `<p class="lead">${esc(lead)}</p>
${mapBlock(s, `World map in ${fy(s)} showing state borders`, '', 'world')}
${openBtn(`${hashYear(s)}-r-world`, `Open the world in ${fy(s)} in the interactive map`)}
<h2>Largest states and empires in ${fy(s)}</h2>
<p class="muted">Areas are approximate, from the historical border data.</p>
${table(['State', 'Approx. area', 'Region'], named.slice(0, 30).map(x => [stLink(x.n), fmtKm2(x.area), REGIONS[regionOf(geoCentroid(x.f))].name.replace('the world', '–')]))}
${wr.length ? `<h2>Rulers in ${fy(s)}</h2>${table(['Realm', 'Ruler', 'Reign'], wr.map(r => [esc(r.realm), esc(r.name), `${fyShort(r.from)}–${fyShort(r.to)}`]))}` : ''}
<h2>Regional maps</h2><ul class="links">${regionLinks}<li><a href="/en/year/${yearSlug(s)}">Europe in ${fy(s)}: rulers and events</a></li></ul>
${evs.length ? `<h2>Key events, ${fy(s)} to ${fy(end)}</h2>${table(['Year', 'Event', 'Where'], evs.map(e => [fy(e.y), esc(e.t), e.place ? placeLink(e.place) : '']))}` : ''}
${sites.length ? `<h2>Battles and sites in this period</h2><ul class="links">${sites.map(x => `<li><a href="/en/battle/${x.id}">${esc(x.title)}</a> · ${fy(x.y)}</li>`).join('')}</ul>` : ''}
<p class="pn">${prev !== undefined ? `<a href="/en/world/${yearSlug(prev)}">← The world in ${fy(prev)}</a>` : '<span></span>'}${next !== undefined ? `<a href="/en/world/${yearSlug(next)}">The world in ${fy(next)} →</a>` : ''}</p>`;
  add(`/en/world/${yearSlug(s)}`, page({ url: `/en/world/${yearSlug(s)}`, title: `World Map in ${fy(s)}: Empires, Borders & Events | Chronica Maps`,
    desc: cut(`Historical world map for ${fy(s)}: borders of ${top.slice(0, 3).join(', ')} and other states, with key events and battles up to ${fy(end)}.`),
    h1: `World Map in ${fy(s)}`, crumbs: [['Home', '/'], ['World maps', '/en/world'], [fy(s), `/en/world/${yearSlug(s)}`]], body,
    ld: [{ '@context': 'https://schema.org', '@type': 'Article', headline: `World Map in ${fy(s)}`, inLanguage: 'en', image: `${SITE}${mapUrl(s, 'world')}`, dateModified: TODAY }] }));
}

// ---------- city pages ----------
for (const c of CITIES) {
  const mid = c.ev.length ? c.ev[Math.floor(c.ev.length / 2)].y : 1500;
  const s = snapFor(Math.max(-500, mid)), rows = ruledBy(c.c), ns = nearSites(c.c), nc = nearCities(c.c);
  const old = c.names.filter(n => n.name !== c.name).map(n => n.name.split(' / ')[0]);
  const h1 = `${c.name}: History, Former Names & Timeline`;
  const body = `<p class="lead">${esc(c.bio)}</p>
${mapBlock(s, `Map showing ${c.name} in ${fy(s)}`, pin(c.c, c.name, regionOf(c.c)), regionOf(c.c))}
${openBtn(`${hashYear(s)}-c-${c.id}`, `Explore ${c.name} in the interactive map`)}
<h2>Former names of ${esc(c.name)}</h2>
${table(['From', 'Name', 'Note'], c.names.map(n => [fy(n.from), `<strong>${esc(n.name)}</strong>`, esc(n.note)]))}
<h2>Timeline of ${esc(c.name)}</h2>
${table(['Year', 'Event'], c.ev.map(e => [`<a href="/en/year/${yearSlug(snapFor(Math.max(-500, e.y)))}">${fy(e.y)}</a>`, esc(e.t)]))}
<h2>Who ruled ${esc(c.name)}</h2>
<p class="muted">Derived from the border maps; each row runs until the next recorded border change.</p>
${table(['Period', 'State'], rows.map(r => [`${fyShort(r.from)}–${r.to >= 2026 ? 'today' : fyShort(r.to)}`, stLink(r.n)]))}
${ns.length ? `<h2>Battles and sites near ${esc(c.name)}</h2><ul class="links">${ns.map(x => `<li><a href="/en/battle/${x.id}">${esc(x.title)}</a> · ${fy(x.y)}</li>`).join('')}</ul>` : ''}
${lmNear(c.c, 60).length ? `<h2>Landmarks in and around ${esc(c.name)}</h2><ul class="lmgrid">${lmNear(c.c, 60).map(lmCard).join('')}</ul>` : ''}
${nc.length ? `<h2>Nearby cities</h2><ul class="links">${nc.map(x => `<li><a href="/en/city/${x.c.id}">${esc(x.c.name)}</a> · about ${Math.round(x.d)} km</li>`).join('')}</ul>` : ''}`;
  add(`/en/city/${c.id}`, page({ url: `/en/city/${c.id}`, title: `${c.name} History: Former Names${old.length ? ` (${old.slice(0, 2).join(', ')})` : ''} & Timeline Map | Chronica Maps`,
    desc: cut(`${c.bio} Former names, timeline of events and every state that ruled ${c.name}, on a historical map.`),
    h1: esc(h1), crumbs: [['Home', '/'], ['Cities', '/en/cities'], [c.name, `/en/city/${c.id}`]], body,
    ld: [{ '@context': 'https://schema.org', '@type': 'Place', name: c.name, alternateName: old, description: c.bio, geo: { '@type': 'GeoCoordinates', latitude: c.c[1], longitude: c.c[0] } }] }));
}

// ---------- battle / site pages ----------
for (const x of SITES) {
  const s = snapFor(Math.max(-500, x.y)), held = polityAt(x.c, s), nc = nearCities(x.c, 1)[0];
  const ctxEv = EVENTS.filter(e => Math.abs(e.y - x.y) <= 5 && e.place !== x.id && (!e.ll || regionOf(e.ll) === regionOf(x.c))).sort((a, b) => a.y - b.y), rul = rulersAt(x.y, regionOf(x.c)), ns = nearSites(x.c, 300, x.id);
  const body = `<p class="lead">${esc(x.d)}</p>
${mapBlock(s, `Map showing the location of ${x.title}`, pin(x.c, x.en, regionOf(x.c)), regionOf(x.c))}
${openBtn(`${hashYear(x.y)}-s-${x.id}`, `Open ${x.title} in the interactive map`)}
<h2>Key facts</h2>
${table(['', ''], [['Date', `<a href="/en/year/${yearSlug(s)}">${fy(x.y)}</a>`], ['Type', x.k === 'battle' ? 'Battle' : 'Historic site or event'], ['Location', fmtLL(x.c)], ...(nc ? [['Nearest city on the map', `<a href="/en/city/${nc.c.id}">${esc(nc.c.name)}</a> (about ${Math.round(nc.d)} km)`]] : []), ['Territory of (map of ' + fy(s) + ')', stLink(held)]])}
${rul.length ? `<h2>Rulers in ${fy(x.y)}</h2>${table(['Realm', 'Ruler', 'Reign'], rul.map(r => [esc(r.realm), esc(r.name), `${fyShort(r.from)}–${fyShort(r.to)}`]))}` : ''}
${ctxEv.length ? `<h2>The world around ${fy(x.y)}</h2>${table(['Year', 'Event', 'Where'], ctxEv.map(e => [fy(e.y), esc(e.t), e.place ? placeLink(e.place) : '']))}` : ''}
${ns.length ? `<h2>Other battles and sites nearby</h2><ul class="links">${ns.map(y => `<li><a href="/en/battle/${y.id}">${esc(y.title)}</a> · ${fy(y.y)}</li>`).join('')}</ul>` : ''}`;
  add(`/en/battle/${x.id}`, page({ url: `/en/battle/${x.id}`, title: `${x.title} (${fy(x.y)}): Location Map & Context | Chronica Maps`,
    desc: cut(`${x.title}, ${fy(x.y)}: ${x.d}`), h1: `${esc(x.title)} <small>${fy(x.y)}</small>`,
    crumbs: [['Home', '/'], ['Battles & sites', '/en/battles'], [x.title, `/en/battle/${x.id}`]], body,
    ld: [{ '@context': 'https://schema.org', '@type': 'Place', name: x.title, description: x.d, geo: { '@type': 'GeoCoordinates', latitude: x.c[1], longitude: x.c[0] } }] }));
}

// ---------- state pages ----------
const REALM_OF = { rome: 'rome', byz: 'byz', persia: 'persia', frank: 'france', hre: 'frank', eng: 'eng', spain: 'spain', rus: 'rus', ottoman: 'ottoman', china: 'china', mongol: 'mongol', japan: 'japan', india: 'india', usa: 'usa' };
for (const st of STATE_LIST) {
  const maps = st.maps.sort((a, b) => a.s - b.s), first = maps[0].s, last = maps.at(-1).s, peak = st.peak, L = lineage(st.n);
  const inside = CITIES.filter(c => polityAt(c.c, peak.s) === st.n);
  const realm = L && REALM_OF[L[0]] ? W.RULERS.find(R => R.k === REALM_OF[L[0]]) : null;
  const rul = realm ? realm.list.map((r, i) => ({ from: r[0], to: r[1], name: E.rulers[realm.k][i] })).filter(r => r.to >= first && r.from <= snapEnd(last)) : [];
  const kin = L ? STATE_LIST.filter(o => o !== st && lineage(o.n) === L) : [];
  const rg = st.region;
  const overlay = `<svg class="hl" viewBox="0 0 1200 800" aria-hidden="true"><path d="${PATHS[rg](peak.f)}" fill="#a8322a" fill-opacity=".18" stroke="#a8322a" stroke-width="2.5"/></svg>`;
  const lead = `${st.name} appears on ${maps.length} of the ${SNAPS.length} border maps, from ${fy(first)} to ${fy(last)}. Its mapped territory was largest in ${fy(peak.s)}, at roughly ${fmtKm2(peak.area)}.${L ? ` Chronica Maps groups it with the ${LINEAGE_EN[L[0]]} lineage, shown in the same colour across periods.` : ''}`;
  const body = `<p class="lead">${esc(lead)}</p>
${mapBlock(peak.s, `Map of ${st.name} in ${fy(peak.s)}`, overlay, rg)}
${openBtn(hashYear(peak.s), `Open ${fy(peak.s)} in the interactive map`)}
<h2>Territory of ${esc(st.name)} over time</h2>
<p class="muted">Approximate area on each border map.</p>
${table(['Map year', 'Approx. area', 'Change'], maps.map((m, i) => [`<a href="/en/year/${yearSlug(m.s)}">${fy(m.s)}</a>`, fmtKm2(m.area), i ? `${m.area >= maps[i - 1].area ? '+' : ''}${Math.round((m.area / maps[i - 1].area - 1) * 100)}%` : '–']))}
${inside.length ? `<h2>Cities within ${esc(st.name)} in ${fy(peak.s)}</h2><ul class="links">${inside.map(c => `<li><a href="/en/city/${c.id}">${esc(c.name)}</a></li>`).join('')}</ul>` : ''}
${rul.length ? `<h2>Rulers (${esc(E.rulersT[realm.k])})</h2>${table(['Reign', 'Ruler'], rul.map(r => [`${fyShort(r.from)}–${fyShort(r.to)}`, esc(r.name)]))}` : ''}
${kin.length ? `<h2>Related states in the same lineage</h2><ul class="links">${kin.map(o => `<li><a href="/en/state/${o.slug}">${esc(o.name)}</a></li>`).join('')}</ul>` : ''}`;
  add(`/en/state/${st.slug}`, page({ url: `/en/state/${st.slug}`, title: `${st.name} Map: Borders Over Time (${fyShort(first)}–${fyShort(last)}) | Chronica Maps`,
    desc: cut(`Maps of ${st.name} from ${fy(first)} to ${fy(last)}: territory on each border map, its greatest extent in ${fy(peak.s)}, cities and rulers.`),
    h1: `${esc(st.name)}: Map &amp; Borders Over Time`, crumbs: [['Home', '/'], ['States', '/en/states'], [st.name, `/en/state/${st.slug}`]], body,
    ld: [{ '@context': 'https://schema.org', '@type': 'Article', headline: `${st.name}: Map & Borders Over Time`, inLanguage: 'en', dateModified: TODAY }] }));
}

// ---------- journey pages ----------
for (const j of JOURNEYS) {
  const s = snapFor(Math.max(-500, j.stops[0].y));
  const jr = j.stops.every(x => { const p = PROJ(x.c); return geoDistance(x.c, REGIONS.europe.c) < 1.1 && p[0] > 20 && p[0] < 1180 && p[1] > 20 && p[1] < 780; }) ? 'europe' : 'world';
  const pts = j.stops.map(x => PROJS[jr](x.c));
  const overlay = `<svg class="hl" viewBox="0 0 1200 800" aria-hidden="true"><polyline points="${pts.map(p => p.map(v => v.toFixed(1)).join(',')).join(' ')}" fill="none" stroke="#a8322a" stroke-width="3" stroke-dasharray="8 5"/>${pts.map((p, i) => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="9" fill="#fff8e8" stroke="#a8322a" stroke-width="2.5"/><text x="${p[0].toFixed(1)}" y="${(p[1] + 4).toFixed(1)}" text-anchor="middle" font-size="11" font-family="Georgia,serif" font-weight="700" fill="#a8322a">${i + 1}</text>`).join('')}</svg>`;
  const placeCell = x => { const c = CITIES.find(c => geoDistance(c.c, x.c) * R_KM < 30); return c ? `<a href="/en/city/${c.id}">${esc(x.place)}</a>` : esc(x.place); };
  const body = `<p class="lead">${esc(`${j.who}: ${j.stops.length} stops from ${fy(j.stops[0].y)} to ${fy(j.stops.at(-1).y)}, from ${j.stops[0].place} to ${j.stops.at(-1).place}.`)}</p>
${mapBlock(s, `Route map of ${j.title}`, overlay, jr)}
${openBtn(`p-${j.id}`, `Follow ${j.title} step by step in the interactive map`)}
<h2>Route and timeline</h2>
${table(['#', 'Year', 'Place', 'What happened'], j.stops.map((x, i) => [i + 1, `<a href="/en/year/${yearSlug(snapFor(Math.max(-500, x.y)))}">${fy(x.y)}</a>`, placeCell(x), esc(x.t)]))}
<h2>Other journeys</h2><ul class="links">${JOURNEYS.filter(o => o !== j).map(o => `<li><a href="/en/journey/${o.id}">${esc(o.title)}</a> · ${esc(o.span)}</li>`).join('')}</ul>`;
  add(`/en/journey/${j.id}`, page({ url: `/en/journey/${j.id}`, title: `${j.title}: Route Map & Timeline (${j.span}) | Chronica Maps`,
    desc: cut(`Map of ${j.title} (${j.span}): ${j.stops.length} stops from ${j.stops[0].place} to ${j.stops.at(-1).place}, with dates and what happened at each place.`),
    h1: `${esc(j.title)}: Route Map &amp; Timeline`, crumbs: [['Home', '/'], ['Journeys', '/en/journeys'], [j.title, `/en/journey/${j.id}`]], body,
    ld: [{ '@context': 'https://schema.org', '@type': 'Article', headline: `${j.title}: Route Map & Timeline`, inLanguage: 'en', dateModified: TODAY }] }));
}

// ---------- era pages (Europe + regional) ----------
const RNAME = r => (r === 'europe' ? 'Europe' : REGIONS[r].name.replace(/^the /, ''));
ALL_ERAS.forEach(e => {
  const sib = ALL_ERAS.filter(o => o.region === e.region), i = sib.indexOf(e), rg = e.region;
  const mids = SNAPS.filter(s => s >= e.from && s < e.to), s = mids.length ? mids[Math.floor(mids.length / 2)] : snapFor(e.from);
  const inR = ll => !ll || regionOf(ll) === rg;
  const evs = eventsIn(e.from, e.to - 1).filter(x => inR(x.ll)), sites = SITES.filter(x => x.y >= e.from && x.y < e.to && inR(x.c)).sort((a, b) => a.y - b.y);
  const body = `<p class="lead">${esc(e.desc)}</p>
${mapBlock(s, `Map of ${REGIONS[rg].name} in ${fy(s)}, during the ${e.name}`, '', rg)}
${openBtn(hashYear(s) + (rg === 'europe' ? '' : `-r-${rg}`), `Open the ${e.name} in the interactive map`)}
${mids.length ? `<h2>Border maps in this era</h2><ul class="links">${mids.map(m => rg === 'europe' ? `<li><a href="/en/year/${yearSlug(m)}">Europe in ${fy(m)}</a></li>` : `<li><a href="/en/world/${yearSlug(m)}">The world in ${fy(m)}</a></li>`).join('')}</ul>` : ''}
${evs.length ? `<h2>Timeline</h2>${table(['Year', 'Event', 'Where'], evs.map(x => [fy(x.y), esc(x.t), x.place ? placeLink(x.place) : '']))}` : ''}
${sites.length ? `<h2>Battles and sites</h2><ul class="links">${sites.map(x => `<li><a href="/en/battle/${x.id}">${esc(x.title)}</a> · ${fy(x.y)}</li>`).join('')}</ul>` : ''}
<p class="pn">${i ? `<a href="/en/era/${sib[i - 1].slug}">← ${esc(sib[i - 1].name)}</a>` : '<span></span>'}${i < sib.length - 1 ? `<a href="/en/era/${sib[i + 1].slug}">${esc(sib[i + 1].name)} →</a>` : ''}</p>`;
  add(`/en/era/${e.slug}`, page({ url: `/en/era/${e.slug}`, title: `${e.name} (${fyShort(e.from)}–${e.to >= 2026 ? 'today' : fyShort(e.to)}): Map & Timeline of ${RNAME(rg)} | Chronica Maps`,
    desc: cut(`${e.name}, ${fy(e.from)}–${e.to >= 2026 ? 'today' : fy(e.to)}: ${e.desc}`), h1: `${esc(e.name)} <small>${fy(e.from)}–${e.to >= 2026 ? 'today' : fy(e.to)}</small>`,
    crumbs: [['Home', '/'], ['Eras', '/en/eras'], [e.name, `/en/era/${e.slug}`]], body }));
});


// ---------- landmark pages ----------
for (const m of LMS) {
  const s = snapFor(Math.max(-500, m.y)), nc = nearCities(m.c, 1)[0], rows = ruledBy(m.c);
  const near = lmNear(m.c, 500, m.id).slice(0, 6), ns = nearSites(m.c, 150);
  const alt1 = `${m.name}, ${THEN[m.st].toLowerCase()}`, alt2 = `${m.name}, ${NOW[m.st].toLowerCase()}`;
  const body = `<p class="lead">${esc(m.d.en)}</p>
<div class="lmgal">${fig(m.img.then, THEN[m.st], alt1)}${fig(m.img.now, NOW[m.st], alt2)}</div>
<h2>Key facts</h2>
${table(['', ''], [['Country today', `<a href="/en/landmarks/${ctySlug(m.country)}">${esc(m.country)}</a>`], ['Status', STATUS[m.st]], ['Date', `<a href="/en/year/${yearSlug(s)}">${fy(m.y)}</a>`], ...(nc ? [['Nearest city on the map', `<a href="/en/city/${nc.c.id}">${esc(nc.c.name)}</a> (about ${Math.round(nc.d)} km)`]] : []), ['Location', fmtLL(m.c, 3)]])}
${mapBlock(s, `Map showing ${m.name} in ${fy(s)}`, pin(m.c, m.name, regionOf(m.c)), regionOf(m.c))}
${openBtn(`${hashYear(Math.max(-500, m.y))}-m-${m.id}`, `Open ${m.name} in the interactive map`)}
<h2>Who ruled this place</h2>
<p class="muted">Derived from the border maps; each row runs until the next recorded border change.</p>
${table(['Period', 'State'], rows.map(r => [`${fyShort(r.from)}–${r.to >= 2026 ? 'today' : fyShort(r.to)}`, stLink(r.n)]))}
${near.length ? `<h2>Other landmarks nearby</h2><ul class="lmgrid">${near.map(lmCard).join('')}</ul>` : ''}
${ns.length ? `<h2>Battles and sites nearby</h2><ul class="links">${ns.map(x => `<li><a href="/en/battle/${x.id}">${esc(x.title)}</a> · ${fy(x.y)}</li>`).join('')}</ul>` : ''}
<p>More: <a href="/en/landmarks/${ctySlug(m.country)}">Historic landmarks of ${esc(m.country)}</a> · <a href="/en/landmarks">All landmarks</a></p>`;
  const imgs = [m.img.then, m.img.now].filter(Boolean);
  add(`/en/landmark/${m.id}`, page({ url: `/en/landmark/${m.id}`, title: `${m.name} Then and Now: History, Old Images & Map | Chronica Maps`,
    desc: cut(`${m.name} then and now: ${m.d.en}`), h1: `${esc(m.name)}: Then and Now`,
    crumbs: [['Home', '/'], ['Landmarks', '/en/landmarks'], [m.country, `/en/landmarks/${ctySlug(m.country)}`], [m.name, `/en/landmark/${m.id}`]], body, ogImage: null,
    ld: [{ '@context': 'https://schema.org', '@type': 'LandmarksOrHistoricalBuildings', name: m.name, description: m.d.en, image: imgs.map(i => i.t960 || i.t500), geo: { '@type': 'GeoCoordinates', latitude: m.c[1], longitude: m.c[0] }, containedInPlace: { '@type': 'Country', name: m.country } }] }));
  m.imgs = imgs;
}
const COUNTRIES = [...new Set(LMS.map(m => m.country))].sort();
for (const c of COUNTRIES) {
  const list = LMS.filter(m => m.country === c).sort((a, b) => a.y - b.y);
  add(`/en/landmarks/${ctySlug(c)}`, page({ url: `/en/landmarks/${ctySlug(c)}`, title: `Historic Landmarks of ${c}: Then and Now | Chronica Maps`,
    desc: cut(`${list.length} historic landmark${list.length > 1 ? 's' : ''} of ${c} then and now: ${list.map(m => m.name).join(', ')}. Old images, today's views and maps.`),
    h1: `Historic Landmarks of ${esc(c)}`, crumbs: [['Home', '/'], ['Landmarks', '/en/landmarks'], [c, `/en/landmarks/${ctySlug(c)}`]],
    body: `<p class="lead">${esc(`${list.length} landmark${list.length > 1 ? 's' : ''} in today's ${c}, from ${fy(list[0].y)} to ${fy(list.at(-1).y)}, each shown as it was and as it is now.`)}</p><ul class="lmgrid">${list.map(lmCard).join('')}</ul><p><a href="/en/landmarks">All countries</a></p>`,
    ld: [{ '@context': 'https://schema.org', '@type': 'ItemList', itemListElement: list.map((m, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE}/en/landmark/${m.id}`, name: m.name })) }] }));
}
// ---------- quiz + hubs ----------
add('/en/quiz', page({ url: '/en/quiz', title: 'History Map Quiz: Find Historic Places on the Map | Chronica Maps',
  desc: 'Test your historical geography: ten questions, each naming an ancient city or battle with a clue. Click the map where you think it was and score by distance.',
  h1: 'History Map Quiz', crumbs: [['Home', '/'], ['Quiz', '/en/quiz']],
  body: `<p class="lead">Ten questions, each naming a historic city or battle with a short clue. Click the map where you think it lies; the closer you are, the more points you score, up to 1,000 in total.</p>${openBtn('quiz', 'Start the quiz')}<p>The questions draw on ${CITIES.length} cities and ${SITES.filter(s => s.y < 1900).length} battles and sites across 2,500 years.</p>` }));

const hub = (url, title, h1, lead, inner, crumb) => add(url, page({ url, title: `${title} | Chronica Maps`, desc: cut(lead), h1, crumbs: [['Home', '/'], [crumb, url]], body: `<p class="lead">${esc(lead)}</p>${inner}` }));
hub('/en/years', 'Maps of Europe by Year (500 BC – Today)', 'Maps of Europe by Year', `${SNAPS.length} border maps of Europe and the Mediterranean, from ${fy(SNAPS[0])} to ${fy(SNAPS.at(-1))}. Each shows state borders, rulers and the events of its period.`,
  `<ul class="grid">${SNAPS.map(s => `<li><a href="/en/year/${yearSlug(s)}"><img src="/maps/${yearSlug(s)}.svg" alt="Map of Europe in ${fy(s)}" loading="lazy" width="300" height="200"><span>Europe in ${fy(s)}</span></a></li>`).join('')}</ul>`, 'Years');
hub('/en/world', 'Historical World Maps by Year (500 BC – Today)', 'Historical World Maps by Year', `${SNAPS.length} world border maps from ${fy(SNAPS[0])} to ${fy(SNAPS.at(-1))}, showing the empires and states of Europe, Asia, Africa, the Americas and Oceania.`,
  `<ul class="grid">${SNAPS.map(s => `<li><a href="/en/world/${yearSlug(s)}"><img src="${mapUrl(s, 'world')}" alt="World map in ${fy(s)}" loading="lazy" width="300" height="200"><span>The world in ${fy(s)}</span></a></li>`).join('')}</ul>`, 'World maps');
const RG_ORDER = ['europe', 'asia', 'africa', 'americas', 'oceania', 'world'];
const byRegion = (list, ll) => RG_ORDER.map(r => [r, list.filter(x => regionOf(ll(x)) === r)]).filter(x => x[1].length);
hub('/en/cities', 'Historic Cities of the World: Former Names & Timelines', 'Historic Cities', `${CITIES.length} cities in Europe, Asia, Africa and Oceania with their former names, timelines of key events and every state that ruled them.`,
  byRegion([...CITIES].sort((a, b) => a.name.localeCompare(b.name)), c => c.c).map(([r, list]) => `<h2>${r === 'world' ? 'Elsewhere' : REGIONS[r].name}</h2>` + table(['City', 'Earliest name on record', 'From'], list.map(c => [`<a href="/en/city/${c.id}">${esc(c.name)}</a>`, esc(c.names[0].name), fy(c.names[0].from)]))).join(''), 'Cities');
hub('/en/landmarks', 'Historic Landmarks of the World: Then and Now', 'Historic Landmarks: Then and Now', `${LMS.length} historic landmarks in ${COUNTRIES.length} countries, each shown as it was and as it looks today, with lost buildings set beside what stands on their site now.`,
  COUNTRIES.map(c => `<h2><a href="/en/landmarks/${ctySlug(c)}">${esc(c)}</a></h2><ul class="lmgrid">${LMS.filter(m => m.country === c).sort((a, b) => a.y - b.y).map(lmCard).join('')}</ul>`).join(''), 'Landmarks');
hub('/en/battles', 'Historic Battles and Sites on a Map: Europe, Asia, Africa', 'Battles and Historic Sites', `${SITES.length} battles and historic sites from ${fy(Math.min(...SITES.map(s => s.y)))} to ${fy(Math.max(...SITES.map(s => s.y)))}, each placed on the border map of its time.`,
  byRegion([...SITES].sort((a, b) => a.y - b.y), s => s.c).map(([r, list]) => `<h2>${r === 'world' ? 'Elsewhere' : REGIONS[r].name}</h2>` + table(['Year', 'Battle or site'], list.map(s => [fy(s.y), `<a href="/en/battle/${s.id}">${esc(s.title)}</a>`]))).join(''), 'Battles & sites');
hub('/en/states', 'States and Empires in History: Maps Over Time', 'States and Empires', `${STATE_LIST.length} states and empires, from Rome and the Tang to the Mughals and the Inca, each with its territory over time.`,
  byRegion(STATE_LIST, s => s.ll).map(([r, list]) => `<h2>${r === 'world' ? 'Americas and elsewhere' : REGIONS[r].name}</h2><ul class="links cols">${list.map(s => `<li><span class="sw" style="background:${colorOf(s.n)}"></span><a href="/en/state/${s.slug}">${esc(s.name)}</a> · ${fyShort(s.maps[0].s)}–${fyShort(s.maps.at(-1).s)}</li>`).join('')}</ul>`).join(''), 'States');
hub('/en/journeys', 'Historical Journeys on a Map: Routes and Timelines', 'Historical Journeys', `${JOURNEYS.length} lives, voyages and campaigns traced stop by stop, from Alexander the Great and Xuanzang to Zheng He, Columbus and Napoleon.`,
  `<ul class="links">${JOURNEYS.map(j => `<li><a href="/en/journey/${j.id}">${esc(j.title)}</a> · ${esc(j.span)} · ${esc(j.who)}</li>`).join('')}</ul>`, 'Journeys');
hub('/en/eras', 'Eras of History by Region: Maps and Timelines', 'Eras of History', `${ALL_ERAS.length} periods of history in Europe, Asia, Africa, the Americas and Oceania, each with its maps, events and battles.`,
  ['europe', 'asia', 'africa', 'americas', 'oceania'].map(r => `<h2>${RNAME(r)}</h2>` + table(['Era', 'Period'], ALL_ERAS.filter(e => e.region === r).map(e => [`<a href="/en/era/${e.slug}">${esc(e.name)}</a>`, `${fy(e.from)}–${e.to >= 2026 ? 'today' : fy(e.to)}`]))).join(''), 'Eras');
hub('/en', 'Historical World Atlas: Maps, Cities, Battles & Timelines', 'Historical Atlas of the World', 'Browse 2,500 years of history in Europe, Asia, Africa and Oceania by year, city, battle, state, era and historical journey, or open the interactive map and drag the timeline.',
  `${openBtn('y1453', 'Open the interactive map')}<ul class="links">${NAV.map(([t, u]) => `<li><a href="${u}">${t}</a></li>`).join('')}<li><a href="/en/quiz">Map quiz</a></li></ul>`, 'Explore');

// ---------- write output ----------
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const SKIP = new Set(['build.mjs', 'package.json', 'package-lock.json', 'vercel.json', 'README.md', 'node_modules', 'dist', '.git', '.vercel', 'robots.txt', 'sitemap.xml', 'atlas.json']);
for (const f of fs.readdirSync(ROOT)) if (!SKIP.has(f) && !f.startsWith('.') && fs.statSync(path.join(ROOT, f)).isFile()) fs.copyFileSync(path.join(ROOT, f), path.join(OUT, f));
const write = (rel, data) => { const p = path.join(OUT, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, data); };
for (const p of pages) write(p.url + '.html', p.html);
// cache-busting: stamp script URLs in the app shell with this build's version
const VER = (process.env.VERCEL_GIT_COMMIT_SHA || Date.now().toString(36)).slice(0, 10);
write('index.html', fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').replace(/__V__/g, VER));
for (const s of SNAPS) NEED.add(`europe|${s}`), NEED.add(`world|${s}`);
for (const k of NEED) { const [r, s] = k.split('|'); write(mapUrl(+s, r).slice(1), mapSVG(+s, r)); }
// split border data for the app: index + one file per snapshot + precomputed "who ruled here"
const appear = {};
SNAPS.forEach((s, i) => { const seen = new Set(); for (const f of feats(s)) { const n = f.properties.n; if (!n || !n.trim() || seen.has(n)) continue; seen.add(n); (appear[n] ||= []).push(i); } });
write('atlas/index.json', JSON.stringify({ snaps: SNAPS, appear }));
for (const s of SNAPS) write(`atlas/${s}.json`, JSON.stringify({ type: 'FeatureCollection', features: feats(s).map(f => ({ type: 'Feature', properties: f.properties, geometry: f.geometry })) }));
const HIST = {};
const histOf = ll => ruledBy(ll).map(r => [r.n, r.from]);
for (const c of W.CITIES) HIST['c-' + c.id] = histOf(c.c);
for (const x of W.SITES) HIST['s-' + x.id] = histOf(x.c);
write('atlas/hist.json', JSON.stringify(HIST));
write('assets/page.css', fs.readFileSync(path.join(ROOT, 'page.css'), 'utf8'));
write('favicon.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="10" fill="#a8322a"/><text x="32" y="45" text-anchor="middle" font-family="Georgia,serif" font-size="40" font-weight="700" fill="#f6e9cf">C</text></svg>`);
const urls = ['/', ...pages.map(p => p.url)];
const IMGS = Object.fromEntries(LMS.map(m => [`/en/landmark/${m.id}`, m.imgs || []]));
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${urls.map(u => `  <url><loc>${SITE}${u}</loc><lastmod>${TODAY}</lastmod>${(IMGS[u] || []).map(i => `<image:image><image:loc>${esc(i.t960 || i.t500)}</image:loc></image:image>`).join('')}</url>`).join('\n')}\n</urlset>\n`);
write('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);
console.log(`Built ${pages.length} pages + ${SNAPS.length} maps → dist/`);
