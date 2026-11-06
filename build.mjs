// Chronica Maps · static SEO page builder
// Runs on Vercel at deploy time: `node build.mjs` → ./dist
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { geoAzimuthalEqualArea, geoPath, geoContains, geoArea, geoDistance } from 'd3-geo';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'dist');
const SITE = 'https://chronicamaps.com';
const TODAY = new Date().toISOString().slice(0, 10);
const R_KM = 6371;

// ---------- load content (same files the app uses) ----------
const ctx = { window: {} };
vm.createContext(ctx);
for (const f of ['i18n.js', 'polities.js', 'content.js', 'content_more.js', 'content_en.js', 'content_more_en.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
}
const W = ctx.window, E = W.CONTENT_EN;
const ATLAS = JSON.parse(fs.readFileSync(path.join(ROOT, 'atlas.json'), 'utf8'));
const PHYS = JSON.parse(fs.readFileSync(path.join(ROOT, 'physical.json'), 'utf8'));
const SNAPS = ATLAS.snaps;
const feats = s => ATLAS.data[String(s)].features;

// ---------- helpers ----------
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
const isTribal = n => W.TRIBAL.test(n) || /^(minor states|\?|Rome \()/.test(n.trim());
const FALL = W.FALLBACK_COLORS;
const hash = s => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); };
const colorOf = n => { const L = lineage(n); if (L) return L[2]; if (W.TRIBAL.test(n)) return '#d6c6a0'; return FALL[hash(n) % FALL.length]; };
const LINEAGE_EN = Object.fromEntries(Object.entries(W.LINEAGE_NAMES).map(([k, v]) => [k, v[0]]));

function polityAt0(ll, s) { for (const f of feats(s)) { const n = f.properties.n; if (n && n.trim() && geoContains(f, ll)) return n; } return null; }
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
const rulersAt = y => W.RULERS.map(R => { const i = R.list.findIndex(r => r[0] <= y && y <= r[1]); return i < 0 ? null : { realm: E.rulersT[R.k], name: E.rulers[R.k][i], from: R.list[i][0], to: R.list[i][1] }; }).filter(Boolean);

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
const ERAS = W.ERAS.map((e, i) => ({ from: e[0], to: e[1], name: E.eras[i][0], desc: E.eras[i][1], slug: slug(E.eras[i][0]) }));
const JOURNEYS = W.JOURNEYS.map(j => { const e = E.journeys[j.id];
  return { id: j.id, title: e.t, who: strip(j.who.replace(/“[^”]*”/g, '')).replace(/^[\s·]+/, ''), span: j.span.replace(/前 (\d+)/g, (m, y) => `${y} BC`),
    stops: j.stops.map((s, i) => ({ y: s[0], c: s[2], place: e.stops[i][0], t: e.stops[i][1] })) }; });

// ---------- projection & static maps ----------
let PROJ, path0;
function initProj() {
  const pts = []; for (let x = -24; x <= 58; x++) pts.push([x, 35], [x, 71.5]); for (let y = 35; y <= 71.5; y++) pts.push([-24, y], [58, y]);
  PROJ = geoAzimuthalEqualArea().rotate([-17, -53]).fitExtent([[10, 10], [1190, 790]], { type: 'MultiPoint', coordinates: pts });
  path0 = () => geoPath(PROJ).digits(1);
}
initProj();
const P = path0();
const pt = ll => { const p = PROJ(ll); return { x: +(p[0] / 12).toFixed(2), y: +(p[1] / 8).toFixed(2) }; }; // % of 1200×800

// states: named, non-tribal, ≥3 maps, centred in Europe
const stInfo = {};
for (const s of SNAPS) for (const f of feats(s)) {
  const n = f.properties.n; if (!n || !n.trim() || isTribal(n)) continue;
  const area = geoArea(f) * R_KM * R_KM;
  (stInfo[n] ||= { n, maps: [] }).maps.push({ s, area, f });
}
const STATES = Object.values(stInfo).filter(st => {
  if (st.maps.length < 3) return false;
  const peak = st.maps.reduce((a, b) => (b.area > a.area ? b : a));
  st.peak = peak;
  const c = path0().centroid(peak.f); // projected
  const ll = PROJ.invert(c);
  return ll && ll[0] > -12 && ll[0] < 45 && ll[1] > 34 && ll[1] < 72 && peak.area > 60000;
}).map(st => ({ ...st, name: polName(st.n), slug: slug(polName(st.n)) }));
// de-duplicate slugs (e.g. Castile / Castille → keep larger)
const bySlug = {};
for (const st of STATES) if (!bySlug[st.slug] || st.peak.area > bySlug[st.slug].peak.area) bySlug[st.slug] = st;
const STATE_LIST = Object.values(bySlug).sort((a, b) => a.name.localeCompare(b.name));
const stateUrl = n => { const s = bySlug[slug(polName(n))]; return s && s.n === n ? `/en/state/${s.slug}` : (s ? `/en/state/${s.slug}` : null); };

function mapSVG(s) {
  const fs_ = feats(s).filter(f => f.properties.n && f.properties.n.trim());
  const land = `<path d="${P(PHYS.land)}" fill="#eadfc4"/>`;
  const pols = fs_.map(f => { const n = f.properties.n; return `<path d="${P(f)}" fill="${colorOf(n)}" fill-opacity="${isTribal(n) ? 0.3 : 0.6}" stroke="#5a4630" stroke-opacity=".55" stroke-width=".7"/>`; }).join('');
  const riv = PHYS.rivers.features.map(f => `<path d="${P(f)}"/>`).join('');
  const lakes = PHYS.lakes.features.map(f => `<path d="${P(f)}"/>`).join('');
  const labs = fs_.filter(f => !isTribal(f.properties.n)).slice(0, 14).map(f => {
    let g = f.geometry, best = g;
    if (g.type === 'MultiPolygon') { let ba = -1; for (const c of g.coordinates) { const pg = { type: 'Polygon', coordinates: c }; const a = geoArea(pg); if (a > ba) { ba = a; best = pg; } } }
    const c = P.centroid(best); if (!isFinite(c[0]) || c[0] < 30 || c[0] > 1170 || c[1] < 20 || c[1] > 780) return '';
    const fs2 = Math.max(11, Math.min(24, 6 + Math.sqrt(f.properties.a) * 0.9));
    return `<text x="${c[0].toFixed(0)}" y="${c[1].toFixed(0)}" font-size="${fs2.toFixed(0)}">${esc(polName(f.properties.n))}</text>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800"><rect width="1200" height="800" fill="#c9d3c8"/>${land}${pols}<g fill="#b8c9c4" stroke="#7d9cab" stroke-width=".5">${lakes}</g><g fill="none" stroke="#7d9cab" stroke-width=".8">${riv}</g><path d="${P(PHYS.land)}" fill="none" stroke="#7d6a4c" stroke-width=".8" stroke-opacity=".7"/><g font-family="Georgia,serif" font-weight="700" fill="#3a2a1a" text-anchor="middle" paint-order="stroke" stroke="#efe4cb" stroke-width="3" stroke-linejoin="round">${labs}</g></svg>`;
}

// ---------- page template ----------
const NAV = [['Years', '/en/years'], ['Cities', '/en/cities'], ['Battles & sites', '/en/battles'], ['States', '/en/states'], ['Journeys', '/en/journeys'], ['Eras', '/en/eras']];
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
const mapBlock = (s, alt, overlay = '') => `<figure class="map"><div class="mapwrap"><img src="/maps/${yearSlug(s)}.svg" width="1200" height="800" alt="${esc(alt)}" loading="eager" decoding="async">${overlay}</div><figcaption>Border map for ${fy(s)}. <a href="/en/year/${yearSlug(s)}">See Europe in ${fy(s)}</a>.</figcaption></figure>`;
const pin = (ll, label) => { const p = pt(ll); return `<span class="pin" style="left:${p.x}%;top:${p.y}%"><span>${esc(label)}</span></span>`; };
const openBtn = (h, label) => `<p><a class="btn" href="/#${h}-l-en">${esc(label)}</a></p>`;
const table = (head, rows) => `<div class="tw"><table>${head.some(h => h) ? `<thead><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr></thead>` : ''}<tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
const stLink = n => { if (!n) return '<span class="muted">Unclaimed / no data</span>'; const u = stateUrl(n); const sw = `<span class="sw" style="background:${colorOf(n)}"></span>`; return u ? `${sw}<a href="${u}">${esc(polName(n))}</a>` : `${sw}${esc(polName(n))}`; };
const placeLink = id => { const c = CITIES.find(x => x.id === id); if (c) return `<a href="/en/city/${c.id}">${esc(c.name)}</a>`; const s = SITES.find(x => x.id === id); return s ? `<a href="/en/battle/${s.id}">${esc(s.title)}</a>` : ''; };
const nearCities = (ll, n = 3, max = 600) => CITIES.map(c => ({ c, d: geoDistance(c.c, ll) * R_KM })).filter(x => x.d > 1 && x.d < max).sort((a, b) => a.d - b.d).slice(0, n);
const nearSites = (ll, max = 150, skip) => SITES.filter(s => s.id !== skip && geoDistance(s.c, ll) * R_KM < max).sort((a, b) => a.y - b.y);
const eventsIn = (a, b) => EVENTS.filter(e => e.y >= a && e.y <= b).sort((x, y) => x.y - y.y);
const pages = [];
const add = (url, html) => pages.push({ url, html });

// ---------- year pages ----------
for (const s of SNAPS) {
  const end = snapEnd(s), era = ERAS.find(e => s >= e.from && s < e.to) || ERAS.at(-1);
  const named = feats(s).filter(f => f.properties.n && f.properties.n.trim() && !isTribal(f.properties.n))
    .map(f => ({ n: f.properties.n, area: geoArea(f) * R_KM * R_KM })).sort((a, b) => b.area - a.area);
  const top3 = named.slice(0, 3).map(x => polName(x.n));
  const rul = rulersAt(s), evs = eventsIn(s, end), sites = SITES.filter(x => x.y >= s && x.y <= end).sort((a, b) => a.y - b.y);
  const i = SNAPS.indexOf(s), prev = SNAPS[i - 1], next = SNAPS[i + 1];
  const lead = `This border map shows Europe and the Mediterranean in ${fy(s)} (era: ${era.name}). The largest states within the map area were ${top3.slice(0, -1).join(', ')} and ${top3.at(-1)}. The map stays in use until the next border change recorded in ${next ? fy(next) : 'the present'}.`;
  const body = `<p class="lead">${esc(lead)}</p>
${mapBlock(s, `Map of Europe in ${fy(s)} showing state borders`)}
${openBtn(hashYear(s), `Open Europe in ${fy(s)} in the interactive map`)}
<h2>States on the map in ${fy(s)}</h2>
<p class="muted">Areas are approximate and count only territory inside the map area.</p>
${table(['State', 'Approx. area on map'], named.slice(0, 25).map(x => [stLink(x.n), fmtKm2(x.area)]))}
${rul.length ? `<h2>Rulers in ${fy(s)}</h2>${table(['Realm', 'Ruler', 'Reign'], rul.map(r => [esc(r.realm), esc(r.name), `${fyShort(r.from)}–${fyShort(r.to)}`]))}` : ''}
${evs.length ? `<h2>Key events, ${fy(s)} to ${fy(end)}</h2>${table(['Year', 'Event', 'Where'], evs.map(e => [fy(e.y), esc(e.t), e.place ? placeLink(e.place) : '']))}` : ''}
${sites.length ? `<h2>Battles and sites in this period</h2><ul class="links">${sites.map(x => `<li><a href="/en/battle/${x.id}">${esc(x.title)}</a> · ${fy(x.y)}</li>`).join('')}</ul>` : ''}
<p class="pn">${prev !== undefined ? `<a href="/en/year/${yearSlug(prev)}">← Europe in ${fy(prev)}</a>` : '<span></span>'}${next !== undefined ? `<a href="/en/year/${yearSlug(next)}">Europe in ${fy(next)} →</a>` : ''}</p>
<p>Part of the era: <a href="/en/era/${era.slug}">${esc(era.name)}</a>.</p>`;
  add(`/en/year/${yearSlug(s)}`, page({ url: `/en/year/${yearSlug(s)}`, title: `Map of Europe in ${fy(s)}: Borders, Rulers & Events | Chronica Maps`,
    desc: cut(`Map of Europe in ${fy(s)}: state borders, the largest empires (${top3.join(', ')}), rulers in power and key events up to ${fy(end)}.`),
    h1: `Map of Europe in ${fy(s)}`, crumbs: [['Home', '/'], ['Years', '/en/years'], [fy(s), `/en/year/${yearSlug(s)}`]], body,
    ld: [{ '@context': 'https://schema.org', '@type': 'Article', headline: `Map of Europe in ${fy(s)}`, inLanguage: 'en', image: `${SITE}/maps/${yearSlug(s)}.svg`, dateModified: TODAY }] }));
}

// ---------- city pages ----------
for (const c of CITIES) {
  const mid = c.ev.length ? c.ev[Math.floor(c.ev.length / 2)].y : 1500;
  const s = snapFor(Math.max(-500, mid)), rows = ruledBy(c.c), ns = nearSites(c.c), nc = nearCities(c.c);
  const old = c.names.filter(n => n.name !== c.name).map(n => n.name.split(' / ')[0]);
  const h1 = `${c.name}: History, Former Names & Timeline`;
  const body = `<p class="lead">${esc(c.bio)}</p>
${mapBlock(s, `Map showing ${c.name} in ${fy(s)}`, pin(c.c, c.name))}
${openBtn(`${hashYear(s)}-c-${c.id}`, `Explore ${c.name} in the interactive map`)}
<h2>Former names of ${esc(c.name)}</h2>
${table(['From', 'Name', 'Note'], c.names.map(n => [fy(n.from), `<strong>${esc(n.name)}</strong>`, esc(n.note)]))}
<h2>Timeline of ${esc(c.name)}</h2>
${table(['Year', 'Event'], c.ev.map(e => [`<a href="/en/year/${yearSlug(snapFor(Math.max(-500, e.y)))}">${fy(e.y)}</a>`, esc(e.t)]))}
<h2>Who ruled ${esc(c.name)}</h2>
<p class="muted">Derived from the border maps; each row runs until the next recorded border change.</p>
${table(['Period', 'State'], rows.map(r => [`${fyShort(r.from)}–${r.to >= 2026 ? 'today' : fyShort(r.to)}`, stLink(r.n)]))}
${ns.length ? `<h2>Battles and sites near ${esc(c.name)}</h2><ul class="links">${ns.map(x => `<li><a href="/en/battle/${x.id}">${esc(x.title)}</a> · ${fy(x.y)}</li>`).join('')}</ul>` : ''}
${nc.length ? `<h2>Nearby cities</h2><ul class="links">${nc.map(x => `<li><a href="/en/city/${x.c.id}">${esc(x.c.name)}</a> · about ${Math.round(x.d)} km</li>`).join('')}</ul>` : ''}`;
  add(`/en/city/${c.id}`, page({ url: `/en/city/${c.id}`, title: `${c.name} History: Former Names${old.length ? ` (${old.slice(0, 2).join(', ')})` : ''} & Timeline Map | Chronica Maps`,
    desc: cut(`${c.bio} Former names, timeline of events and every state that ruled ${c.name}, on a historical map.`),
    h1: esc(h1), crumbs: [['Home', '/'], ['Cities', '/en/cities'], [c.name, `/en/city/${c.id}`]], body,
    ld: [{ '@context': 'https://schema.org', '@type': 'Place', name: c.name, alternateName: old, description: c.bio, geo: { '@type': 'GeoCoordinates', latitude: c.c[1], longitude: c.c[0] } }] }));
}

// ---------- battle / site pages ----------
for (const x of SITES) {
  const s = snapFor(Math.max(-500, x.y)), held = polityAt(x.c, s), nc = nearCities(x.c, 1)[0];
  const ctxEv = EVENTS.filter(e => Math.abs(e.y - x.y) <= 5 && e.place !== x.id).sort((a, b) => a.y - b.y), rul = rulersAt(x.y), ns = nearSites(x.c, 300, x.id);
  const body = `<p class="lead">${esc(x.d)}</p>
${mapBlock(s, `Map showing the location of ${x.title}`, pin(x.c, x.en))}
${openBtn(`${hashYear(x.y)}-s-${x.id}`, `Open ${x.title} in the interactive map`)}
<h2>Key facts</h2>
${table(['', ''], [['Date', `<a href="/en/year/${yearSlug(s)}">${fy(x.y)}</a>`], ['Type', x.k === 'battle' ? 'Battle' : 'Historic site or event'], ['Location', `${x.c[1].toFixed(2)}° N, ${x.c[0].toFixed(2)}° E`], ...(nc ? [['Nearest city on the map', `<a href="/en/city/${nc.c.id}">${esc(nc.c.name)}</a> (about ${Math.round(nc.d)} km)`]] : []), ['Territory of (map of ' + fy(s) + ')', stLink(held)]])}
${rul.length ? `<h2>Rulers in ${fy(x.y)}</h2>${table(['Realm', 'Ruler', 'Reign'], rul.map(r => [esc(r.realm), esc(r.name), `${fyShort(r.from)}–${fyShort(r.to)}`]))}` : ''}
${ctxEv.length ? `<h2>Europe around ${fy(x.y)}</h2>${table(['Year', 'Event', 'Where'], ctxEv.map(e => [fy(e.y), esc(e.t), e.place ? placeLink(e.place) : '']))}` : ''}
${ns.length ? `<h2>Other battles and sites nearby</h2><ul class="links">${ns.map(y => `<li><a href="/en/battle/${y.id}">${esc(y.title)}</a> · ${fy(y.y)}</li>`).join('')}</ul>` : ''}`;
  add(`/en/battle/${x.id}`, page({ url: `/en/battle/${x.id}`, title: `${x.title} (${fy(x.y)}): Location Map & Context | Chronica Maps`,
    desc: cut(`${x.title}, ${fy(x.y)}: ${x.d}`), h1: `${esc(x.title)} <small>${fy(x.y)}</small>`,
    crumbs: [['Home', '/'], ['Battles & sites', '/en/battles'], [x.title, `/en/battle/${x.id}`]], body,
    ld: [{ '@context': 'https://schema.org', '@type': 'Place', name: x.title, description: x.d, geo: { '@type': 'GeoCoordinates', latitude: x.c[1], longitude: x.c[0] } }] }));
}

// ---------- state pages ----------
const REALM_OF = { rome: 'rome', byz: 'byz', persia: 'persia', frank: 'france', hre: 'frank', eng: 'eng', spain: 'spain', rus: 'rus', ottoman: 'ottoman' };
for (const st of STATE_LIST) {
  const maps = st.maps.sort((a, b) => a.s - b.s), first = maps[0].s, last = maps.at(-1).s, peak = st.peak, L = lineage(st.n);
  const inside = CITIES.filter(c => polityAt(c.c, peak.s) === st.n);
  const realm = L && REALM_OF[L[0]] ? W.RULERS.find(R => R.k === REALM_OF[L[0]]) : null;
  const rul = realm ? realm.list.map((r, i) => ({ from: r[0], to: r[1], name: E.rulers[realm.k][i] })).filter(r => r.to >= first && r.from <= snapEnd(last)) : [];
  const kin = L ? STATE_LIST.filter(o => o !== st && lineage(o.n) === L) : [];
  const overlay = `<svg class="hl" viewBox="0 0 1200 800" aria-hidden="true"><path d="${P(peak.f)}" fill="#a8322a" fill-opacity=".18" stroke="#a8322a" stroke-width="2.5"/></svg>`;
  const lead = `${st.name} appears on ${maps.length} of the ${SNAPS.length} border maps, from ${fy(first)} to ${fy(last)}. Its mapped territory was largest in ${fy(peak.s)}, at roughly ${fmtKm2(peak.area)} within the map area.${L ? ` Chronica Maps groups it with the ${LINEAGE_EN[L[0]]} lineage, shown in the same colour across periods.` : ''}`;
  const body = `<p class="lead">${esc(lead)}</p>
${mapBlock(peak.s, `Map of ${st.name} in ${fy(peak.s)}`, overlay)}
${openBtn(hashYear(peak.s), `Open ${fy(peak.s)} in the interactive map`)}
<h2>Territory of ${esc(st.name)} over time</h2>
<p class="muted">Approximate area inside the map area on each border map.</p>
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
  const pts = j.stops.map(x => PROJ(x.c));
  const overlay = `<svg class="hl" viewBox="0 0 1200 800" aria-hidden="true"><polyline points="${pts.map(p => p.map(v => v.toFixed(1)).join(',')).join(' ')}" fill="none" stroke="#a8322a" stroke-width="3" stroke-dasharray="8 5"/>${pts.map((p, i) => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="9" fill="#fff8e8" stroke="#a8322a" stroke-width="2.5"/><text x="${p[0].toFixed(1)}" y="${(p[1] + 4).toFixed(1)}" text-anchor="middle" font-size="11" font-family="Georgia,serif" font-weight="700" fill="#a8322a">${i + 1}</text>`).join('')}</svg>`;
  const placeCell = x => { const c = CITIES.find(c => geoDistance(c.c, x.c) * R_KM < 30); return c ? `<a href="/en/city/${c.id}">${esc(x.place)}</a>` : esc(x.place); };
  const body = `<p class="lead">${esc(`${j.who}: ${j.stops.length} stops from ${fy(j.stops[0].y)} to ${fy(j.stops.at(-1).y)}, from ${j.stops[0].place} to ${j.stops.at(-1).place}.`)}</p>
${mapBlock(s, `Route map of ${j.title}`, overlay)}
${openBtn(`p-${j.id}`, `Follow ${j.title} step by step in the interactive map`)}
<h2>Route and timeline</h2>
${table(['#', 'Year', 'Place', 'What happened'], j.stops.map((x, i) => [i + 1, `<a href="/en/year/${yearSlug(snapFor(Math.max(-500, x.y)))}">${fy(x.y)}</a>`, placeCell(x), esc(x.t)]))}
<h2>Other journeys</h2><ul class="links">${JOURNEYS.filter(o => o !== j).map(o => `<li><a href="/en/journey/${o.id}">${esc(o.title)}</a> · ${esc(o.span)}</li>`).join('')}</ul>`;
  add(`/en/journey/${j.id}`, page({ url: `/en/journey/${j.id}`, title: `${j.title}: Route Map & Timeline (${j.span}) | Chronica Maps`,
    desc: cut(`Map of ${j.title} (${j.span}): ${j.stops.length} stops from ${j.stops[0].place} to ${j.stops.at(-1).place}, with dates and what happened at each place.`),
    h1: `${esc(j.title)}: Route Map &amp; Timeline`, crumbs: [['Home', '/'], ['Journeys', '/en/journeys'], [j.title, `/en/journey/${j.id}`]], body,
    ld: [{ '@context': 'https://schema.org', '@type': 'Article', headline: `${j.title}: Route Map & Timeline`, inLanguage: 'en', dateModified: TODAY }] }));
}

// ---------- era pages ----------
ERAS.forEach((e, i) => {
  const mids = SNAPS.filter(s => s >= e.from && s < e.to), s = mids.length ? mids[Math.floor(mids.length / 2)] : snapFor(e.from);
  const evs = eventsIn(e.from, e.to - 1), sites = SITES.filter(x => x.y >= e.from && x.y < e.to).sort((a, b) => a.y - b.y);
  const body = `<p class="lead">${esc(e.desc)}</p>
${mapBlock(s, `Map of Europe in ${fy(s)}, during the ${e.name}`)}
${openBtn(hashYear(s), `Open the ${e.name} in the interactive map`)}
${mids.length ? `<h2>Border maps in this era</h2><ul class="links">${mids.map(m => `<li><a href="/en/year/${yearSlug(m)}">Europe in ${fy(m)}</a></li>`).join('')}</ul>` : ''}
${evs.length ? `<h2>Timeline</h2>${table(['Year', 'Event', 'Where'], evs.map(x => [fy(x.y), esc(x.t), x.place ? placeLink(x.place) : '']))}` : ''}
${sites.length ? `<h2>Battles and sites</h2><ul class="links">${sites.map(x => `<li><a href="/en/battle/${x.id}">${esc(x.title)}</a> · ${fy(x.y)}</li>`).join('')}</ul>` : ''}
<p class="pn">${i ? `<a href="/en/era/${ERAS[i - 1].slug}">← ${esc(ERAS[i - 1].name)}</a>` : '<span></span>'}${i < ERAS.length - 1 ? `<a href="/en/era/${ERAS[i + 1].slug}">${esc(ERAS[i + 1].name)} →</a>` : ''}</p>`;
  add(`/en/era/${e.slug}`, page({ url: `/en/era/${e.slug}`, title: `${e.name} (${fyShort(e.from)}–${e.to >= 2026 ? 'today' : fyShort(e.to)}): Map & Timeline of Europe | Chronica Maps`,
    desc: cut(`${e.name}, ${fy(e.from)}–${e.to >= 2026 ? 'today' : fy(e.to)}: ${e.desc}`), h1: `${esc(e.name)} <small>${fy(e.from)}–${e.to >= 2026 ? 'today' : fy(e.to)}</small>`,
    crumbs: [['Home', '/'], ['Eras', '/en/eras'], [e.name, `/en/era/${e.slug}`]], body }));
});

// ---------- quiz + hubs ----------
add('/en/quiz', page({ url: '/en/quiz', title: 'European History Map Quiz: Find Historic Places | Chronica Maps',
  desc: 'Test your historical geography: ten questions, each naming an ancient city or battle with a clue. Click the map where you think it was and score by distance.',
  h1: 'European History Map Quiz', crumbs: [['Home', '/'], ['Quiz', '/en/quiz']],
  body: `<p class="lead">Ten questions, each naming a historic city or battle with a short clue. Click the map where you think it lies; the closer you are, the more points you score, up to 1,000 in total.</p>${openBtn('quiz', 'Start the quiz')}<p>The questions draw on ${CITIES.length} cities and ${SITES.filter(s => s.y < 1900).length} battles and sites across 2,500 years.</p>` }));

const hub = (url, title, h1, lead, inner, crumb) => add(url, page({ url, title: `${title} | Chronica Maps`, desc: cut(lead), h1, crumbs: [['Home', '/'], [crumb, url]], body: `<p class="lead">${esc(lead)}</p>${inner}` }));
hub('/en/years', 'Maps of Europe by Year (500 BC – Today)', 'Maps of Europe by Year', `${SNAPS.length} border maps of Europe and the Mediterranean, from ${fy(SNAPS[0])} to ${fy(SNAPS.at(-1))}. Each shows state borders, rulers and the events of its period.`,
  `<ul class="grid">${SNAPS.map(s => `<li><a href="/en/year/${yearSlug(s)}"><img src="/maps/${yearSlug(s)}.svg" alt="Map of Europe in ${fy(s)}" loading="lazy" width="300" height="200"><span>Europe in ${fy(s)}</span></a></li>`).join('')}</ul>`, 'Years');
hub('/en/cities', 'Historic Cities of Europe: Former Names & Timelines', 'Historic Cities of Europe', `${CITIES.length} cities with their former names, timelines of key events and every state that ruled them.`,
  table(['City', 'Earliest name on record', 'From'], [...CITIES].sort((a, b) => a.name.localeCompare(b.name)).map(c => [`<a href="/en/city/${c.id}">${esc(c.name)}</a>`, esc(c.names[0].name), fy(c.names[0].from)])), 'Cities');
hub('/en/battles', 'Battles and Historic Sites of Europe on a Map', 'Battles and Historic Sites', `${SITES.length} battles and historic sites from ${fy(Math.min(...SITES.map(s => s.y)))} to ${fy(Math.max(...SITES.map(s => s.y)))}, each placed on the border map of its time.`,
  table(['Year', 'Battle or site'], [...SITES].sort((a, b) => a.y - b.y).map(s => [fy(s.y), `<a href="/en/battle/${s.id}">${esc(s.title)}</a>`])), 'Battles & sites');
hub('/en/states', 'States and Empires of European History: Maps Over Time', 'States and Empires', `${STATE_LIST.length} states and empires that appear on at least three border maps, each with its territory over time.`,
  `<ul class="links cols">${STATE_LIST.map(s => `<li><span class="sw" style="background:${colorOf(s.n)}"></span><a href="/en/state/${s.slug}">${esc(s.name)}</a> · ${fyShort(s.maps[0].s)}–${fyShort(s.maps.at(-1).s)}</li>`).join('')}</ul>`, 'States');
hub('/en/journeys', 'Historical Journeys on a Map: Routes and Timelines', 'Historical Journeys', `${JOURNEYS.length} lives and campaigns traced stop by stop, from Alexander the Great to Napoleon.`,
  `<ul class="links">${JOURNEYS.map(j => `<li><a href="/en/journey/${j.id}">${esc(j.title)}</a> · ${esc(j.span)} · ${esc(j.who)}</li>`).join('')}</ul>`, 'Journeys');
hub('/en/eras', 'Eras of European History: Maps and Timelines', 'Eras of European History', `${ERAS.length} periods from Classical Greece to the present, each with its maps, events and battles.`,
  table(['Era', 'Period'], ERAS.map(e => [`<a href="/en/era/${e.slug}">${esc(e.name)}</a>`, `${fy(e.from)}–${e.to >= 2026 ? 'today' : fy(e.to)}`])), 'Eras');
hub('/en', 'Historical Atlas of Europe: Maps, Cities, Battles & Timelines', 'Historical Atlas of Europe', 'Browse 2,500 years of European history by year, city, battle, state, era and historical journey, or open the interactive map and drag the timeline.',
  `${openBtn('y1453', 'Open the interactive map')}<ul class="links">${NAV.map(([t, u]) => `<li><a href="${u}">${t}</a></li>`).join('')}<li><a href="/en/quiz">Map quiz</a></li></ul>`, 'Explore');

// ---------- write output ----------
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const SKIP = new Set(['build.mjs', 'package.json', 'package-lock.json', 'vercel.json', 'README.md', 'node_modules', 'dist', '.git', '.vercel', 'robots.txt', 'sitemap.xml']);
for (const f of fs.readdirSync(ROOT)) if (!SKIP.has(f) && !f.startsWith('.') && fs.statSync(path.join(ROOT, f)).isFile()) fs.copyFileSync(path.join(ROOT, f), path.join(OUT, f));
const write = (rel, data) => { const p = path.join(OUT, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, data); };
for (const p of pages) write(p.url + '.html', p.html);
for (const s of SNAPS) write(`maps/${yearSlug(s)}.svg`, mapSVG(s));
write('assets/page.css', fs.readFileSync(path.join(ROOT, 'page.css'), 'utf8'));
write('favicon.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="10" fill="#a8322a"/><text x="32" y="45" text-anchor="middle" font-family="Georgia,serif" font-size="40" font-weight="700" fill="#f6e9cf">C</text></svg>`);
const urls = ['/', ...pages.map(p => p.url)];
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `  <url><loc>${SITE}${u}</loc><lastmod>${TODAY}</lastmod></url>`).join('\n')}\n</urlset>\n`);
write('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);
console.log(`Built ${pages.length} pages + ${SNAPS.length} maps → dist/`);
