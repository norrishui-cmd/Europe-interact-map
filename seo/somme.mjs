const route = '/en/battle/somme';
const imagePath = '/maps/img/somme-location.webp';
const vectorPath = '/maps/img/somme-location.svg';
const imageAlt = 'Battle of the Somme location map in northern France, showing Albert, Bapaume, Péronne and four battle sites on either side of the Somme River';
const lead = 'The Battle of the Somme took place on the Western Front in northern France, east of Amiens, from 1 July to 18 November 1916. Find Albert on the map. Thiepval and Pozières were fighting sites northeast of the town. To the south, French troops attacked on both banks of the Somme River toward Péronne.';
const campaignMap = 'https://www.canada.ca/content/dam/themes/defence/caf/militaryhistory/dhh/official/book-1964-expeditionary-en.pdf';
const riverMap = 'https://www.somme.fr/wp-content/uploads/2019/07/CV2_Peronne-Froissy.pdf';
const gazetteer = 'https://www.geonames.org/export/';

export function sommePage(site, fmtLL, org, battle) {
  const title = 'Battle of the Somme Location Map (1916) | Chronica Maps';
  const desc = 'Locate the 1916 Somme battlefield in northern France. See Albert, Thiepval, Pozières and Péronne on a map showing where fighting took place on both banks.';
  const body = `<p class="lead">${lead}</p>
<p><a class="btn" href="/#y1916-s-somme-l-en">Open the Somme pin on the 1914 border map</a></p>
<figure class="map"><div class="mapwrap" style="max-width:660px"><a href="${vectorPath}"><img src="${imagePath}" width="960" height="1038" alt="${imageAlt}" loading="eager" fetchpriority="high" decoding="async"></a></div><figcaption>Diamonds mark four places where fighting took place in 1916. The inset locates them in modern France. <a href="${vectorPath}">Enlarge the battlefield location map (SVG)</a>.</figcaption></figure>
<h2>Find the battlefield from Albert</h2>
<p>Albert is about 28 km northeast of Amiens. Thiepval and Pozières are each about 7 km from Albert in a straight line. The road toward Bapaume passes through Pozières, where Australian troops fought on the ridge in July. Thiepval lies to the west of that road.</p>
<p>Farther south, the Somme bends west from Péronne toward Bray-sur-Somme and Amiens. The British and French sectors met near Maricourt, north of the river. French troops also attacked on the south bank, taking Dompierre on the opening day. At the northern end of the offensive, British troops attacked at Gommecourt.</p>
<h2>The Somme on the interactive atlas</h2>
<p>The atlas pin at ${fmtLL(battle.c)} marks a point east of Albert within the wider battlefield. Opening it sets the timeline to 1916. The political layer uses the <a href="/en/year/1914">1914 borders of Europe</a>, the atlas’s last snapshot before the battle.</p>
<!--EMBED:y1916-s-somme-->
<p><a href="/en/compare/europe-1914-to-1920">Compare Europe’s borders before and after World War I, 1914 and 1920</a>. For the other major 1916 battle in France, see the <a href="/en/battle/verdun">Battle of Verdun</a> on the Meuse.</p>
<h2>Historical maps and sources</h2>
<ul class="links"><li><a href="${campaignMap}">Canadian Army official history, chapter VI and Map 5 (PDF)</a>. The map shows the campaign around Albert, Bapaume and Péronne, with an inset covering the wider front.</li>
<li><a href="https://www.awm.gov.au/collection/C1019811">Australian War Memorial, 1916 map of Pozières and Mouquet Farm</a>. Lieutenant Peter Rigby Wightman’s tracing records four phases of the Australian attack.</li>
<li><a href="https://www.canada.ca/en/department-national-defence/services/military-history/history-heritage/battle-honours-honorary-distinctions/somme-1916.html">Canada’s Department of National Defence, Somme 1916</a>. Its battle honour records the dates of the offensive and the battles within it.</li></ul>
<p class="muted">Town positions use the <a href="${gazetteer}">GeoNames gazetteer</a>. The river is simplified at this scale. See the <a href="${riverMap}">Département de la Somme map of the valley around Péronne (PDF)</a> for its smaller bends and wetlands. The France inset uses the atlas’s <a href="https://github.com/aourednik/historical-basemaps">historical-basemaps outline</a>.</p>`;
  return {
    url: route,
    title,
    desc,
    h1: 'Battle of the Somme location map (1916)',
    crumbs: [['Home', '/'], ['Battles & sites', '/en/battles'], [battle.title, route]],
    body,
    mapFirst: true,
    ogImage: imagePath,
    ld: [{
      '@context': 'https://schema.org', '@type': 'Event',
      name: 'Battle of the Somme', startDate: '1916-07-01', endDate: '1916-11-18',
      description: lead, url: site + route, image: site + imagePath,
      location: { '@type': 'Place', name: 'Somme battlefield, northern France', address: { '@type': 'PostalAddress', addressCountry: 'FR' } }
    }, {
      '@context': 'https://schema.org', '@type': 'ImageObject',
      name: 'The Somme battlefield in northern France, 1916', description: imageAlt,
      contentUrl: site + imagePath, encodingFormat: 'image/webp', creator: org,
      creditText: 'Chronica Maps. Place locations from GeoNames. France inset from historical-basemaps.',
      copyrightNotice: 'Chronica Maps. GeoNames geographic data under CC BY. France inset from historical-basemaps under GPL-3.0.',
      license: 'https://www.gnu.org/licenses/gpl-3.0.html',
      acquireLicensePage: site + '/about#using-and-citing-the-maps',
      citation: [campaignMap, gazetteer, riverMap]
    }]
  };
}
