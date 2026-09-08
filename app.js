const AXES = [
  { key: "character", label: "キャラとして好き", short: "キャラ愛" },
  { key: "mero", label: "メロつきたい", short: "メロ" },
  { key: "dating", label: "付き合いたい", short: "交際" },
  { key: "sexual", label: "性的に刺さる（成人版）", short: "性的魅力" },
];
const STORAGE_KEY = "moemoe-analytics-v1";
const $ = id => document.getElementById(id);
const state = { characters: [], baseCharacters: [], selectedId: null };

function uid(){return "ch_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,8)}
function clamp10(v){
  let n=Number(v);
  if(!Number.isFinite(n)) n=0;
  if(n>10) n=Math.round(n/10);
  return Math.max(0,Math.min(10,Math.round(n)));
}
function normalizeCharacter(c={}){
  const scores={}; AXES.forEach(a=>scores[a.key]=clamp10(c?.scores?.[a.key]));
  return {id:c.id||uid(),name:String(c.name||"名称未設定"),work:String(c.work||"作品未設定"),tags:Array.isArray(c.tags)?c.tags.map(String):[],imageUrl:String(c.imageUrl||""),notes:String(c.notes||""),scores,updatedAt:c.updatedAt||new Date().toISOString()};
}
function current(){return state.characters.find(c=>c.id===state.selectedId)||null}
function avg(c){
  const v=AXES.reduce((s,a)=>s+c.scores[a.key],0)/AXES.length;
  return Math.round(v*10)/10;
}
function touch(c){c.updatedAt=new Date().toISOString();persist()}
function persist(){localStorage.setItem(STORAGE_KEY,JSON.stringify({characters:state.characters,selectedId:state.selectedId}))}

async function loadInitial(){
  try{
    const res=await fetch("./characters.json",{cache:"no-store"});
    const json=await res.json();
    state.baseCharacters=(Array.isArray(json)?json:(json.characters||[])).map(normalizeCharacter);
  }catch(e){console.warn(e);state.baseCharacters=[]}
  const saved=localStorage.getItem(STORAGE_KEY);
  if(saved){
    try{
      const x=JSON.parse(saved);
      state.characters=(x.characters||[]).map(normalizeCharacter);
      state.selectedId=x.selectedId||null;
      persist();
    }catch(e){state.characters=structuredClone(state.baseCharacters)}
  } else state.characters=structuredClone(state.baseCharacters);
  if(!state.characters.some(c=>c.id===state.selectedId)) state.selectedId=state.characters[0]?.id||null;
  renderAll();
}

function filteredCharacters(){
  const q=$("searchInput").value.trim().toLowerCase(), work=$("workFilter").value, sort=$("sortSelect").value;
  let list=state.characters.filter(c=>!work||c.work===work).filter(c=>!q||[c.name,c.work,...c.tags,c.notes].join(" ").toLowerCase().includes(q));
  const byName=(a,b)=>a.name.localeCompare(b.name,"ja");
  if(sort==="work") list.sort((a,b)=>a.work.localeCompare(b.work,"ja")||byName(a,b));
  else if(sort==="avg-desc") list.sort((a,b)=>avg(b)-avg(a)||byName(a,b));
  else if(sort==="mero-desc") list.sort((a,b)=>b.scores.mero-a.scores.mero||byName(a,b));
  else if(sort==="date-desc") list.sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)));
  else list.sort(byName);
  return list;
}
function renderFilters(){
  const old=$("workFilter").value;
  const works=[...new Set(state.characters.map(c=>c.work))].sort((a,b)=>a.localeCompare(b,"ja"));
  $("workFilter").innerHTML='<option value="">すべての作品</option>'+works.map(w=>`<option>${escapeHtml(w)}</option>`).join("");
  if(works.includes(old)) $("workFilter").value=old;
}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}
function renderList(){
  const list=filteredCharacters();
  $("countLabel").textContent=`${list.length}人`;
  $("characterList").innerHTML=list.map(c=>`<button class="char-card ${c.id===state.selectedId?"active":""}" data-id="${c.id}"><span class="name">${escapeHtml(c.name)}</span><span class="meta"><span>${escapeHtml(c.work)}</span><span>平均 ${avg(c)}</span></span>${c.tags.length?`<span class="tags">${escapeHtml(c.tags.join(" / "))}</span>`:""}<span class="meter"><span style="width:${avg(c)*10}%"></span></span></button>`).join("")||'<p class="hint">該当キャラなし</p>';
  $("characterList").querySelectorAll("[data-id]").forEach(b=>b.addEventListener("click",()=>{
    state.selectedId=b.dataset.id;
    persist();
    renderAll();
    if(window.matchMedia("(max-width: 980px)").matches) $("characterPicker").removeAttribute("open");
  }));
}
function radarPoint(i,value,radius=150){
  const angle=-Math.PI/2+i*(Math.PI*2/4), r=radius*(value/10), cx=220, cy=220;
  return [cx+Math.cos(angle)*r,cy+Math.sin(angle)*r];
}
function renderRadar(c){
  const svg=$("radarChart"), cx=220, cy=220, R=150; let html="";
  [2.5,5,7.5,10].forEach(level=>{const pts=AXES.map((_,i)=>radarPoint(i,level,R).join(",")).join(" ");html+=`<polygon class="radar-grid" points="${pts}"/>`});
  AXES.forEach((a,i)=>{const [x,y]=radarPoint(i,10,R);html+=`<line class="radar-axis" x1="${cx}" y1="${cy}" x2="${x}" y2="${y}"/>`});
  const shape=AXES.map((a,i)=>radarPoint(i,c.scores[a.key],R).join(",")).join(" "); html+=`<polygon class="radar-shape" points="${shape}"/>`;
  AXES.forEach((a,i)=>{const [x,y]=radarPoint(i,c.scores[a.key],R);const [lx,ly]=radarPoint(i,11.8,R);let anchor="middle";if(i===1)anchor="start";if(i===3)anchor="end";html+=`<circle class="radar-dot" cx="${x}" cy="${y}" r="5"/><text class="radar-label" x="${lx}" y="${ly}" text-anchor="${anchor}">${a.short}</text><text class="radar-value" x="${lx}" y="${ly+18}" text-anchor="${anchor}">${c.scores[a.key]}</text>`});
  svg.innerHTML=html;
}
function typeLabel(c){
  const s=c.scores;
  if(Math.max(...Object.values(s))<2.5)return "未評価";
  if(s.mero>=7.5&&s.sexual>=7.5)return "メロ×性的魅力";
  if(s.dating>=7.5&&s.mero>=6.5)return "恋愛本命";
  if(s.character>=8&&s.mero<6)return "キャラ愛強め";
  const max=AXES.reduce((best,a)=>s[a.key]>s[best.key]?a:best,AXES[0]);return `${max.short}強め`;
}
function renderControls(c){
  $("scoreControls").innerHTML=AXES.map(a=>`<div class="score-row"><div class="score-row-head"><strong>${a.label}</strong><output id="out-${a.key}">${c.scores[a.key]}</output></div><input type="range" min="0" max="10" step="1" value="${c.scores[a.key]}" data-score="${a.key}" /></div>`).join("");
  $("scoreControls").querySelectorAll("[data-score]").forEach(input=>input.addEventListener("input",()=>{c.scores[input.dataset.score]=clamp10(input.value);$("out-"+input.dataset.score).textContent=input.value;touch(c);renderRadar(c);renderSummary(c);renderList();renderJson(c)}));
}
function renderSummary(c){
  $("avgScore").textContent=avg(c);
  const max=AXES.reduce((best,a)=>c.scores[a.key]>c.scores[best.key]?a:best,AXES[0]);
  $("maxAxis").textContent=`${max.short} ${c.scores[max.key]}`; $("typeLabel").textContent=typeLabel(c);
}
function renderJson(c){$("jsonPreview").textContent=JSON.stringify(c,null,2)}
function renderImage(c){
  const wrap=$("imagePreviewWrap"), img=$("characterImage"), err=$("imageError");
  const url=c.imageUrl.trim();
  if(!url){
    wrap.classList.add("hidden");
    img.removeAttribute("src");
    err.classList.add("hidden");
    return;
  }
  wrap.classList.remove("hidden");
  err.classList.add("hidden");
  img.alt=`${c.name} の画像`;
  img.onload=()=>err.classList.add("hidden");
  img.onerror=()=>err.classList.remove("hidden");
  img.src=url;
}
function bindField(id,key,transform=v=>v){
  const el=$(id); el.oninput=()=>{const c=current();if(!c)return;c[key]=transform(el.value);touch(c);renderAll()};
}
function renderDetail(){
  const c=current(); $("emptyState").classList.toggle("hidden",!!c); $("detailView").classList.toggle("hidden",!c); if(!c)return;
  $("workLabel").textContent=c.work;$("nameLabel").textContent=c.name;$("nameInput").value=c.name;$("workInput").value=c.work;$("tagsInput").value=c.tags.join(", ");$("imageInput").value=c.imageUrl;$("notesInput").value=c.notes;
  renderImage(c);renderRadar(c);renderSummary(c);renderControls(c);renderJson(c);
}
function renderAll(){renderFilters();renderList();renderDetail()}

bindField("nameInput","name");
bindField("workInput","work");
bindField("tagsInput","tags",v=>v.split(/[,、]/).map(s=>s.trim()).filter(Boolean));
bindField("imageInput","imageUrl");
bindField("notesInput","notes");
["searchInput","workFilter","sortSelect"].forEach(id=>$(id).addEventListener(id==="searchInput"?"input":"change",renderList));

$("addBtn").addEventListener("click",()=>{$("addName").value="";$("addWork").value="";$("addDialog").showModal();setTimeout(()=>$("addName").focus(),20)});
$("addSubmit").addEventListener("click",e=>{e.preventDefault();if(!$("addName").value.trim()||!$("addWork").value.trim())return;const c=normalizeCharacter({name:$("addName").value.trim(),work:$("addWork").value.trim()});state.characters.push(c);state.selectedId=c.id;persist();$("addDialog").close();renderAll()});
$("duplicateBtn").addEventListener("click",()=>{const c=current();if(!c)return;const copy=normalizeCharacter({...structuredClone(c),id:uid(),name:c.name+"（コピー）",updatedAt:new Date().toISOString()});state.characters.push(copy);state.selectedId=copy.id;persist();renderAll()});
$("deleteBtn").addEventListener("click",()=>{const c=current();if(!c||!confirm(`${c.name} を削除しますか？`))return;state.characters=state.characters.filter(x=>x.id!==c.id);state.selectedId=state.characters[0]?.id||null;persist();renderAll()});
$("resetBtn").addEventListener("click",()=>{if(!confirm("ブラウザ内の編集内容を破棄して characters.json の初期状態に戻しますか？"))return;state.characters=structuredClone(state.baseCharacters);state.selectedId=state.characters[0]?.id||null;persist();renderAll()});
$("exportBtn").addEventListener("click",()=>{const blob=new Blob([JSON.stringify({version:2,scale:10,characters:state.characters},null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="moemoe-analytics-characters.json";a.click();URL.revokeObjectURL(a.href)});
$("importInput").addEventListener("change",async e=>{const f=e.target.files?.[0];if(!f)return;try{const json=JSON.parse(await f.text());const arr=Array.isArray(json)?json:json.characters;if(!Array.isArray(arr))throw new Error("characters 配列がありません");state.characters=arr.map(normalizeCharacter);state.selectedId=state.characters[0]?.id||null;persist();renderAll()}catch(err){alert("JSONを読み込めませんでした: "+err.message)}finally{e.target.value=""}});

function switchTab(name){
  const analyze=name==="analyze";
  $("analyzeTab").hidden=!analyze;
  $("helpTab").hidden=analyze;
  $("analyzeTab").classList.toggle("active",analyze);
  $("helpTab").classList.toggle("active",!analyze);
  document.querySelectorAll("[data-tab]").forEach(b=>{
    const active=b.dataset.tab===name;
    b.classList.toggle("active",active);
    b.setAttribute("aria-selected",String(active));
  });
  window.scrollTo({top:0,behavior:"smooth"});
}
document.querySelectorAll("[data-tab]").forEach(b=>b.addEventListener("click",()=>switchTab(b.dataset.tab)));

loadInitial();
