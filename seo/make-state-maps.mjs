// Rebuild the six state illustrations from the same local geography used by the atlas.
// Run from the repository root with: node seo/make-state-maps.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { geoPath, geoProjection } from 'd3-geo';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = name => JSON.parse(fs.readFileSync(path.join(here, '..', name), 'utf8'));
const atlas = read('atlas.json');
const physical = read('physical.json');
const output = path.join(here, 'assets');
const radians = Math.PI / 180;
const width = 800, height = 604;
const frame = { left: 14, right: 786, top: 75, bottom: 513 };
const sea = '#d6e6e4', land = '#f0ead9', shade = '#a8c3a1', outline = '#345946';
const ink = '#24372f', muted = '#4f625a', paper = '#fff9e9';
const xml = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');

const maps = [
  {
    key: 'greek-city-states', name: 'Greek city-states', years: [-500],
    box: [20.2, 36.25, 25.4, 39.06], extent: 'Southern mainland Greece and nearby islands',
    legend: 'Areas grouped as Greek city-states', pointLegend: 'Selected polis',
    places: [
      ['Athens', 23.73, 37.98, 15, -11], ['Corinth', 22.88, 37.91, -13, 26],
      ['Sparta', 22.43, 37.08, 12, -12]
    ],
    waters: [['Gulf of Corinth', 22.38, 38.32], ['Aegean Sea', 25.12, 38.40], ['Ionian Sea', 20.55, 37.47]],
    regions: [['Peloponnese', 21.79, 37.39], ['Attica', 23.69, 38.22]],
    scaleKm: 50
  },
  {
    key: 'ottoman-empire', name: 'Ottoman Empire', years: [1650, 1914],
    box: [-4, 10.3, 54, 51.5], extent: 'Mediterranean, Black Sea and Red Sea',
    legend: 'Mapped Ottoman territory', pointLegend: 'Reference city',
    places: [
      ['Constantinople', 28.98, 41.01, 12, -11], ['Belgrade', 20.45, 44.82, -9, -11],
      ['Cairo', 31.24, 30.04, -13, 18], ['Baghdad', 44.37, 33.31, 12, -8]
    ],
    waters: [['Black Sea', 35.3, 44.7], ['Mediterranean Sea', 15.4, 34.0], ['Red Sea', 38.3, 20.0]],
    regions: [], scaleKm: 500
  },
  {
    key: 'safavid-empire', name: 'Safavid Empire', years: [1600, 1650, 1700],
    box: [40.7, 23.1, 72.3, 42.1], extent: 'Iranian plateau and adjoining frontiers',
    legend: 'Mapped Safavid territory', pointLegend: 'Reference city',
    places: [
      ['Tabriz', 46.29, 38.08, -9, -8], ['Isfahan', 51.67, 32.65, 10, 22], ['Herat', 62.20, 34.35, 8, -10],
      ['Kandahar', 65.66, 31.61, 9, 21], ['Baghdad', 44.37, 33.31, -9, -11]
    ],
    waters: [['Caspian Sea', 51.48, 40.49], ['Persian Gulf', 51.95, 26.05]],
    regions: [['Ottoman Empire', 44.0, 35.9], ['Mughal Empire', 71.05, 28.9]],
    scaleKm: 300
  }
];

function draw(spec, year) {
  const [left, bottom, right, top] = spec.box;
  const midLat = (bottom + top) / 2;
  const xFactor = Math.cos(midLat * radians);
  const scale = Math.min((frame.right - frame.left) / ((right - left) * radians * xFactor),
    (frame.bottom - frame.top) / ((top - bottom) * radians));
  const project = geoProjection((lon, lat) => [lon * xFactor, lat])
    .scale(scale).center([(left + right) / 2, midLat])
    .translate([(frame.left + frame.right) / 2, (frame.top + frame.bottom) / 2])
    .clipExtent([[frame.left, frame.top], [frame.right, frame.bottom]]);
  const geo = geoPath(project).digits(1);
  const selected = atlas.data[year].features.filter(f => f.properties.n === spec.name);
  if (!selected.length) throw new Error('No outline for ' + spec.name + ', ' + year);
  function text(x, y, label, size, options = '') {
    return '<text x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" font-size="' + size + '" ' + options + '>' + xml(label) + '</text>';
  }
  const halo = 'paint-order="stroke" stroke="' + paper + '" stroke-linejoin="round" stroke-width="4"';
  const omittedTabriz = spec.key === 'safavid-empire' && year >= 1650;
  const renderPlaces = spec.places.map(([name, lon, lat, dx, dy]) => {
    const [x, y] = project([lon, lat]);
    return '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="5.3" fill="#462d25" stroke="' + paper + '" stroke-width="2.2"/>' +
      text(x + dx, y + dy, omittedTabriz && name === 'Tabriz' ? 'Tabriz*' : name, 21, 'text-anchor="' + (dx < 0 ? 'end' : 'start') + '" font-weight="700" ' + halo);
  }).join('');
  function areaLabels(list, water) {
    return list.map(([name, lon, lat]) => {
      const [x, y] = project([lon, lat]);
      return text(x, y, name, 18, 'text-anchor="middle" font-style="italic" fill="' + (water ? '#3f656c' : muted) + '" ' +
        (water ? 'paint-order="stroke" stroke="' + sea + '" stroke-width="3" stroke-linejoin="round"' : halo));
    }).join('');
  }
  const date = year < 0 ? Math.abs(year) + ' BC' : String(year);
  const legendLine = '<rect x="27" y="536" width="24" height="16" fill="' + shade + '" stroke="' + outline + '"/>' +
    text(60, 551, spec.legend, 19) + '<circle cx="451" cy="545" r="5" fill="#462d25"/>' +
    text(464, 551, spec.pointLegend, 19);
  const scalePx = scale * spec.scaleKm / 6371;
  const sx = frame.left + 17, sy = frame.bottom - 13;
  const bar = '<rect x="' + (sx - 7) + '" y="' + (sy - 25) + '" width="' + Math.max(83, scalePx + 16).toFixed(1) +
    '" height="31" rx="3" fill="' + paper + '" opacity=".92"/>' + text(sx, sy - 7, spec.scaleKm + ' km', 15) +
    '<path d="M' + sx + ' ' + (sy - 3) + 'v3h' + scalePx.toFixed(1) + 'v-3" fill="none" stroke="' + ink + '" stroke-width="2"/>';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">
<title id="title">${xml(spec.name)} · ${date}</title><desc id="desc">${xml(spec.extent)}. ${xml(spec.legend)} in green. Labelled places include ${xml(spec.places.map(p => p[0]).join(', '))}.</desc>
<rect width="${width}" height="${height}" fill="${paper}"/>
<g font-family="DejaVu Sans, sans-serif" fill="${ink}">
${text(25, 37, spec.name, 31, 'font-weight="700"')}${text(775, 37, date, 30, 'text-anchor="end" font-weight="700"')}
${text(26, 61, spec.extent, 18, 'fill="' + muted + '"')}
<rect x="${frame.left}" y="${frame.top}" width="${frame.right - frame.left}" height="${frame.bottom - frame.top}" fill="${sea}"/>
<path d="${geo(physical.land)}" fill="${land}" stroke="#87988c" stroke-width=".9"/>
<path d="${geo({type:'FeatureCollection', features:selected})}" fill="${shade}" stroke="${outline}" stroke-width="1.7" stroke-linejoin="round"/>
<path d="${geo(physical.lakes) || ''}" fill="${sea}" stroke="#819b9a" stroke-width=".8"/>
${areaLabels(spec.regions, false)}${areaLabels(spec.waters, true)}${renderPlaces}${bar}
<rect x="${frame.left}" y="${frame.top}" width="${frame.right - frame.left}" height="${frame.bottom - frame.top}" fill="none" stroke="#829487"/>
${legendLine}
${omittedTabriz ? text(27, 574, '* Tabriz was Safavid. The atlas outline omits it.', 17, 'fill="' + ink + '"') : ''}
${text(27, omittedTabriz ? 595 : 583, 'Chronica Maps   ·   Historical Basemaps / Natural Earth', 15, 'fill="' + muted + '"')}${text(772, omittedTabriz ? 595 : 583, 'North up', 15, 'text-anchor="end" fill="' + muted + '"')}
</g></svg>\n`;
  const fileYear = year < 0 ? Math.abs(year) + '-bc' : year;
  fs.writeFileSync(path.join(output, spec.key + '-' + fileYear + '.svg'), svg);
}
fs.mkdirSync(output, { recursive: true });
for (const spec of maps) for (const year of spec.years) draw(spec, year);
