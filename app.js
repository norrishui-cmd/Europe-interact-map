/* 寰宇时序 · Chronica Mundi — 主程序 */
// 嵌入模式（?embed=1）：隐藏面板与导航，只留地图、时间轴和回到本站的链接
if(new URLSearchParams(location.search).has("embed")){document.body.classList.add("embed");const a=document.createElement("a");a.id="embedLink";a.target="_blank";a.rel="noopener";a.textContent="Chronica Maps ↗";a.href="https://chronicamaps.com/"+location.hash;document.body.appendChild(a);window.addEventListener("hashchange",()=>{a.href="https://chronicamaps.com/"+location.hash})}
(function(){
const MINY=-500, MAXY=2026;
const W=()=>window.innerWidth, H=()=>window.innerHeight;
let ATLAS=null, PHYS=null, SNAPS=[], IDXA=null, HIST=null, region="europe", SF=1, year=-27, curSnap=null, transform=d3.zoomIdentity;
const layers={cities:true,sites:true,landmarks:true,rivers:true,ghost:true,modern:false,routes:false};
let journey=null, jIdx=0, quiz=null, playing=null, hoverName=null;

// ---------- 工具 ----------
const U=window.U, LANG=window.LANG, IS_ZH=/^zh/.test(LANG);
const fmtY=y=>U.yShort(y);
const fmtYFull=y=>U.yFull(y);
const fill=(s,o)=>s.replace(/\{(\w+)\}/g,(m,k)=>o[k]);
const zhOf=n=>window.polName(n);
const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
function hash(s){let h=0;for(const c of s)h=(h*31+c.charCodeAt(0))|0;return Math.abs(h)}
function lineage(n){for(const L of window.LINEAGES) if(L[3].test(n)) return L; return null}
function isTribal(n){return window.TRIBAL.test(n)||!!(window.TRIBAL_SET&&window.TRIBAL_SET.has(n))}
function colorOf(n){const L=lineage(n); if(L) return L[2]; if(isTribal(n)) return "#d6c6a0"; return window.FALLBACK_COLORS[hash(n)%window.FALLBACK_COLORS.length]}
const cityById=Object.fromEntries(window.CITIES.map(c=>[c.id,c]));
const siteById=Object.fromEntries(window.SITES.map(s=>[s.id,s]));
const placeById=id=>cityById[id]||siteById[id];

// 时间轴非线性刻度
const tScale=d3.scaleLinear().domain([-500,0,1000,1500,1800,2026]).range([0,.17,.43,.62,.81,1]).clamp(true);

// ---------- 投影与图层 ----------
const svg=d3.select("#map");
// 区域视图：欧洲 / 亚洲 / 非洲 / 大洋洲 / 世界
// 平面地图（米勒圆柱投影），各大洲按钮只是缩放到对应范围
const REGIONS={
  europe:{c:[17,53],box:[-24,34,58,71.5]},
  asia:{c:[95,32],box:[34,-8,148,56]},
  africa:{c:[18,3],box:[-19,-35,52,37.5]},
  americas:{c:[-80,15],box:[-126,-56,-34,62]},
  oceania:{c:[155,-22],box:[110,-48,182,0]},
  world:{c:[11,0],box:[-168.9,-57,190.9,84]}
};
const REGION_KEYS=Object.keys(REGIONS);
function millerRaw(l,p){return [l,1.25*Math.log(Math.tan(Math.PI/4+.4*p))]}
millerRaw.invert=(x,y)=>[x,2.5*Math.atan(Math.exp(.8*y))-.625*Math.PI];
function makeProj(){return d3.geoProjection(millerRaw).rotate([-11,0]).precision(.3)}
let projection=makeProj();
const path=d3.geoPath(projection);
function vis(ll){return true}
function inRegion(ll){return region==="world"||regionOf(ll)===region}
function regionOf(ll){let best="world",bd=1e9;for(const k of REGION_KEYS){const R=REGIONS[k];if(k==="world")continue;const [x0,y0,x1,y1]=R.box;let lon=ll[0];if(lon<x0)lon+=360;const inBox=lon>=x0-4&&lon<=x1+4&&ll[1]>=y0-4&&ll[1]<=y1+4;const d=d3.geoDistance(ll,R.c);if(inBox&&d<bd){bd=d;best=k}}return best}
const seaRect=svg.append("rect").attr("class","sea");
const gMap=svg.append("g");
const gLand=gMap.append("g"), gPol=gMap.append("g"), gLake=gMap.append("g"), gRiv=gMap.append("g"), gGhost=gMap.append("g"), gModern=gMap.append("g"), gRoute=gMap.append("g").attr("class","routes"), gTex=gMap.append("g"), gJ=gMap.append("g");
const gOver=svg.append("g"), gLab=gOver.append("g"), gRL=gOver.append("g"), gSites=gOver.append("g"), gLm=gOver.append("g"), gCities=gOver.append("g"), gJS=gOver.append("g"), gQuiz=gOver.append("g"), gPulse=gOver.append("g");
const tip=d3.select("#tip");

function boxPts(b){const [x0,y0,x1,y1]=b,pts=[];for(let x=x0;x<=x1;x+=1){pts.push([x,y0],[x,y1])}for(let y=y0;y<=y1;y+=1){pts.push([x0,y],[x1,y])}return {type:"MultiPoint",coordinates:pts}}
function viewExt(r){const pad=W()<760?6:40;return [[W()>1100&&r!=="world"?pad+150:pad,W()<760?150:pad+30],[W()-pad,H()-(W()<760?190:130)]]}
// 某区域在当前底图坐标中的缩放变换
function regionT(r){
  const [[x0,y0],[x1,y1]]=path.bounds(boxPts(REGIONS[r].box)),[[a0,b0],[a1,b1]]=viewExt(r);
  const k=Math.min((a1-a0)/(x1-x0),(b1-b0)/(y1-y0));
  return d3.zoomIdentity.translate((a0+a1)/2,(b0+b1)/2).scale(k).translate(-(x0+x1)/2,-(y0+y1)/2);
}
function fit(){
  projection.fitExtent(viewExt("world"),boxPts(REGIONS.world.box));
  SF=1/regionT("europe").k;
  for(const k in labelCache)delete labelCache[k];
  svg.attr("width",W()).attr("height",H()); seaRect.attr("width",W()).attr("height",H());
}

let legT=null;
const zoom=d3.zoom().scaleExtent([.8,120]).on("zoom",e=>{transform=e.transform;gMap.attr("transform",transform);placeOverlays()}).on("end",()=>{clearTimeout(legT);legT=setTimeout(()=>{if(curSnap!==null)buildLegend()},250)});
svg.call(zoom).on("dblclick.zoom",null);

// ---------- 数据加载 ----------
// 边界数据按年份分片懒加载：atlas/index.json + atlas/<年份>.json
const SNAP_DATA={}, SNAP_REQ={};
function ensure(list){return Promise.all(list.filter(s=>s!==null&&s!==undefined).map(s=>{s=String(s);if(SNAP_DATA[s])return SNAP_DATA[s];return SNAP_REQ[s]||(SNAP_REQ[s]=d3.json(`atlas/${s}.json?v=${window.APP_V||""}`).then(d=>{SNAP_DATA[s]=d;return d}))}))}
function ensureAll(){return ensure(SNAPS)}
Promise.all([d3.json("atlas/index.json?v="+(window.APP_V||"")),d3.json("geo/land.json?v="+(window.APP_V||""))]).then(([a,t])=>{
  const p={land:topojson.feature(t,t.objects.land),lakes:topojson.feature(t,t.objects.lakes),rivers:{type:"FeatureCollection",features:[]}};
  IDXA=a; PHYS=p; SNAPS=a.snaps; ATLAS={data:SNAP_DATA};
  const h=decodeURIComponent(location.hash.slice(1));const m=h.match(/(?:^|-)r-([a-z]+)/);if(m&&REGIONS[m[1]])region=m[1];
  fit(); transform=regionT(region);svg.call(zoom.transform,transform); drawPhysical(); buildTimeline(); buildQuick(); buildRegionBar(); readHash();
  // first visit: show the short tips once (not in embeds, not when a deep link already opened a card)
  try{if(!document.body.classList.contains('embed')&&!localStorage.getItem('cm_seen_help')){localStorage.setItem('cm_seen_help','1');if(!document.querySelector('#panel.show'))showHelp()}}catch(e){}
  d3.select("#loading").remove();
  d3.json("atlas/hist.json?v="+(window.APP_V||"")).then(h=>{HIST=h}).catch(()=>{});
}).catch(e=>{d3.select("#loading").text(U.loadFail+e)});

function setRegion(r){
  if(!REGIONS[r])return;
  region=r;onRegionChange();window.QEV&&QEV("region",r);svg.transition().duration(900).call(zoom.transform,regionT(r));
  d3.selectAll("#regions button").classed("on",function(){return this.dataset.r===region});
  writeHash();
}
function buildRegionBar(){
  const b=d3.select("#regions");if(b.empty())return;b.html("");
  REGION_KEYS.forEach(k=>b.append("button").attr("data-r",k).classed("on",k===region).text(U.regions[k]).on("click",()=>{stopPlay();setRegion(k)}));
}
function ensureVisible(ll){if(ll&&region!=="world"&&regionOf(ll)!==region){region=regionOf(ll);onRegionChange();d3.selectAll("#regions button").classed("on",function(){return this.dataset.r===region})}}

window.addEventListener("resize",()=>{fit();transform=regionT(region);svg.call(zoom.transform,transform);drawPhysical();renderSnap(true);placeOverlays();buildTimeline()});

function drawPhysical(){
  gLand.selectAll("*").remove();

  gLand.append("path").datum(PHYS.land).attr("class","land").attr("d",path);
  gLand.append("path").datum(PHYS.land).attr("class","land").attr("d",path).attr("filter","url(#paperTex)").style("fill","#e9dcbf");
  gTex.selectAll("*").remove();
  gTex.append("path").datum(PHYS.land).attr("class","coast").attr("d",path);
  gLake.selectAll("path").data(PHYS.lakes.features).join("path").attr("class","lake").attr("d",path);
  gRiv.selectAll("path").data(PHYS.rivers.features).join("path").attr("class","river").attr("d",path);
  // 河流延后加载，不阻塞首屏
  setTimeout(()=>d3.json("geo/rivers.json?v="+(window.APP_V||"")).then(r=>{PHYS.rivers=r;gRiv.selectAll("path").data(r.features).join("path").attr("class","river").attr("d",path)}).catch(()=>{}),300);
}

// ---------- 快照 ----------
function snapFor(y){let s=SNAPS[0];for(const v of SNAPS){if(v<=y)s=v}return s}
function prevSnap(s){const i=SNAPS.indexOf(s);return i>0?SNAPS[i-1]:null}
const labelCache={};
function feats(s){const d=SNAP_DATA[String(s)];return d?d.features:[]}

let wantSnap=null;
function renderSnap(force){
  const s=snapFor(year);
  if(s===curSnap&&!force) return;
  wantSnap=s;
  if(!SNAP_DATA[String(s)]||(layers.ghost&&prevSnap(s)!==null&&!SNAP_DATA[String(prevSnap(s))])||(layers.modern&&!SNAP_DATA["2010"])){
    d3.select("#snapInfo").text("…");
    ensure([s,layers.ghost?prevSnap(s):null,layers.modern?2010:null]).then(()=>{if(wantSnap===s)renderSnap(true)});
    return;
  }
  curSnap=s;window.QEV&&QEV("snap",s);
  const fs=feats(s).filter(f=>f.properties.n&&f.properties.n.trim());
  gPol.selectAll("path.pol").data(fs,d=>d.properties.n).join(
    en=>en.append("path").attr("class",d=>"pol"+(isTribal(d.properties.n)?" tribal":"")).style("fill-opacity",0),
    up=>up, ex=>ex.transition().duration(300).style("fill-opacity",0).remove()
  ).attr("d",path).style("fill",d=>colorOf(d.properties.n))
   .classed("tribal",d=>isTribal(d.properties.n))
   .on("mousemove",(e,d)=>showTip(e,`<b>${esc(zhOf(d.properties.n))}</b> <span class="en">${esc(window.secName(d.properties.n))}</span>`))
   .on("mouseleave",hideTip)
   .on("click",(e,d)=>{if(quiz)return quizClick(e);spotCard(projection.invert(transform.invert(d3.pointer(e,svg.node()))))})
   .transition().duration(350).style("fill-opacity",d=>isTribal(d.properties.n)?.32:.58);
  drawGhost(); drawModern(); buildLegend(fs); computeLabels(s);
  d3.select("#snapInfo").text(fill(U.snap,{y:fmtYFull(s)}));
}

function drawGhost(){
  gGhost.selectAll("*").remove();
  if(!layers.ghost) return;
  const p=prevSnap(curSnap); if(p===null) return;
  if(!SNAP_DATA[String(p)]){ensure([p]).then(drawGhost);return}
  const cur=Object.fromEntries(feats(curSnap).map(f=>[f.properties.n,f.properties.a]));
  const g=feats(p).filter(f=>{const n=f.properties.n;if(!n||!cur[n]||isTribal(n))return false;return Math.abs(cur[n]-f.properties.a)/f.properties.a>.04});
  gGhost.selectAll("path").data(g).join("path").attr("class","ghost").attr("d",path);
}
function drawModern(){
  gModern.selectAll("*").remove();
  if(!layers.modern) return;
  if(!SNAP_DATA["2010"]){ensure([2010]).then(drawModern);return}
  gModern.selectAll("path").data(feats(2010).filter(f=>f.properties.n)).join("path").attr("class","modern").attr("d",path);
}

// ---------- 标签与标注 ----------
function computeLabels(s){
  if(!labelCache[s]){
    labelCache[s]=feats(s).filter(f=>f.properties.n&&f.properties.n.trim()&&f.properties.a>1.2).map(f=>{
      let g=f.geometry, best=g;
      if(g.type==="MultiPolygon"){let ba=-1;for(const c of g.coordinates){const pg={type:"Polygon",coordinates:c};const a=d3.geoArea(pg);if(a>ba){ba=a;best=pg}}}
      const c=path.centroid(best),g0=d3.geoCentroid(best);
      return {n:f.properties.n,a:f.properties.a,c,ll:g0,tribal:isTribal(f.properties.n)};
    }).filter(d=>isFinite(d.c[0]));
  }
  placeOverlays();
}

function nameAt(city,y){let nm=null;for(const n of city.names){if(n[0]<=y)nm=n}return nm}
// 贸易路线图层
function routeOn(r){return layers.routes&&year>=r.y[0]&&year<=r.y[1]}
function drawRoutes(){
  const rs=(window.ROUTES||[]).filter(routeOn);
  gRoute.selectAll("path").data(rs,r=>r.id).join(en=>en.append("path").attr("fill","none").attr("stroke-linecap","round").attr("vector-effect","non-scaling-stroke").style("cursor","pointer").on("click",(e,r)=>{e.stopPropagation();routeCard(r)}).call(p=>p.append("title")))
    .attr("d",r=>path({type:"LineString",coordinates:r.pts.map(p=>[p[0],p[1]])})).attr("stroke",r=>r.col).attr("stroke-width",3.5).attr("stroke-dasharray","9 5").attr("stroke-opacity",.9)
    .select("title").text(r=>`${r.N} · ${fmtY(r.y[0])}–${fmtY(r.y[1])}`);
}
function routeCard(r){
  stopPlay();if(year<r.y[0]||year>r.y[1])setYear(Math.max(-500,Math.round((r.y[0]+r.y[1])/2)));
  if(!layers.routes){layers.routes=true;d3.selectAll(".tbtn[data-t=routes]").classed("on",true)}
  const onSite=/chronicamaps\.com$|vercel\.app$/.test(location.hostname), named=r.pts.filter(p=>p[2]);
  openPanel(`<h2>${esc(r.N)}</h2><div class="latin">${fmtYFull(r.y[0])} – ${fmtYFull(r.y[1])}</div><div class="bio">${esc(r.D)}</div>
  ${onSite?`<p><a href="/en/route/${r.id}">${esc(U.lmPage)}</a></p>`:""}
  <div class="sec">${esc(U.routeStops)}</div><table>${named.map((p,i)=>`<tr><td class="y">${i+1}</td><td><a href="javascript:void 0" data-rp="${r.pts.indexOf(p)}">${esc(p.L)}</a></td></tr>`).join("")}</table>`);
  d3.selectAll("#pbody [data-rp]").on("click",function(){const p=r.pts[+this.dataset.rp];flyTo([p[0],p[1]]);pulse([p[0],p[1]])});
  const xs=r.pts.map(p=>projection([p[0],p[1]]));flyBox(d3.min(xs,p=>p[0]),d3.min(xs,p=>p[1]),d3.max(xs,p=>p[0]),d3.max(xs,p=>p[1]));
  drawRoutes();placeOverlays();lastCard="t-"+r.id;writeHash();window.QEV&&QEV("route",r.id);
}
function placeOverlays(){
  if(!curSnap) return;
  const k=transform.k*SF, T=p=>transform.apply(p);
  drawRoutes();
  {const rs=(window.ROUTES||[]).filter(routeOn).map(r=>{const p=r.pts[Math.floor(r.pts.length/2)];return {r,c:projection([p[0],p[1]])}});
   gRL.selectAll("text").data(rs,d=>d.r.id).join(en=>en.append("text").attr("class","rlabel").style("cursor","pointer").on("click",(e,d)=>{e.stopPropagation();routeCard(d.r)})).attr("transform",d=>`translate(${T(d.c)})`).attr("fill",d=>d.r.col).text(d=>d.r.N);}
  // 政权标签
  const mob=W()<760?3:1;const labs=(labelCache[curSnap]||[]).filter(d=>d.a*k*k>(d.tribal?60:14)*mob&&vis(d.ll));
  const L=gLab.selectAll("text.plabel").data(labs,d=>d.n).join(en=>{const t=en.append("text").attr("class","plabel");t.append("tspan").attr("class","zh");t.append("tspan").attr("class","en").attr("x",0).attr("dy","1.15em");return t});
  L.attr("transform",d=>`translate(${T(d.c)})`).style("opacity",d=>d.tribal?.55:(hoverName&&hoverName!==d.n?.25:1))
   .style("font-size",d=>Math.max(W()<760?8:10,Math.min(26,(5+Math.sqrt(d.a)*1.05)*Math.sqrt(k)*(W()<760?.6:1)))+"px");
  L.select(".zh").text(d=>zhOf(d.n));
  L.select(".en").text(d=>d.a*k*k>120&&!d.tribal?window.secName(d.n):"").style("font-size","0.62em");
  // 城市
  const cs=layers.cities?window.CITIES.filter(c=>{const n=nameAt(c,year);if(!n)return false;if(!vis(c.c))return false;return (c.r===1&&(k>=.55||c.w))||(c.r===2&&k>=1.5)||(c.r===3&&k>=2.4)||(journey||0)}):[];
  const C=gCities.selectAll("g.city").data(cs,d=>d.id).join(en=>{const g=en.append("g").attr("class","city");g.append("circle").attr("r",3.6);const t=g.append("text").attr("x",6).attr("y",4);t.append("tspan").attr("class","zh");t.append("tspan").attr("class","old");return g});
  C.attr("transform",d=>`translate(${T(projection(d.c))})`).classed("cap",d=>d.r===1)
   .on("click",(e,d)=>{e.stopPropagation();if(quiz)return;cityCard(d)})
   .on("mousemove",(e,d)=>{const n=nameAt(d,year);showTip(e,`<b>${esc(d.zh)}</b><br><span class="en">${esc(n[1])}</span>`)}).on("mouseleave",hideTip);
  C.select(".zh").text(d=>d.zh);
  C.select(".old").text(d=>{const n=nameAt(d,year);const lat=n[1].replace(/[\u3000-\u303f\u4e00-\u9fff“”]+/g,"").trim().split(" / ")[0];return k>=1.3&&n!==d.names[d.names.length-1]&&lat!==d.zh?" "+lat:""}).attr("font-size","10px");
  // 战役名胜
  const ss=layers.sites?window.SITES.filter(s=>(s.y<=year+0||Math.abs(s.y-year)<=0)&&vis(s.c)):[];
  const S=gSites.selectAll("g.site").data(ss.filter(s=>k>=1.25||Math.abs(s.y-year)<=30),d=>d.id).join(en=>{const g=en.append("g").attr("class",d=>"site"+(d.k==="site"?" siteK":""));g.append("path").attr("d",d=>d.k==="battle"?"M0,-6 L5,0 L0,6 L-5,0Z":"M-4.5,-4.5h9v9h-9z");g.append("text").attr("x",7).attr("y",4);return g});
  S.attr("transform",d=>`translate(${T(projection(d.c))})`).classed("now",d=>Math.abs(d.y-year)<=15).classed("past",d=>year-d.y>60)
   .on("click",(e,d)=>{e.stopPropagation();if(quiz)return;siteCard(d)})
   .on("mousemove",(e,d)=>showTip(e,`<b>${esc(d.zh)}</b> · ${fmtYFull(d.y)}<br><span class="en">${esc(d.en)}</span>`)).on("mouseleave",hideTip);
  S.select("text").text(d=>Math.abs(d.y-year)<=40||k>=2.2?`${d.zh}·${fmtY(d.y)}`:"");
  // 名胜古迹
  const lms=layers.landmarks&&k>=.6?(window.LANDMARKS||[]).filter(m=>(m.y<=year||k>=2.4)&&vis(m.c)):[];
  const M=gLm.selectAll("g.lm").data(lms,d=>d.id).join(en=>{const g=en.append("g").attr("class",d=>"lm st-"+d.st);g.append("path").attr("d","M-6,1L0,-6L6,1Z M-5,2h10v5h-10Z");g.append("text").attr("x",8).attr("y",4);return g});
  M.attr("transform",d=>`translate(${T(projection(d.c))})`).classed("future",d=>d.y>year)
   .on("click",(e,d)=>{e.stopPropagation();if(quiz)return;landmarkCard(d)})
   .on("mousemove",(e,d)=>showTip(e,`<b>${esc(d.N)}</b>${d.N2?` <span class="en">${esc(d.N2)}</span>`:""}<br>${esc(U.lmStatus[d.st])} · ${esc(d.C)}`)).on("mouseleave",hideTip);
  M.select("text").text(d=>k>=2.2?d.N:"");
  // 行迹
  if(journey){
    gJS.selectAll("g.jstop").attr("transform",d=>`translate(${T(projection(d[2]))})`);
  }
  if(quiz) gQuiz.selectAll("[data-ll]").attr("transform",function(){const ll=JSON.parse(this.dataset.ll);return `translate(${T(projection(ll))})`});
  gQuiz.selectAll("line.qline").each(function(){const a=JSON.parse(this.dataset.a),b=JSON.parse(this.dataset.b);const pa=T(projection(a)),pb=T(projection(b));d3.select(this).attr("x1",pa[0]).attr("y1",pa[1]).attr("x2",pb[0]).attr("y2",pb[1])});
  gPulse.selectAll("circle").attr("cx",function(){return T(projection(JSON.parse(this.dataset.ll)))[0]}).attr("cy",function(){return T(projection(JSON.parse(this.dataset.ll)))[1]});
}

function showTip(e,h){tip.html(h).style("display","block").style("left",(e.clientX+14)+"px").style("top",(e.clientY+12)+"px")}
function hideTip(){tip.style("display","none")}

// ---------- 图例 ----------
function buildLegend(fs){
  fs=fs||feats(curSnap).filter(f=>f.properties.n&&f.properties.n.trim());
  const t=transform,p=makeProj().scale(projection.scale()).translate(projection.translate()).clipExtent([[(0-t.x)/t.k,(0-t.y)/t.k],[(W()-t.x)/t.k,(H()-t.y)/t.k]]),pa=d3.geoPath(p);
  const items=fs.filter(f=>!isTribal(f.properties.n)).map(f=>[f,pa.area(f)]).filter(x=>x[1]>40/t.k/t.k).sort((a,b)=>b[1]-a[1]).slice(0,18).map(x=>x[0]);
  const box=d3.select("#legItems").html("");
  items.forEach(f=>{
    const n=f.properties.n;
    const it=box.append("div").attr("class","it");
    it.append("span").attr("class","sw").style("background",colorOf(n));
    it.append("span").text(zhOf(n));
    it.append("span").attr("class","en").text(window.secName(n));
    it.on("mouseenter",()=>highlight(n)).on("mouseleave",()=>highlight(null)).on("click",()=>{focusFeature(f);polityCard(n)});
  });
}
function highlight(n){hoverName=n;gPol.selectAll("path.pol").classed("dim",d=>n&&d.properties.n!==n).classed("hi",d=>n&&d.properties.n===n);placeOverlays()}
function focusFeature(f){const [[x0,y0],[x1,y1]]=path.bounds(f);flyBox(x0,y0,x1,y1)}
function flyBox(x0,y0,x1,y1){const k=Math.min(8/SF,.8/Math.max((x1-x0)/W(),(y1-y0)/(H()-140)));svg.transition().duration(900).call(zoom.transform,d3.zoomIdentity.translate(W()/2,(H()-120)/2).scale(k).translate(-(x0+x1)/2,-(y0+y1)/2))}
function flyTo(ll,k){ensureVisible(ll);const p=projection(ll);k=Math.max(k||transform.k,(k?2:2.4)/SF);const off=d3.select("#panel").classed("show")&&W()>760?-180:0;svg.transition().duration(900).call(zoom.transform,d3.zoomIdentity.translate(W()/2+off,(H()-120)/2).scale(k).translate(-p[0],-p[1]))}
function pulse(ll){ensureVisible(ll);gPulse.selectAll("*").remove();const c=gPulse.append("circle").attr("class","pulse").attr("data-ll",JSON.stringify(ll)).attr("r",4);placeOverlays();(function rep(){c.attr("r",4).style("opacity",1).transition().duration(1400).attr("r",26).style("opacity",0).on("end",rep)})()}

// ---------- 时间轴 ----------
// 时代与君主随区域切换：欧洲与全球用欧洲时代，其他区域用各自的时代划分
const curEras=()=>(window.REGION_ERAS&&window.REGION_ERAS[region])||window.ERAS;
const REALM_REG={persia:["europe","asia"],mac:["europe","asia"],rome:["europe","africa","world"],byz:["europe","world"],ottoman:["europe","asia","africa","world"],rus:["europe","asia"],eng:["europe","oceania","world"],spain:["europe","americas"],portugal:["europe","americas"],france:["europe","africa"]};
const WORLD_ORDER=["china","rome","byz","caliph","mongol","ottoman","eng","usa"];
function realmsFor(r){
  const list=window.RULERS.filter(R=>(R.reg||REALM_REG[R.k]||["europe"]).includes(r));
  return r==="world"?list.sort((a,b)=>(WORLD_ORDER.indexOf(a.k)+99)%99-(WORLD_ORDER.indexOf(b.k)+99)%99):list;
}
let tlRegion=null;
function onRegionChange(){if(tlRegion!==region){buildTimeline()}}
const eventYears=()=>[...new Set([...window.EVENTS.map(e=>e[0]),...SNAPS])].sort((a,b)=>a-b);
function buildTimeline(){
  const tr=document.getElementById("track"), w=tr.clientWidth;
  const er=d3.select("#eras").html(""), shades=["#e3cfa3","#d9c290"];
  tlRegion=region;
  curEras().forEach((e,i)=>{const x0=tScale(e[0])*w,x1=tScale(e[1])*w;er.append("div").style("left",x0+"px").style("width",(x1-x0)+"px").style("background",shades[i%2]).attr("title",e[2]+U.colon+e[3]).text(x1-x0>46?e[2]:"")});
  const tk=d3.select("#ticks").html("");
  window.EVENTS.forEach(e=>tk.append("i").style("left",tScale(e[0])*w+"px").attr("title",`${fmtYFull(e[0])} · ${e[1]}`).on("click",ev=>{ev.stopPropagation();gotoEvent(e)}));
  const ax=d3.select("#axis").html("");
  [-500,-250,0,250,500,750,1000,1200,1400,1500,1600,1700,1800,1850,1900,1950,2000].forEach(y=>ax.append("span").style("left",tScale(y)*w+"px").text(fmtY(y)));
  setYear(year,true);
}
function xToYear(x){const w=document.getElementById("track").clientWidth;return Math.round(tScale.invert(Math.max(0,Math.min(1,x/w))))}
(function(){const tr=document.getElementById("track");let drag=false;
  const mv=e=>{const r=tr.getBoundingClientRect();setYear(xToYear(e.clientX-r.left))};
  tr.addEventListener("pointerdown",e=>{drag=true;tr.setPointerCapture(e.pointerId);stopPlay();mv(e)});
  tr.addEventListener("pointermove",e=>{if(drag)mv(e)});
  tr.addEventListener("pointerup",()=>{drag=false;writeHash()});
})();

function setYear(y,force){
  y=Math.max(MINY,Math.min(MAXY,Math.round(y)));
  if(y===0) y=year<0?1:-1; // 无公元 0 年
  const changed=y!==year; year=y;window.QEV&&QEV("year",y);
  d3.select("#yearNum").text(U.yBig(y));
  d3.select("#yearEra").text(y<0?U.bc:U.ad);
  d3.select("#knob").style("left",tScale(y)*document.getElementById("track").clientWidth+"px");
  // 君主
  const rs=[];for(const R of realmsFor(region)){for(const r of R.list){if(r[0]<=y&&y<=r[1]){rs.push(`<span class="r">${R.t}${U.colon}<b>${esc(r[2])}</b> <small>${fmtY(r[0])}–${fmtY(r[1])}</small></span>`);break}}}
  d3.select("#rulers").html(rs.slice(0,4).join(""));
  // 时代
  const ER=curEras(),era=ER.find(e=>y>=e[0]&&y<e[1])||ER[ER.length-1];
  const evs=window.EVENTS.filter(e=>e[0]===y);
  d3.select("#era").html(`<b>${era[2]}</b>${evs.length?evs.map(e=>esc(e[1])).join(IS_ZH?"；":"; "):esc(era[3])}`);
  if(ATLAS){renderSnap(force);placeOverlays()}
}
function gotoEvent(e){stopPlay();setYear(e[0]);const ll=e[2]?placeById(e[2]).c:e[3];if(ll){flyTo(ll,Math.max(transform.k,2));pulse(ll)}writeHash()}
function step(dir){
  if(journey){jGo(jIdx+dir);return}
  const ys=eventYears();let t=dir>0?ys.find(v=>v>year):[...ys].reverse().find(v=>v<year);
  if(t===undefined)return;const e=window.EVENTS.find(v=>v[0]===t);
  if(e)gotoEvent(e);else{setYear(t);writeHash()}
}
function togglePlay(){if(journey){if(playing)stopPlay();else{playing=setInterval(()=>{if(jIdx>=journey.stops.length-1)return stopPlay();jGo(jIdx+1)},2600);d3.select("#bPlay").text("❚❚")}return}
  if(playing)return stopPlay();if(year>=MAXY)setYear(MINY);
  playing=setInterval(()=>{const sp=year<0?5:year<1500?4:year<1800?2:1;if(year>=MAXY)return stopPlay();setYear(year+sp)},90);d3.select("#bPlay").text("❚❚")}
function stopPlay(){if(playing){clearInterval(playing);playing=null;writeHash()}d3.select("#bPlay").text("▶")}
d3.select("#bPrev").on("click",()=>step(-1));d3.select("#bNext").on("click",()=>step(1));d3.select("#bPlay").on("click",togglePlay);

// ---------- 卡片 ----------
function showHelp(){const t=U.helpTips||window.UI.en.helpTips;openPanel(`<div class="helpbox"><h2>${U.helpT||"How to use the map"}</h2><ol>${t.map(x=>`<li>${x}</li>`).join("")}</ol><div class="hb"><button type="button" id="helpOk">${U.helpOk||"OK"}</button><a href="/guide" target="_blank" rel="noopener">${U.helpMore||"Guide"} →</a></div></div>`);const b=document.getElementById("helpOk");if(b)b.onclick=()=>closePanel()}
{const hb=document.getElementById("helpBtn");if(hb){hb.title=hb.ariaLabel=U.help||hb.title;hb.onclick=showHelp}}
function openPanel(h){d3.select("#pbody").html(h);d3.select("#panel").classed("show",true).node().scrollTop=0;bindYearLinks()}
window.closePanel=function(){d3.select("#panel").classed("show",false);if(journey)endJourney();writeHash()};
function bindYearLinks(){d3.selectAll("#pbody [data-y]").on("click",function(){const y=+this.dataset.y;stopPlay();setYear(y);if(this.dataset.ll){const ll=JSON.parse(this.dataset.ll);flyTo(ll);pulse(ll)}writeHash()});
  d3.selectAll("#pbody [data-city]").on("click",function(){cityCard(cityById[this.dataset.city])});
  d3.selectAll("#pbody [data-site]").on("click",function(){siteCard(siteById[this.dataset.site])});
  d3.selectAll("#pbody [data-person]").on("click",function(){const p=personById[this.dataset.person];if(p)personCard(p)});
  d3.selectAll("#pbody [data-city]").on("click",function(){const c=cityById[this.dataset.city];if(c)cityCard(c)});}

function polityAt0(ll,s){for(const f of feats(s)){if(f.properties.n&&f.properties.n.trim()&&d3.geoContains(f,ll))return f.properties.n}return null}
function polityAt(ll,s){let n=polityAt0(ll,s);if(n)return n;for(const r of [.1,.2,.35])for(let a=0;a<8;a++){const p=[ll[0]+r*Math.cos(a*Math.PI/4)/Math.cos(ll[1]*Math.PI/180),ll[1]+r*Math.sin(a*Math.PI/4)];n=polityAt0(p,s);if(n)return n}return null}
function history(ll){
  const rows=[];
  for(let i=0;i<SNAPS.length;i++){const s=SNAPS[i];const n=polityAt(ll,s)||"";const last=rows[rows.length-1];if(last&&last.n===n){last.to=SNAPS[i+1]?SNAPS[i+1]-1:MAXY}else rows.push({n,from:s,to:SNAPS[i+1]?SNAPS[i+1]-1:MAXY})}
  return rows;
}
function histRows(h){return h.map((r,i)=>({n:r[0],from:r[1],to:h[i+1]?h[i+1][1]-1:MAXY}))}
function getHistory(ll,key){
  const pre=()=>HIST&&key&&HIST[key]?histRows(HIST[key]):null;
  const r=pre();if(r)return Promise.resolve(r);
  return (key?d3.json("atlas/hist.json?v="+(window.APP_V||"")).then(h=>{HIST=h}).catch(()=>{}):Promise.resolve()).then(()=>pre()||ensureAll().then(()=>history(ll)));
}
let htSeq=0;
function historyTable(ll,key){
  const id="ht"+(++htSeq);
  getHistory(ll,key).then(rows=>{const el=document.getElementById(id);if(el){el.outerHTML=histHTML(rows);bindYearLinks()}});
  return `<div id="${id}"><div class="sec">${U.territory}</div><div style="color:#9a8a6a">…</div></div>`;
}
function histHTML(rows){
  return `<div class="sec">${U.territory}</div><table>${rows.map(r=>`<tr><td class="y" data-y="${r.from}">${fmtY(r.from)}–${r.to>=MAXY?U.now:fmtY(r.to)}</td><td>${r.n?`<span class="sw2" style="background:${colorOf(r.n)}"></span>${esc(zhOf(r.n))} <span class="latin" style="font-size:12px">${esc(window.secName(r.n))}</span>`:`<span style="color:#9a8a6a">${U.noData}</span>`}</td></tr>`).join("")}</table>`;
}
function nearbySites(ll,km){return window.SITES.filter(s=>d3.geoDistance(s.c,ll)*6371<km).sort((a,b)=>a.y-b.y)}
const personById={};(window.PEOPLE||[]).forEach(p=>personById[p.id]=p);
function peopleOf(id){return (window.PEOPLE||[]).filter(p=>p.at.indexOf(id)>=0).sort((a,b)=>a.y[0]-b.y[0])}
function personCard(p){
  stopPlay();
  const cs=p.at.map(id=>cityById[id]).filter(Boolean), ll=p.c||(cs[0]&&cs[0].c);
  const yrs=`${p.ca?"c. ":""}${fmtY(p.y[0])} – ${fmtY(p.y[1])}`;
  openPanel(`<h2>${esc(p.N)}</h2><div class="latin">${p.N2?esc(p.N2)+" · ":""}${esc(p.R)}</div><div class="bio">${esc(p.D)}</div>
  <table><tr><td class="y" data-y="${Math.max(MINY,p.y[0])}"${ll?` data-ll='${JSON.stringify(ll)}'`:""}>${yrs}</td><td>${p.PL?`${U.birthplace||"Birthplace"}${U.colon||": "}${esc(p.PL)}`:""}</td></tr></table>
  ${cs.length?`<div class="sec">${U.places||"Places"}</div><table>${cs.map(c=>`<tr><td><a href="javascript:void 0" data-city="${c.id}">${esc(c.zh)}</a></td></tr>`).join("")}</table>`:""}`);
  setYear(Math.max(MINY,Math.min(p.y[1],p.y[0]+30)));
  if(ll){flyTo(ll);pulse(ll)}lastCard="h-"+p.id;writeHash();window.QEV&&QEV("person",p.id);
}
function cityCard(c){
  stopPlay();
  const cur=nameAt(c,year)||c.names[0];
  const evs=[...c.ev].sort((a,b)=>a[0]-b[0]);
  const ns=nearbySites(c.c,120);
  openPanel(`<h2>${esc(c.zh)}</h2><div class="latin">${esc(cur[1])}</div><div class="bio">${esc(c.bio)}</div>
  <div class="sec">${U.names}</div><table>${c.names.map(n=>`<tr><td class="y" data-y="${Math.max(MINY,n[0])}">${fill(U.since,{y:fmtY(n[0])})}</td><td><b>${esc(n[1])}</b>${n[2]?` · <span style="color:#7a6648">${esc(n[2])}</span>`:""}</td></tr>`).join("")}</table>
  <div class="sec">${U.events}</div><table>${evs.map(e=>`<tr><td class="y" data-y="${Math.max(MINY,e[0])}" data-ll='${JSON.stringify(c.c)}'>${fmtY(e[0])}</td><td>${esc(e[1])}</td></tr>`).join("")}</table>
  ${ns.length?`<div class="sec">${U.nearby}</div><table>${ns.map(s=>`<tr><td class="y" data-y="${s.y}">${fmtY(s.y)}</td><td><a href="javascript:void 0" data-site="${s.id}">${esc(s.zh)}</a></td></tr>`).join("")}</table>`:""}
  ${peopleOf(c.id).length?`<div class="sec">${U.people||"Notable people"}</div><table>${peopleOf(c.id).map(p=>`<tr><td class="y" data-y="${Math.max(MINY,p.y[0])}">${fmtY(p.y[0])}</td><td><a href="javascript:void 0" data-person="${p.id}">${esc(p.N)}</a> · <span style="color:#7a6648">${esc(p.R)}</span></td></tr>`).join("")}</table>`:""}
  ${historyTable(c.c,"c-"+c.id)}`);
  flyTo(c.c);pulse(c.c);lastCard="c-"+c.id;writeHash();window.QEV&&QEV("city",c.id);
}
function lmFig(img,label){
  if(!img)return "";
  const cr=[img.artist,img.license].filter(Boolean).map(esc).join(" · ");
  return `<figure class="lmimg"><div class="lmlabel">${esc(label)}</div><img src="${img.t500}" alt="${esc(label)}" loading="lazy" onerror="this.outerHTML='<div class=&quot;noimg&quot;>${esc(U.lmNoImg)}</div>'"><figcaption>${(img.C||img.cap)?esc(img.C||img.cap)+"<br>":""}${esc(U.lmCredit)}: ${cr} · <a href="${img.page}" target="_blank" rel="noopener">Wikimedia Commons</a></figcaption></figure>`;
}
function landmarkCard(m){
  stopPlay();
  const [c,d]=nearestCity(m.c);
  const onSite=/chronicamaps\.com$|vercel\.app$/.test(location.hostname);
  const near=(window.LANDMARKS||[]).filter(o=>o!==m&&d3.geoDistance(o.c,m.c)*6371<400).slice(0,6);
  openPanel(`<h2>${esc(m.N)}</h2><div class="latin">${esc(m.N2||"")}</div>
  <div class="lmmeta"><span class="lmst st-${m.st}">${esc(U.lmStatus[m.st])}</span> ${esc(U.lmCountry)}: ${esc(m.C)} · <a href="javascript:void 0" data-y="${Math.max(-500,m.y)}">${fmtYFull(m.y)}</a></div>
  <div class="bio">${esc(m.D)}</div>
  ${lmFig(m.img.then,U.lmThen[m.st])}${lmFig(m.img.now,U.lmNow[m.st])}
  ${onSite?`<p><a href="/en/landmark/${m.id}">${esc(U.lmPage)}</a></p>`:""}
  <div class="sec">${esc(U.lmCity)}</div><table><tr><td class="y">${Math.round(d)} ${esc(U.km)}</td><td><a href="javascript:void 0" data-city="${c.id}">${esc(c.zh)}</a></td></tr></table>
  ${near.length?`<div class="sec">${esc(U.lmNear)}</div><div class="lmnear">${near.map(o=>`<a href="javascript:void 0" data-lm="${o.id}">${esc(o.N)}</a>`).join(" · ")}</div>`:""}`);
  d3.selectAll("#pbody [data-lm]").on("click",function(){landmarkCard(window.LANDMARKS.find(x=>x.id===this.dataset.lm))});
  flyTo(m.c);pulse(m.c);lastCard="m-"+m.id;writeHash();window.QEV&&QEV("landmark",m.id);
}
function siteCard(s){
  stopPlay();setYear(s.y);
  openPanel(`<h2>${esc(s.zh)}</h2><div class="latin">${esc(s.en)} · ${fmtYFull(s.y)}</div><div class="bio">${esc(s.d)}</div>${historyTable(s.c,"s-"+s.id)}`);
  flyTo(s.c);pulse(s.c);lastCard="s-"+s.id;writeHash();window.QEV&&QEV("site",s.id);
}
function nearestCity(ll){let best=null,bd=1e9;for(const c of window.CITIES){const d=d3.geoDistance(c.c,ll)*6371;if(d<bd){bd=d;best=c}}return [best,bd]}
function spotCard(ll){
  if(!ll)return;stopPlay();
  const [c,d]=nearestCity(ll);
  if(d<35*(3/Math.max(1,transform.k)))return cityCard(c);
  const n=polityAt(ll,curSnap);window.QEV&&QEV("spot",n);
  openPanel(`<h2>${U.spot}</h2><div class="latin">${Math.abs(ll[1]).toFixed(2)}°${ll[1]<0?"S":"N"}, ${Math.abs(ll[0]).toFixed(2)}°${ll[0]<0?"W":"E"}</div>
   <div class="bio">${fill(U.spotText,{y:fmtYFull(year),p:n?esc(zhOf(n)):U.gap,c:`<a href="javascript:void 0" data-city="${c.id}">${esc(c.zh)}</a>`,d:Math.round(d)})}</div>
   ${(()=>{const ns=nearbySites(ll,150);return ns.length?`<div class="sec">${U.nearby}</div><table>${ns.map(s=>`<tr><td class="y" data-y="${s.y}">${fmtY(s.y)}</td><td><a href="javascript:void 0" data-site="${s.id}">${esc(s.zh)}</a></td></tr>`).join("")}</table>`:""})()}
   ${historyTable(ll)}`);
  pulse(ll);
}
svg.on("dblclick",e=>{if(quiz)return;spotCard(projection.invert(transform.invert(d3.pointer(e))))});
svg.on("click",e=>{if(quiz&&e.target.tagName!=="path")quizClick(e)});
function polityCard(n){
  const AP=IDXA.appear,yrs=(AP[n]||[]).map(i=>SNAPS[i]);
  const L=lineage(n);
  const sameL=L?SNAPS.map((s,i)=>[s,Object.keys(AP).filter(m=>L[3].test(m)&&AP[m].includes(i))]).filter(x=>x[1].length):[];
  openPanel(`<h2>${esc(zhOf(n))}</h2><div class="latin">${esc(window.secName(n))}</div>
  ${L?`<div class="bio">${fill(U.lineage,{l:`<span class="sw2" style="background:${L[2]}"></span><b>${L[1]}</b>`})}</div>`:""}
  <div class="sec">${U.appears}</div><div>${yrs.map(y=>`<span class="chip" data-y="${y}">${fmtY(y)}</span>`).join(" ")}</div>
  ${L&&sameL.length>yrs.length?`<div class="sec">${U.sameL}</div><table>${sameL.map(x=>`<tr><td class="y" data-y="${x[0]}">${fmtY(x[0])}</td><td>${x[1].map(v=>esc(zhOf(v))).join(IS_ZH?"、":", ")}</td></tr>`).join("")}</table>`:""}`);
}

// ---------- 人物行迹 ----------
function journeyMenu(){
  openPanel(`<h2>${U.jTitle}</h2><div class="latin">${U.jSub}</div><div class="bio">${U.jDesc}</div>
  <div class="jlist">${window.JOURNEYS.map(j=>`<div data-j="${j.id}"><b>${esc(j.zh)}</b>${esc(j.span)}<br><span class="latin" style="font-size:13px">${esc(j.who)}</span></div>`).join("")}</div>`);
  d3.selectAll("#pbody [data-j]").on("click",function(){startJourney(this.dataset.j)});
}
function startJourney(id){
  journey=window.JOURNEYS.find(j=>j.id===id);if(!journey)return;window.QEV&&QEV("journey",id);
  d3.selectAll(".tbtn[data-t=journey]").classed("on",true);
  gJ.selectAll("*").remove();gJS.selectAll("*").remove();
  const st=journey.stops;
  ensureVisible(st[0][2]);
  gJ.selectAll("path").data(d3.pairs(st)).join("path").attr("class","jpath").attr("d",p=>path({type:"LineString",coordinates:[p[0][2],p[1][2]]}));
  const g=gJS.selectAll("g.jstop").data(st).join(en=>{const g=en.append("g").attr("class","jstop");g.append("circle").attr("r",6);g.append("text").attr("x",9).attr("y",-6);return g});
  g.select("text").text((d,i)=>`${i+1} ${d[1]}`);g.on("click",(e,d)=>{e.stopPropagation();jGo(st.indexOf(d))});
  const xs=st.map(s=>projection(s[2]));flyBox(d3.min(xs,p=>p[0])-60,d3.min(xs,p=>p[1])-60,d3.max(xs,p=>p[0])+60,d3.max(xs,p=>p[1])+60);
  jIdx=0;renderJourneyPanel();setYear(st[0][0]);placeOverlays();lastCard="p-"+id;writeHash();
}
function renderJourneyPanel(){
  const j=journey;
  openPanel(`<h2>${esc(j.zh)}</h2><div class="latin">${esc(j.who)} · ${esc(j.span)}</div>
  <div class="jnav"><button id="jp">${U.jPrev}</button><span id="jc"></span><button id="jn">${U.jNext}</button></div>
  <div class="jlist">${j.stops.map((s,i)=>`<div data-i="${i}"><b>${fmtY(s[0])}</b><b style="color:#3a2a1a">${esc(s[1])}</b><br>${esc(s[3])}</div>`).join("")}</div>`);
  d3.select("#jp").on("click",()=>jGo(jIdx-1));d3.select("#jn").on("click",()=>jGo(jIdx+1));
  d3.selectAll("#pbody [data-i]").on("click",function(){jGo(+this.dataset.i)});
  jMark();
}
function jMark(){d3.select("#jc").text(`${jIdx+1} / ${journey.stops.length}`);d3.selectAll("#pbody [data-i]").classed("cur",function(){return +this.dataset.i===jIdx});
  gJ.selectAll("path.jpath").classed("cur",(d,i)=>i===jIdx-1);gJS.selectAll("g.jstop").classed("cur",(d,i)=>i===jIdx);
  const el=document.querySelector(`#pbody [data-i="${jIdx}"]`);if(el)el.scrollIntoView({block:"nearest",behavior:"smooth"})}
function jGo(i){if(!journey)return;i=Math.max(0,Math.min(journey.stops.length-1,i));jIdx=i;const s=journey.stops[i];setYear(s[0]);flyTo(s[2],Math.max(transform.k,2.2));pulse(s[2]);jMark()}
function endJourney(){journey=null;gJ.selectAll("*").remove();gJS.selectAll("*").remove();d3.selectAll(".tbtn[data-t=journey]").classed("on",false);stopPlay();placeOverlays()}

// ---------- 古地名小试 ----------
function quizPool(){
  const pool=[];
  window.CITIES.filter(c=>inRegion(c.c)).forEach(c=>{const n=c.names[0];if(n[1].split(" ")[0]!==c.names[c.names.length-1][1].split(" ")[0]||c.names.length===1){const ev=c.ev.find(e=>e[0]>=n[0])||c.ev[0];pool.push({q:n[1],y:Math.max(MINY,ev?ev[0]:n[0]),clue:ev?ev[1]:"",ans:c.zh,c:c.c})}});
  window.SITES.filter(s=>s.y<1900&&inRegion(s.c)).forEach(s=>pool.push({q:s.en&&IS_ZH?`${s.zh}（${s.en}）`:s.zh,y:s.y,clue:s.d,ans:s.zh,c:s.c}));
  return d3.shuffle(pool).slice(0,10);
}
function startQuiz(){
  endJourney();closePanelSilent();quiz={qs:quizPool(),i:0,score:0,pin:null,done:false};document.body.classList.add("quiz");
  d3.selectAll(".tbtn[data-t=quiz]").classed("on",true);svg.transition().duration(700).call(zoom.transform,regionT(region));quizShow();
}
function closePanelSilent(){d3.select("#panel").classed("show",false)}
function quizShow(){
  const q=quiz.qs[quiz.i];gQuiz.selectAll("*").remove();quiz.pin=null;quiz.done=false;setYear(q.y);
  d3.select("#quizBar").style("display","block").html(`<div class="meta">${fill(U.qHead,{i:quiz.i+1,s:quiz.score})}</div><div class="q">${esc(q.q)}</div><div class="clue">${fmtYFull(q.y)} · ${esc(q.clue)}</div><div class="meta">${U.qHint}</div><button id="qok" disabled>${U.qOk}</button><button class="ghostb" id="qquit">${U.qQuit}</button>`);
  d3.select("#qok").on("click",quizReveal);d3.select("#qquit").on("click",endQuiz);
}
function quizClick(e){
  if(!quiz||quiz.done)return;const ll=projection.invert(transform.invert(d3.pointer(e,svg.node())));if(!ll)return;
  quiz.pin=ll;gQuiz.selectAll(".qpin").remove();
  gQuiz.append("g").attr("class","qpin").attr("data-ll",JSON.stringify(ll)).append("path").attr("d","M0,0 C-6,-9 -8,-13 -8,-17 A8,8 0 1,1 8,-17 C8,-13 6,-9 0,0Z");
  d3.select("#qok").attr("disabled",null);placeOverlays();
}
function quizReveal(){
  if(!quiz.pin)return;quiz.done=true;const q=quiz.qs[quiz.i];
  const km=Math.round(d3.geoDistance(quiz.pin,q.c)*6371);const pts=Math.max(0,Math.round(100*Math.exp(-km/450)));quiz.score+=pts;
  [80,200,400].forEach(r=>gQuiz.append("g").attr("data-ll",JSON.stringify(q.c)).append("circle").attr("class","qring").attr("r",r/6371*projection.scale()*transform.k));
  gQuiz.append("line").attr("class","qline").attr("data-a",JSON.stringify(quiz.pin)).attr("data-b",JSON.stringify(q.c));
  gQuiz.append("g").attr("class","qpin qtrue").attr("data-ll",JSON.stringify(q.c)).append("path").attr("d","M0,0 C-6,-9 -8,-13 -8,-17 A8,8 0 1,1 8,-17 C8,-13 6,-9 0,0Z");
  placeOverlays();
  const last=quiz.i===9;
  d3.select("#quizBar").html(`<div class="meta">${fill(U.qNum,{i:quiz.i+1})}</div><div class="q">${esc(q.ans)}</div><div class="clue">${fill(U.qRes,{km,p:pts,s:quiz.score})}</div><button id="qnext">${last?U.qSee:U.qNext}</button><button class="ghostb" id="qquit">${U.qQuit}</button>`);
  d3.select("#qnext").on("click",()=>{if(last)return quizEnd();quiz.i++;quizShow()});d3.select("#qquit").on("click",endQuiz);
}
function quizEnd(){
  const s=quiz.score;const ri=s>=800?0:s>=600?1:s>=380?2:3;const t=[U.ranks[ri],["Cartographus Regius","Geographus Aulicus","Frater Peregrinus","Eques Errans"][ri]];
  d3.select("#quizBar").html(`<div class="meta">${fill(U.qDone,{s})}</div><div class="q">${t[0]}</div><div class="clue latin">${t[1]}</div><button id="qagain">${U.qAgain}</button><button class="ghostb" id="qquit">${U.qQuit}</button>`);
  d3.select("#qagain").on("click",startQuiz);d3.select("#qquit").on("click",endQuiz);
}
function endQuiz(){quiz=null;gQuiz.selectAll("*").remove();d3.select("#quizBar").style("display","none");document.body.classList.remove("quiz");d3.selectAll(".tbtn[data-t=quiz]").classed("on",false);placeOverlays()}

// ---------- 工具按钮 ----------
d3.selectAll(".tbtn").on("click",function(){
  const t=this.dataset.t;
  if(t==="journey"){if(journey){endJourney();closePanelSilent()}else journeyMenu();return}
  if(t==="quiz"){quiz?endQuiz():startQuiz();return}
  layers[t]=!layers[t];d3.select(this).classed("on",layers[t]);window.QEV&&QEV("layer",t);
  if(t==="rivers"){gRiv.style("display",layers.rivers?null:"none");gLake.style("display",layers.rivers?null:"none")}
  if(t==="ghost")drawGhost();if(t==="modern")drawModern();placeOverlays();
});

// ---------- 搜索 ----------
let IDX=null;
function buildIndex(){
  IDX=[];
  window.CITIES.forEach(c=>IDX.push({k:[c.zh,c._k||"",...c.names.map(n=>n[1])].join(" "),label:c.zh,tag:U.tagCity+" · "+c.names[0][1],go:()=>cityCard(c)}));
  (window.LANDMARKS||[]).forEach(m=>IDX.push({k:[m.N,m.N2,m._k].join(" "),label:m.N,tag:`${U.tagLandmark} · ${m.C}`,go:()=>landmarkCard(m)}));
  (window.PEOPLE||[]).forEach(p=>IDX.push({k:[p.N,p._k,p.R].join(" "),label:p.N,tag:`${U.tagPerson||"Person"} · ${fmtY(p.y[0])}–${fmtY(p.y[1])}`,go:()=>personCard(p)}));
  window.SITES.forEach(s=>IDX.push({k:s.zh+" "+(s._k||""),label:s.zh,tag:`${s.k==="battle"?U.tagBattle:U.tagSite} · ${fmtY(s.y)}`,go:()=>siteCard(s)}));
  (window.ROUTES||[]).forEach(r=>IDX.push({k:[r.N,r.n.en,r.n.zh].join(" "),label:r.N,tag:`${U.tagRoute} · ${fmtY(r.y[0])}–${fmtY(r.y[1])}`,go:()=>routeCard(r)}));
  window.JOURNEYS.forEach(j=>IDX.push({k:j.zh+" "+j.who+" "+(j._k||""),label:j.zh,tag:U.tagJourney+" · "+j.span,go:()=>startJourney(j.id)}));
  window.RULERS.forEach(R=>R.list.forEach(r=>IDX.push({k:r[2]+" "+R.t,label:r[2],tag:`${R.t} · ${fmtY(r[0])}–${fmtY(r[1])}`,go:()=>{setYear(r[0]);writeHash()}})));
  window.EVENTS.forEach(e=>IDX.push({k:e[1]+" "+(e._k||""),label:e[1],tag:U.tagEvent+" · "+fmtY(e[0]),go:()=>gotoEvent(e)}));
  window.ERAS.forEach(e=>IDX.push({k:e[2],label:e[2],tag:`${U.tagEra} · ${fmtY(e[0])}–${fmtY(e[1])}`,go:()=>{setYear(e[0]+1);writeHash()}}));
  for(const r in (window.REGION_ERAS||{}))window.REGION_ERAS[r].forEach(e=>IDX.push({k:e[2]+" "+U.regions[r],label:e[2],tag:`${U.tagEra} · ${U.regions[r]} · ${fmtY(e[0])}–${fmtY(e[1])}`,go:()=>{setRegion(r);setYear(e[0]+1);writeHash()}}));
  Object.keys(IDXA.appear).forEach(n=>{if(!n.trim())return;IDX.push({k:zhOf(n)+" "+n+" "+(window.POLITY_ZH[n]||""),label:zhOf(n),tag:U.tagPolity+" · "+window.secName(n),go:()=>{const y=SNAPS[IDXA.appear[n][0]];setYear(y);ensure([y]).then(()=>{const ff=feats(y).find(g=>g.properties.n===n);if(ff){const ll=d3.geoCentroid(ff);ensureVisible(ll);focusFeature(ff)}polityCard(n);writeHash()})}})});
}
function yearQuery(q){const m=q.match(/^(公元前|前|bc|-|ad|公元)?\s*(\d{1,4})\s*(年|bc|b\.c\.|v\.?\s*chr\.?|av\.?\s*j\.?-?c\.?|a\.?\s*c\.?|ad|n\.?\s*chr\.?|apr\.?\s*j\.?-?c\.?|d\.?\s*c\.?)?$/i);if(!m)return null;let y=+m[2];if(/^(公元前|前|bc|-)$/i.test(m[1]||"")||/^(bc|b\.c\.|v|av|a\.?\s*c)/i.test(m[3]||""))y=-y;return y>=MINY&&y<=MAXY?y:null}
let selI=0,cur=[];
const sInput=d3.select("#search");
sInput.on("input",()=>{const q=sInput.property("value").trim().toLowerCase();if(!IDX)buildIndex();const box=d3.select("#results").html("");selI=0;if(!q){cur=[];return}
  cur=[];const y=yearQuery(q);if(y!==null)cur.push({label:fmtYFull(y),tag:U.tagYear,go:()=>{setYear(y);writeHash()}});
  cur.push(...IDX.filter(it=>it.k.toLowerCase().includes(q)).slice(0,14));
  cur.forEach((it,i)=>box.append("div").classed("sel",i===0).html(`<span>${esc(it.label)}</span><span class="tag">${esc(it.tag)}</span>`).on("click",()=>pick(i)));
}).on("keydown",e=>{if(e.key==="Enter"){pick(selI);e.preventDefault()}else if(e.key==="ArrowDown"||e.key==="ArrowUp"){selI=Math.max(0,Math.min(cur.length-1,selI+(e.key==="ArrowDown"?1:-1)));d3.selectAll("#results div").classed("sel",(d,i)=>i===selI);e.preventDefault()}else if(e.key==="Escape"){sInput.property("value","");d3.select("#results").html("");e.target.blur()}});
function pick(i){const it=cur[i];if(!it)return;d3.select("#results").html("");sInput.property("value","");if(quiz)endQuiz();if(journey&&it.tag.indexOf(U.tagJourney)!==0)endJourney();it.go();document.activeElement.blur()}
function buildQuick(){const F=[()=>cityCard(cityById.istanbul),()=>cityCard(cityById.rome),()=>gotoEvent(window.EVENTS.find(e=>e[0]===1453)),()=>startJourney("caesar"),()=>startJourney("napoleon"),()=>siteCard(siteById.waterloo),()=>startQuiz()];const q=U.quick.map((t,i)=>[t,F[i]]);
  const b=d3.select("#quick");q.forEach(([t,f])=>b.append("span").attr("class","chip").text(t).on("click",f))}

// ---------- 键盘 ----------
document.addEventListener("keydown",e=>{
  if(e.target.tagName==="INPUT")return;
  if(e.key==="/"||((e.metaKey||e.ctrlKey)&&e.key==="k")){e.preventDefault();document.getElementById("search").focus();return}
  if(e.key==="ArrowRight"){e.preventDefault();if(e.shiftKey){stopPlay();setYear(year+10);writeHash()}else step(1)}
  else if(e.key==="ArrowLeft"){e.preventDefault();if(e.shiftKey){stopPlay();setYear(year-10);writeHash()}else step(-1)}
  else if(e.key===" "){e.preventDefault();togglePlay()}
  else if(e.key==="Escape"){if(quiz)endQuiz();closePanel();gPulse.selectAll("*").remove();highlight(null)}
});

// ---------- 链接锚点：#y1453 / #yBC52 / #y1415-c-paris / #p-napoleon / #quiz ----------
let lastCard="";
function writeHash(){if(quiz)return;const yh=year<0?`yBC${-year}`:`y${year}`;let h=yh;if(journey)h=`p-${journey.id}`;else if(d3.select("#panel").classed("show")&&lastCard)h+=`-${lastCard}`;if(region!=="europe")h+=`-r-${region}`;if(window.LANG_CODE!=="en")h+=`-l-${window.LANG_CODE}`;try{history_.replaceState(null,"","#"+h)}catch(e){}}
const history_=window.history;
function readHash(){
  const h=decodeURIComponent(location.hash.slice(1));
  let m=h.match(/^y(BC)?(\d+)/);if(m)setYear(m[1]?-m[2]:+m[2],true);else setYear(year,true);
  if(/^quiz/.test(h))return startQuiz();
  m=h.match(/(?:^|-)p-([a-z]+)/);if(m)return startJourney(m[1]);
  m=h.match(/(?:^|-)c-([a-z0-9]+)/);if(m&&cityById[m[1]]){const y=year;cityCard(cityById[m[1]]);setYear(y);return}
  m=h.match(/(?:^|-)m-([a-z0-9-]+?)(?:-[rl]-|$)/);if(m&&window.LANDMARKS){const o=window.LANDMARKS.find(x=>x.id===m[1]);if(o)return landmarkCard(o)}
  m=h.match(/(?:^|-)t-([a-z-]+?)(?:-[rl]-|$)/);if(m&&window.ROUTES){const o=window.ROUTES.find(x=>x.id===m[1]);if(o)return routeCard(o)}
  m=h.match(/(?:^|-)s-([a-z0-9]+)/);if(m&&siteById[m[1]])return siteCard(siteById[m[1]]);
  m=h.match(/(?:^|-)h-([a-z0-9-]+?)(?:-[rl]-|$)/);if(m&&personById[m[1]]){const y=year;personCard(personById[m[1]]);setYear(y);return}
}
window.addEventListener("hashchange",()=>{if(ATLAS)readHash()});
// 对外接口（任务模块使用）
window.APPX={get year(){return year},get region(){return region},get curSnap(){return curSnap},get transform(){return transform},get SNAPS(){return SNAPS},layers,cityById,svg,zoom,gMap,gPol,path,openPanel,closePanelSilent,setRegion,setYear,feats,colorOf,zhOf,isTribal,regionOf,regionT,snapFor,ensure,renderSnap,flyTo,pulse,fmtY,personCard,cityCard,landmarkCard,siteCard};
document.dispatchEvent(new Event("appx"));
})();
