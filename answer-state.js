/* Separate answer state from numeric scores so 0 can be a valid answer. */
(() => {
  const originalNormalizeCharacter = normalizeCharacter;
  const originalFilteredCharacters = filteredCharacters;
  const originalTypeLabel = typeLabel;

  function inferredAnswered(raw, key){
    if(raw?.answered && typeof raw.answered[key] === "boolean") return raw.answered[key];
    // Legacy data had no answer-state flag. Non-zero values were definitely answered;
    // legacy zero cannot be distinguished from the former "unanswered" sentinel.
    return Number(raw?.scores?.[key] ?? 0) !== 0;
  }

  normalizeCharacter = function(c = {}){
    const normalized = originalNormalizeCharacter(c);
    normalized.answered = {};
    AXES.forEach(a => normalized.answered[a.key] = inferredAnswered(c, a.key));
    return normalized;
  };

  function ensureAnswerState(c){
    if(!c) return c;
    if(!c.answered || typeof c.answered !== "object") c.answered = {};
    AXES.forEach(a => {
      if(typeof c.answered[a.key] !== "boolean"){
        c.answered[a.key] = Number(c?.scores?.[a.key] ?? 0) !== 0;
      }
    });
    return c;
  }

  function answerCount(c){
    ensureAnswerState(c);
    return AXES.filter(a => c.answered[a.key]).length;
  }

  function isAnswered(c){
    return answerCount(c) === AXES.length;
  }

  function answeredAxes(c){
    ensureAnswerState(c);
    return AXES.filter(a => c.answered[a.key]);
  }

  avg = function(c){
    const axes = answeredAxes(c);
    if(!axes.length) return 0;
    const v = axes.reduce((sum, a) => sum + c.scores[a.key], 0) / axes.length;
    return Math.round(v * 10) / 10;
  };

  filteredCharacters = function(){
    let list = originalFilteredCharacters();
    const filter = document.getElementById("answerFilter")?.value || "";
    if(filter === "answered") list = list.filter(isAnswered);
    if(filter === "unanswered") list = list.filter(c => !isAnswered(c));
    return list;
  };

  renderList = function(){
    const list = filteredCharacters();
    $("countLabel").textContent = `${list.length}人`;
    $("characterList").innerHTML = list.map(c => {
      ensureAnswerState(c);
      const count = answerCount(c);
      const status = count === AXES.length ? "回答済み" : `未回答 ${count}/4`;
      const sub = [c.voiceActor ? `CV ${c.voiceActor}` : "", c.heightCm ? `${c.heightCm}cm` : ""].filter(Boolean).join(" / ");
      return `<button class="char-card ${c.id === state.selectedId ? "active" : ""}" data-id="${escapeHtml(c.id)}">
        <span class="name">${escapeHtml(c.name)}</span>
        <span class="meta"><span>${escapeHtml(c.work)}</span><span>${escapeHtml(status)}</span></span>
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
  };

  renderRadar = function(c){
    ensureAnswerState(c);
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
    const shape = AXES.map((a, i) => radarPoint(i, c.answered[a.key] ? c.scores[a.key] : 0, R).join(",")).join(" ");
    html += `<polygon class="radar-shape" points="${shape}"/>`;
    AXES.forEach((a, i) => {
      const value = c.answered[a.key] ? c.scores[a.key] : 0;
      const displayValue = c.answered[a.key] ? String(c.scores[a.key]) : "—";
      const [x, y] = radarPoint(i, value, R), [lx, ly] = radarPoint(i, 11.8, R);
      let anchor = "middle";
      if(i === 1) anchor = "start";
      if(i === 3) anchor = "end";
      html += `<circle class="radar-dot" cx="${x}" cy="${y}" r="5"/><text class="radar-label" x="${lx}" y="${ly}" text-anchor="${anchor}">${a.short}</text><text class="radar-value" x="${lx}" y="${ly + 18}" text-anchor="${anchor}">${displayValue}</text>`;
    });
    svg.innerHTML = html;
  };

  typeLabel = function(c){
    ensureAnswerState(c);
    const count = answerCount(c);
    if(count < AXES.length) return `未回答 ${count}/4`;
    const values = AXES.map(a => c.scores[a.key]);
    if(values.every(v => v === 0)) return "全軸0";
    return originalTypeLabel(c);
  };

  renderSummary = function(c){
    ensureAnswerState(c);
    const axes = answeredAxes(c);
    $("avgScore").textContent = axes.length ? avg(c) : "—";

    if(!axes.length){
      $("maxAxis").textContent = "—";
    }else{
      const maxScore = Math.max(...axes.map(a => c.scores[a.key]));
      const maxAxes = axes.filter(a => c.scores[a.key] === maxScore);
      if(maxAxes.length === AXES.length) $("maxAxis").textContent = `全軸 ${maxScore}`;
      else $("maxAxis").textContent = `${maxAxes.map(a => a.short).join("・")} ${maxScore}`;
    }
    $("typeLabel").textContent = typeLabel(c);
  };

  function refreshScoreViews(c){
    touch(c);
    renderRadar(c);
    renderSummary(c);
    renderList();
    renderJson(c);
  }

  renderControls = function(c){
    ensureAnswerState(c);
    $("scoreControls").innerHTML = AXES.map(a => {
      const answered = c.answered[a.key];
      const output = answered ? c.scores[a.key] : "未回答";
      return `<div class="score-row ${answered ? "" : "unanswered"}" data-score-row="${a.key}">
        <div class="score-row-head">
          <strong>${a.label}</strong>
          <div class="score-answer-head"><output id="out-${a.key}">${output}</output><button type="button" class="unanswer-btn ${answered ? "" : "hidden"}" data-unanswer="${a.key}">未回答に戻す</button></div>
        </div>
        <input type="range" min="0" max="10" step="1" value="${c.scores[a.key]}" data-score="${a.key}" aria-label="${a.label}" />
      </div>`;
    }).join("");

    $("scoreControls").querySelectorAll("[data-score]").forEach(input => {
      const key = input.dataset.score;
      const markAnswered = () => {
        if(c.answered[key]) return;
        c.answered[key] = true;
        const row = $("scoreControls").querySelector(`[data-score-row="${key}"]`);
        row?.classList.remove("unanswered");
        const out = $("out-" + key);
        if(out) out.textContent = String(c.scores[key]);
        row?.querySelector("[data-unanswer]")?.classList.remove("hidden");
        refreshScoreViews(c);
      };

      input.addEventListener("pointerdown", markAnswered);
      input.addEventListener("keydown", e => {
        if(["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Home","End","PageUp","PageDown"].includes(e.key)) markAnswered();
      });
      input.addEventListener("input", () => {
        c.answered[key] = true;
        c.scores[key] = clamp10(input.value);
        const out = $("out-" + key);
        if(out) out.textContent = String(c.scores[key]);
        const row = $("scoreControls").querySelector(`[data-score-row="${key}"]`);
        row?.classList.remove("unanswered");
        row?.querySelector("[data-unanswer]")?.classList.remove("hidden");
        refreshScoreViews(c);
      });
    });

    $("scoreControls").querySelectorAll("[data-unanswer]").forEach(button => {
      button.addEventListener("click", () => {
        const key = button.dataset.unanswer;
        c.answered[key] = false;
        c.scores[key] = 0;
        renderControls(c);
        refreshScoreViews(c);
      });
    });
  };

  function migrateCurrentState(){
    let changed = false;
    for(const c of state.characters){
      if(!c.answered || AXES.some(a => typeof c.answered[a.key] !== "boolean")){
        ensureAnswerState(c);
        changed = true;
      }
    }
    for(const c of state.baseCharacters) ensureAnswerState(c);
    if(changed) persist();
  }

  const answerFilter = document.getElementById("answerFilter");
  if(answerFilter) answerFilter.addEventListener("change", renderList);

  // Help text / editor hint are updated here as a safety net for cached HTML.
  document.querySelectorAll(".editor-panel > .hint").forEach(el => {
    el.textContent = "0〜10で評価。未回答は数値とは別に管理します。0も正式な回答です。スライダーに触れると回答済みになり、『未回答に戻す』で解除できます。";
  });

  const sync = () => {
    migrateCurrentState();
    if(state.characters.length) renderAll();
  };
  setTimeout(sync, 0);
  window.addEventListener("load", sync, { once:true });
})();