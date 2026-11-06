# 寰宇时序 · Chronica Mundi

An interactive historical atlas of the world, 500 BC – present. It opens on Europe, with one-click views for Asia, Africa, Oceania and the whole world. Drag the timeline to watch borders change, click any city to read its name history and events, follow historical journeys, and test yourself with the place-name quiz. Interface in 简体中文 / 繁體中文 / English / Deutsch / Français / Español.

Deployed on Vercel: `node build.mjs` writes `dist/`, which holds the app, about 780 static SEO pages, static SVG maps, and the border data split by year (`atlas/<year>.json`), loaded on demand.

## Data sources
- Historical polity outlines: [aourednik/historical-basemaps](https://github.com/aourednik/historical-basemaps) (GPL-3.0), simplified.
- Land, rivers and lakes: [Natural Earth](https://www.naturalearthdata.com/) (public domain).
- Inspired by [江山时序 Jiangshan Atlas](https://github.com/DeanChensj/jiangshan-map).

Historical borders are schematic approximations, not surveyed boundaries.

## License
GPL-3.0 (see LICENSE), following the historical-basemaps data it derives from.
