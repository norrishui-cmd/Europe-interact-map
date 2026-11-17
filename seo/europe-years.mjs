const asset = name => `/maps/img/${name}`;
const medievalMap = 'medieval-europe-1300-realms';
const interwarMap = 'europe-1938-political-borders';
const centralMap = 'central-europe-1938-vienna-liberec-prague';

function mapFigure(name, height, alt, caption, detail = false) {
  const url = asset(name);
  return `<figure class="map"><div class="mapwrap"><img src="${url}.webp" width="1240" height="${height}" alt="${alt}" loading="${detail ? 'lazy' : 'eager'}" decoding="async"></div><figcaption>${caption} <a href="${url}.svg">Open the full-size map (SVG)</a>.</figcaption></figure>`;
}

function medievalYear({openBtn}) {
  const cities = [
    ['<a href="/en/city/london">London</a>', 'English crown', 'Edward I ruled England. In 1300 he reissued Magna Carta under his seal. Harvard preserves one of the surviving originals. <a href="https://hls.harvard.edu/today/youve-got-the-best-1300-is-the-best-final-magna-carta/">Harvard Law School manuscript MS 172</a>.'],
    ['<a href="/en/city/paris">Paris</a>', 'Kingdom of France', 'On the Île de la Cité, Philip IV was enlarging the royal palace. Work began in 1296 to give his administration more room beside the royal residence. <a href="https://www.paris-conciergerie.fr/en/discover/the-palais-de-la-cite-residence-and-center-of-capetian-power">The Palais de la Cité</a>.'],
    ['<a href="/en/city/granada">Granada</a>', 'Nasrid emirate', 'South of Castile, the Alhambra housed the Nasrid court above the city of Granada. The small realm on the coast was one of several powers on the Iberian Peninsula. <a href="https://www.alhambra-patronato.es/en/discover/alhambra-y-generalife/history">History of the Alhambra</a>.'],
    ['<a href="/en/city/rome">Rome</a>', 'Papal States', 'Pope Boniface VIII proclaimed the Jubilee in 1300. His bull directed pilgrims to the tombs of Peter and Paul, drawing people to Rome from far beyond the papal lands on this map. <a href="https://antiquorum-habet.senato.it/index.php/section/section_11_en/">The 1300 Jubilee bull</a>.'],
    ['<a href="/en/city/istanbul">Constantinople</a>', 'Byzantine Empire', 'The imperial capital stood on the Bosporus, the strait between Europe and Asia. Byzantine rulers had recovered the city in 1261. <a href="https://www.metmuseum.org/exhibitions/listings/2004/byzantium-faith-and-power">The Met’s Byzantine collection and exhibition</a>.'],
  ];
  return {
    hero: medievalMap,
    states: ['English territory', 'France', 'Castile', 'Aragón', 'Granada', 'Holy Roman Empire', 'Papal States', 'Byzantine Empire', 'Novgorod', 'Khanate of the Golden Horde'],
    title: 'Map of Europe in 1300: Borders, Rulers & Events | Chronica Maps',
    desc: 'Explore Europe in 1300 on a labelled map of medieval kingdoms and empires. Locate France, the Holy Roman Empire, Granada, Rome and Constantinople.',
    facts: ['Philip IV ruled France, while Edward I ruled England across the Channel.', 'Boniface VIII proclaimed the first Roman Jubilee in 1300.', 'The 1200 and 1400 maps are the nearest European border snapshots in this atlas.'],
    body: `<p class="lead">In 1300, the kingdoms of England and France faced each other across the Channel. The Holy Roman Empire stretched across central Europe. Farther south, the Nasrid rulers held Granada, the popes governed lands around Rome, and Byzantine emperors ruled from Constantinople.</p>
${mapFigure(medievalMap, 1144, 'Map of Europe in 1300 showing the Holy Roman Empire, France, Granada, the Papal States, the Byzantine Empire and five cities', 'Dots mark cities. Colours distinguish selected realms, including small territories around Granada and Rome. Borders are approximate for the year 1300.')}
${openBtn('y1300', 'Explore the interactive map of Europe in 1300')}
<h2>Where were the centres of power in 1300?</h2>
${cities.map(([place, realm, detail]) => `<h3>${place} · ${realm}</h3><p>${detail}</p>`).join('\n')}
<h2>How to read the medieval borders</h2>
<p>Follow the Holy Roman Empire eastward from the lands on the Rhine towards Bohemia. The atlas gives it a single outline. Within it, princes, bishops and cities exercised powers of their own. To the northeast, the map labels Novgorod. Farther southeast, the Golden Horde extended across the steppe beyond the right-hand edge of the map. <a href="https://ome-lexikon.uni-oldenburg.de/en/countries/holy-roman-empire-of-the-german-nation">University of Oldenburg’s account of the empire</a>.</p>
<p>On the Iberian Peninsula, look for Portugal on the Atlantic side, Castile in the interior, Aragon towards the Mediterranean and Granada on the southern coast. The different colours make it possible to trace these neighbours on the <a href="/#y1300-l-en">interactive 1300 map</a>.</p>
<h2>Compare Europe before and after 1300</h2>
<p>Follow Constantinople across the <a href="/en/year/1200">1200 map of Europe</a> and the <a href="/en/year/1400">1400 map of Europe</a>, or place the <a href="/en/compare/europe-1100-to-1300">1100 and 1300 borders side by side</a>. The <a href="/en/world/1300">world map in 1300</a> shows how far the Golden Horde extended beyond Europe.</p>`,
  };
}

function interwarYear({openBtn, table}) {
  return {
    hero: interwarMap,
    states: ['France', 'Germany', 'Czechoslovakia', 'Poland', 'USSR', 'Italy', 'Hungary', 'Romania', 'Yugoslavia'],
    title: 'Map of Europe in 1938 | Austria and the Sudetenland',
    desc: 'See Europe’s 1938 borders after Germany annexed Austria and the Sudetenland. Compare Vienna, Liberec and Prague with the earlier 1930 map.',
    facts: ['Germany annexed Austria in March 1938.', 'The Munich Agreement provided for German occupation of Czechoslovak border territories beginning in October 1938.', 'Prague remained in Czechoslovakia on the 1938 map. German troops occupied the city in March 1939.'],
    body: `<p class="lead">The 1938 map of Europe shows Germany after it annexed Austria and the Sudetenland. Vienna and Liberec fall inside the German border. Prague remains in Czechoslovakia. Farther east, Poland separates Germany from the Soviet Union.</p>
${mapFigure(interwarMap, 1084, 'Map of Europe in 1938 with Germany, Czechoslovakia, Poland, France and the Soviet Union labelled or keyed', 'Germany is rose and Czechoslovakia is green. The dotted circle locates the Central Europe detail below. The atlas identifies the snapshot by year and supplies no exact date.')}
${openBtn('y1938', 'Explore the interactive map of Europe in 1938')}
<h2>Where did the German border move?</h2>
${mapFigure(centralMap, 1036, 'Central Europe in 1938 with Vienna and Liberec in Germany and Prague in Czechoslovakia', 'The orange and purple areas are the parts of the atlas’s 1930 Austrian and Czechoslovak territories that fall inside Germany on its 1938 map.', true)}
${table(['City', '1930 map', '1938 map'], [
  ['<a href="/en/city/vienna">Vienna</a>', 'Austria', 'Germany'],
  ['Liberec<br><small>(Reichenberg)</small>', 'Czechoslovakia', 'Germany'],
  ['<a href="/en/city/prague">Prague</a>', 'Czechoslovakia', 'Czechoslovakia'],
])}
<h2>Why Vienna and Prague appear on different sides</h2>
<p>German troops entered Austria in March 1938. The annexation, known as the Anschluss, brought Vienna under Nazi rule. Helen Baker, an American living there, recorded the scene on the day Hitler entered the city. <a href="https://encyclopedia.ushmm.org/content/en/timeline-event/holocaust/1933-1938/helen-baker-diary-entry">Helen Baker’s diary at the US Holocaust Memorial Museum</a>.</p>
<p>In September, Germany, Britain, France and Italy agreed at Munich to the cession of the Sudeten German territories of Czechoslovakia. The text set out a staged German occupation beginning on 1 October. On the detail map, Liberec lies on the German side of this new frontier, while Prague lies south of it. <a href="https://mzv.gov.cz/public/5b/59/e5/198473_14930_MunichAgreement.pdf">Text of the Munich Agreement, articles 1–4 (PDF)</a>.</p>
<p>German troops entered Prague on 15 March 1939. That later occupation helps explain why a map of wartime Europe can show Prague differently. <a href="https://encyclopedia.ushmm.org/content/en/photo/german-troops-occupy-prague">Dated photograph of the occupation of Prague</a>.</p>
<h2>Compare the European borders</h2>
<p>The <a href="/en/year/1930">1930 Europe map</a> shows Austria separately and both Czech cities within Czechoslovakia. Compare <a href="/en/compare/europe-1920-to-1938">Europe in 1920 and 1938</a> for the wider interwar changes. The <a href="/en/year/1945">1945 Europe map</a> is the next available snapshot, also available in the <a href="/en/compare/europe-1938-to-1945">1938 and 1945 side-by-side comparison</a>.</p>
<p>The <a href="/en/world/1938">world map in 1938</a> includes countries and overseas territories outside the European map frame.</p>`,
  };
}

export function europeYearPage(year, helpers) {
  const content = year === 1300 ? medievalYear(helpers) : interwarYear(helpers);
  const url = `/en/year/${year}`;
  const h1 = `Map of Europe in ${year}`;
  const ogImage = asset(content.hero) + '.webp';
  const label = { 'English territory': 'Lands of the English crown', USSR: 'Soviet Union' };
  const links = content.states.filter(name => helpers.names.has(name) && helpers.stateUrl(name)).map(name =>
    `<a href="${helpers.stateUrl(name)}">${helpers.esc(label[name] || helpers.polName(name))}</a>`);
  const timeline = helpers.sites.map(site => ({ year: site.y, date: site.id === 'stalingrad' ? '1942–43' : site.y,
    detail: `<a href="/en/battle/${site.id}">${helpers.esc(site.id === 'kalmar' ? 'Formation of the Kalmar Union' : site.title)}</a>` }));
  for (const event of helpers.events) {
    if (event.y === 1337 || event.y === 1347) timeline.push({year: event.y, date: event.y, detail: helpers.esc(event.t)});
    if (event.place === 'warsaw') timeline.push({year: event.y, date: event.y, detail: 'Germany invades Poland. See <a href="/en/city/warsaw">Warsaw’s timeline</a>.'});
    if (event.place === 'reykjavik') timeline.push({year: event.y, date: event.y, detail: 'Iceland becomes a republic. See <a href="/en/city/reykjavik">Reykjavík’s timeline</a>.'});
  }
  timeline.sort((a, b) => a.year - b.year);
  const more = `<h2>States on the ${year} map</h2><p>${links.join(' · ')}.</p>` +
    `<h2>${year === 1300 ? 'Later in the 14th century' : 'Europe during the Second World War'}</h2><p>${year === 1300 ? 'These later events fall between the 1300 and 1400 border maps.' : 'These events came after the 1938 borders shown above.'}</p><ul class="links">${timeline.map(item => `<li>${item.date} · ${item.detail}</li>`).join('')}</ul>`;
  return {
    url, h1, title: content.title, desc: content.desc, body: content.body + more, facts: content.facts,
    mapFirst: true, ogImage, crumbs: [['Home', '/'], ['Years', '/en/years'], [String(year), url]],
    ld: [{ '@context': 'https://schema.org', '@type': 'Article', headline: h1, inLanguage: 'en',
      image: helpers.site + ogImage, dateModified: helpers.today }],
  };
}
