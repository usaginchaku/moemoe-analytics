const AXES = [
  { key: "character", label: "キャラとして好き", short: "キャラ愛" },
  { key: "mero", label: "メロつきたい", short: "メロ" },
  { key: "dating", label: "付き合いたい", short: "交際" },
  { key: "sexual", label: "性的に刺さる（成人版）", short: "性的魅力" },
];

const STORAGE_KEY = "moemoe-analytics-v1";
const CATALOG_VERSION = 2;
const $ = id => document.getElementById(id);
const state = { characters: [], baseCharacters: [], selectedId: null };

const NAME_ALIASES = {
  "キルア＝ゾルディック（成人版）": "キルア＝ゾルディック",
  "クラピカ（成人版）": "クラピカ",
  "東方仗助（成人版）": "東方仗助",
  "ジョセフ・ジョースター（2部）": "ジョセフ・ジョースター",
  "蔵馬（南野秀一）": "蔵馬",
  "シルヴァン": "シルヴァン＝ジョゼ＝ゴーティエ",
  "フェリクス": "フェリクス＝ユーゴ＝フラルダリウス",
};

function uid(){
  return "ch_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
}

function clamp10(v){
  let n = Number(v);
  if(!Number.isFinite(n)) n = 0;
  if(n > 10) n = Math.round(n / 10);
  return Math.max(0, Math.min(10, Math.round(n)));
}

function canonicalName(name){
  const raw = String(name || "").trim();
  if(NAME_ALIASES[raw]) return NAME_ALIASES[raw];
  return raw.replace(/（成人版）/g, "").replace(/\(成人版\)/g, "").trim();
}

function numOrNull(v){
  if(v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function normalizeCharacter(c = {}){
  const scores = {};
  AXES.forEach(a => scores[a.key] = clamp10(c?.scores?.[a.key]));
  return {
    id: c.id || uid(),
    name: canonicalName(c.name || "名称未設定"),
    work: String(c.work || "作品未設定"),
    series: String(c.series || ""),
    tags: Array.isArray(c.tags) ? c.tags.map(String) : [],
    imageUrl: String(c.imageUrl || ""),
    notes: String(c.notes || ""),
    scores,
    favorite: Boolean(c.favorite),
    heightCm: numOrNull(c.heightCm),
    heightText: String(c.heightText || ""),
    heightSource: String(c.heightSource || ""),
    voiceActor: String(c.voiceActor || ""),
    updatedAt: c.updatedAt || new Date().toISOString(),
  };
}

function mergeTags(a = [], b = []){
  return [...new Set([...a, ...b].filter(Boolean))];
}

function enrichSaved(saved, base){
  if(!base) return saved;
  return {
    ...saved,
    tags: mergeTags(saved.tags, base.tags),
    favorite: saved.favorite || base.favorite,
    series: saved.series || base.series,
    heightCm: saved.heightCm ?? base.heightCm,
    heightText: saved.heightText || base.heightText,
    heightSource: saved.heightSource || base.heightSource,
    voiceActor: saved.voiceActor || base.voiceActor,
  };
}

function mergeBaseIntoSaved(savedCharacters, baseCharacters){
  const baseMap = new Map(baseCharacters.map(c => [canonicalName(c.name), c]));
  const seen = new Set();
  const merged = savedCharacters.map(raw => {
    const saved = normalizeCharacter(raw);
    const key = canonicalName(saved.name);
    seen.add(key);
    return enrichSaved(saved, baseMap.get(key));
  });
  for(const base of baseCharacters){
    const key = canonicalName(base.name);
    if(!seen.has(key)){
      merged.push(structuredClone(base));
      seen.add(key);
    }
  }
  return merged;
}

function current(){
  return state.characters.find(c => c.id === state.selectedId) || null;
}

function avg(c){
  const v = AXES.reduce((s, a) => s + c.scores[a.key], 0) / AXES.length;
  return Math.round(v * 10) / 10;
}

function touch(c){
  c.updatedAt = new Date().toISOString();
  persist();
}

function persist(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    catalogVersion: CATALOG_VERSION,
    characters: state.characters,
    selectedId: state.selectedId,
  }));
}

async function loadInitial(){
  try{
    const res = await fetch("./characters.json", { cache: "no-store" });
    const json = await res.json();
    state.baseCharacters = (Array.isArray(json) ? json : (json.characters || [])).map(normalizeCharacter);
  }catch(e){
    console.warn(e);
    state.baseCharacters = [];
  }

  const saved = localStorage.getItem(STORAGE_KEY);
  if(saved){
    try{
      const x = JSON.parse(saved);
      const savedCharacters = (x.characters || []).map(normalizeCharacter);
      if((x.catalogVersion || 1) < CATALOG_VERSION){
        state.characters = mergeBaseIntoSaved(savedCharacters, state.baseCharacters);
      }else{
        state.characters = savedCharacters;
      }
      state.selectedId = x.selectedId || null;
      persist();
    }catch(e){
      console.warn(e);
      state.characters = structuredClone(state.baseCharacters);
    }
  }else{
    state.characters = structuredClone(state.baseCharacters);
  }

  if(!state.characters.some(c => c.id === state.selectedId)){
    state.selectedId = state.characters[0]?.id || null;
  }
  renderAll();
}

function filteredCharacters(){
  const q = $("searchInput").value.trim().toLowerCase();
  const work = $("workFilter").value;
  const sort = $("sortSelect").value;

  let list = state.characters
    .filter(c => !work || c.work === work)
    .filter(c => {
      if(!q) return true;
      return [c.name, c.work, c.series, ...c.tags, c.notes, c.voiceActor, c.heightText]
        .join(" ").toLowerCase().includes(q);
    });

  const byName = (a, b) => a.name.localeCompare(b.name, "ja");
  if(sort === "work"){
    list.sort((a, b) => a.work.localeCompare(b.work, "ja") || byName(a, b));
  }else if(sort === "avg-desc"){
    list.sort((a, b) => avg(b) - avg(a) || byName(a, b));
  }else if(sort === "mero-desc"){
    list.sort((a, b) => b.scores.mero - a.scores.mero || byName(a, b));
  }else if(sort === "height-desc"){
    list.sort((a, b) => (b.heightCm ?? -1) - (a.heightCm ?? -1) || byName(a, b));
  }else if(sort === "height-asc"){
    list.sort((a, b) => (a.heightCm ?? 9999) - (b.heightCm ?? 9999) || byName(a, b));
  }else if(sort === "date-desc"){
    list.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  }else{
    list.sort(byName);
  }
  return list;
}

function renderFilters(){
  const old = $("workFilter").value;
  const works = [...new Set(state.characters.map(c => c.work))].sort((a, b) => a.localeCompare(b, "ja"));
  $("workFilter").innerHTML = '<option value="">すべての作品</option>' + works.map(w => `<option>${escapeHtml(w)}</option>`).join("");
  if(works.includes(old)) $("workFilter").value = old;
}

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, m => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
}

function renderList(){
  const list = filteredCharacters();
  $("countLabel").textContent = `${list.length}人`;
  $("characterList").innerHTML = list.map(c => {
    const sub = [c.voiceActor ? `CV ${c.voiceActor}` : "", c.heightCm ? `${c.heightCm}cm` : ""].filter(Boolean).join(" / ");
    return `<button class="char-card ${c.id === state.selectedId ? "active" : ""}" data-id="${escapeHtml(c.id)}">
      <span class="name">${escapeHtml(c.name)}</span>
      <span class="meta"><span>${escapeHtml(c.work)}</span><span>平均 ${avg(c)}</span></span>
      ${sub ? `<span class="tags">${escapeHtml(sub)}</span>` : ""}
      ${c.tags.length ? `<span class="tags">${escapeHtml(c.tags.join(" / "))}</span>` : ""}
      <span class="meter"><span style="width:${avg(c) * 10}%"></span></span>
    </button>`;
  }).join("") || '<p class="hint">該当キャラなし</p>';

  $("characterList").querySelectorAll("[data-id]").forEach(b => b.addEventListener("click", () => {
    state.selectedId = b.dataset.id;
    persist();
    renderAll();
    if(window.matchMedia("(max-width: 980px)").matches) $("characterPicker").removeAttribute("open");
  }));
}

function radarPoint(i, value, radius = 150){
  const angle = -Math.PI / 2 + i * (Math.PI * 2 / 4), r = radius * (value / 10), cx = 220, cy = 220;
  return [cx + Math.cos(angle) * r, cy + Math.sin(angle) * r];
}

function renderRadar(c){
  const svg = $("radarChart"), cx = 220, cy = 220, R = 150;
  let html = "";
  [2.5, 5, 7.5, 10].forEach(level => {
    const pts = AXES.map((_, i) => radarPoint(i, level, R).join(",")).join(" ");
    html += `<polygon class="radar-grid" points="${pts}"/>`;
  });
  AXES.forEach((a, i) => {
    const [x, y] = radarPoint(i, 10, R);
    html += `<line class="radar-axis" x1="${cx}" y1="${cy}" x2="${x}" y2="${y}"/>`;
  });
  const shape = AXES.map((a, i) => radarPoint(i, c.scores[a.key], R).join(",")).join(" ");
  html += `<polygon class="radar-shape" points="${shape}"/>`;
  AXES.forEach((a, i) => {
    const [x, y] = radarPoint(i, c.scores[a.key], R), [lx, ly] = radarPoint(i, 11.8, R);
    let anchor = "middle"; if(i === 1) anchor = "start"; if(i === 3) anchor = "end";
    html += `<circle class="radar-dot" cx="${x}" cy="${y}" r="5"/><text class="radar-label" x="${lx}" y="${ly}" text-anchor="${anchor}">${a.short}</text><text class="radar-value" x="${lx}" y="${ly + 18}" text-anchor="${anchor}">${c.scores[a.key]}</text>`;
  });
  svg.innerHTML = html;
}

function typeLabel(c){
  const s = c.scores, values = AXES.map(a => s[a.key]);
  if(values.every(v => v === 0)) return "未評価";
  const high = AXES.filter(a => s[a.key] >= 8).map(a => a.key), has = (...keys) => keys.every(k => high.includes(k));
  if(values.every(v => v === 10)) return "完全どストライク";
  if(values.every(v => v >= 9)) return "全方位どストライク";
  if(values.every(v => v >= 8)) return "全方位本命";
  if(high.length === 3){
    if(has("character","mero","dating")) return "推し兼恋愛本命";
    if(has("character","mero","sexual")) return "推し×メロ×性的魅力";
    if(has("character","dating","sexual")) return "推し兼理想の恋人";
    if(has("mero","dating","sexual")) return "リアコ×性的魅力";
  }
  if(high.length === 2){
    if(has("character","mero")) return "推しメロ";
    if(has("character","dating")) return "推し兼恋人候補";
    if(has("character","sexual")) return "推し×性的魅力";
    if(has("mero","dating")) return "恋愛本命";
    if(has("mero","sexual")) return "メロ×性的魅力";
    if(has("dating","sexual")) return "交際×性的魅力";
  }
  if(high.length === 1) return ({character:"キャラ愛特化",mero:"メロ特化",dating:"交際本命",sexual:"性的魅力特化"})[high[0]];
  const ranked = [...AXES].sort((a,b) => s[b.key] - s[a.key]), top = ranked[0], second = ranked[1];
  if(s[top.key] === s[second.key] && s[top.key] > 0) return `${top.short}・${second.short}寄り`;
  if(s[top.key] >= 5) return `${top.short}強め`;
  if(values.filter(v => v > 0).length === 4 && Math.max(...values) <= 4) return "全体的に控えめ";
  return `${top.short}寄り`;
}

function renderControls(c){
  $("scoreControls").innerHTML = AXES.map(a => `<div class="score-row"><div class="score-row-head"><strong>${a.label}</strong><output id="out-${a.key}">${c.scores[a.key]}</output></div><input type="range" min="0" max="10" step="1" value="${c.scores[a.key]}" data-score="${a.key}" /></div>`).join("");
  $("scoreControls").querySelectorAll("[data-score]").forEach(input => input.addEventListener("input", () => {
    c.scores[input.dataset.score] = clamp10(input.value); $("out-" + input.dataset.score).textContent = input.value;
    touch(c); renderRadar(c); renderSummary(c); renderList(); renderJson(c);
  }));
}

function renderSummary(c){
  $("avgScore").textContent = avg(c);
  const maxScore = Math.max(...AXES.map(a => c.scores[a.key])), maxAxes = AXES.filter(a => c.scores[a.key] === maxScore);
  if(maxScore === 0) $("maxAxis").textContent = "—";
  else if(maxAxes.length === 4) $("maxAxis").textContent = `全軸 ${maxScore}`;
  else $("maxAxis").textContent = `${maxAxes.map(a => a.short).join("・")} ${maxScore}`;
  $("typeLabel").textContent = typeLabel(c);
}

function renderProfileMeta(c){
  const chips = [];
  if(c.heightText) chips.push(`<span><b>身長</b>${escapeHtml(c.heightText)}</span>`);
  else if(c.heightCm) chips.push(`<span><b>身長</b>${escapeHtml(c.heightCm)}cm</span>`);
  if(c.voiceActor) chips.push(`<span><b>CV</b>${escapeHtml(c.voiceActor)}</span>`);
  if(c.series) chips.push(`<span><b>区分</b>${escapeHtml(c.series)}</span>`);
  $("profileMeta").innerHTML = chips.join("");
  $("profileMeta").classList.toggle("hidden", chips.length === 0);
}

function renderJson(c){ $("jsonPreview").textContent = JSON.stringify(c, null, 2); }

function resolveImageUrl(raw){
  const value = String(raw || "").trim(); if(!value) return "";
  try{
    const u = new URL(value);
    if(u.hostname.toLowerCase().endsWith(".fandom.com")){
      const file = u.searchParams.get("file");
      if(file){
        const wikiPos = u.pathname.indexOf("/wiki/"), prefix = wikiPos >= 0 ? u.pathname.slice(0, wikiPos) : "";
        return `${u.origin}${prefix}/wiki/Special:Redirect/file/${encodeURIComponent(file).replace(/%2F/gi, "/")}`;
      }
      const decodedPath = decodeURIComponent(u.pathname), fileMatch = decodedPath.match(/\/wiki\/(?:File:|ファイル:)(.+)$/i);
      if(fileMatch){
        const wikiPos = u.pathname.indexOf("/wiki/"), prefix = wikiPos >= 0 ? u.pathname.slice(0, wikiPos) : "";
        return `${u.origin}${prefix}/wiki/Special:Redirect/file/${encodeURIComponent(fileMatch[1]).replace(/%2F/gi, "/")}`;
      }
    }
  }catch(e){ console.warn("画像URLを解釈できません", e); }
  return value;
}

function renderImage(c){
  const wrap = $("imagePreviewWrap"), img = $("characterImage"), err = $("imageError"), rawUrl = c.imageUrl.trim();
  if(!rawUrl){ wrap.classList.add("hidden"); img.removeAttribute("src"); err.classList.add("hidden"); return; }
  const displayUrl = resolveImageUrl(rawUrl);
  wrap.classList.remove("hidden"); err.classList.add("hidden"); img.alt = `${c.name} の画像`; img.referrerPolicy = "no-referrer";
  img.onload = () => err.classList.add("hidden"); img.onerror = () => err.classList.remove("hidden"); img.src = displayUrl;
}

function bindField(id, key, transform = v => v){
  const el = $(id); el.oninput = () => { const c = current(); if(!c) return; c[key] = transform(el.value); touch(c); renderAll(); };
}

function renderDetail(){
  const c = current(); $("emptyState").classList.toggle("hidden", !!c); $("detailView").classList.toggle("hidden", !c); if(!c) return;
  $("workLabel").textContent = c.work; $("nameLabel").textContent = c.name; $("nameInput").value = c.name; $("workInput").value = c.work;
  $("seriesInput").value = c.series; $("tagsInput").value = c.tags.join(", "); $("imageInput").value = c.imageUrl;
  $("heightCmInput").value = c.heightCm ?? ""; $("heightTextInput").value = c.heightText; $("voiceActorInput").value = c.voiceActor; $("notesInput").value = c.notes;
  renderProfileMeta(c); renderImage(c); renderRadar(c); renderSummary(c); renderControls(c); renderJson(c);
}
function renderAll(){ renderFilters(); renderList(); renderDetail(); }

bindField("nameInput", "name", canonicalName); bindField("workInput", "work"); bindField("seriesInput", "series");
bindField("tagsInput", "tags", v => v.split(/[,、]/).map(s => s.trim()).filter(Boolean)); bindField("imageInput", "imageUrl");
bindField("heightCmInput", "heightCm", numOrNull); bindField("heightTextInput", "heightText"); bindField("voiceActorInput", "voiceActor"); bindField("notesInput", "notes");
["searchInput", "workFilter", "sortSelect"].forEach(id => $(id).addEventListener(id === "searchInput" ? "input" : "change", renderList));

$("addBtn").addEventListener("click", () => { $("addName").value = ""; $("addWork").value = ""; $("addDialog").showModal(); setTimeout(() => $("addName").focus(), 20); });
$("addSubmit").addEventListener("click", e => { e.preventDefault(); if(!$("addName").value.trim() || !$("addWork").value.trim()) return; const c = normalizeCharacter({name:$("addName").value.trim(),work:$("addWork").value.trim()}); state.characters.push(c); state.selectedId = c.id; persist(); $("addDialog").close(); renderAll(); });
$("duplicateBtn").addEventListener("click", () => { const c = current(); if(!c) return; const copy = normalizeCharacter({...structuredClone(c),id:uid(),name:c.name+"（コピー）",updatedAt:new Date().toISOString()}); state.characters.push(copy); state.selectedId = copy.id; persist(); renderAll(); });
$("deleteBtn").addEventListener("click", () => { const c = current(); if(!c || !confirm(`${c.name} を削除しますか？`)) return; state.characters = state.characters.filter(x => x.id !== c.id); state.selectedId = state.characters[0]?.id || null; persist(); renderAll(); });
$("resetBtn").addEventListener("click", () => { if(!confirm("ブラウザ内の編集内容を破棄して characters.json の初期状態に戻しますか？")) return; state.characters = structuredClone(state.baseCharacters); state.selectedId = state.characters[0]?.id || null; persist(); renderAll(); });
$("exportBtn").addEventListener("click", () => { const blob = new Blob([JSON.stringify({version:3,scale:10,characters:state.characters},null,2)],{type:"application/json"}); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "moemoe-analytics-characters.json"; a.click(); URL.revokeObjectURL(a.href); });
$("importInput").addEventListener("change", async e => { const f = e.target.files?.[0]; if(!f) return; try{ const json = JSON.parse(await f.text()), arr = Array.isArray(json)?json:json.characters; if(!Array.isArray(arr)) throw new Error("characters 配列がありません"); state.characters = arr.map(normalizeCharacter); state.selectedId = state.characters[0]?.id || null; persist(); renderAll(); }catch(err){ alert("JSONを読み込めませんでした: "+err.message); }finally{ e.target.value = ""; } });

function switchTab(name){
  const analyze = name === "analyze"; $("analyzeTab").hidden = !analyze; $("helpTab").hidden = analyze; $("analyzeTab").classList.toggle("active", analyze); $("helpTab").classList.toggle("active", !analyze);
  document.querySelectorAll("[data-tab]").forEach(b => { const active = b.dataset.tab === name; b.classList.toggle("active", active); b.setAttribute("aria-selected", String(active)); });
  window.scrollTo({top:0,behavior:"smooth"});
}
document.querySelectorAll("[data-tab]").forEach(b => b.addEventListener("click", () => switchTab(b.dataset.tab)));
loadInitial();
