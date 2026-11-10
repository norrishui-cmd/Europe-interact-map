// Chronica Maps · static SEO page builder
// Runs on Vercel at deploy time: `node build.mjs` → ./dist
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { geoProjection, geoPath, geoContains, geoArea, geoDistance, geoBounds, geoCentroid } from 'd3-geo';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'dist');
const SITE = 'https://chronicamaps.com';
const VER = (process.env.VERCEL_GIT_COMMIT_SHA || Date.now().toString(36)).slice(0, 10);
const TODAY = new Date().toISOString().slice(0, 10);
const R_KM = 6371;
const ORG = { '@type': 'Organization', name: 'Chronica Maps', url: 'https://chronicamaps.com', logo: 'https://chronicamaps.com/icon-512.png' };
const fdate = d => new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

// ---------- load content (same files the app uses) ----------
const ctx = { window: {} };
vm.createContext(ctx);
for (const f of ['i18n.js', 'polities.js', 'polities_world.js', 'content.js', 'content_more.js', 'content_world.js', 'content_world2.js', 'content_en.js', 'content_more_en.js', 'content_world_en.js', 'content_world2_en.js', 'content_world3.js', 'people.js', 'landmarks.js', 'routes.js', 'featured.js']) {
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
const CITY = Object.fromEntries(CITIES.map(c => [c.id, c]));
const PEOPLE = (W.PEOPLE || []).map(p => ({ ...p, name: p.n.en, role: p.r.en, bio: p.d.en, cities: p.at.map(id => CITY[id]).filter(Boolean) }))
  .map(p => ({ ...p, ll: p.c || (p.cities[0] && p.cities[0].c), place: p.pl ? p.pl.en : (p.cities[0] && p.cities[0].name) }));
const lifeY = p => `${p.ca ? 'c. ' : ''}${fy(p.y[0])} – ${fy(p.y[1])}`;
const peopleIn = id => PEOPLE.filter(p => p.at.includes(id)).sort((a, b) => a.y[0] - b.y[0]);
const further = q => `<h2>Further reading</h2><ul class="links"><li><a href="https://www.britannica.com/search?query=${encodeURIComponent(q)}" rel="nofollow">${esc(q)} in Encyclopaedia Britannica</a></li><li><a href="https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(q)}&amp;go=Go" rel="nofollow">${esc(q)} on Wikipedia</a></li></ul>`;
const CN2 = { 'Zaire': 'Democratic Republic of the Congo', 'Tanzania, United Republic of': 'Tanzania', 'Korea, Republic of': 'South Korea', "Korea, Democratic People's Republic of": 'North Korea', 'Iran, Islamic Republic of': 'Iran', 'Syrian Arab Republic': 'Syria', 'Viet Nam': 'Vietnam', "Lao People's Democratic Republic": 'Laos', 'Libyan Arab Jamahiriya': 'Libya', 'Macedonia': 'North Macedonia', 'Moldova, Republic of': 'Moldova', 'Ivory Coast': "Côte d'Ivoire", 'Swaziland': 'Eswatini', 'Burma': 'Myanmar' };
const modernOf = ll => { const n = polityAt(ll, SNAPS.at(-1)); return n && !isTribal(n) ? (CN2[n] || polName(n)) : null; };
const YQ = [1000, 1500, 1800, 1900];
const art = n => /^[A-Z][a-z]+s$/.test(n) && !/(lands|ines|Wales|Paris|Athens)$/.test(n) ? `the lands of the ${n}` : (/^the /i.test(n) || !/\b(Empire|Kingdom|Khanate|Sultanate|Caliphate|Republic|Union|Confederation|Duchy|Horde|Emirate|Dynasty|States|Commonwealth|Federation|Protectorate|Viceroyalty|Mandate|Order|League|Principality|Archduchy|Dominion|Khaganate|Shogunate|Raj)\b/.test(n) ? n : 'the ' + n);
const yearQs = (name, ll, from = -9999) => YQ.filter(y => y >= from && SNAPS[0] <= y).map(y => { const sn = snapFor(y), n = polityAt(ll, sn);
  return n && !isTribal(n) ? [`What country was ${name} in ${y}?`, `On the border map for ${fy(sn)}, ${name} lay within ${art(polName(n))}.`] : null; }).filter(Boolean);
const qaBlock = (title, qa) => qa.length ? `<h2>${title}</h2>${qa.map(([q, a]) => `<h3>${esc(q)}</h3><p>${esc(a)}</p>`).join('')}` : '';
const qaLd = qa => ({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: qa.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) });
const alive = (a, b) => PEOPLE.filter(p => p.y[0] <= b && p.y[1] >= a);
const pTable = list => table(['Lived', 'Person', ''], list.map(p => [lifeY(p), `<a href="/en/person/${p.id}">${esc(p.name)}</a>`, esc(p.role)]));
const pBlock = (h, list, n = 12) => list.length ? `<h2>${h}</h2>${pTable(list.slice(0, n))}${list.length > n ? `<p><a href="/en/people">All ${PEOPLE.length} people</a></p>` : ''}` : '';
const spread = (list, n) => { if (list.length <= n) return list; const out = []; for (let i = 0; i < n; i++) out.push(list[Math.floor(i * list.length / n)]); return out; };
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
const imgSlug = (s, r = 'europe') => (r === 'world' ? `world-map-in-${yearSlug(s)}` : `map-of-${r === 'americas' ? 'the-americas' : r}-in-${yearSlug(s)}`);
const imgUrl = (s, r = 'europe') => `/maps/img/${imgSlug(s, r)}.webp`;
const mapUrl = (s, r = 'europe') => (r === 'europe' ? `/maps/${yearSlug(s)}.svg` : `/maps/${r}/${yearSlug(s)}.svg`);
const NEED = new Set();
// area of each named, non-tribal state per snapshot (km²) — for "what changed" sections
const AREA = {}, REG = {};
for (const s of SNAPS) { const m = AREA[s] = new Map(), g = REG[s] = new Map(); for (const f of feats(s)) { const n = f.properties.n; if (!n || !n.trim() || isTribal(n)) continue; m.set(n, (m.get(n) || 0) + geoArea(f) * 6371 * 6371); if (!g.has(n)) g.set(n, regionOf(geoCentroid(f))); } }
const inEurope = (n, s) => REG[s].get(n) === 'europe';
function changes(prev, s, keep = () => true) {
  const A = AREA[prev], B = AREA[s], big = 20000;
  const appeared = [...B].filter(([n, a]) => !A.has(n) && a > big && keep(n, s)).sort((x, y) => y[1] - x[1]);
  const vanished = [...A].filter(([n, a]) => !B.has(n) && a > big && keep(n, prev)).sort((x, y) => y[1] - x[1]);
  const delta = [...B].filter(([n]) => A.has(n) && keep(n, s)).map(([n, a]) => [n, a - A.get(n), A.get(n)]).filter(x => Math.abs(x[1]) > 15000 && Math.abs(x[1]) / x[2] > 0.08).sort((x, y) => Math.abs(y[1]) - Math.abs(x[1]));
  return { appeared, vanished, delta };
}
const signKm = d => `${d >= 0 ? '+' : '−'}${fmtKm2(Math.abs(d))}`;
function changeSection(prev, s, keep, scopeLink) {
  if (prev === undefined) return '';
  const { appeared, vanished, delta } = changes(prev, s, keep);
  if (!appeared.length && !vanished.length && !delta.length) return '';
  const nm = list => list.slice(0, 4).map(x => polName(x[0]));
  const join = a => (a.length > 1 ? `${a.slice(0, -1).join(', ')} and ${a.at(-1)}` : a[0]);
  const parts = [];
  if (appeared.length) parts.push(`${appeared.length} state${appeared.length > 1 ? 's' : ''} appear${appeared.length > 1 ? '' : 's'} on the map, among them ${join(nm(appeared))}`);
  if (vanished.length) parts.push(`${vanished.length} disappear${vanished.length > 1 ? '' : 's'}, among them ${join(nm(vanished))}`);
  const gain = delta.filter(x => x[1] > 0)[0], loss = delta.filter(x => x[1] < 0)[0];
  let txt = `Compared with the previous border map (${fy(prev)}), ${parts.join('; ') || 'no major state appears or disappears'}.`;
  if (gain) txt += ` ${polName(gain[0])} gained the most territory (${signKm(gain[1])}).`;
  if (loss) txt += ` ${polName(loss[0])} lost the most (${signKm(loss[1])}).`;
  const rows = [...appeared.slice(0, 6).map(x => [stLink(x[0]), 'Appears', fmtKm2(x[1])]), ...vanished.slice(0, 6).map(x => [stLink(x[0]), 'Disappears', fmtKm2(x[1])]), ...delta.slice(0, 8).map(x => [stLink(x[0]), x[1] > 0 ? 'Grows' : 'Shrinks', signKm(x[1])])];
  return `<h2>What changed since ${fy(prev)}</h2><p>${esc(txt)} <a href="${scopeLink(prev)}">See the ${fy(prev)} map</a>.</p>${table(['State', 'Change', 'Area / difference'], rows)}`;
}

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
  const placed = [];
  const labs = fs_.filter(f => !isTribal(f.properties.n)).slice(0, r === 'world' ? 26 : 18).map(f => {
    let g = f.geometry, best = g;
    if (g.type === 'MultiPolygon') { let ba = -1; for (const c of g.coordinates) { const pg = { type: 'Polygon', coordinates: c }; const a = geoArea(pg); if (a > ba) { ba = a; best = pg; } } }
    const c = P.centroid(best); if (!isFinite(c[0]) || c[0] < 30 || c[0] > 1170 || c[1] < 20 || c[1] > 780) return '';
    const fs2 = r === 'europe' ? Math.max(11, Math.min(24, 6 + Math.sqrt(f.properties.a) * 0.9)) : Math.max(10, Math.min(20, 5 + Math.sqrt(P.area(best)) * 0.04));
    const nm = polName(f.properties.n), w = nm.length * fs2 * 0.56 + 6, h = fs2 + 4, bx = [c[0] - w / 2, c[1] - h + 3, c[0] + w / 2, c[1] + 4];
    if (placed.some(q => !(bx[2] < q[0] || bx[0] > q[2] || bx[3] < q[1] || bx[1] > q[3])) || placed.length >= (r === 'world' ? 18 : 14)) return '';
    placed.push(bx);
    return `<text x="${c[0].toFixed(0)}" y="${c[1].toFixed(0)}" font-size="${fs2.toFixed(0)}">${esc(nm)}</text>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800"><rect width="1200" height="800" fill="#c9d3c8"/>${land}${pols}<g fill="#b8c9c4" stroke="#7d9cab" stroke-width=".5">${lakes}</g><g fill="none" stroke="#7d9cab" stroke-width=".8">${riv}</g><path d="${P(PHYS.land)}" fill="none" stroke="#7d6a4c" stroke-width=".8" stroke-opacity=".7"/>${sphere}<g font-family="Georgia,serif" font-weight="700" fill="#3a2a1a" text-anchor="middle" paint-order="stroke" stroke="#efe4cb" stroke-width="3" stroke-linejoin="round">${labs}</g></svg>`;
}

// ---------- page template ----------
const NAV = [['Daily puzzle', '/daily'], ['Tools', '/tools'], ['Trade routes', '/en/routes'], ['Europe by year', '/en/years'], ['World maps', '/en/world'], ['Countries', '/en/countries'], ['Largest empires', '/en/largest-empires'], ['Cities', '/en/cities'], ['People', '/en/people'], ['Landmarks', '/en/landmarks'], ['Battles & sites', '/en/battles'], ['States', '/en/states'], ['Journeys', '/en/journeys'], ['Eras', '/en/eras']];
const ogUrl = (s, r = 'europe') => `/og/${r}-${yearSlug(s)}.jpg`;
const FEAT = [...(W.FEATURED || [])].sort((a, b) => (b.pin ? 1 : 0) - (a.pin ? 1 : 0) || b.date.localeCompare(a.date));
const featAside = url => { const l = FEAT.filter(f => `/en/topics/${f.slug}` !== url).slice(0, 4); return l.length ? `<aside class="featured" aria-label="Featured"><h2>Featured</h2><ul>${l.map(f => `<li><a href="/en/topics/${f.slug}">${esc(f.title)}</a></li>`).join('')}</ul><p><a href="/en/topics">All featured topics →</a></p></aside>` : ''; };
const EXTRA = {}, EXTRA_LD = {};
function page({ url, title, desc, h1, crumbs, body, ld = [], ogImage, tool, ogType = 'article', noindex }) {
  if (title.length > 62 && title.endsWith(' | Chronica Maps')) title = title.slice(0, -16);
  if (EXTRA[url]) body += EXTRA[url];
  if (EXTRA_LD[url]) ld = [...ld, ...EXTRA_LD[url]];
  body = body.replace(/<!--EMBED:([^>]*)-->/, (_, h) => embedBox(h, url, h1.replace(/&amp;/g, '&').replace(/<[^>]+>/g, ''))).replace(/<!--EMBED:[^>]*-->/g, '');
  if (!ogImage) { const m = body.match(/data-svg="\/maps\/(?:([a-z]+)\/)?([0-9]+(?:-bc)?)\.svg"/); if (m) ogImage = `/og/${m[1] || 'europe'}-${m[2]}.jpg`; }
  const imgs = [...new Set([...body.matchAll(/src="(\/maps\/img\/[^"]+\.webp)"[^>]*alt="([^"]*)"/g)].map(m => m[1] + '|' + m[2]))];
  if (imgs.length) ld = [...ld, ...imgs.map(x => { const [u, alt] = x.split('|'); return { '@context': 'https://schema.org', '@type': 'ImageObject', contentUrl: SITE + u, name: alt.replace(/&amp;/g, '&'), creditText: 'Chronica Maps', creator: ORG, copyrightNotice: 'Chronica Maps; border data historical-basemaps (GPL-3.0), Natural Earth', license: 'https://www.gnu.org/licenses/gpl-3.0.html', acquireLicensePage: SITE + '/about#using-and-citing-the-maps' }; })];
  if (!noindex) ld = [...ld, { '@context': 'https://schema.org', '@type': 'WebPage', url: SITE + url, name: title, dateModified: TODAY, inLanguage: 'en', isPartOf: { '@type': 'WebSite', name: 'Chronica Maps', url: SITE }, publisher: ORG }];
  if (!ogImage) ogImage = '/og/world-1500.jpg';
  const ogAbs = ogImage ? (/^https?:/.test(ogImage) ? ogImage : SITE + ogImage) : '';
  const bc = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c[0], item: SITE + c[1] })) };
  const lds = [bc, ...ld].map(o => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`).join('\n');
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
${noindex ? '<meta name="robots" content="noindex">' : `<link rel="canonical" href="${SITE}${url}">`}
<link rel="alternate" type="application/rss+xml" title="Chronica Maps: Featured topics" href="/feed.xml">
<meta property="og:type" content="${ogType}">
<meta property="og:site_name" content="Chronica Maps">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${SITE}${url}">
${ogAbs ? `<meta property="og:image" content="${ogAbs}">${/^\/og\//.test(ogImage) ? '\n<meta property="og:image:width" content="1200">\n<meta property="og:image:height" content="630">' : ''}\n<meta name="twitter:image" content="${ogAbs}">` : ''}
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<link rel="stylesheet" href="/assets/page.css">
${lds}
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-9505220977121599"\n     crossorigin="anonymous"></script>
</head>
<body>
<header class="top"><a class="brand" href="/"><span class="seal">C</span>Chronica Maps</a><nav>${NAV.map(([t, u]) => `<a href="${u}">${t}</a>`).join('')}<a class="cta" href="/">Interactive map →</a></nav></header>
<main>
<nav class="crumbs" aria-label="Breadcrumb">${crumbs.map((c, i) => (i < crumbs.length - 1 ? `<a href="${c[1]}">${esc(c[0])}</a>` : `<span>${esc(c[0])}</span>`)).join(' › ')}</nav>
<h1>${h1}</h1>
${body}
${noindex || tool ? '' : `<p class="updated muted">Last updated ${fdate(TODAY)}. Sources: border data from <a href="https://github.com/aourednik/historical-basemaps">historical-basemaps</a>, land and rivers from Natural Earth; texts written for Chronica Maps from standard reference works. <a href="/about#sources-and-method">How we make the maps</a>.</p>`}
${featAside(url)}
</main>${tool ? `\n<script>window.APP_V="${VER}"</script><script src="/vendor/d3.min.js"></script><script src="/tools.js?v=${VER}"></script>` : ''}
<footer><p>Historical borders are schematic approximations, not surveyed boundaries. Border data: <a href="https://github.com/aourednik/historical-basemaps">historical-basemaps</a> (GPL-3.0); land and rivers: Natural Earth.</p><p><a href="/about">About</a> · <a href="/guide">How to use the map</a> · <a href="/en/topics">Featured topics</a> · <a href="/en/anniversaries/${new Date().getUTCFullYear()}">Anniversaries</a></p><p><a href="/">Interactive map</a> · ${NAV.map(([t, u]) => `<a href="${u}">${t}</a>`).join(' · ')}</p></footer>
</body>
</html>`;
}
const mapBlock = (s, alt, overlay = '', r = 'europe') => { NEED.add(`${r}|${s}`); return `<figure class="map"><div class="mapwrap"><img src="${imgUrl(s, r)}" data-svg="${mapUrl(s, r)}" width="1200" height="800" alt="${esc(alt)}" loading="eager" decoding="async">${overlay}</div><figcaption>Border map for ${fy(s)}. ${r === 'europe' ? `<a href="/en/year/${yearSlug(s)}">See Europe in ${fy(s)}</a>` : `<a href="/en/world/${yearSlug(s)}">See the world in ${fy(s)}</a>`}.</figcaption></figure>`; };
const pin = (ll, label, r = 'europe') => { const p = pt(ll, r); return `<span class="pin" style="left:${p.x}%;top:${p.y}%"><span>${esc(label)}</span></span>`; };
const openBtn = (h, label) => `<p><a class="btn" href="/#${h}-l-en">${esc(label)}</a></p><!--EMBED:${h}-->`;
// copyable iframe code; the credit line under the map links back to the page
const embedBox = (h, url, title) => { const code = `<iframe src="${SITE}/?embed=1#${h}-l-en" width="100%" height="520" style="border:0;max-width:100%" loading="lazy" title="${esc(title)}"></iframe>\n<p style="font-size:13px;margin:4px 0 0">Interactive map: <a href="${SITE}${url}">${esc(title)}</a> · Chronica Maps</p>`; return `<details class="embed"><summary>Embed this interactive map on your site</summary><p class="muted">Free to use on blogs, school pages and course sites. Copy the code below; please keep the credit line.</p><textarea readonly rows="4" onclick="this.select()">${esc(code)}</textarea></details>`; };
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
  { const e2 = snapEnd(s), L = alive(s, e2).filter(p => p.ll && regionOf(p.ll) === 'europe').sort((a, b) => a.y[0] - b.y[0]); EXTRA[`/en/year/${yearSlug(s)}`] = pBlock(`Famous people in Europe, ${fy(s)} to ${fy(e2)}`, spread(L, 12)); }
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
${changeSection(prev, s, inEurope, p => `/en/year/${yearSlug(p)}`)}
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
  { const e2 = snapEnd(s), L = alive(s, e2).filter(p => p.ll).sort((a, b) => a.y[0] - b.y[0]); EXTRA[`/en/world/${yearSlug(s)}`] = pBlock(`Famous people of the world, ${fy(s)} to ${fy(e2)}`, spread(L, 16), 16); }
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
${changeSection(prev, s, () => true, p => `/en/world/${yearSlug(p)}`)}
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
  { const rows = ruledBy(c.c).filter(r => r.n), st = [...new Set(rows.map(r => polName(r.n)))], pp = peopleIn(c.id), old = c.names.filter(n => n.name !== c.name);
    const qa = [];
    if (old.length) qa.push([`What was ${c.name} called in the past?`, `${c.name} has been known as ${old.map(n => `${n.name} (from ${fy(n.from)}${n.note ? `, ${n.note}` : ''})`).join('; ')}. Its present name dates from ${fy(c.names.at(-1).from)}.`]);
    if (st.length) qa.push([`Which states have ruled ${c.name}?`, `On the historical border maps from ${fy(SNAPS[0])} to today, ${c.name} lies within ${st.length} different state${st.length > 1 ? 's' : ''}: ${st.slice(0, 10).join(', ')}${st.length > 10 ? ' and others' : ''}.`]);
    if (c.ev.length) qa.push([`What are the key dates in the history of ${c.name}?`, c.ev.slice(0, 5).map(e => `${fy(e.y)}: ${e.t}`).join('. ') + '.']);
    qa.push(...yearQs(c.name, c.c, c.names[0].from));
    { const m = modernOf(c.c); if (m && m !== c.name) qa.push([`What country is ${c.name} in today?`, `${c.name} is in ${m}.`]); }
    if (pp.length) qa.push([`Which famous people are connected with ${c.name}?`, pp.slice(0, 6).map(p => `${p.name} (${p.role.toLowerCase()}, ${lifeY(p)})`).join('; ') + '.']);
    EXTRA[`/en/city/${c.id}`] = further(`${c.name} history`) + `<h2>Questions about ${esc(c.name)}</h2>${qa.map(([q, a]) => `<h3>${esc(q)}</h3><p>${esc(a)}</p>`).join('')}`;
    EXTRA_LD[`/en/city/${c.id}`] = [{ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: qa.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) }]; }
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
${peopleIn(c.id).length ? `<h2>Famous people of ${esc(c.name)}</h2>${table(['Lived', 'Person', ''], peopleIn(c.id).map(p => [lifeY(p), `<a href="/en/person/${p.id}">${esc(p.name)}</a>`, esc(p.role)]))}` : ''}
${nc.length ? `<h2>Nearby cities</h2><ul class="links">${nc.map(x => `<li><a href="/en/city/${x.c.id}">${esc(x.c.name)}</a> · about ${Math.round(x.d)} km</li>`).join('')}</ul>` : ''}`;
  add(`/en/city/${c.id}`, page({ url: `/en/city/${c.id}`, title: [2, 1, 0].map(k => `${c.name} History: Former Names${old.length && k ? ` (${old.slice(0, k).join(', ')})` : ''} & Timeline Map`).find(t => t.length <= 62) || `${c.name} History, Former Names & Timeline`,
    desc: cut(`${c.bio} Former names, timeline of events and every state that ruled ${c.name}, on a historical map.`),
    h1: esc(h1), crumbs: [['Home', '/'], ['Cities', '/en/cities'], [c.name, `/en/city/${c.id}`]], body,
    ld: [{ '@context': 'https://schema.org', '@type': 'Place', name: c.name, alternateName: old, description: c.bio, geo: { '@type': 'GeoCoordinates', latitude: c.c[1], longitude: c.c[0] } }] }));
}

// ---------- battle / site pages ----------
for (const x of SITES) {
  { const nc = CITIES.slice().sort((a, b) => geoDistance(a.c, x.c) - geoDistance(b.c, x.c))[0], km = Math.round(geoDistance(nc.c, x.c) * R_KM), m = modernOf(x.c), n = polityAt(x.c, snapFor(x.y)), qa = [];
    qa.push([`Where did the ${x.title.replace(/^the /i, '')} take place?`, `${km < 15 ? `At ${nc.name}` : `About ${Math.round(km / 5) * 5} km from ${nc.name}`}${m ? `, in present-day ${m}` : ''}. Coordinates: ${x.c[1].toFixed(2)}°${x.c[1] >= 0 ? 'N' : 'S'}, ${Math.abs(x.c[0]).toFixed(2)}°${x.c[0] >= 0 ? 'E' : 'W'}.`]);
    qa.push([`When did the ${x.title.replace(/^the /i, '')} happen?`, `In ${fy(x.y)}.`]);
    if (n && !isTribal(n)) qa.push([`Which state controlled the area at the time?`, `On the border map for ${fy(snapFor(x.y))}, the site lay within ${art(polName(n))}.`]);
    x._qa = qa; EXTRA_LD[`/en/battle/${x.id}`] = [qaLd(qa)]; }
  EXTRA[`/en/battle/${x.id}`] = qaBlock('Questions', x._qa) + further(x.title) + pBlock(`Who was alive at the time`, alive(x.y, x.y).filter(p => p.ll && geoDistance(p.ll, x.c) * R_KM < 2500).sort((a, b) => geoDistance(a.ll, x.c) - geoDistance(b.ll, x.c)), 8);
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
const P_STATES = new Map(PEOPLE.map(p => { const set = new Set(), lls = [...(p.c ? [p.c] : []), ...p.cities.map(c => c.c)];
  for (const s of SNAPS) if (s >= p.y[0] - 50 && s <= p.y[1]) for (const ll of lls) { const n = polityAt(ll, s); if (n) set.add(n); }
  return [p.id, set]; }));
for (const st of STATE_LIST) {
  { const ss = [...new Set(st.maps.map(m => m.s))].sort((a, b) => a - b), nm = st.name.replace(/^the /i, ''), The = art(nm) !== nm ? 'the ' : '', Nm = The ? 'The ' + nm : nm;
    const mods = [...new Set(feats(SNAPS.at(-1)).filter(f => f.properties.n && !isTribal(f.properties.n) && inB(st.peak.f._b, geoCentroid(f)) && geoContains(st.peak.f, geoCentroid(f))).map(f => CN2[f.properties.n] || polName(f.properties.n)))].filter(m => m !== st.name);
    const qa = [[`When does ${The}${nm} appear on the map?`, ss.length === 1 ? `${Nm} appears on one border map, the map for ${fy(ss[0])}.` : `${Nm} appears on ${ss.length} of the ${SNAPS.length} border maps, from ${fy(ss[0])}${ss.at(-1) === SNAPS.at(-1) ? ' to today' : ` to ${fy(ss.at(-1))}`}.`],
      [`When was ${The}${nm} at its largest?`, `On the map for ${fy(st.peak.s)}, with about ${fmtKm2(st.peak.area)}.`]];
    if (mods.length) qa.push([`Which present-day countries were part of ${The}${nm}?`, `At its largest, ${The}${nm} covered all or part of ${mods.slice(0, 15).join(', ')}${mods.length > 15 ? ' and others' : ''}.`]);
    st._qa = qa; EXTRA_LD[`/en/state/${st.slug}`] = [qaLd(qa)]; }
  EXTRA[`/en/state/${st.slug}`] = qaBlock('Questions', st._qa) + pBlock(`Famous people who lived under the ${esc(st.name.replace(/^the /i, ''))}`, PEOPLE.filter(p => P_STATES.get(p.id).has(st.n)).sort((a, b) => a.y[0] - b.y[0]));
  const maps = st.maps.sort((a, b) => a.s - b.s), first = maps[0].s, last = maps.at(-1).s, peak = st.peak, L = lineage(st.n);
  const inside = CITIES.filter(c => polityAt(c.c, peak.s) === st.n);
  const realm = L && REALM_OF[L[0]] ? W.RULERS.find(R => R.k === REALM_OF[L[0]]) : null;
  const rul = realm ? realm.list.map((r, i) => ({ from: r[0], to: r[1], name: E.rulers[realm.k][i] })).filter(r => r.to >= first && r.from <= snapEnd(last)) : [];
  const kin = L ? STATE_LIST.filter(o => o !== st && lineage(o.n) === L) : [];
  const rg = st.region;
  const overlay = `<svg class="hl" viewBox="0 0 1200 800" aria-hidden="true"><path d="${PATHS[rg](peak.f)}" fill="#a8322a" fill-opacity=".18" stroke="#a8322a" stroke-width="2.5"/></svg>`;
  const steps = maps.slice(1).map((m, i) => ({ from: maps[i].s, to: m.s, d: m.area - maps[i].area })), up = steps.filter(x => x.d > 0).sort((a, b) => b.d - a.d)[0], down = steps.filter(x => x.d < 0).sort((a, b) => a.d - b.d)[0];
  const trend = `${up ? ` Its largest expansion came between ${fy(up.from)} and ${fy(up.to)} (${signKm(up.d)}).` : ''}${down ? ` Its sharpest contraction came between ${fy(down.from)} and ${fy(down.to)} (${signKm(down.d)}).` : ''}`;
  const lead = `${st.name} appears on ${maps.length} of the ${SNAPS.length} border maps, from ${fy(first)} to ${fy(last)}. Its mapped territory was largest in ${fy(peak.s)}, at roughly ${fmtKm2(peak.area)}.${trend}${L ? ` Chronica Maps groups it with the ${LINEAGE_EN[L[0]]} lineage, shown in the same colour across periods.` : ''}`;
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
  EXTRA[`/en/era/${e.slug}`] = pBlock(`Notable people of the ${esc(e.name.replace(/^the /i, ''))}`, spread(alive(e.from, e.to).filter(p => p.ll && regionOf(p.ll) === e.region).sort((a, b) => a.y[0] - b.y[0]), 14), 14);
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
  EXTRA[`/en/landmark/${m.id}`] = further(m.name);
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
    crumbs: [['Home', '/'], ['Landmarks', '/en/landmarks'], [m.country, `/en/landmarks/${ctySlug(m.country)}`], [m.name, `/en/landmark/${m.id}`]], body, ogImage: (m.img.now || m.img.then || {}).t960 || null,
    ld: [{ '@context': 'https://schema.org', '@type': 'LandmarksOrHistoricalBuildings', name: m.name, description: m.d.en, image: imgs.map(i => i.t960 || i.t500), geo: { '@type': 'GeoCoordinates', latitude: m.c[1], longitude: m.c[0] }, containedInPlace: { '@type': 'Country', name: m.country } }] }));
  m.imgs = imgs;
}
const COUNTRIES = [...new Set(LMS.map(m => m.country))].sort();
for (const c of COUNTRIES) {
  const list = LMS.filter(m => m.country === c).sort((a, b) => a.y - b.y);
  EXTRA[`/en/landmarks/${ctySlug(c)}`] = `<h2>About these landmarks</h2>${list.map(m => `<h3><a href="/en/landmark/${m.id}">${esc(m.name)}</a> · ${fy(m.y)}</h3><p>${esc(m.d.en)}</p>`).join('')}`;
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

// ---------- interactive tools ----------
let TOOLS_META = '';
const TOWNS = JSON.parse(fs.readFileSync(path.join(ROOT, 'towns.json'), 'utf8'));
const PRESETS = [
  ['Fall of the Western Roman Empire', 'europe', 400, 500, 'Between 400 and 500 the Western Roman Empire breaks up into Germanic kingdoms, while the Eastern Roman Empire survives.'],
  ['Rise of the caliphate', 'world', 600, 700, 'Within a century of Muhammad, the caliphate stretches from Spain to Central Asia.'],
  ['Mongol conquests', 'asia', 1200, 1300, 'Genghis Khan and his successors build the largest contiguous land empire in history.'],
  ['Age of Discovery', 'world', 1492, 1600, 'European empires spread across the Americas and to the coasts of Africa and Asia.'],
  ['Napoleonic Europe', 'europe', 1783, 1815, 'From the eve of the French Revolution to the Congress of Vienna.'],
  ['Scramble for Africa', 'africa', 1880, 1914, 'European powers divide almost the whole of Africa among themselves.'],
  ['World War I', 'europe', 1914, 1920, 'Four empires collapse and new states appear across central and eastern Europe.'],
  ['Decolonisation', 'world', 1945, 1994, 'Colonial empires dissolve into dozens of independent states.'],
  ['End of the Cold War', 'europe', 1960, 1994, 'The Soviet Union and Yugoslavia break apart and Germany reunites.'],
];
// static town pages: larger towns not already covered by a city page, with a real sequence of rulers
const TOWN_PAGES = [];
for (const t of TOWNS.t) {
  if (TOWN_PAGES.length >= 600) break;
  const ll = [t[4], t[5]];
  if (CITIES.some(c => geoDistance(c.c, ll) * R_KM < 25)) continue;
  const key = t[0] + '|' + t[2]; if (TOWN_PAGES.some(x => x.t[0] + '|' + x.t[2] === key)) continue;
  const h = t[7], rows = [];
  for (let i = 0; i < h.length; i += 2) rows.push({ n: h[i] >= 0 ? TOWNS.names[h[i]] : null, from: TOWNS.snaps[h[i + 1]], to: h[i + 2] !== undefined ? TOWNS.snaps[h[i + 3]] - 1 : 2026 });
  const ruled = rows.filter(r => r.n && !isTribal(r.n)), uniq = [...new Set(ruled.map(r => polName(r.n)))];
  if (uniq.length < 4) continue;
  TOWN_PAGES.push({ t, ll, rows, ruled, uniq, slug: t[8] });
}
{
  const names = {};
  for (const s of SNAPS) for (const f of feats(s)) { const n = f.properties.n; if (!n || !n.trim() || names[n]) continue; const u = stateUrl(n); names[n] = [polName(n), colorOf(n), isTribal(n) ? 1 : 0, u ? u.replace('/en/state/', '') : '']; }
  for (const n of TOWNS.names) if (!names[n]) { const u = stateUrl(n); names[n] = [polName(n), colorOf(n), isTribal(n) ? 1 : 0, u ? u.replace('/en/state/', '') : '']; }
  const eras = { europe: ERAS.map(e => [e.from, e.to, e.name]) };
  for (const e of RERAS) (eras[e.region] ||= []).push([e.from, e.to, e.name]);
  eras.world = eras.europe;
  const sizePresets = ['Roman Empire', 'Achaemenid Empire', 'Han Empire', 'Mongol Empire', 'Umayyad Caliphate', 'Tang Empire', 'Inca Empire', 'Mughal Empire', 'Ottoman Empire', 'Qing Empire', 'Russian Empire', 'British Raj', 'Empire of Alexander', 'Holy Roman Empire'].map(n => { let best = null; for (const s of SNAPS) { const a = AREA[s].get(n); if (a && (!best || a > best[1])) best = [s, a]; } return best ? [`${polName(n)} (${fy(best[0])})`, best[0], n] : null; }).filter(Boolean);
  TOOLS_META = (JSON.stringify({ snaps: SNAPS, names, eras, presets: PRESETS, sizePresets, towns: Object.fromEntries(TOWN_PAGES.map(x => [x.slug, 1])) }));
}
const toolPage = (url, title, desc, h1, tool, intro, after) => add(url, page({ url, title, desc, h1, crumbs: [['Home', '/'], [h1, url]], tool: true,
  body: `<p class="lead">${esc(intro)}</p><div data-tool="${tool}"><div class="tool"><p class="muted">Loading…</p></div></div><noscript><p>This tool needs JavaScript.</p></noscript>${after}`,
  ld: [{ '@context': 'https://schema.org', '@type': 'WebApplication', name: h1, url: SITE + url, applicationCategory: 'EducationalApplication', operatingSystem: 'Any', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, description: desc }] }));
const faq = qa => `<h2>Questions</h2>${qa.map(([q, a]) => `<h3>${esc(q)}</h3><p>${a}</p>`).join('')}`;
const faqLd = qa => ({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: qa.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a.replace(/<[^>]+>/g, '') } })) });
{
  const qa = [['How does the daily history map puzzle work?', 'Every day there is one unlabelled border map. Pick the year you think it shows; you have five tries. After each wrong guess you get a hint: the largest state, the era, more labels, and finally a narrow range of years. 🟩 means exact, 🟨 means within two maps.'],
    ['When does a new puzzle appear?', 'A new puzzle starts every day at 00:00 UTC. Your streak and stats are kept in your browser.'],
    ['Can I play past puzzles?', 'Yes. Add the puzzle number to the address, for example <a href="/daily#1">/daily#1</a>.']];
  toolPage('/daily', 'Daily History Map Puzzle: Guess the Year | Chronica Maps', 'A free daily geography and history game: look at an unlabelled historical border map and guess the year in five tries. Share your result.', 'Daily Map Puzzle: Guess the Year', 'daily',
    'One unlabelled historical map a day. Guess which year it shows in five tries, then share your score.', faq(qa));
  pages.at(-1).html = pages.at(-1).html.replace('</head>', `<script type="application/ld+json">${JSON.stringify(faqLd(qa))}</script>
</head>`);
}
toolPage('/compare', 'Compare Historical Maps: Two Years Side by Side | Chronica Maps', 'Compare the borders of any two years from 500 BC to today with a swipe slider: see which states appeared, disappeared, grew and shrank, in Europe, Asia, Africa, the Americas or the world.', 'Compare Two Historical Maps', 'compare',
  'Pick a region and two years, then drag the slider to see how the borders changed. The lists below show which states appeared, disappeared, grew or shrank.',
  `<h2>Popular comparisons</h2><ul class="links">${PRESETS.map(p => `<li><a href="/compare#${p[1]}-${p[2]}-${p[3]}">${esc(p[0])}: ${fy(p[2])} vs ${fy(p[3])}</a> — ${esc(p[4])}</li>`).join('')}</ul>`);
toolPage('/town', 'What Country Was My Town In? Town History Through 2,500 Years | Chronica Maps', `Search ${TOWNS.t.length.toLocaleString('en-US')} towns and cities to see every state that ruled them on the historical border maps from 500 BC to today.`, 'What Country Was My Town In?', 'town',
  `Type the name of a town or city to see which empires, kingdoms and states it belonged to on each historical border map, from ${fy(SNAPS[0])} to today.`,
  `<h2>Town histories</h2><p>Browse <a href="/en/towns">${TOWN_PAGES.length} town history pages</a>, or the <a href="/en/cities">historic cities</a> with full timelines.</p>`);
toolPage('/size', 'True Size of Historical Empires: Drag and Compare | Chronica Maps', 'How big was the Mongol Empire, Rome or the Inca Empire really? Drag any historical state across the world map to compare its true size with modern countries.', 'The True Size of Historical Empires', 'size',
  'Pick an empire and drag its outline anywhere on the globe. The shape keeps its real size as it moves, so you can compare it with modern countries.',
  `<h2>How it works</h2><p>Flat maps stretch the land near the poles. When you drag a shape, Chronica Maps rotates it on the sphere instead of just sliding it, so a shape moved north grows on screen exactly as much as the countries it covers. Areas come from the historical border data and are approximate.</p>`);
toolPage('/animate', 'Make a Historical Border Animation (GIF or Video) | Chronica Maps', 'Create a free animated map of changing borders for any region and period, as a GIF or a video in landscape, square or vertical format for YouTube Shorts and TikTok.', 'Animate Changing Borders', 'animate',
  'Choose a region and a period, then create a GIF or video of the borders changing map by map. Vertical format works for YouTube Shorts, TikTok and Instagram Reels.',
  `<h2>Notes</h2><p>The animation is made in your browser; nothing is uploaded. Video is saved as MP4 where the browser supports it, otherwise as WebM. You are free to share the result; please keep the chronicamaps.com credit visible.</p>`);
// town pages
for (const x of TOWN_PAGES) {
  { const nm = x.t[0], qa = yearQs(nm, x.ll); if (qa.length) { EXTRA_LD[`/en/town/${x.slug}`] = [qaLd(qa)]; } x._qa = qa; }
  EXTRA[`/en/town/${x.slug}`] = qaBlock(`Questions about ${esc(x.t[0])}`, x._qa) + pBlock(`Famous people from the region`, PEOPLE.filter(p => p.ll && geoDistance(p.ll, x.ll) * R_KM < 250).sort((a, b) => a.y[0] - b.y[0]), 8);
  const { t, ll, rows, ruled, uniq } = x, rg = regionOf(ll), name = t[0], where = [t[3] !== t[0] ? t[3] : '', t[2]].filter(Boolean).join(', ');
  const longest = ruled.slice().sort((a, b) => (b.to - b.from) - (a.to - a.from))[0];
  const ms = SNAPS.filter(s => s >= longest.from && s <= longest.to), s = ms[Math.floor(ms.length / 2)] ?? snapFor(longest.from);
  const nc = nearCities(ll, 4, 500), ns = nearSites(ll, 200).slice(0, 8), nl = lmNear(ll, 200).slice(0, 6);
  const lead = `${name}${where ? ` (${where})` : ''} lies within ${uniq.length} different states on Chronica Maps' ${SNAPS.length} historical border maps. The longest stretch is under ${polName(longest.n)}, from ${fy(longest.from)} to ${longest.to >= 2026 ? 'today' : fy(longest.to)}. ${ruled[0] ? `The earliest state recorded here is ${polName(ruled[0].n)} (${fy(ruled[0].from)}).` : ''}`;
  const body = `<p class="lead">${esc(lead)}</p>
<div class="tbar">${rows.map(r => `<span title="${esc((r.n ? polName(r.n) : 'No state recorded') + ' · ' + fy(r.from))}" style="flex:${Math.max(1, r.to - r.from)};background:${r.n ? colorOf(r.n) : '#e8dfcc'}"></span>`).join('')}</div>
<h2>Who ruled ${esc(name)}?</h2>
${table(['Period (by border map)', 'Ruled by'], rows.map(r => [`<a href="${rg === 'europe' ? '/en/year/' : '/en/world/'}${yearSlug(r.from)}">${fy(r.from)}</a> – ${r.to >= 2026 ? 'today' : fy(r.to)}`, stLink(r.n)]))}
${mapBlock(s, `Map showing ${name} in ${fy(s)}`, pin(ll, name, rg), rg)}
<p><a class="btn" href="/town#${x.slug}">Search another town</a></p>
${nc.length ? `<h2>Historic cities nearby</h2><ul class="links">${nc.map(o => `<li><a href="/en/city/${o.c.id}">${esc(o.c.name)}</a> · about ${Math.round(o.d / 10) * 10} km</li>`).join('')}</ul>` : ''}
${ns.length ? `<h2>Battles and events within 200 km</h2><ul class="links">${ns.map(o => `<li><a href="/en/battle/${o.id}">${esc(o.title)}</a> · ${fy(o.y)}</li>`).join('')}</ul>` : ''}
${nl.length ? `<h2>Landmarks nearby</h2><ul class="links">${nl.map(o => `<li><a href="/en/landmark/${o.id}">${esc(o.name)}</a></li>`).join('')}</ul>` : ''}
<p class="muted">Based on approximate historical borders; towns close to a frontier may be assigned to a neighbouring state.</p>`;
  const tn = `${name}${t[2] ? `, ${t[2]}` : ''}`;
  add(`/en/town/${x.slug}`, page({ url: `/en/town/${x.slug}`, title: [`What Country Was ${tn} In? Rulers from ${fyShort(SNAPS[0])} to Today`, `What Country Was ${tn} In? Rulers Through History`, `What Country Was ${tn} In?`, `What Country Was ${name} In? Rulers Through History`].find(t => t.length <= 62) || `What Country Was ${name} In?`,
    desc: cut(`${name} was ruled by ${uniq.slice(0, 4).join(', ')}${uniq.length > 4 ? ' and others' : ''}. See every state that held ${name} on historical border maps from ${fy(SNAPS[0])} to today.`),
    h1: `What Country Was ${esc(name)} In?`, crumbs: [['Home', '/'], ['Towns', '/en/towns'], [name, `/en/town/${x.slug}`]], body,
    ld: [{ '@context': 'https://schema.org', '@type': 'Place', name, address: where || undefined, geo: { '@type': 'GeoCoordinates', latitude: t[5], longitude: t[4] }, url: `${SITE}/en/town/${x.slug}` }] }));
}
// ---------- trade route pages ----------
const ROUTES = W.ROUTES || [];
for (const r of ROUTES) {
  const lls = r.pts.map(p => [p[0], p[1]]), rg = regionOfAll(lls.filter((_, i) => r.pts[i][2])), mid = Math.round((Math.max(r.y[0], -500) + r.y[1]) / 2), s = snapFor(mid);
  const P2 = PATHS[rg], line = P2({ type: 'LineString', coordinates: lls });
  const overlay = `<svg class="hl" viewBox="0 0 1200 800" aria-hidden="true"><path d="${line}" fill="none" stroke="${r.col}" stroke-width="4" stroke-dasharray="10 6" stroke-linecap="round"/>${r.pts.filter(p => p[2]).map(p => { const q = PROJS[rg]([p[0], p[1]]); return `<circle cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" r="5" fill="#fff" stroke="${r.col}" stroke-width="2.5"/>`; }).join('')}</svg>`;
  const named = r.pts.filter(p => p[2]);
  let km = 0; for (let i = 1; i < lls.length; i++) km += geoDistance(lls[i - 1], lls[i]) * R_KM;
  const snapsIn = SNAPS.filter(v => v >= r.y[0] && v <= r.y[1]), show = snapsIn.length > 4 ? [snapsIn[0], snapsIn[Math.floor(snapsIn.length / 3)], snapsIn[Math.floor((2 * snapsIn.length) / 3)], snapsIn.at(-1)] : snapsIn;
  const placeCell = p => { const c = CITIES.find(c => geoDistance(c.c, [p[0], p[1]]) * R_KM < 40); return c ? `<a href="/en/city/${c.id}">${esc(p[2])}</a>` : esc(p[2]); };
  const lead = `${r.n.en} (${fy(r.y[0])} – ${fy(r.y[1])}): ${r.d.en}`;
  const body = `<p class="lead">${esc(r.d.en)}</p>
${mapBlock(s, `Map of the ${r.n.en} in ${fy(s)}`, overlay, rg)}
${openBtn(`${hashYear(Math.max(-500, s))}-t-${r.id}${rg === 'europe' ? '' : `-r-${rg}`}`, `Open the ${r.n.en} in the interactive map`)}
<h2>Key facts</h2>
${table(['', ''], [['Active', `${fy(r.y[0])} – ${fy(r.y[1])} (approximate)`], ['Length shown on the map', `about ${(Math.round(km / 100) * 100).toLocaleString('en-US')} km`], ['Main stops', String(named.length)]])}
<h2>Stops along the ${esc(r.n.en)}</h2>
${table(['', 'Stop', ...show.map(v => `Ruled by in ${fy(v)}`)], named.map((p, i) => [String(i + 1), placeCell(p), ...show.map(v => stLink(polityAt([p[0], p[1]], v)))]))}
<p class="muted">The route is drawn schematically through its main stops; real caravans and ships used many variants. The state columns come from the border maps closest to each year.</p>
<h2>Other trade routes</h2><ul class="links">${ROUTES.filter(o => o !== r).map(o => `<li><a href="/en/route/${o.id}">${esc(o.n.en)}</a> · ${fy(o.y[0])}–${fy(o.y[1])}</li>`).join('')}</ul>`;
  add(`/en/route/${r.id}`, page({ url: `/en/route/${r.id}`, title: `${r.n.en} Map: Route, Stops and History | Chronica Maps`, desc: cut(lead), h1: `${esc(r.n.en)}: Route Map and History`,
    crumbs: [['Home', '/'], ['Trade routes', '/en/routes'], [r.n.en, `/en/route/${r.id}`]], body,
    ld: [{ '@context': 'https://schema.org', '@type': 'Article', headline: `${r.n.en}: Route Map and History`, inLanguage: 'en', dateModified: TODAY }] }));
}
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
{
  const byC = {}; for (const x of TOWN_PAGES) (byC[x.t[2] || 'Other'] ||= []).push(x);
  hub('/en/towns', 'Town Histories: What Country Was Each Town In?', 'Town Histories', `${TOWN_PAGES.length} towns and cities with the full sequence of states that ruled them from ${fy(SNAPS[0])} to today. Search any of ${TOWNS.t.length.toLocaleString('en-US')} towns with the town history tool.`,
    `<p><a class="btn" href="/town">Search any town</a></p>` + Object.keys(byC).sort().map(c => `<h2>${esc(c)}</h2><ul class="links cols">${byC[c].sort((a, b) => a.t[0].localeCompare(b.t[0])).map(x => `<li><a href="/en/town/${x.slug}">${esc(x.t[0])}</a></li>`).join('')}</ul>`).join(''), 'Towns');
}
hub('/tools', 'Free Interactive History Map Tools', 'Interactive History Map Tools', 'Free tools built on 2,500 years of historical border maps: a daily puzzle, a two-year comparison, town histories, true-size empires and animated border maps.',
  `<ul class="toolgrid">${[['/daily', 'Daily map puzzle', 'Guess the year of an unlabelled historical map in five tries, then share your score.'], ['/compare', 'Compare two years', 'Swipe between two border maps and see which states appeared, vanished, grew or shrank.'], ['/town', 'What country was my town in?', 'Search 7,000 towns for every state that ruled them since 500 BC.'], ['/size', 'True size of empires', 'Drag Rome, the Mongols or the Inca across the globe and compare them with modern countries.'], ['/animate', 'Animate changing borders', 'Make a GIF or a vertical video of borders changing in any region and period.'], ['/', 'The interactive atlas', 'Drag the timeline, open cities, battles, landmarks, journeys and trade routes.']].map(([u, t, d]) => `<li><a href="${u}"><b>${t}</b><span>${d}</span></a></li>`).join('')}</ul>`, 'Tools');
hub('/en/routes', 'Historical Trade Routes on a Map: Silk Road, Incense Route and More', 'Historical Trade Routes', `${ROUTES.length} trade and travel routes from the Persian Royal Road to the Cape Route, each with its stops and the states it crossed over time.`,
  table(['Route', 'Active'], [...ROUTES].sort((a, b) => a.y[0] - b.y[0]).map(r => [`<a href="/en/route/${r.id}">${esc(r.n.en)}</a>`, `${fy(r.y[0])} – ${fy(r.y[1])}`])), 'Trade routes');
hub('/en/battles', 'Historic Battles and Sites on a Map: Europe, Asia, Africa', 'Battles and Historic Sites', `${SITES.length} battles and historic sites from ${fy(Math.min(...SITES.map(s => s.y)))} to ${fy(Math.max(...SITES.map(s => s.y)))}, each placed on the border map of its time.`,
  byRegion([...SITES].sort((a, b) => a.y - b.y), s => s.c).map(([r, list]) => `<h2>${r === 'world' ? 'Elsewhere' : REGIONS[r].name}</h2>` + table(['Year', 'Battle or site'], list.map(s => [fy(s.y), `<a href="/en/battle/${s.id}">${esc(s.title)}</a>`]))).join(''), 'Battles & sites');
hub('/en/states', 'States and Empires in History: Maps Over Time', 'States and Empires', `${STATE_LIST.length} states and empires, from Rome and the Tang to the Mughals and the Inca, each with its territory over time.`,
  byRegion(STATE_LIST, s => s.ll).map(([r, list]) => `<h2>${r === 'world' ? 'Americas and elsewhere' : REGIONS[r].name}</h2><ul class="links cols">${list.map(s => `<li><span class="sw" style="background:${colorOf(s.n)}"></span><a href="/en/state/${s.slug}">${esc(s.name)}</a> · ${fyShort(s.maps[0].s)}–${fyShort(s.maps.at(-1).s)}</li>`).join('')}</ul>`).join(''), 'States');
hub('/en/journeys', 'Historical Journeys on a Map: Routes and Timelines', 'Historical Journeys', `${JOURNEYS.length} lives, voyages and campaigns traced stop by stop, from Alexander the Great and Xuanzang to Zheng He, Columbus and Napoleon.`,
  `<ul class="links">${JOURNEYS.map(j => `<li><a href="/en/journey/${j.id}">${esc(j.title)}</a> · ${esc(j.span)} · ${esc(j.who)}</li>`).join('')}</ul>`, 'Journeys');
hub('/en/eras', 'Eras of History by Region: Maps and Timelines', 'Eras of History', `${ALL_ERAS.length} periods of history in Europe, Asia, Africa, the Americas and Oceania, each with its maps, events and battles.`,
  ['europe', 'asia', 'africa', 'americas', 'oceania'].map(r => `<h2>${RNAME(r)}</h2>` + table(['Era', 'Period'], ALL_ERAS.filter(e => e.region === r).map(e => [`<a href="/en/era/${e.slug}">${esc(e.name)}</a>`, `${fy(e.from)}–${e.to >= 2026 ? 'today' : fy(e.to)}`]))).join(''), 'Eras');

// ---------- modern countries: who ruled the land of today's states ----------
const CNAME_OLD = { 'Zaire': 'Democratic Republic of the Congo', 'Tanzania, United Republic of': 'Tanzania', 'Russia': 'Russia', 'United States': 'United States', 'Myanmar': 'Myanmar', 'Korea, Republic of': 'South Korea', "Korea, Democratic People's Republic of": 'North Korea', 'Iran, Islamic Republic of': 'Iran', 'Syrian Arab Republic': 'Syria', 'Viet Nam': 'Vietnam', 'Lao People\'s Democratic Republic': 'Laos', 'Libyan Arab Jamahiriya': 'Libya', 'Czech Republic': 'Czech Republic', 'Macedonia': 'North Macedonia', 'Moldova, Republic of': 'Moldova', 'Ivory Coast': "Côte d'Ivoire", 'Swaziland': 'Eswatini', 'Burma': 'Myanmar' };
const COUNTRY_PAGES = [];
{
  const t0 = Date.now();
  for (const f of feats(2010)) {
    const raw = (f.properties.n || '').trim(); if (!raw || raw === 'Antarctica' || isTribal(raw)) continue;
    const name = CN2[raw] || polName(raw), b = f._b, pts = [];
    const cities = CITIES.filter(c => inB(b, c.c) && geoContains(f, c.c));
    if (f.properties.a < 3 && !cities.length) continue;
    const w = b[1][0] - b[0][0] < 0 ? b[1][0] + 360 - b[0][0] : b[1][0] - b[0][0], h = b[1][1] - b[0][1];
    for (let k = 7; pts.length < 30 && k <= 40; k += 6) { pts.length = 0; for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) { const ll = [((b[0][0] + (i + .5) * w / k + 540) % 360) - 180, b[0][1] + (j + .5) * h / k]; if (geoContains(f, ll)) pts.push(ll); } }
    const sample = [...cities.map(c => c.c), ...pts].slice(0, 48); if (sample.length < 3) continue;
    const rows = SNAPS.map(sn => { const cnt = new Map(); let none = 0; for (const ll of sample) { const n = polityAt(ll, sn); if (n && !isTribal(n)) cnt.set(n, (cnt.get(n) || 0) + 1); else none++; }
      return { s: sn, top: [...cnt].sort((a, b) => b[1] - a[1]).map(([n, c]) => ({ n, share: c / sample.length })), none: none / sample.length }; });
    const all = new Map(); for (const r of rows) for (const t of r.top) all.set(t.n, (all.get(t.n) || 0) + t.share);
    const states = [...all].sort((a, b) => b[1] - a[1]).map(x => x[0]);
    if (states.length < 3) continue;
    COUNTRY_PAGES.push({ raw, name, slug: slug(name), f, cities, rows, states, ll: geoCentroid(f) });
  }
  console.log(`countries: ${COUNTRY_PAGES.length} in ${Math.round((Date.now() - t0) / 1000)} s`);
}
const pct = x => `${Math.round(x * 100)}%`;
for (const C of COUNTRY_PAGES) {
  const url = `/en/country/${C.slug}`, rg = regionOf(C.ll), inC = ll => inB(C.f._b, ll) && geoContains(C.f, ll);
  const people = PEOPLE.filter(p => (p.c && inC(p.c)) || p.cities.some(c => C.cities.includes(c))).sort((a, b) => a.y[0] - b.y[0]);
  const sites = SITES.filter(x => inC(x.c)).sort((a, b) => a.y - b.y), lms = LMS.filter(m => inC(m.c));
  const big = C.states.slice(0, 6).map(polName), st = stateUrl(C.raw);
  const at = y => { const r = C.rows.find(r => r.s === snapFor(y)); return r && r.top[0] ? polName(r.top[0].n) : null; };
  const lead = `The land of today's ${C.name} appears on ${SNAPS.length} historical border maps from ${fy(SNAPS[0])} to today. Over that time it was held, in whole or in part, by ${C.states.length} different states, among them ${big.slice(0, 5).join(', ')}.`;
  const qa = [[`Which empires and states ruled the territory of ${C.name}?`, `On the border maps from ${fy(SNAPS[0])} to today, the largest shares of the territory of modern ${C.name} belonged to ${big.join(', ')}${C.states.length > 6 ? `, along with ${C.states.length - 6} other states` : ''}.`],
    ...[1000, 1500, 1900].filter(y => at(y)).map(y => [`What was ${C.name} part of in ${y}?`, `On the border map for ${fy(snapFor(y))}, most of the territory of today's ${C.name} lay within ${at(y)}.`])];
  const mapS = [snapFor(1000), snapFor(1700)];
  const body = `<p class="lead">${esc(lead)}</p>
${mapBlock(mapS[1], `Map of ${RNAME(rg)} in ${fy(mapS[1])}, showing the lands of today's ${C.name}`, pin(C.ll, C.name, rg), rg)}
${openBtn(`${hashYear(mapS[1])}${rg === 'europe' ? '' : `-r-${rg}`}`, `Explore the history of ${C.name} in the interactive map`)}
<p><a href="/compare#${rg}-${mapS[0]}-2010">Compare ${fy(mapS[0])} with today</a>${st ? ` · <a href="${st}">${esc(C.name)} as a state on the map</a>` : ''}</p>
<h2>Who ruled the land of ${esc(C.name)}, map by map</h2>
<p class="muted">Share of sample points inside today's borders held by each state on each map. Areas with no organised state on the map are left out.</p>
${table(['Map', 'Main states on this land'], C.rows.filter(r => r.top.length).map(r => [`<a href="${rg === 'europe' ? '/en/year/' : '/en/world/'}${yearSlug(r.s)}">${fy(r.s)}</a>`, r.top.slice(0, 3).map(t => `${stLink(t.n)} <span class="muted">${pct(t.share)}</span>`).join(' · ')]))}
${C.cities.length ? `<h2>Historic cities in ${esc(C.name)}</h2><ul class="links cols">${C.cities.map(c => `<li><a href="/en/city/${c.id}">${esc(c.name)}</a></li>`).join('')}</ul>` : ''}
${pBlock(`Famous people of ${esc(C.name)}`, people, 16)}
${sites.length ? `<h2>Battles and historic sites</h2>${table(['Year', 'Battle or site'], sites.map(x => [fy(x.y), `<a href="/en/battle/${x.id}">${esc(x.title)}</a>`]))}` : ''}
${lms.length ? `<h2>Landmarks</h2><ul class="lmgrid">${lms.map(lmCard).join('')}</ul>` : ''}
${faq(qa)}
${further(`History of ${C.name}`)}`;
  add(url, page({ url, title: [`History of ${C.name} on the Map: Who Ruled Its Lands`, `${C.name} History Map: Who Ruled Its Lands`, `History of ${C.name} on the Map`].find(t => t.length <= 62) || `${C.name}: History Map`,
    desc: cut(`${lead} See every map from ${fy(SNAPS[0])} to today, with its cities, people and battles.`), h1: `${esc(C.name)} Through History: Who Ruled Its Lands`,
    crumbs: [['Home', '/'], ['Countries', '/en/countries'], [C.name, url]], body,
    ld: [faqLd(qa), { '@context': 'https://schema.org', '@type': 'Article', headline: `${C.name} Through History`, about: { '@type': 'Country', name: C.name }, dateModified: TODAY, author: ORG, publisher: ORG }] }));
}
hub('/en/countries', 'History of Every Country on the Map: Who Ruled Its Lands', 'Countries Through History', `${COUNTRY_PAGES.length} modern countries, each with the empires and states that held its land on every map from ${fy(SNAPS[0])} to today, plus its historic cities, people and battles.`,
  byRegion([...COUNTRY_PAGES].sort((a, b) => a.name.localeCompare(b.name)), c => c.ll).map(([r, list]) => `<h2>${r === 'world' ? 'Elsewhere' : RNAME(r)}</h2><ul class="links cols">${list.map(c => `<li><a href="/en/country/${c.slug}">${esc(c.name)}</a></li>`).join('')}</ul>`).join(''), 'Countries');

// ---------- largest states on each map ----------
const LAND = 148.9e6, LAREA = {};
for (const st of Object.values(stInfo)) for (const m of st.maps) { const a = m.area > 2 * Math.PI * R_KM * R_KM ? 4 * Math.PI * R_KM * R_KM - m.area : m.area; ((LAREA[m.s] ||= {})[st.n] = (LAREA[m.s][st.n] || 0) + a); }
const ranked = sn => Object.entries(LAREA[sn] || {}).filter(([n]) => !/^(Antarctica|Greenland)$/.test(n)).sort((a, b) => b[1] - a[1]);
const lgUrl = sn => `/en/largest/${yearSlug(sn)}`;
for (const sn of SNAPS) {
  const url = lgUrl(sn), L = ranked(sn), top = L.slice(0, 20), i = SNAPS.indexOf(sn), prev = SNAPS[i - 1], next = SNAPS[i + 1];
  if (!top.length) continue;
  const regTop = ['europe', 'asia', 'africa', 'americas', 'oceania'].map(r => [r, L.filter(([n]) => { const st = Object.values(stInfo).find(x => x.n === n); const mp = st && st.maps.find(m => m.s === sn); return mp && regionOf(geoCentroid(mp.f)) === r; }).slice(0, 5)]).filter(x => x[1].length);
  const prevRank = prev ? Object.fromEntries(ranked(prev).map(([n], k) => [n, k + 1])) : {};
  const lead = `On the world border map for ${fy(sn)}, the largest state was ${polName(top[0][0])}, with about ${fmtKm2(top[0][1])} — some ${Math.round(100 * top[0][1] / LAND)}% of the world's land. ${top[1] ? `It was followed by ${polName(top[1][0])}${top[2] ? ` and ${polName(top[2][0])}` : ''}.` : ''}`;
  const qa = [[`What was the largest country in the world in ${fy(sn)}?`, `${polName(top[0][0])}, with about ${fmtKm2(top[0][1])}, on the border map for ${fy(sn)}.`],
    [`What were the five largest states in ${fy(sn)}?`, top.slice(0, 5).map(([n, a], k) => `${k + 1}. ${polName(n)} (${fmtKm2(a)})`).join('; ') + '.'],
    ...regTop.slice(0, 3).map(([r, l]) => [`What was the largest state in ${RNAME(r)} in ${fy(sn)}?`, `${polName(l[0][0])}, with about ${fmtKm2(l[0][1])}.`])];
  const body = `<p class="lead">${esc(lead)}</p>
${mapBlock(sn, `World map in ${fy(sn)}`, '', 'world')}
<h2>The 20 largest states in ${fy(sn)}</h2>
${table(['Rank', 'State', 'Area', 'Share of world land', prev ? `Rank in ${fy(prev)}` : ''], top.map(([n, a], k) => [k + 1, stLink(n), fmtKm2(a), `${(100 * a / LAND).toFixed(1)}%`, prev ? (prevRank[n] ? (prevRank[n] <= 20 ? prevRank[n] : '–') : '<span class="muted">new</span>') : '']))}
<p class="muted">Areas are measured from the border polygons of the map and are approximate; claimed areas, tributaries and unorganised land are not included.</p>
<h2>Largest states by region</h2>${regTop.map(([r, l]) => `<h3>${RNAME(r)}</h3>${table(['Rank', 'State', 'Area'], l.map(([n, a], k) => [k + 1, stLink(n), fmtKm2(a)]))}`).join('')}
${qaBlock('Questions', qa)}
<p>${prev ? `<a href="${lgUrl(prev)}">← Largest states in ${fy(prev)}</a>` : ''}${prev && next ? ' · ' : ''}${next ? `<a href="${lgUrl(next)}">Largest states in ${fy(next)} →</a>` : ''} · <a href="/en/largest-empires">Largest empires in history</a> · <a href="/en/world/${yearSlug(sn)}">The world in ${fy(sn)}</a></p>`;
  add(url, page({ url, title: `Largest Countries and Empires in ${fy(sn)}: Top 20 by Area`, desc: cut(lead), h1: `The Largest States in the World in ${fy(sn)}`,
    crumbs: [['Home', '/'], ['Largest empires', '/en/largest-empires'], [fy(sn), url]], body, ld: [qaLd(qa), { '@context': 'https://schema.org', '@type': 'ItemList', name: `Largest states in ${fy(sn)}`, itemListElement: top.map(([n], k) => ({ '@type': 'ListItem', position: k + 1, name: polName(n) })) }] }));
}
{
  const best = Object.values(stInfo).map(st => { let b = null; for (const s2 of new Set(st.maps.map(m => m.s))) { const a = LAREA[s2] && LAREA[s2][st.n]; if (a && (!b || a > b.a)) b = { s: s2, a }; } return b && { n: st.n, ...b }; })
    .filter(x => x && /^[A-Z]/.test(x.n) && !/^(Antarctica|Greenland|Russia|Russian Federation|Canada|United States|United States of America|China|Brazil|Kingdom of Brazil|Empire of Brazil|Australia|USSR|White Russia|Mongolia|Argentina|India|Kazakhstan)$/i.test(x.n) && x.s < 1950).sort((a, b) => b.a - a.a).slice(0, 50);
  const qa = [['What was the largest empire in history?', `On these maps, the largest state before 1950 is ${polName(best[0].n)}, with about ${fmtKm2(best[0].a)} on the map for ${fy(best[0].s)}. Area figures in history books differ because they count claimed land and dependencies differently; overseas empires such as the British appear on these maps as separate colonies, so they do not show as one state.`],
    ['What were the largest empires in history?', best.slice(0, 10).map((x, k) => `${k + 1}. ${polName(x.n)} (${fmtKm2(x.a)}, ${fy(x.s)})`).join('; ') + '.']];
  add('/en/largest-empires', page({ url: '/en/largest-empires', title: 'Largest Empires in History, Ranked by Map Area', desc: cut(`The 50 largest empires and states before 1950, ranked by the area they cover at their peak on the historical border maps, with links to the map of each year.`),
    h1: 'The Largest Empires in History', crumbs: [['Home', '/'], ['Largest empires', '/en/largest-empires']],
    body: `<p class="lead">The 50 largest states before 1950, each measured at its peak on the historical border maps from ${fy(SNAPS[0])} onward. Modern states are left out so the list shows historical empires.</p>
${table(['Rank', 'Empire or state', 'Peak area', 'Map year'], best.map((x, k) => [k + 1, stLink(x.n), fmtKm2(x.a), `<a href="${lgUrl(x.s)}">${fy(x.s)}</a>`]))}
<p class="muted">Overseas colonial empires, such as the British and French, are drawn on these maps as separate colonies and therefore do not appear as single entries. Areas come from the border polygons and are approximate. Ranking by area at a single map date can differ from figures quoted elsewhere, which may use a different peak year or include claimed territory.</p>
<h2>Largest states by year</h2><ul class="links cols">${SNAPS.filter(x => LAREA[x]).map(x => `<li><a href="${lgUrl(x)}">${fy(x)}</a></li>`).join('')}</ul>
${qaBlock('Questions', qa)}
<p><a href="/size">Compare the true size of empires</a></p>`,
    ld: [qaLd(qa), { '@context': 'https://schema.org', '@type': 'ItemList', name: 'Largest empires in history', itemListElement: best.slice(0, 20).map((x, k) => ({ '@type': 'ListItem', position: k + 1, name: polName(x.n) })) }] }));
}

// ---------- people ----------
for (const p of PEOPLE) {
  const url = `/en/person/${p.id}`, clampY = y => Math.max(-500, Math.min(2025, y)), mid = clampY(Math.round((p.y[0] + p.y[1]) / 2));
  const rg = p.ll ? regionOf(p.ll) : 'world', s = snapFor(mid);
  const places = [...(p.c ? [{ name: p.pl.en, ll: p.c, url: null }] : []), ...p.cities.map(c => ({ name: c.name, ll: c.c, url: `/en/city/${c.id}` }))];
  const sb = snapFor(clampY(p.y[0])), sd = snapFor(clampY(p.y[1]));
  const rule = p.y[1] >= -500 ? places.map(x => { const a = polityAt(x.ll, sb), b = polityAt(x.ll, sd); return [x.url ? `<a href="${x.url}">${esc(x.name)}</a>` : esc(x.name), stLink(a), a === b ? '<span class="muted">same</span>' : stLink(b)]; }) : [];
  const evs = p.cities.flatMap(c => c.ev.filter(e => e.y >= p.y[0] && e.y <= p.y[1]).map(e => [fy(e.y), esc(e.t), `<a href="/en/city/${c.id}">${esc(c.name)}</a>`]));
  const sites = SITES.filter(x => x.y >= p.y[0] && x.y <= p.y[1] && p.ll && geoDistance(x.c, p.ll) * R_KM < 1500).sort((a, b) => a.y - b.y).slice(0, 8);
  const ov = q => Math.min(p.y[1], q.y[1]) - Math.max(p.y[0], q.y[0]);
  const cont = PEOPLE.filter(q => q.id !== p.id && ov(q) >= 15).sort((a, b) => ov(b) - ov(a) || a.y[0] - b.y[0]).slice(0, 10);
  const her = /\b(she|her|Queen|Empress)\b/.test(p.bio + p.role) ? 'her' : 'his';
  const qa = [];
  if (places.length) qa.push([`Where did ${p.name} live?`, `On the map, ${p.name} is linked with ${places.map(x => x.name).join(', ')}.`]);
  if (p.y[0] >= -500 && p.y[0] - sb <= 40 && places.length) { const n0 = polityAt(places[0].ll, sb); if (n0 && !isTribal(n0)) qa.push([`What country was ${places[0].name} part of when ${p.name} was born?`, `Around ${fy(p.y[0])}, ${places[0].name} lay within ${art(polName(n0))} (border map for ${fy(sb)}).`]); }
  if (!p.ca) { const age = p.y[1] - p.y[0] - (p.y[0] < 0 && p.y[1] > 0 ? 1 : 0); qa.push([`How old was ${p.name} at death?`, `${p.name} lived from ${fy(p.y[0])} to ${fy(p.y[1])} and died at about ${age}.`]); }
  if (cont.length) qa.push([`Who lived at the same time as ${p.name}?`, `Contemporaries on the map include ${cont.slice(0, 6).map(q => `${q.name} (${lifeY(q)})`).join(', ')}.`]);
  const body = `<p class="lead">${esc(p.bio)}</p>
${table(['', ''], [['Lived', lifeY(p)], ['Known as', esc(p.role)], ...(p.place ? [['Birthplace or main place', esc(p.place)]] : []), ...(p.cities.length ? [['Places on the map', p.cities.map(c => `<a href="/en/city/${c.id}">${esc(c.name)}</a>`).join(', ')]] : [])])}
${p.ll ? mapBlock(s, `Map of the world around ${p.name} in ${fy(s)}`, pin(p.ll, p.place || p.name, rg), rg) : ''}
${openBtn(`${hashYear(clampY(p.y[0] + 30 > p.y[1] ? p.y[0] : p.y[0] + 30))}-h-${p.id}${rg === 'europe' || rg === 'world' ? '' : `-r-${rg}`}`, `See the world of ${p.name} in the interactive map`)}
${p.y[0] < -500 ? `<p class="muted">${esc(p.name)} lived before the earliest border map (${fy(SNAPS[0])}); the map above shows the oldest snapshot available.</p>` : ''}
${rule.length ? `<h2>Who ruled these places in ${her} lifetime</h2>${table([`Place`, `At birth (map of ${fy(sb)})`, `At death (map of ${fy(sd)})`], rule)}<p class="muted">From the border maps nearest to each date; borders are approximate.</p>` : ''}
${evs.length ? `<h2>Events in ${her} lifetime</h2>${table(['Year', 'Event', 'Where'], evs.sort((a, b) => parseInt(a[0]) - parseInt(b[0])))}` : ''}
${sites.length ? `<h2>Battles and sites of the time</h2><ul class="links">${sites.map(x => `<li><a href="/en/battle/${x.id}">${esc(x.title)}</a> · ${fy(x.y)}</li>`).join('')}</ul>` : ''}
${qaBlock('Questions', qa)}
${further(p.name)}
${cont.length ? `<h2>Contemporaries</h2>${table(['Lived', 'Person', ''], cont.map(q => [lifeY(q), `<a href="/en/person/${q.id}">${esc(q.name)}</a>`, esc(q.role)]))}` : ''}`;
  const ld = { '@context': 'https://schema.org', '@type': 'Person', name: p.name, alternateName: p.n.zh, description: p.bio, jobTitle: p.role, url: SITE + url };
  if (p.y[0] > 0 && !p.ca) ld.birthDate = String(p.y[0]).padStart(4, '0');
  if (p.y[1] > 0 && !p.ca) ld.deathDate = String(p.y[1]).padStart(4, '0');
  if (p.place) ld.birthPlace = { '@type': 'Place', name: p.place };
  add(url, page({ url, title: `${p.name} (${p.ca ? 'c. ' : ''}${fyShort(p.y[0])}–${fyShort(p.y[1])}): Life, Places & Map | Chronica Maps`,
    desc: cut(`${p.bio} Places, contemporaries and who ruled ${her} world, on a historical map.`),
    h1: esc(p.name), crumbs: [['Home', '/'], ['People', '/en/people'], [p.name, url]], body, ld: [ld, ...(qa.length ? [qaLd(qa)] : [])] }));
}
hub('/en/people', 'Famous People in History: Lives on the Map', 'Famous People in History', `${PEOPLE.length} rulers, thinkers, artists, travellers and reformers from Hammurabi to Mandela, each placed on the map of their time with the cities they are linked to.`,
  byRegion([...PEOPLE].filter(p => p.ll).sort((a, b) => a.y[0] - b.y[0]), p => p.ll).map(([r, list]) => `<h2>${r === 'world' ? 'Elsewhere' : RNAME(r)}</h2>` + table(['Lived', 'Person', ''], list.map(p => [lifeY(p), `<a href="/en/person/${p.id}">${esc(p.name)}</a>`, esc(p.role)]))).join(''), 'People');

// ---------- about, guide, featured topics, anniversaries ----------
const md = t => esc(t).replace(/\[([^\]]+)\]\((\/[^)\s]*)\)/g, '<a href="$2">$1</a>');
add('/about', page({ url: '/about', title: 'About Chronica Maps: An Interactive Historical Atlas', ogType: 'website',
  desc: 'Chronica Maps is a free interactive atlas of world history: 2,500 years of borders, cities, battles, landmarks, journeys and trade routes. Sources, methods and how to cite.',
  h1: 'About Chronica Maps', crumbs: [['Home', '/'], ['About', '/about']],
  body: `<p class="lead">Chronica Maps is a free interactive atlas of world history. Drag a timeline from ${fy(SNAPS[0])} to today and watch the borders of Europe, Asia, Africa, the Americas and Oceania change, with the cities, battles, landmarks, journeys and trade routes of each period placed on the map of its time.</p>
<h2>What the atlas contains</h2>
<ul class="links"><li><a href="/en/world">${SNAPS.length} border maps</a> from ${fy(SNAPS[0])} to ${fy(SNAPS.at(-1))}</li><li><a href="/en/cities">${CITIES.length} historic cities</a> with timelines and the states that ruled them</li><li><a href="/en/battles">${SITES.length} battles and historic sites</a> and ${EVENTS.length} dated events</li><li><a href="/en/landmarks">${LMS.length} landmarks</a> shown then and now</li><li><a href="/en/journeys">${JOURNEYS.length} journeys</a> and <a href="/en/routes">${ROUTES.length} trade routes</a></li><li><a href="/en/towns">${TOWN_PAGES.length} town histories</a>, and a search over ${TOWNS.t.length.toLocaleString('en-US')} towns</li><li>Five free <a href="/tools">tools</a>: a daily puzzle, a two-year comparison, town history, true size of empires and border animations</li></ul>
<p>The interface is available in English, German, French, Spanish and Chinese (simplified and traditional).</p>
<h2 id="sources-and-method">Sources and method</h2>
<p>State borders come from the open <a href="https://github.com/aourednik/historical-basemaps">historical-basemaps</a> dataset (GPL-3.0), with some names corrected where a snapshot used a state that did not yet exist or no longer existed. Coastlines, lakes and rivers come from <a href="https://www.naturalearthdata.com/">Natural Earth</a>, and town positions from Natural Earth populated places. Landmark photographs come from Wikimedia Commons; each image is credited with its author and licence on its page.</p>
<p>The texts on cities, battles, landmarks and routes are written for this atlas and summarise standard reference works.</p>
<h2 id="how-the-content-is-made">How the content is made</h2>
<p>Every city, battle, person and landmark text is written for this atlas from standard reference works and checked against at least one general reference, such as Encyclopaedia Britannica or Wikipedia, which each page links under Further reading. Dates follow the most widely accepted convention; where historians disagree or a date is traditional, the page says so or marks it with “c.”. The tables of rulers and “who ruled here” are calculated from the border maps, not typed by hand, so they change whenever the map data is corrected.</p>
<p>The English pages are the reference version. The German, French and Spanish texts inside the interactive map are machine translations of the English and may contain errors; the Chinese texts were written separately.</p>
<h2 id="corrections">Corrections</h2>
<p>History maps are never finished. When an error is found, the data is corrected at the source and every page that uses it is rebuilt; the date at the foot of each page shows when it was last rebuilt.</p>
<h2>How accurate are the borders?</h2>
<p>Every map is a snapshot of one year, and the gaps between snapshots can be long. Pre-modern borders were rarely fixed lines: many areas were contested, held through tributaries, or not governed by any state at all. Treat the borders as schematic approximations. Where a place lies near a frontier, the atlas may assign it to a neighbouring state. If you spot an error, the dataset is open and corrections are welcome.</p>
<h2 id="using-and-citing-the-maps">Using and citing the maps</h2>
<p>You may link to any page and embed the interactive map on blogs, course sites and school pages with the embed code shown under each map; please keep the credit line. Animations made with the <a href="/animate">animation tool</a> are free to share with the chronicamaps.com credit visible.</p>
<p>Suggested citation: <i>Chronica Maps: Interactive Historical Atlas</i>, ${SITE}, accessed [date].</p>
<h2>Credits</h2>
<p>Maps are drawn with <a href="https://d3js.org/">D3</a>.</p>
<p><a class="btn" href="/">Open the interactive map</a> <a class="btn" href="/guide">How to use it</a></p>`,
  ld: [{ '@context': 'https://schema.org', '@type': 'AboutPage', name: 'About Chronica Maps', url: SITE + '/about', about: ORG }, { '@context': 'https://schema.org', ...ORG }] }));
{
  const G = [
    ['Move through time', 'Drag the timeline at the bottom of the screen, or press ▶ to play the maps in order. The era bands above the timeline jump to the start of a period. On a keyboard, the left and right arrow keys step one map back or forward.', 'Europe in 1453 with the timeline at the bottom', `y1453`],
    ['Open a city, battle or landmark', 'Click a dot to open its card: a short history, the states that ruled the place over time, and links to nearby places. Click an empty spot of land, or double-click anywhere, to see who ruled that exact point.', 'The Istanbul card in the interactive map', `y1453-c-istanbul`],
    ['Switch region', 'The region buttons at the top zoom to Europe, Asia, Africa, the Americas or Oceania, or show the whole world. You can also scroll or pinch to zoom and drag to pan.', 'The world in 1500', `y1500-r-world`],
    ['Follow a journey', 'Under the journeys layer you can follow Alexander, Genghis Khan, Marco Polo, Zheng He, Columbus, Napoleon and others stop by stop. The map moves to each stop and the year changes with it.', 'Napoleon’s journey on the map', `p-napoleon`],
    ['See landmarks then and now', 'Landmarks such as the Taj Mahal, the Colosseum and the Great Wall show a historical view next to a photo of the site today.', 'The Taj Mahal landmark card', `y1700-m-taj-mahal`],
    ['Turn on trade routes', 'The trade routes layer draws the Silk Road, the Incense Route, the Hanseatic routes and others for the years they were active. Click a route for its stops and history.', 'The Silk Road on the map of Asia in 800', `y800-t-silk-road-r-asia`],
    ['Test yourself', 'The quiz mode asks you to find cities and states on the map of a given year. There is also a <a href="/daily">daily puzzle</a> where you guess the year of an unlabelled map.', 'The map quiz', `quiz`],
    ['Compare with today', 'Turn on modern borders to draw today’s countries over any historical map, or previous borders to see what changed since the last map. For a side-by-side view, use the <a href="/compare">compare tool</a>.', 'Europe in 1914 with modern borders overlaid', `y1914`]];
  const qa = [['Is Chronica Maps free?', 'Yes. The map, the tools and all pages are free to use, with no account needed.'], ['Does it work on phones?', 'Yes. Pinch to zoom, drag to pan and tap a place to open its card. The timeline sits at the bottom of the screen.'], ['Can I link to a specific year or place?', 'Yes. The address bar updates as you move, so you can copy it to share the exact year, region and card you are looking at.'], ['Can I use the map in class or on my website?', 'Yes. Most pages have an <i>Embed this interactive map</i> box with code you can paste into a blog or course page.']];
  add('/guide', page({ url: '/guide', title: 'How to Use the Interactive History Map: A Quick Guide | Chronica Maps', ogImage: '/guide-1.jpg',
    desc: 'A step-by-step guide to the Chronica Maps interactive historical atlas: the timeline, city and battle cards, regions, journeys, landmarks, trade routes, the quiz and modern borders.',
    h1: 'How to Use the Interactive Map', crumbs: [['Home', '/'], ['Guide', '/guide']],
    body: `<p class="lead">Chronica Maps shows 2,500 years of borders on one map. These eight steps cover everything it can do; each takes under a minute to try.</p>
<ol class="toc">${G.map((g, i) => `<li><a href="#step-${i + 1}">${g[0]}</a></li>`).join('')}</ol>
${G.map((g, i) => `<section class="step" id="step-${i + 1}"><h2>${i + 1}. ${g[0]}</h2><p>${g[1]}</p><figure class="shot"><img src="/guide-${i + 1}.jpg" width="1200" height="750" alt="${esc(g[2])}" loading="${i ? 'lazy' : 'eager'}" decoding="async"></figure><p><a href="/#${g[3]}-l-en">Try it →</a></p></section>`).join('\n')}
<h2>Keyboard shortcuts</h2>${table(['Key', 'Action'], [['← →', 'Previous or next map (with Shift: ten years)'], ['Space', 'Play or pause'], ['/', 'Search places'], ['Esc', 'Close a card']])}
${faq(qa)}
<p><a class="btn" href="/">Open the interactive map</a></p>`,
    ld: [{ '@context': 'https://schema.org', '@type': 'HowTo', name: 'How to use the Chronica Maps interactive historical map', image: SITE + '/guide-1.jpg', step: G.map((g, i) => ({ '@type': 'HowToStep', position: i + 1, name: g[0], text: g[1].replace(/<[^>]+>/g, ''), image: `${SITE}/guide-${i + 1}.jpg`, url: `${SITE}/guide#step-${i + 1}` })) }, faqLd(qa)] }));
}
for (const f of FEAT) {
  const [y, rg] = f.map, url = `/en/topics/${f.slug}`;
  add(url, page({ url, title: `${f.title} | Chronica Maps`, desc: cut(f.desc), h1: esc(f.title), crumbs: [['Home', '/'], ['Featured', '/en/topics'], [f.title, url]],
    body: `<p class="muted">Published ${fdate(f.date)}</p><p class="lead">${esc(f.desc)}</p>
${mapBlock(y, `${RNAME(rg)} in ${fy(y)}`, '', rg)}
${f.body.map(p => `<p>${md(p)}</p>`).join('\n')}
${openBtn(`${hashYear(y)}${rg === 'europe' ? '' : `-r-${rg}`}`, `Open ${fy(y)} in the interactive map`)}
${f.links?.length ? `<h2>Related</h2><ul class="links">${f.links.map(([t, u]) => `<li><a href="${u}">${esc(t)}</a></li>`).join('')}</ul>` : ''}`,
    ld: [{ '@context': 'https://schema.org', '@type': 'Article', headline: f.title, description: f.desc, datePublished: f.date, dateModified: f.date, image: `${SITE}${ogUrl(snapFor(y), rg)}`, author: ORG, publisher: ORG, mainEntityOfPage: SITE + url }] }));
}
const ANN_YEARS = []; for (let y = 2026; y <= new Date().getUTCFullYear() + 1; y++) ANN_YEARS.push(y);
hub('/en/topics', 'Featured History Topics and Map Stories', 'Featured Topics', 'Map stories on anniversaries and questions in the news: how wars, treaties and empires changed the map, with border maps you can compare and explore.',
  `<ul class="toolgrid">${FEAT.map(f => `<li><a href="/en/topics/${f.slug}"><b>${esc(f.title)}</b><span>${esc(f.desc)}</span></a></li>`).join('')}</ul><h2>Anniversaries</h2><ul class="links">${ANN_YEARS.map(y => `<li><a href="/en/anniversaries/${y}">History anniversaries in ${y}</a></li>`).join('')}</ul>`, 'Featured');
const ord = n => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');
for (const Y of ANN_YEARS) {
  const items = [];
  const push = (y, html) => { const d = Y - y; if (y > 0 && d > 0 && d % 25 === 0) items.push({ d, y, html }); };
  for (const s of SITES) push(s.y, `<a href="/en/battle/${s.id}">${esc(s.title)}</a>`);
  for (const e of EVENTS) push(e.y, `${esc(e.t)}${e.place ? ` · ${placeLink(e.place)}` : ''}`);
  for (const c of CITIES) for (const e of c.ev || []) push(e.y, `${esc(e.t)} · <a href="/en/city/${c.id}">${esc(c.name)}</a>`);
  for (const m of LMS) if (typeof m.y === 'number') push(m.y, `<a href="/en/landmark/${m.id}">${esc(m.name)}</a> (built or begun)`);
  const seen = new Set(), uniq = items.filter(x => { const k = x.y + '|' + x.html.replace(/<[^>]+>/g, '').slice(0, 40); return seen.has(k) ? false : seen.add(k); });
  const groups = [...new Set(uniq.map(x => x.d))].sort((a, b) => { const r = d => (d % 100 === 0 ? 0 : d % 50 === 0 ? 1 : 2); return r(a) - r(b) || a - b; });
  const featHere = FEAT.filter(f => f.date.startsWith(String(Y)));
  hub(`/en/anniversaries/${Y}`, `History Anniversaries in ${Y}: Battles, Events and Landmarks`, `History Anniversaries in ${Y}`,
    `${uniq.length} events, battles and landmarks from the atlas that reach a round anniversary in ${Y}, from the ${ord(Math.min(...groups))} to the ${ord(Math.max(...groups))}, each linked to the map of its time.`,
    `${featHere.length ? `<p>Featured: ${featHere.map(f => `<a href="/en/topics/${f.slug}">${esc(f.title)}</a>`).join(' · ')}</p>` : ''}${groups.map(d => `<h2>${ord(d)} anniversary (${fy(Y - d)})</h2><ul class="links">${uniq.filter(x => x.d === d).map(x => `<li>${x.html}</li>`).join('')}</ul>`).join('')}<p>Other years: ${ANN_YEARS.filter(y => y !== Y).map(y => `<a href="/en/anniversaries/${y}">${y}</a>`).join(' · ')}</p>`, 'Anniversaries');
}
hub('/en', 'Historical World Atlas: Maps, Cities, Battles & Timelines', 'Historical Atlas of the World', 'Browse 2,500 years of history in Europe, Asia, Africa and Oceania by year, city, battle, state, era and historical journey, or open the interactive map and drag the timeline.',
  `${openBtn('y1453', 'Open the interactive map')}<ul class="links">${NAV.map(([t, u]) => `<li><a href="${u}">${t}</a></li>`).join('')}<li><a href="/en/quiz">Map quiz</a></li></ul>`, 'Explore');

// ---------- 404 ----------
add('/404', page({ url: '/404', title: 'Page Not Found | Chronica Maps', desc: 'This page does not exist. Open the interactive historical map or browse cities, people, battles and maps by year.', h1: 'Page not found', noindex: true, crumbs: [['Home', '/'], ['Not found', '/404']],
  body: `<p class="lead">This page does not exist, or it has moved. Try one of these instead:</p><ul class="toolgrid">${[['/', 'Interactive map', 'Drag the timeline from 500 BC to today.'], ['/en/world', 'World maps by year', `${SNAPS.length} border maps of the world.`], ['/en/cities', 'Historic cities', `${CITIES.length} cities with former names and timelines.`], ['/en/people', 'Famous people', `${PEOPLE.length} lives placed on the map.`], ['/town', 'What country was my town in?', 'Search 7,000 towns.'], ['/en/topics', 'Featured topics', 'Map stories and anniversaries.']].map(([u, t, d]) => `<li><a href="${u}"><b>${t}</b><span>${d}</span></a></li>`).join('')}</ul>` }));
pages.at(-1).noSitemap = true;

// ---------- write output ----------
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const SKIP = new Set(['build.mjs', 'package.json', 'package-lock.json', 'vercel.json', 'README.md', 'node_modules', 'dist', '.git', '.vercel', 'robots.txt', 'sitemap.xml', 'atlas.json']);
for (const f of fs.readdirSync(ROOT)) if (!SKIP.has(f) && !f.startsWith('.') && fs.statSync(path.join(ROOT, f)).isFile()) fs.copyFileSync(path.join(ROOT, f), path.join(OUT, f));
const write = (rel, data) => { const p = path.join(OUT, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, data); };
for (const p of pages) write(p.url + '.html', p.html);
// cache-busting: stamp script URLs in the app shell with this build's version
write('index.html', fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').replace(/__V__/g, VER));
for (const s of SNAPS) NEED.add(`europe|${s}`), NEED.add(`world|${s}`);
const SVGS = new Map();
for (const k of NEED) { const [r, s] = k.split('|'); const svg = mapSVG(+s, r); SVGS.set(k, svg); write(mapUrl(+s, r).slice(1), svg); }
// social preview images (1200×630 JPEG) for every map used on a page
try {
  const { Resvg } = await import('@resvg/resvg-js');
  const sharp = (await import('sharp')).default;
  const FD = path.join(ROOT, 'node_modules/dejavu-fonts-ttf/ttf/');
  const fontOpts = { fontFiles: [FD + 'DejaVuSerif.ttf', FD + 'DejaVuSerif-Bold.ttf'], loadSystemFonts: false, defaultFontFamily: 'DejaVu Serif', serifFamily: 'DejaVu Serif' };
  fs.mkdirSync(path.join(OUT, 'og'), { recursive: true });
  fs.mkdirSync(path.join(OUT, 'maps/img'), { recursive: true });
  let n = 0;
  for (const [k, svg] of SVGS) {
    const [r, s] = k.split('|'), title = r === 'world' ? `The world in ${fy(+s)}` : `${r === 'americas' ? 'The Americas' : REGIONS[r].name} in ${fy(+s)}`;
    const inner = svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
    const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><svg width="1200" height="630" viewBox="0 85 1200 630" preserveAspectRatio="xMidYMid slice">${inner}</svg><rect y="540" width="1200" height="90" fill="#2b2118" fill-opacity=".9"/><text x="40" y="598" font-family="DejaVu Serif" font-weight="bold" font-size="42" fill="#f6e9cf">${esc(title)}</text><text x="1160" y="597" text-anchor="end" font-family="DejaVu Serif" font-size="26" fill="#e3c9a0">chronicamaps.com</text></svg>`;
    const png = new Resvg(og, { font: fontOpts }).render().asPng();
    const full = svg.replace(/<\/svg>\s*$/, `<rect x="760" y="770" width="440" height="30" fill="#efe4cb" opacity=".8"/><text x="1188" y="791" text-anchor="end" font-family="DejaVu Serif" font-size="15" fill="#3a2a1a">${esc(title)} · chronicamaps.com</text></svg>`);
    await sharp(new Resvg(full, { font: fontOpts }).render().asPng()).webp({ quality: 76 }).toFile(path.join(OUT, imgUrl(+s, r).slice(1)));
    await sharp(png).jpeg({ quality: 78, mozjpeg: true }).toFile(path.join(OUT, ogUrl(+s, r).slice(1)));
    n++;
  }
  console.log(`og images: ${n}`);
} catch (e) { console.warn('og images skipped:', e.message); }
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
// self-hosted vendor files: D3 and the Latin display font (CJK fonts load from Google only for Chinese UI)
{
  const V = path.join(OUT, 'vendor'); fs.mkdirSync(path.join(V, 'fonts'), { recursive: true });
  fs.copyFileSync(path.join(ROOT, 'node_modules/d3/dist/d3.min.js'), path.join(V, 'd3.min.js'));
  fs.copyFileSync(path.join(ROOT, 'node_modules/gifenc/dist/gifenc.esm.js'), path.join(V, 'gifenc.esm.js'));
  const FD = path.join(ROOT, 'node_modules/@fontsource/cormorant-garamond/files');
  const ranges = { latin: 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD', 'latin-ext': 'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF' };
  let css = '';
  for (const [w, st] of [[500, 'normal'], [700, 'normal'], [500, 'italic']]) for (const sub of ['latin-ext', 'latin']) {
    const f = `cormorant-garamond-${sub}-${w}-${st}.woff2`; fs.copyFileSync(path.join(FD, f), path.join(V, 'fonts', f));
    css += `@font-face{font-family:'Cormorant Garamond';font-style:${st};font-weight:${w};font-display:swap;src:url(/vendor/fonts/${f}) format('woff2');unicode-range:${ranges[sub]}}\n`;
  }
  write('vendor/fonts.css', css);
}
write('favicon.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="10" fill="#a8322a"/><text x="32" y="45" text-anchor="middle" font-family="Georgia,serif" font-size="40" font-weight="700" fill="#f6e9cf">C</text></svg>`);
{ // raster favicons: Google search needs a crawlable icon in a multiple of 48 px
  const { Resvg } = await import('@resvg/resvg-js'); const FD2 = path.join(ROOT, 'node_modules/dejavu-fonts-ttf/ttf/');
  const fsvg = s => `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 64 64"><rect width="64" height="64" rx="${s <= 32 ? 8 : 12}" fill="#a8322a"/><text x="32" y="46" text-anchor="middle" font-family="DejaVu Serif" font-size="42" font-weight="700" fill="#f6e9cf">C</text></svg>`;
  const png = s => new Resvg(fsvg(s), { font: { fontFiles: [FD2 + 'DejaVuSerif-Bold.ttf'], loadSystemFonts: false, defaultFontFamily: 'DejaVu Serif' } }).render().asPng();
  for (const [s, f] of [[48, 'favicon-48x48.png'], [96, 'favicon-96x96.png'], [180, 'apple-touch-icon.png'], [192, 'icon-192.png'], [512, 'icon-512.png']]) fs.writeFileSync(path.join(OUT, f), png(s));
  const ims = [16, 32, 48].map(s => ({ s, b: png(s) })), hd = Buffer.alloc(6 + 16 * ims.length); hd.writeUInt16LE(0, 0); hd.writeUInt16LE(1, 2); hd.writeUInt16LE(ims.length, 4);
  let off = hd.length; ims.forEach((im, i) => { const o = 6 + 16 * i; hd.writeUInt8(im.s, o); hd.writeUInt8(im.s, o + 1); hd.writeUInt16LE(1, o + 4); hd.writeUInt16LE(32, o + 6); hd.writeUInt32LE(im.b.length, o + 8); hd.writeUInt32LE(off, o + 12); off += im.b.length; });
  fs.writeFileSync(path.join(OUT, 'favicon.ico'), Buffer.concat([hd, ...ims.map(i => i.b)]));
  write('site.webmanifest', JSON.stringify({ name: 'Chronica Maps', short_name: 'Chronica Maps', icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: '/icon-512.png', sizes: '512x512', type: 'image/png' }], theme_color: '#a8322a', background_color: '#f3e9d2', display: 'standalone', start_url: '/' }));
}
const urls = ['/', ...pages.filter(p => !p.noSitemap).map(p => p.url)];
const IMGS = Object.fromEntries(LMS.map(m => [`/en/landmark/${m.id}`, m.imgs || []]));
for (const p of pages) { const l = [...new Set([...p.html.matchAll(/src="(\/maps\/img\/[^"]+\.webp)"/g)].map(m => m[1]))]; if (l.length) IMGS[p.url] = [...(IMGS[p.url] || []), ...l.map(u => ({ t960: SITE + u }))]; }
const SECT = u => u === '/' ? 'core' : (u.match(/^\/en\/(country|largest|city|person|town|state|battle|landmark|landmarks|year|world|era|journey|route|topics)\//) || [, 'core'])[1].replace(/^landmarks$/, 'landmark');
const smGroups = {}; for (const u of urls) (smGroups[SECT(u)] ||= []).push(u);
for (const [g, list] of Object.entries(smGroups)) write(`sitemap-${g}.xml`, `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${list.map(u => `  <url><loc>${SITE}${u}</loc><lastmod>${TODAY}</lastmod>${(IMGS[u] || []).map(i => `<image:image><image:loc>${esc(i.t960 || i.t500)}</image:loc></image:image>`).join('')}</url>`).join('\n')}\n</urlset>\n`);
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${Object.keys(smGroups).map(g => `  <sitemap><loc>${SITE}/sitemap-${g}.xml</loc><lastmod>${TODAY}</lastmod></sitemap>`).join('\n')}\n</sitemapindex>\n`);
write('feed.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>Chronica Maps: Featured topics</title><link>${SITE}/en/topics</link><atom:link href="${SITE}/feed.xml" rel="self" type="application/rss+xml"/><description>Map stories on history anniversaries and questions in the news.</description><language>en</language>\n${[...FEAT].sort((a, b) => b.date.localeCompare(a.date)).map(f => `<item><title>${esc(f.title)}</title><link>${SITE}/en/topics/${f.slug}</link><guid>${SITE}/en/topics/${f.slug}</guid><pubDate>${new Date(f.date + 'T08:00:00Z').toUTCString()}</pubDate><description>${esc(f.desc)}</description></item>`).join('\n')}\n</channel></rss>\n`);
write('llms.txt', `# Chronica Maps\n\n> Free interactive historical atlas of the world: ${SNAPS.length} border maps from ${fy(SNAPS[0])} to today, with ${CITIES.length} historic cities, ${SITES.length} battles and sites, ${LMS.length} landmarks, ${PEOPLE.length} famous people, ${JOURNEYS.length} journeys and ${ROUTES.length} trade routes. Every page is static HTML in English. Borders are schematic approximations based on the open historical-basemaps dataset (GPL-3.0).\n\n## Main sections\n- [Interactive map](${SITE}/): drag the timeline; deep links like ${SITE}/#y1453-c-istanbul\n- [World maps by year](${SITE}/en/world)\n- [Europe by year](${SITE}/en/years)\n- [Historic cities](${SITE}/en/cities): former names, timelines and who ruled each city\n- [Famous people](${SITE}/en/people): lives, places and contemporaries\n- [States and empires](${SITE}/en/states): territory over time\n- [Battles and sites](${SITE}/en/battles)\n- [Landmarks then and now](${SITE}/en/landmarks)\n- [Journeys](${SITE}/en/journeys) and [trade routes](${SITE}/en/routes)\n- [Eras](${SITE}/en/eras)\n- [Town histories](${SITE}/en/towns): what country was each town in\n- [Featured topics](${SITE}/en/topics)\n\n## Tools\n- [Daily map puzzle](${SITE}/daily)\n- [Compare two years](${SITE}/compare)\n- [What country was my town in?](${SITE}/town)\n- [True size of empires](${SITE}/size)\n- [Animate borders](${SITE}/animate)\n\n## About\n- [About, sources and how to cite](${SITE}/about)\n- [How to use the map](${SITE}/guide)\n`);
write('data/tools-meta.json', TOOLS_META);
write('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);
console.log(`Built ${pages.length} pages + ${SNAPS.length} maps → dist/`);
