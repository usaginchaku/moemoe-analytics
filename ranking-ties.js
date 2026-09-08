/* Make analytics rankings tie-aware: equal scores share a rank, and cutoff ties are included. */
(() => {
  const root = document.getElementById('analyticsRoot');
  if(!root) return;

  const esc = value => String(value ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const mean = values => values.length ? values.reduce((a,b) => a + b, 0) / values.length : 0;
  const characterAverage = c => mean(AXES.map(a => Number(c?.scores?.[a.key] ?? 0)));
  const answered = (c, key) => c?.answered && typeof c.answered[key] === 'boolean'
    ? c.answered[key]
    : Number(c?.scores?.[key] ?? 0) !== 0;
  const complete = c => AXES.every(a => answered(c, a.key));
  const completedCharacters = () => (typeof state !== 'undefined' && Array.isArray(state.characters))
    ? state.characters.filter(complete)
    : [];

  function withCutoffTies(sorted, valueFn, limit = 10){
    if(sorted.length <= limit) return sorted;
    const cutoff = valueFn(sorted[limit - 1]);
    return sorted.filter(item => valueFn(item) >= cutoff);
  }

  function competitionRankRows(list, valueFn, rowHtml){
    let previousValue = null;
    let rank = 0;
    return list.map((item, index) => {
      const value = valueFn(item);
      if(index === 0 || value !== previousValue) rank = index + 1;
      previousValue = value;
      return rowHtml(item, rank, value);
    }).join('');
  }

  function patchAxisRankings(chars){
    const cards = [...root.querySelectorAll('.ranking-card')];
    if(!cards.length || cards.every(card => card.dataset.tieRanks === '1')) return;

    AXES.forEach((axis, index) => {
      const card = cards[index];
      const ol = card?.querySelector('ol');
      if(!card || !ol) return;

      const valueFn = c => Number(c.scores[axis.key] ?? 0);
      const sorted = [...chars].sort((a,b) =>
        valueFn(b) - valueFn(a) ||
        characterAverage(b) - characterAverage(a) ||
        a.name.localeCompare(b.name, 'ja')
      );
      const list = withCutoffTies(sorted, valueFn, 10);
      ol.innerHTML = competitionRankRows(list, valueFn, (c, rank) => `<li class="analytics-rank-row">
        <span class="analytics-rank-no">${rank}</span>
        <span class="analytics-rank-main"><b>${esc(c.name)}</b><small>${esc(c.work)}</small></span>
        <strong>${valueFn(c)}</strong>
      </li>`);
      card.dataset.tieRanks = '1';
    });

    const note = [...root.querySelectorAll('.analytics-section-head .analytics-note')]
      .find(el => el.textContent.trim() === '各軸 Top 10');
    if(note) note.textContent = '各軸 Top 10（同点は同順位・10位同点を含む）';
  }

  function gapValue(c, mode){
    const s = c.scores;
    if(mode === 'axis-gap') return Math.max(...AXES.map(a => Number(s[a.key] ?? 0))) - Math.min(...AXES.map(a => Number(s[a.key] ?? 0)));
    if(mode === 'mero-sexual') return Math.abs(Number(s.mero ?? 0) - Number(s.sexual ?? 0));
    if(mode === 'dating-sexual') return Math.abs(Number(s.dating ?? 0) - Number(s.sexual ?? 0));
    return 0;
  }

  function gapDetail(c, mode){
    if(mode === 'axis-gap'){
      const ordered = [...AXES].sort((a,b) => Number(c.scores[b.key]) - Number(c.scores[a.key]));
      const hi = ordered[0], lo = ordered.at(-1);
      return `${hi.short} ${c.scores[hi.key]} ↔ ${lo.short} ${c.scores[lo.key]}`;
    }
    if(mode === 'mero-sexual') return `メロ ${c.scores.mero} ↔ 性的魅力 ${c.scores.sexual}`;
    return `交際 ${c.scores.dating} ↔ 性的魅力 ${c.scores.sexual}`;
  }

  function patchGapRankings(chars){
    const cards = [...root.querySelectorAll('.analytics-gap-grid .analytics-card')];
    const modes = ['axis-gap', 'mero-sexual', 'dating-sexual'];
    cards.forEach((card, index) => {
      if(card.dataset.tieRanks === '1') return;
      const ol = card.querySelector('ol');
      const mode = modes[index];
      if(!ol || !mode) return;

      const valueFn = c => gapValue(c, mode);
      const sorted = [...chars].sort((a,b) =>
        valueFn(b) - valueFn(a) ||
        characterAverage(b) - characterAverage(a) ||
        a.name.localeCompare(b.name, 'ja')
      );
      const list = withCutoffTies(sorted, valueFn, 10);
      ol.innerHTML = competitionRankRows(list, valueFn, (c, rank, value) => `<li class="analytics-rank-row">
        <span class="analytics-rank-no">${rank}</span>
        <span class="analytics-rank-main"><b>${esc(c.name)}</b><small>${esc(gapDetail(c, mode))}</small></span>
        <strong>差 ${value}</strong>
      </li>`);
      card.dataset.tieRanks = '1';
    });
  }

  function patch(){
    const chars = completedCharacters();
    if(!chars.length) return;
    patchAxisRankings(chars);
    patchGapRankings(chars);
  }

  const observer = new MutationObserver(() => queueMicrotask(patch));
  observer.observe(root, {childList:true, subtree:true});
  document.getElementById('analyticsTabButton')?.addEventListener('click', () => setTimeout(patch, 0));
  window.addEventListener('load', patch, {once:true});
})();
