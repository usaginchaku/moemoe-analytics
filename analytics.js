/* Lightweight in-browser analytics for completed 4-axis responses. */
(() => {
  const analyticsButton = document.getElementById('analyticsTabButton');
  const analyticsTab = document.getElementById('analyticsTab');
  const root = document.getElementById('analyticsRoot');
  if(!analyticsButton || !analyticsTab || !root) return;

  const ui = { tagMetric: 'count', voiceMetric: 'count', workMetric: 'count' };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const round1 = n => Math.round(n * 10) / 10;
  const mean = values => values.length ? values.reduce((a,b) => a + b, 0) / values.length : null;
  const axisByKey = key => AXES.find(a => a.key === key);
  const axisLabel = key => axisByKey(key)?.short || key;

  function answered(c, key){
    if(c?.answered && typeof c.answered[key] === 'boolean') return c.answered[key];
    return Number(c?.scores?.[key] ?? 0) !== 0;
  }
  function complete(c){ return AXES.every(a => answered(c, a.key)); }
  function completedCharacters(){ return (state?.characters || []).filter(complete); }
  function characterAverage(c){ return mean(AXES.map(a => Number(c.scores[a.key] || 0))) ?? 0; }
  function axisMean(chars, key){ return mean(chars.map(c => Number(c.scores[key] || 0))) ?? 0; }
  function stddev(values){
    if(!values.length) return 0;
    const m = mean(values);
    return Math.sqrt(mean(values.map(v => (v - m) ** 2)) || 0);
  }
  function pearson(pairs){
    if(pairs.length < 3) return null;
    const xs = pairs.map(p => p[0]), ys = pairs.map(p => p[1]);
    const mx = mean(xs), my = mean(ys);
    let num = 0, dx = 0, dy = 0;
    for(let i=0;i<pairs.length;i++){
      const a = xs[i] - mx, b = ys[i] - my;
      num += a*b; dx += a*a; dy += b*b;
    }
    if(!dx || !dy) return null;
    return num / Math.sqrt(dx*dy);
  }
  function correlationLabel(r){
    if(r === null) return '算出不可';
    const a = Math.abs(r);
    const strength = a >= .6 ? '強め' : a >= .35 ? 'やや' : a >= .15 ? '弱め' : 'ほぼなし';
    if(a < .15) return strength;
    return `${strength}の${r > 0 ? '正' : '負'}相関`;
  }
  function barWidth(value, max){ return max > 0 ? Math.max(2, Math.min(100, value / max * 100)) : 0; }

  function groupBy(chars, getter){
    const map = new Map();
    for(const c of chars){
      const values = getter(c);
      for(const raw of (Array.isArray(values) ? values : [values])){
        const key = String(raw || '').trim();
        if(!key) continue;
        if(!map.has(key)) map.set(key, []);
        map.get(key).push(c);
      }
    }
    return [...map.entries()].map(([name, members]) => ({name, members}));
  }

  function rankingRows(chars, key, limit=10){
    const list = [...chars].sort((a,b) =>
      Number(b.scores[key]) - Number(a.scores[key]) ||
      characterAverage(b) - characterAverage(a) ||
      a.name.localeCompare(b.name, 'ja')
    ).slice(0, limit);
    return list.map((c, i) => `<li class="analytics-rank-row">
      <span class="analytics-rank-no">${i+1}</span>
      <span class="analytics-rank-main"><b>${esc(c.name)}</b><small>${esc(c.work)}</small></span>
      <strong>${c.scores[key]}</strong>
    </li>`).join('');
  }

  function distributionCard(chars, axis){
    const counts = Array.from({length:11}, (_,score) => chars.filter(c => Number(c.scores[axis.key]) === score).length);
    const max = Math.max(1, ...counts);
    return `<section class="analytics-card distribution-card">
      <div class="analytics-card-head"><h3>${esc(axis.label)}</h3><span>平均 ${round1(axisMean(chars, axis.key))}</span></div>
      <div class="histogram" aria-label="${esc(axis.label)}の分布">
        ${counts.map((count, score) => `<div class="hist-col" title="${score}: ${count}人">
          <span class="hist-count">${count || ''}</span>
          <span class="hist-track"><span class="hist-fill" style="height:${count ? Math.max(8, count/max*100) : 0}%"></span></span>
          <span class="hist-label">${score}</span>
        </div>`).join('')}
      </div>
    </section>`;
  }

  function metricValue(group, metric){
    if(metric === 'count') return group.members.length;
    if(metric === 'overall') return mean(group.members.map(characterAverage)) ?? 0;
    return mean(group.members.map(c => Number(c.scores[metric] || 0))) ?? 0;
  }
  function groupRows(groups, metric, {minCount=1, limit=12, showMembers=false}={}){
    let list = groups.filter(g => g.members.length >= minCount);
    list.sort((a,b) => metricValue(b, metric) - metricValue(a, metric) || b.members.length - a.members.length || a.name.localeCompare(b.name,'ja'));
    list = list.slice(0, limit);
    const max = Math.max(1, ...list.map(g => metricValue(g, metric)));
    if(!list.length) return '<p class="analytics-empty">該当データがありません。</p>';
    return `<div class="analytics-bar-list">${list.map(g => {
      const val = metricValue(g, metric), display = metric === 'count' ? `${g.members.length}人` : `${round1(val)} / 10`;
      const members = showMembers ? `<small>${esc(g.members.map(c => c.name).join('、'))}</small>` : `<small>${g.members.length}人</small>`;
      return `<div class="analytics-bar-row">
        <div class="analytics-bar-label"><b>${esc(g.name)}</b>${members}</div>
        <div class="analytics-bar-track"><span style="width:${barWidth(val,max)}%"></span></div>
        <strong>${display}</strong>
      </div>`;
    }).join('')}</div>`;
  }

  function scoreGapRows(chars, mode){
    const calc = c => {
      const s = c.scores;
      if(mode === 'axis-gap') return Math.max(...AXES.map(a => s[a.key])) - Math.min(...AXES.map(a => s[a.key]));
      if(mode === 'mero-sexual') return Math.abs(s.mero - s.sexual);
      if(mode === 'dating-sexual') return Math.abs(s.dating - s.sexual);
      return 0;
    };
    return [...chars].sort((a,b) => calc(b)-calc(a) || characterAverage(b)-characterAverage(a)).slice(0,10).map((c,i) => {
      let detail = '';
      if(mode === 'axis-gap'){
        const ordered = [...AXES].sort((a,b)=>c.scores[b.key]-c.scores[a.key]);
        detail = `${ordered[0].short} ${c.scores[ordered[0].key]} ↔ ${ordered.at(-1).short} ${c.scores[ordered.at(-1).key]}`;
      }else if(mode === 'mero-sexual'){
        detail = `メロ ${c.scores.mero} ↔ 性的魅力 ${c.scores.sexual}`;
      }else{
        detail = `交際 ${c.scores.dating} ↔ 性的魅力 ${c.scores.sexual}`;
      }
      return `<li class="analytics-rank-row"><span class="analytics-rank-no">${i+1}</span><span class="analytics-rank-main"><b>${esc(c.name)}</b><small>${esc(detail)}</small></span><strong>差 ${calc(c)}</strong></li>`;
    }).join('');
  }

  function renderAnalytics(){
    if(typeof state === 'undefined' || !Array.isArray(state.characters)){
      root.innerHTML = '<div class="panel analytics-loading">データを読み込み中です…</div>';
      setTimeout(renderAnalytics, 150);
      return;
    }
    const all = state.characters;
    const chars = completedCharacters();
    const excluded = all.length - chars.length;
    if(!chars.length){
      root.innerHTML = '<div class="panel analytics-loading"><h2>分析できる回答がまだありません</h2><p>4軸すべて回答済みのキャラが1人以上になると分析できます。</p></div>';
      return;
    }

    const axisMeans = AXES.map(a => ({...a, mean: axisMean(chars,a.key), sd: stddev(chars.map(c => Number(c.scores[a.key] || 0)))}));
    const strongest = [...axisMeans].sort((a,b)=>b.mean-a.mean)[0];
    const mostVariable = [...axisMeans].sort((a,b)=>b.sd-a.sd)[0];
    const totalAverage = mean(chars.map(characterAverage)) ?? 0;
    const heights = chars.filter(c => Number.isFinite(Number(c.heightCm)) && Number(c.heightCm) > 0);
    const avgHeight = heights.length ? mean(heights.map(c => Number(c.heightCm))) : null;
    const tags = groupBy(chars, c => c.tags || []);
    const voiceActors = groupBy(chars, c => c.voiceActor || '');
    const works = groupBy(chars, c => c.work || '');

    const heightBuckets = [
      ['〜164cm', h => h < 165],
      ['165〜174cm', h => h >=165 && h <175],
      ['175〜184cm', h => h >=175 && h <185],
      ['185〜194cm', h => h >=185 && h <195],
      ['195cm〜', h => h >=195],
    ].map(([name, test]) => ({name, members: heights.filter(c => test(Number(c.heightCm)))}));

    const heightCorrelations = AXES.map(a => {
      const pairs = heights.map(c => [Number(c.heightCm), Number(c.scores[a.key])]);
      return {...a, r: pearson(pairs), n:pairs.length};
    });

    root.innerHTML = `
      <section class="analytics-overview panel">
        <div class="analytics-section-head"><div><p class="eyebrow">OVERVIEW</p><h2>ざっくり傾向</h2></div><span class="analytics-note">4軸すべて回答済みのみ集計${excluded ? `・未回答あり ${excluded}人は除外` : ''}</span></div>
        <div class="analytics-kpis">
          <div><span>分析対象</span><strong>${chars.length}</strong><small>/ ${all.length}人</small></div>
          <div><span>4軸平均</span><strong>${round1(totalAverage)}</strong><small>/ 10</small></div>
          <div><span>いちばん高い軸</span><strong>${esc(strongest.short)}</strong><small>平均 ${round1(strongest.mean)}</small></div>
          <div><span>平均身長</span><strong>${avgHeight === null ? '—' : round1(avgHeight)}</strong><small>${avgHeight === null ? 'データなし' : `cm・n=${heights.length}`}</small></div>
        </div>
        <div class="analytics-insight-line">ばらつきが大きいのは <b>${esc(mostVariable.short)}</b>（標準偏差 ${round1(mostVariable.sd)}）。キャラによって評価が分かれやすい軸です。</div>
      </section>

      <section class="analytics-section">
        <div class="analytics-section-head"><div><p class="eyebrow">RANKING</p><h2>4軸ランキング</h2></div><span class="analytics-note">各軸 Top 10</span></div>
        <div class="analytics-ranking-grid">
          ${AXES.map((a,i)=>`<details class="analytics-card ranking-card" ${i===0?'open':''}><summary><span>${esc(a.label)}</span><b>平均 ${round1(axisMean(chars,a.key))}</b></summary><ol>${rankingRows(chars,a.key,10)}</ol></details>`).join('')}
        </div>
      </section>

      <section class="analytics-section">
        <div class="analytics-section-head"><div><p class="eyebrow">DISTRIBUTION</p><h2>スコア分布</h2></div><span class="analytics-note">0〜10の人数分布</span></div>
        <div class="distribution-grid">${AXES.map(a=>distributionCard(chars,a)).join('')}</div>
      </section>

      <section class="analytics-section analytics-two-col">
        <section class="analytics-card">
          <div class="analytics-card-head stack-mobile"><div><p class="eyebrow">TAGS</p><h2>タグ傾向</h2></div>
            <select id="tagMetricSelect" class="analytics-select">
              <option value="count" ${ui.tagMetric==='count'?'selected':''}>出現数</option>
              <option value="overall" ${ui.tagMetric==='overall'?'selected':''}>4軸平均</option>
              ${AXES.map(a=>`<option value="${a.key}" ${ui.tagMetric===a.key?'selected':''}>${esc(a.short)}平均</option>`).join('')}
            </select>
          </div>
          <p class="analytics-note">タグは手入力データなので、表記揺れ・付け方の偏りも含みます。</p>
          ${groupRows(tags, ui.tagMetric, {minCount: ui.tagMetric==='count'?1:2, limit:14})}
        </section>

        <section class="analytics-card">
          <div class="analytics-card-head stack-mobile"><div><p class="eyebrow">VOICE ACTOR</p><h2>声優傾向</h2></div>
            <select id="voiceMetricSelect" class="analytics-select">
              <option value="count" ${ui.voiceMetric==='count'?'selected':''}>担当キャラ数</option>
              <option value="overall" ${ui.voiceMetric==='overall'?'selected':''}>4軸平均</option>
              ${AXES.map(a=>`<option value="${a.key}" ${ui.voiceMetric===a.key?'selected':''}>${esc(a.short)}平均</option>`).join('')}
            </select>
          </div>
          <p class="analytics-note">比較しやすいよう、2キャラ以上いる声優を優先表示。</p>
          ${groupRows(voiceActors, ui.voiceMetric, {minCount:2, limit:12, showMembers:true})}
        </section>
      </section>

      <section class="analytics-section analytics-two-col">
        <section class="analytics-card">
          <div class="analytics-card-head"><div><p class="eyebrow">HEIGHT</p><h2>身長傾向</h2></div><span>${heights.length}人分</span></div>
          <h3 class="analytics-subtitle">身長帯別の4軸平均</h3>
          ${groupRows(heightBuckets, 'overall', {minCount:1, limit:10})}
          <div class="height-correlation-grid">
            ${heightCorrelations.map(x=>`<div><span>${esc(x.short)}</span><strong>${x.r===null?'—':x.r.toFixed(2)}</strong><small>${esc(correlationLabel(x.r))}</small></div>`).join('')}
          </div>
          <p class="analytics-note">相関はこの入力データ内だけの記述統計です。人数が少ないため「傾向のヒント」程度に。</p>
        </section>

        <section class="analytics-card">
          <div class="analytics-card-head stack-mobile"><div><p class="eyebrow">WORKS</p><h2>作品別傾向</h2></div>
            <select id="workMetricSelect" class="analytics-select">
              <option value="count" ${ui.workMetric==='count'?'selected':''}>登録人数</option>
              <option value="overall" ${ui.workMetric==='overall'?'selected':''}>4軸平均</option>
              ${AXES.map(a=>`<option value="${a.key}" ${ui.workMetric===a.key?'selected':''}>${esc(a.short)}平均</option>`).join('')}
            </select>
          </div>
          ${groupRows(works, ui.workMetric, {minCount: ui.workMetric==='count'?1:2, limit:14})}
        </section>
      </section>

      <section class="analytics-section">
        <div class="analytics-section-head"><div><p class="eyebrow">GAP ANALYSIS</p><h2>「好き」のズレを見る</h2></div><span class="analytics-note">4軸が一致しないキャラほど面白い</span></div>
        <div class="analytics-gap-grid">
          <section class="analytics-card"><h3>軸差が大きいキャラ</h3><p class="analytics-note">4軸の最高点−最低点</p><ol>${scoreGapRows(chars,'axis-gap')}</ol></section>
          <section class="analytics-card"><h3>メロ ↔ 性的魅力</h3><p class="analytics-note">恋愛的にメロるか、性的に刺さるかのズレ</p><ol>${scoreGapRows(chars,'mero-sexual')}</ol></section>
          <section class="analytics-card"><h3>交際 ↔ 性的魅力</h3><p class="analytics-note">付き合いたいと性的に刺さるは別物</p><ol>${scoreGapRows(chars,'dating-sexual')}</ol></section>
        </div>
      </section>
    `;

    document.getElementById('tagMetricSelect')?.addEventListener('change', e => { ui.tagMetric = e.target.value; renderAnalytics(); });
    document.getElementById('voiceMetricSelect')?.addEventListener('change', e => { ui.voiceMetric = e.target.value; renderAnalytics(); });
    document.getElementById('workMetricSelect')?.addEventListener('change', e => { ui.workMetric = e.target.value; renderAnalytics(); });
  }

  function showAnalytics(){
    document.getElementById('analyzeTab')?.setAttribute('hidden','');
    document.getElementById('helpTab')?.setAttribute('hidden','');
    document.getElementById('analyzeTab')?.classList.remove('active');
    document.getElementById('helpTab')?.classList.remove('active');
    document.getElementById('analyzeTabButton')?.classList.remove('active');
    document.getElementById('helpTabButton')?.classList.remove('active');
    document.getElementById('analyzeTabButton')?.setAttribute('aria-selected','false');
    document.getElementById('helpTabButton')?.setAttribute('aria-selected','false');
    analyticsTab.hidden = false;
    analyticsTab.classList.add('active');
    analyticsButton.classList.add('active');
    analyticsButton.setAttribute('aria-selected','true');
    renderAnalytics();
    window.scrollTo({top:0, behavior:'smooth'});
  }
  function hideAnalytics(){
    analyticsTab.hidden = true;
    analyticsTab.classList.remove('active');
    analyticsButton.classList.remove('active');
    analyticsButton.setAttribute('aria-selected','false');
  }

  analyticsButton.addEventListener('click', showAnalytics);
  document.getElementById('analyzeTabButton')?.addEventListener('click', hideAnalytics, true);
  document.getElementById('helpTabButton')?.addEventListener('click', hideAnalytics, true);
  window.renderMoemoeAnalytics = renderAnalytics;
})();