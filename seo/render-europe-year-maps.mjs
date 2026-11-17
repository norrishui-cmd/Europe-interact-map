// Regenerate the three editorial year maps from the same geometry as the atlas.
// From the repository root: node seo/render-europe-year-maps.mjs
import fs from 'node:fs';
import { geoAzimuthalEqualArea, geoGraticule, geoMercator, geoPath } from 'd3-geo';

const root = new URL('../', import.meta.url);
const read = file => JSON.parse(fs.readFileSync(new URL(file, root)));
const atlas = read('atlas.json').data;
const physical = read('physical.json');
const width = 620;
const ink = '#213b38';
const water = '#cbe1e6';
const neutral = '#e9e2cd';
const seaInk = '#486877';
const face = 'DejaVu Sans,Arial,sans-serif';
const europe = geoAzimuthalEqualArea().rotate([-17,-54]).translate([300,280]).scale(685);
const central = geoMercator().center([15.15,49.9]).translate([310,205]).scale(2850);
const key1300 = {
  'English territory':'#d5a1a2', France:'#bbd0ab', 'Holy Roman Empire':'#eed2a2',
  'Papal States':'#d49574', Granada:'#61a79c', 'Byzantine Empire':'#b2a2c7',
  'Khanate of the Golden Horde':'#dac688', Novgorod:'#bac7b0', Castile:'#e4bb96',
  Hungary:'#d4b5b3', Sweden:'#e2dcc1', Norway:'#d6c4a5', 'Aragón':'#eacbaa',
};
const key1938 = {Germany:'#cd8769', Czechoslovakia:'#77afa5', Poland:'#dbc997',
  USSR:'#cfbea6',France:'#b9cbb3', Italy:'#d9c4ae', Spain:'#e2c7a6', Sweden:'#c7cdb1',
  Norway:'#e4cdb5', 'United Kingdom':'#cabdb2', Romania:'#ded0ab', Yugoslavia:'#c6c5a9'};

function text(x,y,lines,{size=19,weight=600,anchor='middle',color=ink,halo=true,italic=false,gap=19}={}) {
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="${face}" font-size="${size}" font-weight="${weight}" font-style="${italic?'italic':'normal'}" fill="${color}" ${halo?'paint-order="stroke" stroke="#f4f3df" stroke-width="3.2" stroke-linejoin="round"':''}>${[].concat(lines).map((line,i)=>`<tspan x="${x}" dy="${i?gap:0}">${line}</tspan>`).join('')}</text>`;
}
function city(project,lonlat,label,tx,ty,anchor='start') {
  const [x,y]=project(lonlat).map(n=>+n.toFixed(1));
  const endX=anchor==='end'?tx+4:tx-4;
  return `<path d="M${x},${y} L${endX},${ty-5}" fill="none" stroke="#f5f3df" stroke-width="3.3"/><path d="M${x},${y} L${endX},${ty-5}" fill="none" stroke="${ink}" stroke-width="1.3"/><circle cx="${x}" cy="${y}" r="4.3" fill="${ink}" stroke="#fff9e8" stroke-width="1.5"/>${text(tx,ty,label,{size:20,anchor})}`;
}
function geography(year,project,top,bottom,palette) {
  project.clipExtent([[0,top],[width,bottom]]);
  const path=geoPath(project).digits(1);
  const shape=(obj,attrs)=>{const d=path(obj);return d?`<path d="${d}" ${attrs}/>`:''};
  const borders=atlas[year].features.filter(f=>f.properties.n).map(f=>shape(f,`fill="${palette[f.properties.n]||neutral}" stroke="#776f5e" stroke-width=".65" stroke-linejoin="round"`)).join('');
  const grid=geoGraticule().step([15,10])();
  return {path,base:`<rect y="${top}" width="${width}" height="${bottom-top}" fill="${water}"/>${shape(grid,'fill="none" stroke="#a4c2c6" stroke-width=".65"')}${shape(physical.land,`fill="${neutral}" stroke="#839792" stroke-width=".65"`)}${borders}${shape(physical.lakes,`fill="${water}" stroke="#9ab7b9" stroke-width=".5"`)}`};
}
function save(name,height,title,description,body) {
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1240" height="${height*2}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title description"><title id="title">${title}</title><desc id="description">${description}</desc><metadata>Chronica Maps. Political boundaries from historical-basemaps (GPL-3.0). Physical geography from Natural Earth. Approximate geographic reconstruction.</metadata><rect width="${width}" height="${height}" fill="#f7f4e9"/>${body}</svg>`;
  fs.writeFileSync(new URL(`seo/assets/${name}.svg`,root),svg);
}
function title(label){return text(17,32,label,{size:24,weight:700,anchor:'start',halo:false})}
function sea(x,y,label){return text(x,y,label,{size:16,weight:400,color:seaInk,halo:false,italic:true})}
function key(x,y,color,label){return `<rect x="${x}" y="${y-14}" width="18" height="15" rx="2" fill="${color}" stroke="#675e53" stroke-width=".8"/>`+text(x+25,y,label,{size:17,weight:500,anchor:'start',halo:false})}

const frame={top:45,bottom:495};
{
  const {base}=geography(1300,europe,frame.top,frame.bottom,key1300);
  const capital=(...args)=>city(europe,...args);
  const labels=sea(81,224,['Atlantic','Ocean'])+sea(527,435,'Black Sea')+
    text(305,275,['Holy Roman','Empire'],{size:20})+`<path d="M298,300 L267,321" stroke="${ink}" stroke-width="1.4"/>`+
    text(442,176,'Novgorod',{size:19})+text(520,304,['Golden','Horde'])+
    text(137,410,'Castile',{size:18})+text(358,365,'Hungary',{size:18})+
    capital([-.12,51.5],'London',147,267,'end')+capital([2.35,48.85],'Paris',146,335,'end')+
    capital([-3.6,37.18],'Granada',48,458)+capital([12.5,41.9],'Rome',232,453,'end')+
    capital([28.98,41.01],'Constantinople',433,470);
  const legend=key(15,525,key1300['English territory'],'English crown')+key(205,525,key1300.France,'France')+key(360,525,key1300['Papal States'],'Papal States')+
    key(15,555,key1300.Granada,'Granada')+key(205,555,key1300['Byzantine Empire'],'Byzantine Empire');
  save('medieval-europe-1300-realms',572,'Europe in 1300','Selected medieval realms and five cities across Europe. Map colours are identified in the legend.',title('Europe in 1300 · Realms and cities')+base+labels+legend);
}
{
  const {base}=geography(1938,europe,frame.top,frame.bottom,key1938);
  const labels=sea(67,228,['Atlantic','Ocean'])+text(155,252,['United','Kingdom'],{size:19})+
    text(196,353,'France')+text(141,417,'Spain')+text(244,303,'Germany',{size:19})+
    text(348,294,'Poland',{size:19})+text(459,195,'Soviet Union')+text(289,170,'Sweden',{size:18})+
    text(256,423,'Italy',{size:19})+text(398,370,'Romania',{size:18})+
    text(344,416,'Yugoslavia',{size:17})+sea(520,432,'Black Sea');
  const centre=central.invert([310,205]);
  const [cx,cy]=europe(centre);
  const marker=`<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="11" fill="none" stroke="#203e3e" stroke-width="1.8" stroke-dasharray="3 2"/>`;
  const legend=key(15,524,key1938.Germany,'Germany')+key(165,524,key1938.Czechoslovakia,'Czechoslovakia')+`<circle cx="391" cy="518" r="9" fill="none" stroke="${ink}" stroke-width="1.8" stroke-dasharray="3 2"/>`+text(408,524,'Detail map below',{size:17,weight:500,anchor:'start',halo:false});
  save('europe-1938-political-borders',542,'Europe in 1938','European political boundaries with Germany and Czechoslovakia highlighted. A dotted circle marks the area of the Central Europe detail map.',title('Europe in 1938 · Political borders')+base+labels+marker+legend);
}
{
  const mapTop=46,mapBottom=415;
  const {base,path}=geography(1938,central,mapTop,mapBottom,{Germany:'#ddbca4',Czechoslovakia:key1938.Czechoslovakia});
  const polygon=(year,name)=>path(atlas[year].features.find(f=>f.properties.n===name));
  const germany=polygon(1938,'Germany');
  const overlay=`<defs><clipPath id="de"><path d="${germany}"/></clipPath></defs><g clip-path="url(#de)"><path d="${polygon(1930,'Austria')}" fill="#d49a69"/><path d="${polygon(1930,'Czechoslovakia')}" fill="#a47794"/></g><path d="${germany}" fill="none" stroke="#6f665c" stroke-width="1"/>`;
  const labels=text(112,164,'Germany',{size:21})+text(535,87,'Poland',{size:21})+text(530,383,'Hungary',{size:19})+
    text(412,236,'Czechoslovakia',{size:20})+city(central,[15.056,50.768],'Liberec',347,120)+
    city(central,[14.42,50.08],'Prague',233,233,'end')+city(central,[16.37,48.21],'Vienna',391,353);
  const legend=key(16,445,'#d49a69','Austrian territory annexed by Germany')+
    key(16,473,'#a47794','Czechoslovak borderlands annexed by Germany')+
    key(16,501,key1938.Czechoslovakia,'Czechoslovakia in the 1938 map');
  save('central-europe-1938-vienna-liberec-prague',518,'Central Europe in 1938','Vienna and Liberec fall within Germany, and Prague falls within Czechoslovakia on the atlas. Coloured areas compare the atlas’s 1930 and 1938 borders.',title('Central Europe · The 1938 border changes')+base+overlay+labels+legend);
}
