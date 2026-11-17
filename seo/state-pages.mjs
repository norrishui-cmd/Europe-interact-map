const illustration = (stem, alt, caption, loading = 'eager') => `<figure class="map"><div class="mapwrap"><a href="/maps/img/${stem}.svg" aria-label="Enlarge ${alt}"><img src="/maps/img/${stem}.webp" width="800" height="604" alt="${alt}" loading="${loading}" decoding="async"></a></div><figcaption>${caption} <a href="/maps/img/${stem}.svg">Full-size map (SVG)</a>.</figcaption></figure>`;

const archiveLinks = {
  greek: '<a href="https://www.metmuseum.org/essays/greek-art-in-the-archaic-period">The Met on the autonomous poleis of Archaic Greece</a>',
  corinth: '<a href="https://www.ascsa.edu.gr/excavations/ancient-corinth/about-the-excavations-1/history-timeline">The Corinth excavators on the isthmus and its harbors</a>',
  ottoman: '<a href="https://www.loc.gov/item/2021668592/">Sanson’s seventeenth-century map of Ottoman lands</a>',
  balkans: '<a href="https://www.loc.gov/item/a22000878/">The British Foreign Office’s 1919 handbook <i>Turkey in Europe</i></a>',
  persia: '<a href="https://www.loc.gov/item/2021668691/">Willem Blaeu’s 1635 map of the Safavid kingdom</a>',
  isfahan: '<a href="https://www.metmuseum.org/essays/shah-cabbas-and-the-arts-of-isfahan">The Met on Shah Abbas and Isfahan</a>',
  frontier: '<a href="https://www.iranicaonline.org/articles/boundaries-i/">Encyclopaedia Iranica on the Ottoman–Iranian frontier</a>',
  kandahar: '<a href="https://www.iranicaonline.org/articles/kandahar-from-the-mongol-invasion-through-the-safavid-era/">Encyclopaedia Iranica’s history of Kandahar</a>'
};
const periodLink = (year, region, caption) => {
  const hash = year < 0 ? 'yBC' + Math.abs(year) : 'y' + year;
  const label = caption ?? (year < 0 ? Math.abs(year) + ' BC' : year);
  return `<a href="/#${hash}-r-${region}-l-en">${label}</a>`;
};

function yearCell(year, region) {
  const label = year < 0 ? Math.abs(year) + ' BC' : year;
  const slug = year < 0 ? Math.abs(year) + '-bc' : year;
  const route = region === 'europe' ? 'year' : 'world';
  const view = {europe: 'Europe', asia: 'Asia', world: 'world'}[region];
  return `<a href="/en/${route}/${slug}">${label}</a> · ${periodLink(year, region, 'Interactive ' + view)}`;
}

function greekPage({ table }) {
  const title = 'Greek City-States Map Around 500 BC';
  const lead = 'Athens lay in Attica, Corinth stood beside the isthmus linking the Peloponnese to central Greece, and Sparta lay farther south in Laconia. Each was a separate polis, with its own political community. The map marks their city centers. Its green shading groups several Greek communities under one atlas label.';
  const stem = 'greek-city-states-500-bc';
  const body = `<p class="lead">${lead}</p>
${illustration(stem, 'Map of Greek city-states around 500 BC showing Athens, Corinth and Sparta', 'The view is cropped to southern Greece. The green edge follows the atlas’s combined outline. Internal boundaries between the poleis are unavailable at this scale.')}
<p><a class="btn" href="/#yBC500-c-athens-r-europe-l-en">Find Athens on the 500 BC map</a> · <a href="/#yBC500-c-sparta-r-europe-l-en">Find Sparta</a></p>
<h2>Where were Athens, Corinth and Sparta?</h2>
${table(['Polis', 'How to find it on the map'], [
  ['<a href="/en/city/athens">Athens</a>', 'Look east of the isthmus, on the Attic peninsula. Of the three marked cities, Athens lies farthest east.'],
  ['Corinth', 'Follow the Gulf of Corinth east to the narrow land crossing. Ancient Corinth stood on the Peloponnesian side, with access to the Corinthian and Saronic gulfs.'],
  ['<a href="/en/city/sparta">Sparta</a>', 'Look inland in the southeastern Peloponnese. Sparta lies well south of Corinth and west of Athens.']
])}
<p>The sea and the mountain ranges helped separate these communities. Their shared language and sanctuaries connected people across political boundaries. ${archiveLinks.greek}. ${archiveLinks.corinth}.</p>
<h2>What the four atlas dates show</h2>
<p>“Greek city-states” is the name of a group of polygons in the border data. Its coverage changes when the mapmakers give a region a different label. The four entries below track that label. They cannot measure the territory gained or lost by an individual polis.</p>
${table(['Map year', 'Where the grouped label appears'], [
  [yearCell(-500, 'europe'), 'Mainland Greece, Crete and islands in the Aegean, with separate areas farther west, including southern Italy and Sicily.'],
  [yearCell(-400, 'europe'), 'Mainland Greece, Crete and Aegean islands. The western areas included under this label in 500 BC are absent from this snapshot.'],
  [yearCell(-323, 'europe'), 'The label has shifted to parts of Italy, Sicily and Corsica. Mainland Athens and Sparta fall outside this group on this map.'],
  [yearCell(-300, 'europe'), 'The label again appears in the western Mediterranean. An isolated shaded patch identifies an atlas grouping, with no implied common government.']
])}
<p><a href="/en/year/500-bc">See the European map for 500 BC</a> · <a href="/en/battle/marathon">Locate Marathon northeast of Athens in 490 BC</a></p>`;
  return { title, h1: title, desc: 'Locate Athens, Sparta and Corinth on a map of Greek city-states around 500 BC. Compare how the atlas groups Greek communities across four ancient maps.', body, ogImage: '/maps/img/' + stem + '.webp' };
}

function ottomanPage({ st, table, fmtKm2 }) {
  const title = 'Ottoman Empire Map: Borders Over Time (1400–1914)';
  const maps = st.maps;
  const a = year => maps.filter(m => m.s === year).reduce((total, m) => total + m.area, 0);
  const years = [...new Set(maps.map(m => m.s))].sort((a, b) => a - b);
  const largest = years.reduce((best, year) => a(year) > a(best) ? year : best);
  const body = `<p class="lead">In 1650 Ottoman territory stretched from southeastern Europe across Anatolia to Baghdad and around the eastern Mediterranean to Egypt and North Africa. By 1914 the empire still held Constantinople, Anatolia, Syria and much of Mesopotamia, but its European territory had contracted to a small area in Thrace. The two maps use the same frame and scale.</p>
<div class="cmp2">
${illustration('ottoman-empire-1650', 'Ottoman Empire map in 1650 from the Balkans to Egypt and Baghdad', '1650. The mapped territory includes Belgrade, Cairo and Baghdad. The Black Sea and Mediterranean coasts help orient the European and African parts.')}
${illustration('ottoman-empire-1914', 'Ottoman Empire map in 1914 showing Anatolia, the Arab provinces and the smaller European territory', '1914. Belgrade and Cairo now fall outside the shaded outline. Baghdad and the imperial capital at Constantinople remain useful reference points.')}
</div>
<p><a class="btn" href="/compare#world-1650-1914">Compare 1650 and 1914 on the world map</a> · Open a single map for ${periodLink(1650, 'world')} or ${periodLink(1914, 'world')}.</p>
<h2>Reading the change in the Balkans</h2>
<p>Start at Constantinople and trace the green area northwest. On the 1650 map it extends past Belgrade into central Europe. In 1914 the European portion ends in Thrace. The Balkan Wars of 1912–13 account for part of that difference. For the earlier extent, the Library of Congress holds a 1679 impression of a map made by Nicolas Sanson. For the later geography, a British Foreign Office handbook describes the remaining Ottoman territory in Europe. ${archiveLinks.ottoman}. ${archiveLinks.balkans}.</p>
<h2>Ottoman territory across ${years.length} atlas maps</h2>
<p>The largest area among these ${years.length} Ottoman snapshots is approximately ${fmtKm2(a(largest))} in ${largest}. The dates are spaced unevenly, so this comparison cannot establish an exact year of maximum historical extent. Each estimate measures the land assigned the Ottoman label by this dataset. Tributary relationships and different degrees of provincial control are difficult to represent with a single fill. The 1650 outline also extends too far east around Tabriz, as the <a href="/en/state/safavid-empire#western-frontier">Safavid map notes explain</a>.</p>
${table(['Map year', 'Approximate mapped area'], years.map(year => [yearCell(year, 'world'), fmtKm2(a(year))]))}
<p><a href="/en/city/istanbul">Constantinople and Istanbul through time</a> · <a href="/en/city/baghdad">Baghdad’s history and maps</a> · <a href="/en/state/safavid-empire">Compare the neighboring Safavid Empire</a></p>`;
  return { title, h1: 'Ottoman Empire: Map &amp; Borders Over Time',
    desc: 'Compare the Ottoman Empire in 1650 and 1914 on two same-scale maps. Follow the changing Balkan frontier and see mapped areas for twelve dates from 1400 to 1914.',
    body, ogImage: '/maps/img/ottoman-empire-1650.webp' };
}

function safavidPage({ st, table, fmtKm2 }) {
  const years = [1600, 1650, 1700];
  const observations = [
    '1600. Isfahan and Herat lie inside the outline. Kandahar, on the eastern frontier, lies outside.',
    '1650. The eastern outline now takes in Kandahar. Compare its dot with the same point in 1600. See the <a href="#western-frontier">Tabriz correction</a> on the western frontier.',
    '1700. Kandahar remains inside. The northeastern outline changes shape while Isfahan remains deep within the empire.'
  ];
  const body = `<p class="lead">Safavid Iran occupied much of the Iranian plateau between the Ottoman Empire to the west and the Mughal Empire to the east. All three maps place Isfahan inside Safavid territory. To see the clearest eastern change, follow Kandahar from outside the green area in 1600 to inside it in 1650 and 1700.</p>
<div class="cmp2">
${years.map((year, i) => illustration('safavid-empire-' + year, 'Safavid Empire map in ' + year + ' showing Isfahan, Herat and Kandahar between the Ottoman and Mughal empires', observations[i])).join('')}
<section><h2>Why Kandahar changes sides</h2>
<p>Kandahar guarded routes between the Iranian plateau and the Indian subcontinent. Its governor surrendered the city to the Mughals in 1595. Shah Abbas I retook it in 1622, the Mughals regained it in 1638, and Shah Abbas II recovered it in 1649. That last change explains why the city appears inside the 1650 outline. A comparison of snapshots fifty years apart hides the intervening changes. ${archiveLinks.kandahar}.</p></section></div>
<p><a class="btn" href="/compare#asia-1600-1650">Compare 1600 and 1650 in Asia</a> · <a href="/compare#asia-1650-1700">Compare 1650 and 1700</a></p>
<h2 id="western-frontier">Isfahan and the western frontier</h2>
<p>Shah Abbas I moved the seat of government to Isfahan in 1597–98. The capital anchors the three panels, with the Caspian Sea to the north and the Persian Gulf to the south. Baghdad is a western reference point. Tabriz illustrates a substantial omission in the dataset. The 1650 and 1700 outlines leave the city outside the green area, although Shah Abbas I had recovered territory west of Tabriz and his successor concluded peace with the Ottomans in 1639. Take particular care with the western edge when using the mapped area estimates. ${archiveLinks.isfahan}. ${archiveLinks.frontier}. ${archiveLinks.persia}.</p>
<h2>Safavid territory in the atlas</h2>
<p>Each panel uses the same projection, scale and crop. The area figures sum the atlas polygons for the named year. These three dates sample a longer history, including the fall of Isfahan in 1722.</p>
${table(['Map year', 'Approximate mapped area', 'Kandahar on this map'], years.map((year, i) => [
  yearCell(year, 'asia'), fmtKm2(st.maps.filter(m => m.s === year).reduce((total, m) => total + m.area, 0)), i === 0 ? 'Outside the Safavid outline' : 'Inside the Safavid outline'
]))}
<p><a href="/#y1650-c-isfahan-r-world-l-en">Locate Isfahan in the 1650 atlas</a> · <a href="/en/city/isfahan">Read Isfahan’s city history</a> · <a href="/en/state/ottoman-empire">See the Ottoman map for 1650</a></p>`;
  const title = 'Safavid Empire Map in 1600, 1650 and 1700';
  return { title, h1: title, desc: 'Compare three maps of Safavid Iran at the same scale. Locate Isfahan, Herat and Kandahar and trace the changing frontier with the Mughal Empire.',
    body, ogImage: '/maps/img/safavid-empire-1650.webp' };
}

const pages = { 'greek-city-states': greekPage, 'ottoman-empire': ottomanPage, 'safavid-empire': safavidPage };
export function statePilot(st, context) {
  return pages[st.slug]?.({ st, ...context });
}
