// 本地化：在 app.js 之前把数据与界面切换到当前语言
(function(){
const L=window.LANG, U=window.U=window.UI[L]||window.UI["zh-Hans"];
const zh=/^zh/.test(L), di={de:0,fr:1,es:2}[L], li={en:0,de:1,fr:2,es:3}[L];
const FIX={"Burgandy":"Burgundy","Castille":"Castile","Castilla":"Castile","Irlanda":"Irish kingdoms","Britany":"Brittany","Cyraneica (UK Lybia)":"Cyrenaica (UK)","Tripolitana (UK Lybia)":"Tripolitania (UK)","Fezzan (Frech Lybia)":"Fezzan (France)","?":"Unknown","Turcik tribes":"Turkic tribes","Kyivan Rus":"Kievan Rus'","Kievan Rus":"Kievan Rus'","Mascat":"Muscat","Watassid Morocco":"Wattasid Morocco","Mamluke Sultanate":"Mamluk Sultanate","Byelarus":"Belarus","Peshemegs":"Pechenegs","Samoyèdes":"Samoyeds","Quazaq Khanate":"Kazakh Khanate","Kwarezm":"Khwarezm","Imperial Hungary":"Royal Hungary","Turingians":"Thuringians","Boihaenum":"Bohemia (Marcomanni)","Dumonii":"Dumnonia","Saami":"Sámi","Sami":"Sámi","Samis":"Sámi","Suomi":"Finns","Polanes":"Polans","Etrurians":"Etruscans","Sabini":"Sabines","Sarmates":"Sarmatians","Alamans":"Alemanni"};
const enName=n=>{n=n.trim();return FIX[n]||n};
window.polName=n=>{
  if(zh) return window.POLITY_ZH[n]||window.POLITY_ZH[n.trim()]||n.trim();
  if(di!==undefined){const t=window.POLITY_DFE[n]||window.POLITY_DFE[n.trim()];if(t)return t[di]}
  return enName(n);
};
window.secName=n=>{if(zh)return enName(n);const e=enName(n);return window.polName(n)===e?"":e};

if(!zh){
  const E=window.CONTENT_EN, P=window.PLACE_NAMES;
  const strip=s=>s.replace(/[　-〿一-鿿＀-￯“”]+/g," ").replace(/\s+/g," ").replace(/\s*\/\s*$/,"").trim();
  window.CITIES.forEach(c=>{const e=E.cities[c.id];if(!e)return;
    c._k=c.zh+" "+e.n; c.zh=di!==undefined&&P[c.id]?P[c.id][di]:e.n; c.bio=e.bio;
    c.ev=c.ev.map((x,i)=>[x[0],e.ev[i]||x[1]]);
    c.names=c.names.map((n,i)=>[n[0],(e.names&&e.names[i])||strip(n[1])||e.n,e.notes[i]||""]);});
  window.SITES.forEach(s=>{s._k=s.zh+" "+s.en;const nm=di!==undefined&&P[s.id]?P[s.id][di]:s.en;s.d=E.sites[s.id]||s.d;s.en=nm===s.en?"":s.en;s.zh=nm});
  window.EVENTS.forEach((e,i)=>{e._k=e[1];e[1]=E.events[i]||e[1]});
  window.ERAS.forEach((e,i)=>{e[2]=di!==undefined?window.ERA_NAMES[i][di]:E.eras[i][0];e[3]=E.eras[i][1]});
  for(const r in (window.REGION_ERAS||{}))window.REGION_ERAS[r].forEach((e,i)=>{e[2]=di!==undefined?window.REGION_ERA_NAMES[r][i][di]:E.regionEras[r][i][0];e[3]=E.regionEras[r][i][1]});
  window.RULERS.forEach(R=>{R.t=di!==undefined?window.REALM_NAMES[R.k][di]:E.rulersT[R.k];R.list.forEach((r,i)=>{r[2]=E.rulers[R.k][i]||r[2]})});
  window.JOURNEYS.forEach(j=>{const e=E.journeys[j.id];j._k=j.zh+" "+j.who;j.who=strip(j.who.replace(/“[^”]*”/g,"")).replace(/^[\s·]+/,"");j.zh=di!==undefined?window.JOURNEY_NAMES[j.id][di]:e.t;
    j.span=j.span.replace(/前 (\d+)/g,(m,y)=>U.yShort(-y));j.stops.forEach((s,i)=>{s[1]=e.stops[i][0];s[3]=e.stops[i][1]})});
  window.LINEAGES.forEach(x=>{x[1]=window.LINEAGE_NAMES[x[0]][li]});
}

// 名胜古迹
(window.LANDMARKS||[]).forEach(m=>{
  const nk=L==="zh-Hant"?"zht":zh?"zh":L;
  m.N=m.n[nk]||m.n.en; m.N2=zh?m.n.en:(m.N===m.n.en?"":m.n.en);
  m.D=L==="zh-Hant"?m.d.zht:zh?m.d.zh:m.d.en;
  const ci={"zh-Hans":0,"zh-Hant":0,de:1,fr:2,es:3}[L];
  m.C=ci===undefined?m.country:(L==="zh-Hant"?m.countryNames.zht:m.countryNames[["zh","de","fr","es"][ci]]);
  m._k=[m.n.zh,m.n.en,m.country].join(" ");
  const th=m.img.then; if(th) th.C=L==="zh-Hant"?th.capZht:zh?th.capZh:th.cap;
});
(window.ROUTES||[]).forEach(r=>{
  r.N=L==="zh-Hant"?r.n.zht:zh?r.n.zh:(r.n[L]||r.n.en); r.D=L==="zh-Hant"?r.d.zht:zh?r.d.zh:r.d.en;
  r.pts.forEach(p=>{if(p[2])p.L=L==="zh-Hant"?(p[4]||p[3]):zh?(p[3]||p[2]):p[2]});
});
// 静态界面
document.documentElement.lang=L; document.title=U.title+(zh?" · ":" · ")+U.sub.split(" · ")[0];
if(!zh) document.body.classList.add("latin");
if(L==="zh-Hant") document.body.classList.add("hant");
const $=s=>document.querySelector(s);
$("#title h1").innerHTML=`<span class="seal">${U.seal}</span>${U.title}`;
$("#title .sub").textContent=U.sub;
$("#search").placeholder=U.search;
document.querySelectorAll(".tbtn").forEach(b=>{b.textContent=U["t_"+b.dataset.t]});
$("#legend h3").textContent=U.legend;
$("#note").innerHTML=U.note;
const ld=$("#loading");if(ld)ld.textContent=U.loading;
$("#bPrev").title=U.bPrev;$("#bPlay").title=U.bPlay;$("#bNext").title=U.bNext;
// 语言切换
const sel=$("#langSel");sel.title=U.lang;
window.LANGS.forEach(([k,n])=>{const o=document.createElement("option");o.value=k;o.textContent=n;if(k===L)o.selected=true;sel.appendChild(o)});
sel.addEventListener("change",()=>{const v=sel.value;try{localStorage.setItem("euLang",v)}catch(e){}
  const code=window.LANG_CODES[v];let h=location.hash.slice(1).replace(/(^|-)l-[a-z]+/,"");h=(h?h+"-":"")+"l-"+code;
  location.hash=h;location.reload()});
})();
