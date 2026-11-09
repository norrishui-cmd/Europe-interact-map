// 任务场景 · Story quests with 3D "empire rises" rewards. Loaded after app.js; uses its globals.
(function () {
function init() {
const A = window.APPX;
const { layers, cityById, svg, zoom, gMap, gPol, path, openPanel, closePanelSilent, setRegion, setYear, feats, colorOf, zhOf, isTribal, regionOf, regionT, snapFor, ensure, renderSnap, flyTo, pulse, fmtY } = A;
const W = () => window.innerWidth, H = () => window.innerHeight;
const LG = window.LANG || 'en', K = LG === 'zh-Hans' ? 'zh' : LG === 'zh-Hant' ? 'zht' : LG;
const T = o => (o == null ? '' : typeof o === 'string' ? o : (o[K] || (K === 'zht' && o.zh) || o.en || ''));

// ---------- texts ----------
const UI = {
  btn: { en: 'Quests', zh: '任务', de: 'Aufgaben', fr: 'Quêtes', es: 'Misiones' },
  title: { en: 'Story quests', zh: '历史任务', de: 'Abenteuer der Geschichte', fr: 'quêtes histoire', es: 'Misiones de historia' },
  intro: { en: 'Follow a story through the map. Each quest has a few steps; finish it and the empire at its heart rises from the map in 3D.', zh: '跟着故事在地图上完成几个步骤。完成一个任务，故事中的帝国会在地图上以 3D 形式升起。', de: 'Folgen Sie einer Geschichte durch die Karte. Jede Quest hat ein paar Schritte; beenden Sie sie und das Imperium in seinem Herzen steigt von der Karte in 3D.', fr: 'Suivez une histoire à travers la carte. Chaque quête a quelques étapes; terminez-la et l\'empire en son cœur s\'élève de la carte en 3D.', es: 'Sigue una historia a través del mapa. Cada misión tiene unos pocos pasos; termínala y el imperio en su corazón se eleva desde el mapa en 3D.' },
  tiers: [{ en: 'Novice · find and open', zh: '初阶 · 寻找与打开', de: 'Novize · finden und öffnen', fr: 'Novice  trouver et ouvrir', es: 'Principiante  encontrar y abrir' }, { en: 'Explorer · journeys, routes and layers', zh: '进阶 · 行迹、商路与图层', de: 'Explorer · Reisen, Routen und Schichten', fr: 'Explorateur  voyages, itinéraires et couches', es: 'Explorer  viajes, rutas y capas' }, { en: 'Master · read the map', zh: '高阶 · 读懂地图', de: 'Meister · Karte lesen', fr: 'Maître  lire la carte', es: 'Maestro  leer el mapa' }],
  start: { en: 'Start', zh: '开始', de: 'Starten', fr: 'Démarrer', es: 'Inicio' }, resume: { en: 'Continue', zh: '继续', de: 'Weiter', fr: 'Continuer', es: 'Continuar' }, replay: { en: 'Replay', zh: '重玩', de: 'Wiedergabe', fr: 'Replay', es: 'Volver a reproducir' }, done: { en: 'Done', zh: '已完成', de: 'Fertig', fr: 'Fait', es: 'Hecho' },
  step: { en: 'Step', zh: '步骤', de: 'Schritt', fr: 'Étape', es: 'Paso' }, hint: { en: 'Hint', zh: '提示', de: 'Hinweis', fr: 'Indice', es: 'Pista' }, list: { en: 'All quests', zh: '全部任务', de: 'Alle Quests', fr: 'Toutes les quêtes', es: 'Todas las misiones' }, quit: { en: 'Pause', zh: '暂停', de: 'Pause', fr: 'Pause', es: 'Pausa' },
  stepDone: { en: 'Step complete', zh: '步骤完成', de: 'Schritt abgeschlossen', fr: 'Étape terminée', es: 'Paso completo' }, questDone: { en: 'Quest complete!', zh: '任务完成！', de: 'Quest abgeschlossen!', fr: 'Quête terminée !', es: '¡Misión completa!' },
  wrong: { en: 'Not quite. Look at the map again.', zh: '不对，再看看地图。', de: 'Sehen Sie sich die Karte noch mal an.', fr: 'Regarde encore la carte.', es: 'Mira el mapa de nuevo.' },
  rewards: { en: 'Rewards', zh: '奖励', de: 'Belohnungen', fr: 'Récompenses', es: 'Premios' },
  m: [
    { n: 3, kind: 'steps', t: { en: 'First steps', zh: '初出茅庐', de: 'Erste Schritte', fr: 'Premiers pas', es: 'Primeros pasos' }, d: { en: 'Complete 3 steps: a golden seal stamps the map.', zh: '完成 3 个步骤：地图上盖下一枚金印。', de: 'Komplette 3 Schritte: ein goldenes Siegel stempelt die Karte.', fr: 'Terminez 3 étapes: un sceau d\'or estampille la carte.', es: 'Completa 3 pasos: un sello de oro sella el mapa.' } },
    { n: 3, kind: 'quests', t: { en: 'Empire skyline', zh: '帝国天际线', de: 'Empire Skyline', fr: 'Skyline Empire', es: 'Horizonte del imperio' }, d: { en: 'Complete 3 quests: raise every large state on the current map at once, height by size.', zh: '完成 3 个任务：当前地图上的大国按面积同时升起。', de: 'Ergänzen Sie 3 Quests: heben Sie jeden großen Zustand auf der aktuellen Karte auf einmal, Höhe nach Größe.', fr: 'Terminez 3 quêtes : augmentez tous les grands états de la carte en même temps, taille par taille.', es: 'Completa 3 misiones: eleva cada estado grande en el mapa actual a la vez, altura por tamaño.' }, fx: 'skyline' },
    { n: 6, kind: 'quests', t: { en: 'Rise and fall', zh: '兴衰时光机', de: 'Auf und ab', fr: 'Montée et descente', es: 'Subida y caída' }, d: { en: 'Complete 6 quests: a time-lapse in which the largest state of each age rises in turn.', zh: '完成 6 个任务：按时代依次升起每个时期最大的国家。', de: 'Komplett 6 Quests: ein Zeitraffer, in dem der größte Zustand jedes Alters wiederum steigt.', fr: 'Terminez 6 quêtes : un time-lapse dans lequel le plus grand état de chaque âge augmente à son tour.', es: 'Completa 6 misiones: un lapso de tiempo en el que el estado más grande de cada edad se eleva a su vez.' }, fx: 'timelapse' },
    { n: 9, kind: 'quests', t: { en: 'Grand finale', zh: '寰宇终章', de: 'Großes Finale', fr: 'Grande finale', es: 'Gran final' }, d: { en: 'Complete all 9 quests: every quest empire rises over the world, and you receive a certificate.', zh: '完成全部 9 个任务：所有任务中的帝国在世界地图上依次升起，并获得一张证书。', de: 'Ergänzen Sie alle 9 Quests: Jedes Quest-Imperium steigt über die Welt, und Sie erhalten ein Zertifikat.', fr: 'Terminez toutes les 9 quêtes : chaque empire de quête s\'élève au-dessus du monde, et vous recevez un certificat.', es: 'Completa las 9 misiones: cada imperio de misiones se levanta sobre el mundo, y recibes un certificado.' }, fx: 'finale' }],
  unlocked: { en: 'Reward unlocked', zh: '解锁奖励', de: 'Freigegebene Belohnung', fr: 'Récompense débloquée', es: 'Recompensa desbloqueada' }, play: { en: 'Play', zh: '播放', de: 'Wiedergabe', fr: 'Lecture', es: 'Reproducir' }, locked: { en: 'Locked', zh: '未解锁', de: 'Gesperrt', fr: 'Verrouillé', es: 'Bloqueado' },
  cert: { en: 'Certificate of the Chronica Maps quests', zh: '寰宇时序 · 历史任务结业证书', de: 'Zertifikat der Chronica Maps Quests', fr: 'Certificat des quêtes Chronica Maps', es: 'Certificado de las misiones de Chronica Maps' },
  certText: { en: 'You followed nine stories across 2,500 years of history, from Rome and Chang’an to the Great War.', zh: '你走过了两千五百年的九段历史，从罗马、长安一直到第一次世界大战。', de: 'Sie folgten neun Geschichten über 2.500 Jahre Geschichte, von Rom und Chang\'an bis zum Großen Krieg.', fr: 'Vous avez suivi neuf histoires à travers 2500 ans d\'histoire, de Rome et Chang\'an à la Grande Guerre.', es: 'Has seguido nueve historias a lo largo de 2.500 años de historia, desde Roma y Chang\'an hasta la Gran Guerra.' },
  share: { en: 'Copy share text', zh: '复制分享文字', de: 'Text teilen kopieren', fr: 'Copier le texte de partage', es: 'Copiar texto compartido' }, copied: { en: 'Copied', zh: '已复制', de: 'Kopiert', fr: 'Copié', es: 'Copiado' },
  shareText: { en: 'I completed all 9 history quests on Chronica Maps 🗺️ https://chronicamaps.com', zh: '我在寰宇时序完成了全部 9 个历史任务 🗺️ https://chronicamaps.com', de: 'Ich beendete alle 9 Geschichte Quests auf Chronica Maps https://chronicamagps.com', fr: 'J\'ai terminé toutes les 9 quêtes d\'histoire sur Chronica Maps  https://chronicamaps.com', es: 'Completé las 9 misiones de historia en Chronica Maps  https://chronicamaps.com' },
  reset: { en: 'Reset progress', zh: '清除进度', de: 'Fortschritt zurücksetzen', fr: 'Réinitialiser les progrès', es: 'Restablecer progreso' },
};

// step types: year{a,b} region{r} city site landmark person journey route{id} layer{id} spot{n} quiz{q,o[],a}
const QUESTS = [
 { id: 'constantinople', tier: 0, reg: 'europe', t: { en: 'The Fall of Constantinople', zh: '君士坦丁堡陷落', de: 'Der Fall von Konstantinopel', fr: 'La chute de Constantinople', es: 'La caída de Constantinopla' },
   d: { en: 'In 1453 the Ottomans took the city that had been the capital of the Roman world for over a thousand years.', zh: '1453 年，奥斯曼人攻下了作为罗马世界首都一千多年的城市。', de: '1453 eroberten die Osmanen die Stadt, die seit über tausend Jahren Hauptstadt der römischen Welt war.', fr: 'En 1453, les Ottomans ont pris la ville qui avait été la capitale du monde romain pendant plus de mille ans.', es: 'En 1453 los otomanos tomaron la ciudad que había sido la capital del mundo romano durante más de mil años.' },
   rise: { n: 'Ottoman Empire', s: 1492, r: 'europe' },
   steps: [
    { type: 'year', a: 1453, b: 1491, t: { en: 'Move the timeline to 1453.', zh: '把时间轴拖到 1453 年。', de: 'Verschieben Sie die Zeitlinie auf 1453.', fr: 'Déplacez la ligne de temps à 1453.', es: 'Mueva la línea de tiempo a 1453.' } },
    { type: 'city', id: 'istanbul', t: { en: 'Open the card for Constantinople (Istanbul).', zh: '打开君士坦丁堡（伊斯坦布尔）的城市卡片。', de: 'Öffnen Sie die Karte für Konstantinopel (Istanbul).', fr: 'Ouvrez la carte pour Constantinople (Istanbul).', es: 'Abre la tarjeta para Constantinopla (Estambul).' } },
    { type: 'person', id: 'mehmed-ii', t: { en: 'Find the sultan who took the city: Mehmed II.', zh: '找到攻下这座城的苏丹：穆罕默德二世。', de: 'Findet den Sultan, der die Stadt erobert hat: Mehmed II.', fr: 'Trouvez le sultan qui a pris la ville: Mehmed II.', es: 'Encuentra al sultán que tomó la ciudad: Mehmed II.' } },
    { type: 'landmark', id: 'hagia-sophia', t: { en: 'Open Hagia Sophia, the church that became a mosque.', zh: '打开由教堂改为清真寺的圣索菲亚大教堂。', de: 'Open Hagia Sophia, die Kirche, die eine Moschee wurde.', fr: 'Ouvrez Sainte-Sophie, l\'église qui est devenue une mosquée.', es: 'Abre Hagia Sophia, la iglesia que se convirtió en mezquita.' } }] },
 { id: 'rome', tier: 0, reg: 'europe', t: { en: 'Rome at Its Height', zh: '鼎盛的罗马', de: 'Rom auf seiner Höhe', fr: 'Rome à sa hauteur', es: 'Roma en su apogeo' },
   d: { en: 'From the civil wars of the Republic to the empire of the second century.', zh: '从共和国末年的内战，到公元二世纪的帝国鼎盛。', de: 'Von den Bürgerkriegen der Republik bis zum Reich des zweiten Jahrhunderts.', fr: 'Des guerres civiles de la République à l’empire du IIe siècle.', es: 'Desde las guerras civiles de la República hasta el imperio del siglo II.' },
   rise: { n: 'Roman Empire', s: 100, r: 'europe' },
   steps: [
    { type: 'site', id: 'actium', t: { en: 'Open the Battle of Actium (31 BC), where Octavian defeated Antony and Cleopatra.', zh: '打开亚克兴海战（前 31 年），屋大维在此击败安东尼与克娄巴特拉。', de: 'Öffnen Sie die Schlacht von Actium (31 v. Chr.), wo Octavian Antony und Cleopatra besiegte.', fr: 'Ouvrez la bataille d\'Actium (31 av. J.-C.), où Octave a vaincu Antoine et Cléopâtre.', es: 'Abrir la batalla de Actium (31 aC), donde Octavio derrotó a Antonio y Cleopatra.' } },
    { type: 'person', id: 'augustus', t: { en: 'Find Augustus, the first emperor.', zh: '找到第一位皇帝奥古斯都。', de: 'Finde Augustus, den ersten Kaiser.', fr: 'Trouver Auguste, le premier empereur.', es: 'Encuentra a Augusto, el primer emperador.' } },
    { type: 'year', a: 100, b: 199, t: { en: 'Move the timeline to AD 100.', zh: '把时间轴拖到公元 100 年。', de: 'Verschieben Sie die Zeitlinie auf AD 100.', fr: 'Déplacez la ligne de temps à AD 100.', es: 'Mueva la línea de tiempo a AD 100.' } },
    { type: 'landmark', id: 'colosseum', t: { en: 'Open the Colosseum.', zh: '打开罗马斗兽场。', de: 'Öffnen Sie das Kolosseum.', fr: 'Ouvrez le Colisée.', es: 'Abre el Coliseo.' } }] },
 { id: 'changan', tier: 0, reg: 'asia', t: { en: 'Chang’an under the Tang', zh: '大唐长安', de: 'Chang\'an unter der Tang', fr: 'Chang\'an sous les Tang', es: 'Chang\'an bajo el Tang' },
   d: { en: 'The Tang capital was the largest city in the world and the eastern end of the Silk Road.', zh: '唐朝的都城是当时世界上最大的城市，也是丝绸之路的东端。', de: 'Die Hauptstadt Tang war die größte Stadt der Welt und das östliche Ende der Seidenstraße.', fr: 'La capitale Tang était la plus grande ville du monde et l\'extrémité orientale de la Route de la Soie.', es: 'La capital Tang era la ciudad más grande del mundo y el extremo oriental de la Ruta de la Seda.' },
   rise: { n: 'Tang Empire', s: 700, r: 'asia' },
   steps: [
    { type: 'region', r: 'asia', t: { en: 'Switch the map to Asia.', zh: '把地图切换到亚洲。', de: 'Wechseln Sie die Karte nach Asien.', fr: 'Changez la carte pour l\'Asie.', es: 'Cambiar el mapa a Asia.' } },
    { type: 'year', a: 700, b: 799, t: { en: 'Move the timeline to 700.', zh: '把时间轴拖到 700 年。', de: 'Verschiebe die Zeitlinie auf 700.', fr: 'Déplacez la ligne de temps à 700.', es: 'Mueva la línea de tiempo a 700.' } },
    { type: 'city', id: 'xian', t: { en: 'Open Chang’an (Xi’an).', zh: '打开长安（西安）。', de: 'Öffnen Sie Chang\'an (Xi\'an).', fr: 'Ouvrez Chang\'an (Xi\'an).', es: 'Abre Chang\'an (Xi\'an).' } },
    { type: 'person', id: 'xuanzang', t: { en: 'Find Xuanzang, the monk who walked to India.', zh: '找到西行求法的玄奘。', de: 'Finde Xuanzang, den Mönch, der nach Indien ging.', fr: 'Retrouvez Xuanzang, le moine qui a marché en Inde.', es: 'Encuentra a Xuanzang, el monje que caminó hacia la India.' } }] },
 { id: 'genghis', tier: 1, reg: 'asia', t: { en: 'The Mongol Storm', zh: '蒙古风暴', de: 'Der mongolische Sturm', fr: 'La tempête mongole', es: 'La tormenta mongola' },
   d: { en: 'Within a lifetime the Mongols built the largest land empire in history.', zh: '蒙古人在一代人之内建立了史上最大的陆上帝国。', de: 'Innerhalb eines Lebens errichteten die Mongolen das größte Landreich der Geschichte.', fr: 'En une vie, les Mongols ont construit le plus grand empire terrestre de l\'histoire.', es: 'Dentro de una vida los mongoles construyeron el imperio de la tierra más grande en la historia.' },
   rise: { n: 'Mongol Empire', s: 1200, r: 'asia' },
   steps: [
    { type: 'journey', id: 'genghis', t: { en: 'Start the journey of Genghis Khan (Journeys menu).', zh: '在“人物行迹”菜单中开始成吉思汗的行迹。', de: 'Beginnen Sie die Reise von Dschingis Khan (Reisemenü).', fr: 'Commencez le voyage de Gengis Khan (menu Voyages).', es: 'Comience el viaje de Genghis Khan (menú Viaje).' } },
    { type: 'city', id: 'karakorum', t: { en: 'Open Karakorum, the Mongol capital.', zh: '打开蒙古都城哈拉和林。', de: 'Offene Karakorum, die mongolische Hauptstadt.', fr: 'Open Karakorum, la capitale mongole.', es: 'Abre Karakorum, la capital mongola.' } },
    { type: 'site', id: 'ainjalut', t: { en: 'Open Ain Jalut (1260), where the Mamluks stopped the Mongols.', zh: '打开艾因贾鲁战役（1260 年），马穆鲁克在此挡住了蒙古军。', de: 'Öffnen Ain Jalut (1260), wo die Mamluken die Mongolen gestoppt.', fr: 'Ouvrez Ain Jalut (1260), où les Mamelouks ont arrêté les Mongols.', es: 'Abre Ain Jalut (1260), donde los mamelucos detuvieron a los mongoles.' } },
    { type: 'person', id: 'kublai-khan', t: { en: 'Find Kublai Khan, who founded the Yuan.', zh: '找到建立元朝的忽必烈。', de: 'Finden Sie Kublai Khan, der den Yuan gründete.', fr: 'Trouver Kublai Khan, qui a fondé le Yuan.', es: 'Encuentra a Kublai Khan, quien fundó el Yuan.' } }] },
 { id: 'silkroad', tier: 1, reg: 'asia', t: { en: 'Merchant of the Silk Road', zh: '丝路商人', de: 'Händler der Seidenstraße', fr: 'Marchand de la Route de la Soie', es: 'Mercader de la Ruta de la Seda' },
   d: { en: 'Follow the caravans from China to Central Asia, the road Marco Polo took.', zh: '跟着商队从中国走到中亚，这正是马可·波罗走过的路。', de: 'Folgen Sie den Karawanen von China nach Zentralasien, die Straße Marco Polo nahm.', fr: 'Suivez les caravanes de la Chine à l\'Asie centrale, la route Marco Polo a pris.', es: 'Siga las caravanas de China a Asia Central, el camino que tomó Marco Polo.' },
   rise: { n: 'Great Khanate', s: 1300, r: 'asia' },
   steps: [
    { type: 'layer', id: 'routes', t: { en: 'Turn on the Trade routes layer.', zh: '打开“贸易路线”图层。', de: 'Schalten Sie die Trade-Routen-Schicht ein.', fr: 'Activez la couche Routes commerciales.', es: 'Activa la capa de rutas comerciales.' } },
    { type: 'route', id: 'silk-road', t: { en: 'Click the Silk Road to open its card.', zh: '点击丝绸之路，打开路线卡片。', de: 'Klicken Sie auf die Seidenstraße, um ihre Karte zu öffnen.', fr: 'Cliquez sur la Route de la Soie pour ouvrir sa carte.', es: 'Haga clic en la Ruta de la Seda para abrir su tarjeta.' } },
    { type: 'city', id: 'samarkand', t: { en: 'Open Samarkand.', zh: '打开撒马尔罕。', de: 'Öffnen Sie Samarkand.', fr: 'Ouvrez Samarkand.', es: 'Abre Samarcanda.' } },
    { type: 'landmark', id: 'registan', t: { en: 'Open the Registan square.', zh: '打开雷吉斯坦广场。', de: 'Öffnen Sie das Registan-Quadrat.', fr: 'Ouvrez la place du Registan.', es: 'Abra la plaza Registan.' } },
    { type: 'person', id: 'marco-polo', t: { en: 'Find Marco Polo.', zh: '找到马可·波罗。', de: 'Finde Marco Polo.', fr: 'Trouver Marco Polo.', es: 'Encuentra a Marco Polo.' } }] },
 { id: 'conquest', tier: 1, reg: 'americas', t: { en: 'Empires of the New World', zh: '新大陆的帝国', de: 'Reiche der Neuen Welt', fr: 'Les Empires du Nouveau Monde', es: 'Imperios del Nuevo Mundo' },
   d: { en: 'Columbus’s voyage led within forty years to the fall of the Aztec and Inca empires.', zh: '哥伦布远航后不到四十年，阿兹特克与印加帝国相继覆灭。', de: 'Kolumbus Reise führte innerhalb von vierzig Jahren zum Fall der Azteken und Inka Reiche.', fr: 'Le voyage de Colomb a conduit dans les quarante ans à la chute des empires aztèque et inca.', es: 'El viaje de Colón llevó dentro de cuarenta años a la caída de los imperios azteca e inca.' },
   rise: { n: 'Viceroyalty of New Spain', s: 1600, r: 'americas' },
   steps: [
    { type: 'region', r: 'americas', t: { en: 'Switch the map to the Americas.', zh: '把地图切换到美洲。', de: 'Wechseln Sie die Karte auf Amerika.', fr: 'Changez la carte pour les Amériques.', es: 'Cambie el mapa a las Américas.' } },
    { type: 'journey', id: 'columbus', t: { en: 'Start the journey of Columbus.', zh: '开始哥伦布的行迹。', de: 'Beginnen Sie die Reise von Columbus.', fr: 'Commencez le voyage de Columbus.', es: 'Comience el viaje de Colón.' } },
    { type: 'site', id: 'tenochtitlan', t: { en: 'Open the fall of Tenochtitlan (1521).', zh: '打开特诺奇蒂特兰陷落（1521 年）。', de: 'Öffnen Sie den Fall von Tenochtitlan (1521).', fr: 'Ouvre la chute de Tenochtitlan (1521).', es: 'Abrir la caída de Tenochtitlan (1521).' } },
    { type: 'site', id: 'cajamarca', t: { en: 'Open Cajamarca (1532), where Pizarro seized Atahualpa.', zh: '打开卡哈马卡（1532 年），皮萨罗在此俘获阿塔瓦尔帕。', de: 'Öffnen Cajamarca (1532), wo Pizarro erobert Atahualpa.', fr: 'Ouvrez Cajamarca (1532), où Pizarro s\'est emparé d\'Atahualpa.', es: 'Abre Cajamarca (1532), donde Pizarro se apoderó de Atahualpa.' } },
    { type: 'layer', id: 'modern', t: { en: 'Turn on Modern borders to compare with today.', zh: '打开“今国界”，与今天对比。', de: 'Schalten Sie moderne Grenzen an, um mit heute zu vergleichen.', fr: 'Tournez sur les frontières modernes pour comparer avec aujourd\'hui.', es: 'Encienda las fronteras modernas para comparar con hoy.' } }] },
 { id: 'napoleon', tier: 2, reg: 'europe', t: { en: 'Napoleon’s Europe', zh: '拿破仑的欧洲', de: 'Napoleons Europa', fr: 'L\'Europe de Napoléon', es: 'La Europa de Napoleón' },
   d: { en: 'For a decade one man redrew the map of Europe.', zh: '有十年时间，一个人重画了欧洲地图。', de: 'Ein Jahrzehnt lang hat ein Mann die Karte von Europa überarbeitet.', fr: 'Pendant une décennie, un homme a redessiné la carte de l\'Europe.', es: 'Durante una década, un hombre rediseñó el mapa de Europa.' },
   rise: { n: 'France', s: 1800, r: 'europe' },
   steps: [
    { type: 'year', a: 1800, b: 1814, t: { en: 'Move the timeline to 1800.', zh: '把时间轴拖到 1800 年。', de: 'Verschieben Sie die Zeitlinie auf 1800.', fr: 'Déplacez la ligne de temps à 1800.', es: 'Mueva la línea de tiempo a 1800.' } },
    { type: 'spot', n: 'France', t: { en: 'Click open land inside France, away from the city dots.', zh: '在法国境内、远离城市圆点的空白处点击一下。', de: 'Klicken Sie auf offenes Land innerhalb Frankreichs, weg von den Stadtpunkten.', fr: 'Cliquez sur la terre ouverte en France, loin des points de la ville.', es: 'Haga clic en tierra abierta dentro de Francia, lejos de los puntos de la ciudad.' } },
    { type: 'quiz', t: { en: 'In 1812 the Grande Armée marched as far as which city?', zh: '1812 年，拿破仑大军最远打到了哪座城市？', de: 'Im Jahre 1812 marschierte die Grande Armée bis zu welcher Stadt?', fr: 'En 1812, la Grande Armée marchait jusqu’à quelle ville ?', es: 'En 1812 la Grande Armée marchó hasta qué ciudad?' }, o: [{ en: 'Moscow', zh: '莫斯科', de: 'Moskau', fr: 'Moscou', es: 'Moscú' }, { en: 'Vienna', zh: '维也纳', de: 'Wien', fr: 'Vienne', es: 'Viena' }, { en: 'Saint Petersburg', zh: '圣彼得堡', de: 'Sankt Petersburg', fr: 'Saint-Pétersbourg', es: 'San Petersburgo' }], a: 0 },
    { type: 'site', id: 'waterloo', t: { en: 'Open the Battle of Waterloo.', zh: '打开滑铁卢战役。', de: 'Öffne die Schlacht von Waterloo.', fr: 'Ouvrez la bataille de Waterloo.', es: 'Abrir la batalla de Waterloo.' } }] },
 { id: 'africa1914', tier: 2, reg: 'africa', t: { en: 'Africa in 1914', zh: '1914 年的非洲', de: 'Afrika im Jahre 1914', fr: 'L\'Afrique en 1914', es: 'África en 1914' },
   d: { en: 'By 1914 European powers had divided almost the whole continent.', zh: '到 1914 年，欧洲列强几乎瓜分了整个非洲大陆。', de: 'Bis 1914 hatten die europäischen Mächte fast den ganzen Kontinent geteilt.', fr: 'En 1914, les puissances européennes avaient divisé presque tout le continent.', es: 'En 1914, las potencias europeas habían dividido casi todo el continente.' },
   rise: { n: 'Abyssinia', s: 1914, r: 'africa' },
   steps: [
    { type: 'region', r: 'africa', t: { en: 'Switch the map to Africa.', zh: '把地图切换到非洲。', de: 'Wechseln Sie die Karte nach Afrika.', fr: 'Changez la carte pour l\'Afrique.', es: 'Cambiar el mapa a África.' } },
    { type: 'year', a: 1914, b: 1919, t: { en: 'Move the timeline to 1914.', zh: '把时间轴拖到 1914 年。', de: 'Verschieben Sie die Zeitlinie nach 1914.', fr: 'Déplacez la ligne de temps jusqu\'en 1914.', es: 'Mover la línea de tiempo a 1914.' } },
    { type: 'quiz', t: { en: 'Look at the map: which two African states were not under European rule in 1914?', zh: '看地图：1914 年哪两个非洲国家不受欧洲统治？', de: 'Sehen Sie sich die Karte an: Welche beiden afrikanischen Staaten standen 1914 nicht unter europäischer Herrschaft?', fr: 'Regardez la carte: quels deux États africains n\'étaient pas sous domination européenne en 1914?', es: 'Mira el mapa: ¿qué dos estados africanos no estaban bajo el dominio europeo en 1914?' }, o: [{ en: 'Ethiopia and Liberia', zh: '埃塞俄比亚和利比里亚', de: 'Äthiopien und Liberia', fr: 'Éthiopie et Libéria', es: 'Etiopía y Liberia' }, { en: 'Egypt and Morocco', zh: '埃及和摩洛哥', de: 'Ägypten und Marokko', fr: 'Égypte et Maroc', es: 'Egipto y Marruecos' }, { en: 'Sudan and Ethiopia', zh: '苏丹和埃塞俄比亚', de: 'Sudan und Äthiopien', fr: 'Soudan et Éthiopie', es: 'Sudán y Etiopía' }], a: 0 },
    { type: 'spot', n: 'Abyssinia', t: { en: 'Click open land inside Ethiopia (Abyssinia).', zh: '在埃塞俄比亚（阿比西尼亚）境内的空白处点击。', de: 'Klicken Sie auf offenes Land in Äthiopien (Abessinien).', fr: 'Cliquez sur la terre ouverte à l\'intérieur de l\'Ethiopie (Abyssinie).', es: 'Haga clic en tierra abierta dentro de Etiopía (Abisinia).' } },
    { type: 'site', id: 'adwa', t: { en: 'Open the Battle of Adwa (1896).', zh: '打开阿杜瓦战役（1896 年）。', de: 'Öffne die Schlacht von Adwa (1896).', fr: 'La bataille d\'Adwa (1896).', es: 'Abrir la batalla de Adwa (1896).' } }] },
 { id: 'greatwar', tier: 2, reg: 'europe', t: { en: 'The Great War', zh: '第一次世界大战', de: 'Der Große Krieg', fr: 'La Grande Guerre', es: 'La Gran Guerra' },
   d: { en: 'Four empires went to war in 1914; none of them survived it unchanged.', zh: '1914 年四大帝国卷入战争，没有一个原样幸存。', de: 'Vier Reiche gingen 1914 in den Krieg; keiner von ihnen überlebte es unverändert.', fr: 'Quatre empires sont entrés en guerre en 1914; aucun d\'entre eux n\'y a survécu inchangé.', es: 'Cuatro imperios fueron a la guerra en 1914; ninguno de ellos sobrevivió sin cambios.' },
   rise: { n: 'Austro-Hungarian Empire', s: 1914, r: 'europe' },
   steps: [
    { type: 'year', a: 1914, b: 1919, t: { en: 'Move the timeline to 1914.', zh: '把时间轴拖到 1914 年。', de: 'Verschieben Sie die Zeitlinie nach 1914.', fr: 'Déplacez la ligne de temps jusqu\'en 1914.', es: 'Mover la línea de tiempo a 1914.' } },
    { type: 'site', id: 'sarajevo', t: { en: 'Open Sarajevo, where the archduke was shot.', zh: '打开萨拉热窝，大公在此遇刺。', de: 'Öffnen Sie Sarajevo, wo der Erzherzog erschossen wurde.', fr: 'Ouvert Sarajevo, où l\'archiduc a été abattu.', es: 'Abre Sarajevo, donde el archiduque recibió un disparo.' } },
    { type: 'spot', n: 'Austro-Hungarian Empire', t: { en: 'Click open land inside Austria-Hungary.', zh: '在奥匈帝国境内的空白处点击。', de: 'Klicken Sie auf offenes Land in Österreich-Ungarn.', fr: 'Cliquez sur terre ouverte à l\'intérieur de l\'Autriche-Hongrie.', es: 'Haga clic en tierra abierta dentro de Austria-Hungría.' } },
    { type: 'site', id: 'verdun', t: { en: 'Open the Battle of Verdun (1916).', zh: '打开凡尔登战役（1916 年）。', de: 'Öffne die Schlacht von Verdun (1916).', fr: 'Bataille de Verdun (1916).', es: 'Abrir la batalla de Verdún (1916).' } },
    { type: 'quiz', t: { en: 'Move to 1920 if you like. Which of these no longer existed after the war?', zh: '可以拖到 1920 年看看。战后哪一个不复存在？', de: 'Welche davon gab es nach dem Krieg nicht mehr?', fr: 'Lequel d\'entre eux n\'existait plus après la guerre ?', es: 'Muévete a 1920 si quieres. ¿Cuál de estos ya no existía después de la guerra?' }, o: [{ en: 'Austria-Hungary', zh: '奥匈帝国', de: 'Österreich-Ungarn', fr: 'Autriche-Hongrie', es: 'Austria-Hungría' }, { en: 'The British Empire', zh: '大英帝国', de: 'Das Britische Reich', fr: 'L\' Empire britannique', es: 'El Imperio Británico' }, { en: 'Spain', zh: '西班牙', de: 'Spanien', fr: 'Espagne', es: 'España' }], a: 0 }] },
];
window.QUESTS = QUESTS; window.QUESTS_UI = UI;

// ---------- state ----------
const KEY = 'cm_quests';
let S = { done: {}, active: null, steps: 0, seen: [] };
try { S = Object.assign(S, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) {}
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };
const qById = Object.fromEntries(QUESTS.map(q => [q.id, q]));
const doneSteps = q => S.done[q.id] || [];
const isDone = q => doneSteps(q).length >= q.steps.length;
const curIdx = q => doneSteps(q).length;
const nDone = () => QUESTS.filter(isDone).length;
const msOpen = m => (m.kind === 'steps' ? S.steps : nDone()) >= m.n;

// ---------- UI shell ----------
const css = document.createElement('style');
css.textContent = `
#qBtn.tbtn{background:#a8322d;color:#fbf0d8;border-color:#7a1f1b;font-weight:600}
#qBtn.on{box-shadow:0 0 0 2px #c9a24a}
#qBar{position:absolute;left:50%;top:62px;transform:translateX(-50%);z-index:30;max-width:min(560px,92vw);background:rgba(251,243,224,.97);border:1px solid #c9a24a;border-radius:6px;box-shadow:0 4px 18px rgba(60,40,20,.25);padding:8px 12px;font-family:var(--serif);display:none}
#qBar .qt{font-size:12px;letter-spacing:.06em;color:var(--seal);text-transform:uppercase}
#qBar .qs{font-size:15px;margin:3px 0 6px;color:#2a1d10}
#qBar .qp{height:4px;background:#e8dcc0;border-radius:2px;overflow:hidden;margin:4px 0 6px}#qBar .qp i{display:block;height:100%;background:#c9a24a;transition:width .5s}
#qBar button{font-family:var(--serif);font-size:12px;border:1px solid #b79d6e;background:#fff8e8;border-radius:3px;padding:2px 9px;margin-right:6px;cursor:pointer}
#qBar .opt{display:block;width:100%;text-align:left;margin:4px 0;font-size:14px;padding:5px 9px}
#qBar .opt.no{border-color:#b33;color:#b33}
#qToast{position:absolute;left:50%;top:40%;transform:translate(-50%,-50%) scale(.9);z-index:40;background:rgba(42,29,16,.9);color:#fbf0d8;font:600 18px var(--serif);padding:12px 22px;border-radius:6px;opacity:0;pointer-events:none;transition:opacity .3s,A.transform .3s}
#qToast.show{opacity:1;transform:translate(-50%,-50%) scale(1)}
#map{transition:transform 1.1s cubic-bezier(.3,.7,.3,1);transform-origin:50% 62%}
#map.tilt{transform:perspective(1300px) rotateX(36deg) scale(.94)}
body.rising #map{cursor:wait}
body.rising text.plabel{opacity:0;transition:opacity .4s}
g.pol-wrap.rise-dim path.pol,.rise-dim path.pol{opacity:.38;transition:opacity .6s}
.qlist .qrow{border:1px solid #e1d3b2;border-radius:5px;padding:8px 10px;margin:6px 0;display:flex;gap:10px;align-items:center}
.qlist .qrow.done{background:#f3ead2}.qlist .qrow b{display:block;font-size:15px}.qlist .qrow span{font-size:12.5px;color:#7a6648}
.qlist .qrow button,.qms button{margin-left:auto;font-family:var(--serif);border:none;background:var(--seal);color:#fbf0d8;border-radius:3px;padding:4px 10px;cursor:pointer;white-space:nowrap}
.qlist .qrow.done button{background:#8a7350}
.qms{border-top:1px solid #e1d3b2;margin-top:12px;padding-top:6px}.qms .m{display:flex;gap:10px;align-items:center;margin:6px 0;font-size:13.5px}
.qms .m.lock{opacity:.5}.qms .m i{font-style:normal;font-size:18px}
.qcert{text-align:center;border:3px double #c9a24a;padding:18px;margin:8px 0;background:#fffaf0}.qcert h3{font-size:20px;margin:6px 0}
body.embed #qBtn,body.embed #qBar{display:none}`;
document.head.appendChild(css);
const tb = document.querySelector('.tbtn[data-t=journey]');
const btn = document.createElement('button'); btn.id = 'qBtn'; btn.className = 'tbtn'; btn.type = 'button'; btn.textContent = '⚑ ' + T(UI.btn); btn.title = T(UI.title);
if (tb) tb.parentNode.insertBefore(btn, tb);
const bar = document.createElement('div'); bar.id = 'qBar'; document.body.appendChild(bar);
const toastEl = document.createElement('div'); toastEl.id = 'qToast'; document.body.appendChild(toastEl);
let toastT; function toast(msg, ms = 1800) { toastEl.textContent = msg; toastEl.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('show'), ms); }

function listPanel() {
  const rows = QUESTS.map((q, i) => { const n = curIdx(q), d = isDone(q);
    return `${i % 3 === 0 ? `<div class="sec">${T(UI.tiers[q.tier])}</div>` : ''}<div class="qrow${d ? ' done' : ''}"><div><b>${d ? '✓ ' : ''}${T(q.t)}</b><span>${T(q.d)}</span><span> · ${n}/${q.steps.length}</span></div><button data-q="${q.id}">${d ? T(UI.replay) : n ? T(UI.resume) : T(UI.start)}</button></div>`; }).join('');
  const ms = UI.m.map((m, i) => `<div class="m${msOpen(m) ? '' : ' lock'}"><i>${['🏅', '🏙️', '⏳', '🏆'][i]}</i><div><b>${T(m.t)}</b><br>${T(m.d)}</div>${m.fx ? `<button data-fx="${m.fx}"${msOpen(m) ? '' : ' disabled'}>${msOpen(m) ? T(UI.play) : T(UI.locked)}</button>` : ''}</div>`).join('');
  openPanel(`<h2>${T(UI.title)}</h2><div class="bio">${T(UI.intro)}</div><div class="qlist">${rows}</div><div class="qms"><div class="sec">${T(UI.rewards)}</div>${ms}</div><p style="margin-top:14px;font-size:12px"><a href="javascript:void 0" id="qReset">${T(UI.reset)}</a></p>`);
  d3.selectAll('#pbody [data-q]').on('click', function () { const q = qById[this.dataset.q]; if (isDone(q)) S.done[q.id] = []; startQuest(q); });
  d3.selectAll('#pbody [data-fx]').on('click', function () { closePanel(); FX[this.dataset.fx](); });
  d3.select('#qReset').on('click', () => { if (confirm(T(UI.reset) + '?')) { S = { done: {}, active: null, steps: 0, seen: [] }; save(); renderBar(); listPanel(); } });
}
btn.onclick = () => listPanel();

function startQuest(q) {
  S.active = q.id; save(); closePanel();
  if (q.reg && q.reg !== A.region && q.steps[0].type !== 'region') setRegion(q.reg);
  renderBar(); setTimeout(autoCheck, 300);
}
function renderBar() {
  const q = S.active && qById[S.active];
  btn.classList.toggle('on', !!q);
  if (!q || isDone(q)) { bar.style.display = 'none'; return; }
  const i = curIdx(q), st = q.steps[i];
  bar.style.display = 'block';
  bar.innerHTML = `<div class="qt">⚑ ${T(q.t)} · ${T(UI.step)} ${i + 1}/${q.steps.length}</div><div class="qp"><i style="width:${100 * i / q.steps.length}%"></i></div><div class="qs">${T(st.t)}</div>
   ${st.type === 'quiz' ? st.o.map((o, k) => `<button class="opt" data-k="${k}">${T(o)}</button>`).join('') : ''}
   <button id="qHint">${T(UI.hint)}</button><button id="qList">${T(UI.list)}</button><button id="qQuit">${T(UI.quit)}</button>`;
  bar.querySelector('#qHint').onclick = () => hint(st);
  bar.querySelector('#qList').onclick = listPanel;
  bar.querySelector('#qQuit').onclick = () => { S.active = null; save(); renderBar(); };
  bar.querySelectorAll('.opt').forEach(b => b.onclick = () => { if (+b.dataset.k === st.a) complete(q, i); else { b.classList.add('no'); toast(T(UI.wrong), 1400); } });
}

// ---------- checking ----------
function sat(st, type, val) {
  switch (st.type) {
    case 'year': return A.year >= st.a && A.year <= st.b;
    case 'region': return A.region === st.r;
    case 'layer': return !!layers[st.id];
    case 'spot': return type === 'spot' && val === st.n;
    case 'quiz': return false;
    default: return type === st.type && val === st.id;
  }
}
function check(type, val) {
  const q = S.active && qById[S.active]; if (!q || isDone(q) || busy) return;
  const i = curIdx(q); if (sat(q.steps[i], type, val)) complete(q, i);
}
function autoCheck() { check('auto'); }
window.QEV = (type, val) => { check(type, val); };
let busy = false;
function complete(q, i) {
  (S.done[q.id] ||= []).push(i); S.steps++; save();
  burst();
  const ms = UI.m.find(m => m.kind === 'steps' && S.steps === m.n);
  if (isDone(q)) {
    renderBar(); bar.style.display = 'none'; busy = true;
    setTimeout(() => riseEmpire(q.rise.n, q.rise.s, q.rise.r, { label: T(q.t), sub: T(UI.questDone) }).then(() => {
      busy = false; const m = UI.m.find(m => m.kind === 'quests' && nDone() === m.n);
      if (m) { toast(`${T(UI.unlocked)}: ${T(m.t)}`, 2600); setTimeout(() => FX[m.fx](), 1600); }
      else listPanel();
    }), 700);
  } else {
    toast(ms ? `${T(UI.unlocked)}: ${T(ms.t)}` : `✓ ${T(UI.stepDone)}`, ms ? 2400 : 1300);
    if (ms) seal();
    renderBar(); setTimeout(autoCheck, 500);
  }
}

// ---------- hints ----------
function lookup(st) {
  if (st.type === 'city') return cityById[st.id] && cityById[st.id].c;
  if (st.type === 'site') { const s = window.SITES.find(x => x.id === st.id); return s && s.c; }
  if (st.type === 'landmark') { const m = (window.LANDMARKS || []).find(x => x.id === st.id); return m && m.c; }
  return null;
}
function hint(st) {
  const ll = lookup(st);
  if (ll) { flyTo(ll); setTimeout(() => pulse(ll), 900); return; }
  if (st.type === 'year') return setYear(st.a);
  if (st.type === 'region') return setRegion(st.r);
  if (st.type === 'person' || st.type === 'route') { const p = st.type === 'person' ? (window.PEOPLE || []).find(x => x.id === st.id) : (window.ROUTES || []).find(x => x.id === st.id); const inp = document.querySelector('#search'); if (p && inp) { inp.value = p.N || p.n.en; inp.dispatchEvent(new Event('input')); inp.focus(); } return; }
  if (st.type === 'journey' || st.type === 'layer') { const b = document.querySelector(`.tbtn[data-t=${st.type === 'journey' ? 'journey' : st.id}]`); if (b) { b.animate([{ boxShadow: '0 0 0 0 #c9a24a' }, { boxShadow: '0 0 0 8px rgba(201,162,74,0)' }], { duration: 700, iterations: 3 }); } return; }
  if (st.type === 'spot') { const f = A.curSnap != null && feats(A.curSnap).find(f => f.properties.n === st.n); if (f) flyTo(d3.geoCentroid(f)); }
}

// ---------- effects ----------
function burst(ll) {
  const c = [W() / 2, H() / 2 - 40], g = d3.select('#map').append('g').style('pointer-events', 'none');
  for (let i = 0; i < 3; i++) g.append('circle').attr('cx', c[0]).attr('cy', c[1]).attr('r', 6).attr('fill', 'none').attr('stroke', '#c9a24a').attr('stroke-width', 3).attr('opacity', .9)
    .transition().delay(i * 150).duration(900).ease(d3.easeCubicOut).attr('r', 120 + i * 40).attr('opacity', 0).attr('stroke-width', .5);
  setTimeout(() => g.remove(), 1500);
}
function seal() {
  const g = d3.select('#map').append('g').attr('transform', `translate(${W() / 2},${H() / 2 - 40})`).style('pointer-events', 'none');
  g.append('rect').attr('x', -46).attr('y', -46).attr('width', 92).attr('height', 92).attr('rx', 8).attr('fill', '#a8322d').attr('stroke', '#7a1f1b').attr('stroke-width', 3);
  g.append('text').attr('text-anchor', 'middle').attr('dy', '.35em').attr('fill', '#fbf0d8').attr('font-size', 30).attr('font-family', 'serif').text(K === 'zh' || K === 'zht' ? '寰宇' : 'CM');
  g.attr('opacity', 0).attr('transform', `translate(${W() / 2},${H() / 2 - 40}) scale(2.4)`).transition().duration(450).ease(d3.easeBackOut).attr('opacity', 1).attr('transform', `translate(${W() / 2},${H() / 2 - 40}) rotate(-8) scale(1)`)
    .transition().delay(1400).duration(600).attr('opacity', 0).remove();
}
function fitTo(f, dur = 1100) {
  const b = path.bounds(f), dx = b[1][0] - b[0][0], dy = b[1][1] - b[0][1];
  const k = Math.max(.8, Math.min(14, .62 / Math.max(dx / W(), dy / (H() - 200))));
  const cx = (b[0][0] + b[1][0]) / 2, cy = (b[0][1] + b[1][1]) / 2;
  return svg.transition().duration(dur).call(zoom.transform, d3.zoomIdentity.translate(W() / 2, (H() - 40) / 2).scale(k).translate(-cx, -cy)).end().catch(() => {});
}
const wait = ms => new Promise(r => setTimeout(r, ms));
async function showSnap(s, r) {
  if (r && r !== A.region) setRegion(r);
  if (snapFor(A.year) !== s) setYear(s);
  await ensure([s]); renderSnap(true);
}
// extrude polities: list of {f, h(px), label}
function extrude(items, o = {}) {
  const k = A.transform.k, g = gMap.append('g').attr('class', 'rise').style('pointer-events', 'none');
  const N = o.layers || 14, parts = items.map(it => {
    const d = path(it.f), col = d3.color(colorOf(it.f.properties.n)) || d3.color('#b08850');
    const side = d3.range(N).map(i => g.append('path').attr('d', d).attr('fill', col.darker(1.3 - .7 * i / N)).attr('stroke', col.darker(1.6)).attr('stroke-width', .4 / k).attr('opacity', 0));
    const top = g.append('path').attr('d', d).attr('fill', col.brighter(.45)).attr('stroke', '#c9a24a').attr('stroke-width', 1.6 / k).attr('opacity', 0);
    let lab = null;
    if (it.label) { const c = path.centroid(it.f); lab = g.append('g').attr('opacity', 0);
      lab.append('text').attr('x', c[0]).attr('y', c[1]).attr('text-anchor', 'middle').attr('font-family', 'var(--serif), serif').attr('font-weight', 700).attr('font-size', 26 / k).attr('fill', '#2a1d10').attr('stroke', '#fbf3e0').attr('stroke-width', 5 / k).attr('paint-order', 'stroke').text(it.label);
      if (it.sub) lab.append('text').attr('x', c[0]).attr('y', c[1] + 24 / k).attr('text-anchor', 'middle').attr('font-family', 'var(--serif), serif').attr('font-size', 15 / k).attr('fill', '#a8322d').attr('stroke', '#fbf3e0').attr('stroke-width', 4 / k).attr('paint-order', 'stroke').text(it.sub); }
    return { side, top, lab, H: it.h / k, c: path.centroid(it.f) };
  });
  const set = t => parts.forEach(p => { const h = p.H * t; p.side.forEach((s, i) => s.attr('transform', `translate(0,${-h * i / N})`).attr('opacity', Math.min(1, t * 3))); p.top.attr('transform', `translate(0,${-h})`).attr('opacity', Math.min(1, t * 3)); if (p.lab) p.lab.attr('transform', `translate(0,${-h - 8 / k})`).attr('opacity', t); });
  const anim = (a, b, ms, ease) => new Promise(res => { const tm = d3.timer(e => { const x = Math.min(1, e / ms); set(a + (b - a) * ease(x)); if (x >= 1) { tm.stop(); res(); } }); });
  return { up: (ms = 1600) => anim(0, 1, ms, d3.easeCubicOut), down: (ms = 900) => anim(1, 0, ms, d3.easeCubicIn).then(() => g.remove()), g };
}
async function begin() { busy = true; document.body.classList.add('rising'); closePanelSilent && closePanelSilent(); gPol.classed('rise-dim', true); d3.select('#map').classed('tilt', true); await wait(500); }
async function end() { d3.select('#map').classed('tilt', false); gPol.classed('rise-dim', false); await wait(700); document.body.classList.remove('rising'); busy = false; }
async function riseEmpire(n, s, r, o = {}) {
  await showSnap(s, r);
  const f = feats(s).find(f => f.properties.n === n); if (!f) return;
  await fitTo(f); await begin();
  const ex = extrude([{ f, h: o.h || 46, label: o.label || zhOf(n), sub: o.sub }], { layers: 16 });
  await ex.up(1700); await wait(o.hold || 2600); await ex.down(); await end();
}
const area = f => d3.geoArea(f);
const FX = {
  async skyline() {
    const s = A.curSnap; if (s == null) return;
    const vis = feats(s).filter(f => f.properties.n && f.properties.n.trim() && !isTribal(f.properties.n) && (A.region === 'world' || regionOf(d3.geoCentroid(f)) === A.region)).sort((a, b) => area(b) - area(a)).slice(0, 12);
    if (!vis.length) return; const max = Math.sqrt(area(vis[0]));
    svg.transition().duration(900).call(zoom.transform, regionT(A.region)); await wait(950); await begin();
    const ex = extrude(vis.map((f, i) => ({ f, h: 12 + 48 * Math.sqrt(area(f)) / max, label: i < 5 ? zhOf(f.properties.n) : null })), { layers: 12 });
    await ex.up(2000); await wait(3200); await ex.down(); await end();
  },
  async timelapse() {
    const r = A.region, list = A.SNAPS.filter((s, i) => i % Math.ceil(A.SNAPS.length / 9) === 0);
    svg.transition().duration(900).call(zoom.transform, regionT(r)); await wait(950);
    for (const s of list) {
      await showSnap(s, r);
      const f = feats(s).filter(f => f.properties.n && f.properties.n.trim() && !isTribal(f.properties.n) && (r === 'world' || regionOf(d3.geoCentroid(f)) === r)).sort((a, b) => area(b) - area(a))[0];
      if (!f) continue; await begin();
      const ex = extrude([{ f, h: 40, label: zhOf(f.properties.n), sub: fmtY(s) }]); await ex.up(900); await wait(900); await ex.down(500); await end();
    }
  },
  async finale() {
    for (const q of QUESTS) await riseEmpire(q.rise.n, q.rise.s, q.rise.r, { label: T(q.t), sub: fmtY(q.rise.s), hold: 1100, h: 36 });
    showSnap(A.SNAPS[A.SNAPS.length - 1], 'world'); svg.transition().duration(900).call(zoom.transform, regionT('world'));
    const date = new Date().toLocaleDateString(LG);
    openPanel(`<div class="qcert"><div style="font-size:42px">🏆</div><h3>${T(UI.cert)}</h3><p>${T(UI.certText)}</p><p class="latin">${QUESTS.map(q => T(q.t)).join(' · ')}</p><p>${date} · chronicamaps.com</p></div><button id="qShare" style="font-family:var(--serif);background:var(--seal);color:#fbf0d8;border:none;border-radius:3px;padding:6px 14px;cursor:pointer">${T(UI.share)}</button>`);
    const b = document.getElementById('qShare'); if (b) b.onclick = () => { navigator.clipboard && navigator.clipboard.writeText(T(UI.shareText)); b.textContent = T(UI.copied); };
  },
};
window.QUEST_FX = FX; window.riseEmpire = riseEmpire;
renderBar(); setTimeout(autoCheck, 1500);
}
if (window.APPX) init(); else document.addEventListener('appx', init, { once: true });
})();
